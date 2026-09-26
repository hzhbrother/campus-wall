// 角色初始化: 确保系统内置角色存在 (在应用启动或首次访问时调用)
import { prisma } from './prisma';
import { DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLE_LABELS, PERMISSION_CODES } from './permissions';
import { UserRole } from '@prisma/client';

// 系统内置角色定义
const SYSTEM_ROLES: { code: string; name: string; isSystem: boolean; isDefault: boolean; permissions: string[] }[] = [
  {
    code: UserRole.SUPER_ADMIN,
    name: SYSTEM_ROLE_LABELS.SUPER_ADMIN,
    isSystem: true,
    isDefault: false,
    permissions: PERMISSION_CODES, // 全权限
  },
  {
    code: UserRole.ADMIN,
    name: SYSTEM_ROLE_LABELS.ADMIN,
    isSystem: true,
    isDefault: false,
    permissions: DEFAULT_ROLE_PERMISSIONS.ADMIN,
  },
  {
    code: UserRole.TEACHER,
    name: SYSTEM_ROLE_LABELS.TEACHER,
    isSystem: true,
    isDefault: false,
    permissions: DEFAULT_ROLE_PERMISSIONS.TEACHER,
  },
  {
    code: UserRole.STUDENT,
    name: SYSTEM_ROLE_LABELS.STUDENT,
    isSystem: true,
    isDefault: true,
    permissions: DEFAULT_ROLE_PERMISSIONS.STUDENT,
  },
  {
    code: UserRole.USER,
    name: SYSTEM_ROLE_LABELS.USER,
    isSystem: true,
    isDefault: false,
    permissions: DEFAULT_ROLE_PERMISSIONS.USER,
  },
];

let seeded = false;

// 初始化系统角色 (幂等)
export async function seedRoles() {
  if (seeded) return;
  for (const r of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: {
        // 已存在的系统角色: 仅同步名称与权限 (不覆盖超级管理员可能修改过的名称)
        // 这里保守策略: 若名称仍是默认值则同步, 否则保留自定义
      },
      create: {
        code: r.code,
        name: r.name,
        permissions: r.permissions,
        isSystem: r.isSystem,
        isDefault: r.isDefault,
      },
    });
  }
  seeded = true;
}

// 获取默认角色 (新注册用户使用)
export async function getDefaultRole() {
  await seedRoles();
  return prisma.role.findFirst({ where: { isDefault: true } });
}
