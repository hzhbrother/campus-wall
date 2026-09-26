// 权限码定义: 每个功能对应一个开关, 超级管理员可自定义角色的权限组合
// 命名规范: <模块>.<动作>, 如 user.create / post.moderate

export interface PermissionMeta {
  code: string;
  name: string;
  group: string;
}

// 全量权限清单 (前端渲染开关 / 后端校验均基于此)
export const PERMISSIONS: PermissionMeta[] = [
  // ---- 用户管理 ----
  { code: 'user.view', name: '查看用户列表', group: '用户管理' },
  { code: 'user.create', name: '创建用户', group: '用户管理' },
  { code: 'user.edit', name: '编辑用户资料', group: '用户管理' },
  { code: 'user.delete', name: '删除用户', group: '用户管理' },
  { code: 'user.ban', name: '封禁/解封用户', group: '用户管理' },
  { code: 'user.import', name: 'Excel 导入用户', group: '用户管理' },
  { code: 'user.batch', name: '批量更新用户', group: '用户管理' },
  { code: 'user.role', name: '修改用户角色', group: '用户管理' },

  // ---- 帖子管理 ----
  { code: 'post.view', name: '查看所有帖子', group: '帖子管理' },
  { code: 'post.moderate', name: '审核帖子 (通过/驳回)', group: '帖子管理' },
  { code: 'post.edit', name: '编辑帖子', group: '帖子管理' },
  { code: 'post.delete', name: '删除帖子', group: '帖子管理' },
  { code: 'post.pin', name: '置顶帖子', group: '帖子管理' },

  // ---- 评论管理 ----
  { code: 'comment.view', name: '查看所有评论', group: '评论管理' },
  { code: 'comment.delete', name: '删除评论', group: '评论管理' },

  // ---- 申诉管理 ----
  { code: 'appeal.view', name: '查看封禁申诉', group: '申诉管理' },
  { code: 'appeal.handle', name: '处理封禁申诉', group: '申诉管理' },

  // ---- 通知管理 ----
  { code: 'notification.send', name: '发送系统通知', group: '通知管理' },

  // ---- 系统设置 (仅超级管理员可授权) ----
  { code: 'settings.site', name: '站点设置', group: '系统设置' },
  { code: 'settings.email', name: '邮件/SMTP 配置', group: '系统设置' },
  { code: 'settings.agreement', name: '协议与关于我们', group: '系统设置' },

  // ---- 角色管理 (仅超级管理员) ----
  { code: 'role.manage', name: '角色与权限管理', group: '角色管理' },
];

export const PERMISSION_CODES = PERMISSIONS.map(p => p.code);
export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS.map(p => p.group)));

// 按模块分组的权限 (便于前端渲染)
export const PERMISSIONS_BY_GROUP: Record<string, PermissionMeta[]> = {};
for (const p of PERMISSIONS) {
  (PERMISSIONS_BY_GROUP[p.group] ||= []).push(p);
}

// 仅超级管理员可授予的权限 (其他角色即使勾选也不生效, 且普通管理员不可勾选)
export const SUPER_ADMIN_ONLY_PERMISSIONS = new Set([
  'user.delete',
  'settings.site',
  'settings.email',
  'settings.agreement',
  'role.manage',
]);

// 系统内置角色的默认权限 (SUPER_ADMIN 永远全权限, 不在此列出)
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    'user.view', 'user.create', 'user.edit', 'user.ban', 'user.import', 'user.batch', 'user.role',
    'post.view', 'post.moderate', 'post.edit', 'post.delete', 'post.pin',
    'comment.view', 'comment.delete',
    'appeal.view', 'appeal.handle',
    'notification.send',
  ],
  TEACHER: [
    'post.view', 'post.moderate', 'post.delete',
    'comment.view', 'comment.delete',
  ],
  STUDENT: [],
  USER: [],
};

// 系统角色显示名称 (可被超级管理员自定义覆盖)
export const SYSTEM_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '管理员',
  TEACHER: '教师',
  STUDENT: '学生',
  USER: '用户',
};
