// 数据库初始化 seed: 仅创建超级管理员 + 默认勋章 (幂等, 可重复运行)
// 不创建任何示例用户/帖子/学校/团体, 由管理员在后台自行管理
import { PrismaClient, UserRole } from '@prisma/client';
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
  // 行为类
  { name: '守夜冠军',   description: '连续3天在凌晨2:00-4:00发帖或评论。全校都睡了，你还在冲浪？',  icon: '🌙', conditionType: 'NIGHT_OWL',   threshold: 3 },
  { name: '爆款制造机', description: '单条帖子点赞数突破100。你就是校园热点！',                    icon: '🔥', conditionType: 'HOT_POST',    threshold: 100 },
  { name: '吃瓜一线',   description: '评论被点赞超过20次。神评论诞生！',                            icon: '🕵️', conditionType: 'TOP_COMMENT', threshold: 20 },
  { name: '暖心学姐',   description: '在求助问答板块被点赞3次以上。',                                icon: '❤️', conditionType: 'HELPER',      threshold: 3 },
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

  // 超级管理员: 已存在则只确保角色为 SUPER_ADMIN (不覆盖密码等), 不存在则创建
  // 使用 findFirst + upsert 的 update 条件, 保证永远只有一个超级管理员
  const existingAdmin = await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN } });
  const adminEmailExists = await prisma.user.findUnique({ where: { email: adminEmail } });

  let admin;
  if (existingAdmin && !adminEmailExists) {
    // 已有超管但不是配置的邮箱: 确保现有超管角色不变, 不新建
    admin = existingAdmin;
    console.log('⚠️  已存在超级管理员:', admin.email, ', 跳过创建新超管');
  } else {
    admin = await prisma.user.upsert({
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
