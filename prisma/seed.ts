// 数据库初始化 seed: 创建超级管理员 + 示例板块 + 示例帖子
import { PrismaClient, UserRole, PostStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@campus.edu';
  const adminPwd = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Admin@12345';

  const passwordHash = await bcrypt.hash(adminPwd, 10);

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

  // 创建一个普通用户 + 示例帖子便于联调
  let demoUser = await prisma.user.findFirst({
    where: { email: 'demo@campus.edu' },
  });
  if (!demoUser) {
    const demoPwd = await bcrypt.hash('Demo@12345', 10);
    demoUser = await prisma.user.create({
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
