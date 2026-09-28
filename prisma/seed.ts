// 数据库初始化 seed: 创建超级管理员 + 默认勋章 (幂等, 可重复运行)
import { PrismaClient, UserRole, PostStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// 系统默认勋章 (管理员仍可在后台编辑名称/图标/阈值/启停; seed 只在缺失时补建, 不覆盖已有修改)
const DEFAULT_BADGES = [
  // 发帖/评论/获赞类
  { name: '发帖达人',   description: '累计发布 10 篇帖子',     icon: '✍️', conditionType: 'POST_COUNT',    threshold: 10 },
  { name: '发帖狂人',   description: '累计发布 50 篇帖子',     icon: '📝', conditionType: 'POST_COUNT',    threshold: 50 },
  { name: '评论达人',   description: '累计发布 50 条评论',     icon: '💬', conditionType: 'COMMENT_COUNT', threshold: 50 },
  { name: '人气王',     description: '累计获得 100 个赞',      icon: '❤️', conditionType: 'LIKE_COUNT',    threshold: 100 },
  // 签到类 (与 CheckInView.tsx 的 REWARD_RULES 对应)
  { name: '签到新手',   description: '连续签到 7 天',          icon: '🌱', conditionType: 'CHECKIN_DAYS',   threshold: 7 },
  { name: '签到达人',   description: '连续签到 30 天',         icon: '🔥', conditionType: 'CHECKIN_DAYS',   threshold: 30 },
  { name: '签到狂魔',   description: '连续签到 100 天',       icon: '💯', conditionType: 'CHECKIN_DAYS',   threshold: 100 },
  { name: '签到之神',   description: '连续签到 365 天',       icon: '👑', conditionType: 'CHECKIN_DAYS',   threshold: 365 },
  // 积分类
  { name: '积分新星',   description: '累计获得 100 积分',      icon: '⭐', conditionType: 'POINTS',         threshold: 100 },
  { name: '积分富翁',   description: '累计获得 1000 积分',     icon: '💰', conditionType: 'POINTS',         threshold: 1000 },
] as const;

// 显式使用 DIRECT_URL (Supabase Session Pooler, 5432 端口), 支持 prepared statements
// 避免 Transaction Pooler (PgBouncer, 6543) 在构建期报 "prepared statement already exists"
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

async function main() {
  const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@campus.edu';
  const adminPwd = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Admin@12345';

  const passwordHash = await bcrypt.hash(adminPwd, 10);

  // 超级管理员: 已存在则更新角色, 不存在则创建
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: UserRole.SUPER_ADMIN },
    create: {
      email: adminEmail,
      nickname: '校园墙管理员',
      password: passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
  });
  console.log('✅ 超级管理员已就绪:', admin.email, 'role:', admin.role);

  // 示例用户 + 示例帖子: 仅在从未创建过的情况下创建 (幂等 — 已有则跳过)
  const existingDemo = await prisma.user.findFirst({ where: { email: 'demo@campus.edu' } });
  if (!existingDemo) {
    const demoPwd = await bcrypt.hash('Demo@12345', 10);
    const demoUser = await prisma.user.create({
      data: {
        email: 'demo@campus.edu',
        nickname: '校园小明',
        password: demoPwd,
        role: UserRole.USER,
      },
    });
    await prisma.post.create({
      data: {
        authorId: demoUser.id,
        title: '欢迎来到校园墙!',
        content: '这里是校园墙, 你可以发布失物招领、二手交易、表白、寻物启事等内容。请遵守校园规范, 文明发言。',
        category: '校园',
        status: PostStatus.APPROVED,
        pinned: true,
      },
    });
    console.log('✅ 示例用户 demo@campus.edu / Demo@12345 已创建');
  }

  // 系统默认勋章: 按 name 去重, 已存在则跳过, 不存在则补建 — 后台修改不会被覆盖
  let createdCount = 0;
  for (const b of DEFAULT_BADGES) {
    const exists = await prisma.badge.findFirst({ where: { name: b.name } });
    if (!exists) {
      await prisma.badge.create({
        data: {
          name: b.name,
          description: b.description,
          icon: b.icon,
          conditionType: b.conditionType,
          threshold: b.threshold,
          isActive: true,
        },
      });
      createdCount++;
      console.log(`🏅 已创建勋章: ${b.name}`);
    }
  }
  if (createdCount === 0) console.log('✅ 默认勋章均已存在, 跳过创建');

  console.log('🌱 Seed 完成');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
