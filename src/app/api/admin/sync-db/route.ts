// GET /api/admin/sync-db  运行时同步数据库结构 (补全枚举值 + 创建缺失的表)
// Vercel 构建时无法连接数据库跑 db push, 部署后由管理员调用此接口同步
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server-auth';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

// AccountProvider 枚举的全部值 (与 schema.prisma 保持一致)
const ALL_PROVIDERS = [
  'LOCAL', 'GITHUB', 'GITEE', 'GOOGLE', 'WECHAT', 'QQ', 'WEIBO',
  'HUAWEI', 'XIAOMI', 'ALIPAY', 'BAIDU', 'DOUYIN', 'BILIBILI',
  'FEISHU', 'DINGTALK', 'FACEBOOK', 'TWITTER', 'TELEGRAM',
];

// 需要创建的表 (与 schema.prisma 保持一致)
const TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS "QuickLink" (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ShopItem" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image TEXT,
    "pointsCost" INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT -1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ExchangeRecord" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    "fulfillmentType" TEXT,
    "fulfillmentInfo" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  // 兼容旧表: 补充新增列
  `ALTER TABLE "ExchangeRecord" ADD COLUMN IF NOT EXISTS "fulfillmentType" TEXT`,
  `ALTER TABLE "ExchangeRecord" ADD COLUMN IF NOT EXISTS "fulfillmentInfo" TEXT`,
  `ALTER TABLE "ExchangeRecord" ADD COLUMN IF NOT EXISTS "fulfilledAt" TIMESTAMP(3)`,
  `CREATE TABLE IF NOT EXISTS "WishItem" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    description TEXT NOT NULL,
    image TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "PointsLog" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    amount INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    reason TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

const INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS "ExchangeRecord_userId_idx" ON "ExchangeRecord"("userId")`,
  `CREATE INDEX IF NOT EXISTS "ExchangeRecord_itemId_idx" ON "ExchangeRecord"("itemId")`,
  `CREATE INDEX IF NOT EXISTS "WishItem_userId_idx" ON "WishItem"("userId")`,
  `CREATE INDEX IF NOT EXISTS "WishItem_status_idx" ON "WishItem"("status")`,
  `CREATE INDEX IF NOT EXISTS "WishItem_createdAt_idx" ON "WishItem"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "PointsLog_userId_idx" ON "PointsLog"("userId")`,
  `CREATE INDEX IF NOT EXISTS "PointsLog_createdAt_idx" ON "PointsLog"("createdAt")`,
];

export async function GET(req: NextRequest) {
  await requireRole(req, UserRole.ADMIN, UserRole.SUPER_ADMIN);

  const result: { enums: string[]; tables: string[]; errors: string[] } = {
    enums: [],
    tables: [],
    errors: [],
  };

  // 1. 补全 AccountProvider 枚举值
  for (const value of ALL_PROVIDERS) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "AccountProvider" ADD VALUE IF NOT EXISTS '${value}'`
      );
      result.enums.push(value);
    } catch (e: any) {
      // 并发或已存在时忽略
      result.errors.push(`enum ${value}: ${e?.message || 'unknown'}`);
    }
  }

  // 2. 创建缺失的表
  for (const sql of TABLES_SQL) {
    try {
      await prisma.$executeRawUnsafe(sql);
      const match = sql.match(/CREATE TABLE IF NOT EXISTS "(\w+)"/);
      result.tables.push(match ? match[1] : 'table');
    } catch (e: any) {
      result.errors.push(`table: ${e?.message || 'unknown'}`);
    }
  }

  // 3. 创建索引
  for (const sql of INDEXES_SQL) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e: any) {
      result.errors.push(`index: ${e?.message || 'unknown'}`);
    }
  }

  return NextResponse.json(result);
}
