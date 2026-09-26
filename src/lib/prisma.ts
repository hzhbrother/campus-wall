// Prisma Client 单例 (避免 dev 热重载与 serverless 实例化时连接耗尽)
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// 处理 PgBouncer 事务模式下 "prepared statement already exists" 错误
// 自动给 DATABASE_URL 追加 pgbouncer=true (若尚未设置)
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || '';
  if (!url) return url;
  // 已有 pgbouncer=true 则不重复添加
  if (/[?&]pgbouncer=true/i.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}pgbouncer=true`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: { url: getDatabaseUrl() },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
