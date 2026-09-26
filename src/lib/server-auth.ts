// 服务端 JWT 与登录态辅助: 用于 Next.js Route Handler
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { UserRole, UserStatus } from '@prisma/client';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_CODES } from './permissions';
import { seedRoles } from './role-service';

export interface JwtPayload {
  sub: string;
  email: string | null;
  role: UserRole;
}

export interface ReqUser {
  id: string;
  email: string | null;
  role: UserRole;
  roleId: string | null;
  nickname: string;
  bannedUntil: Date | null;
  verified: boolean;
}

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// 从 Authorization 头解析当前用户, 无则返回 null (用于匿名可访问接口)
export async function getUserFromRequest(req: Request | NextRequest): Promise<ReqUser | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status === UserStatus.BANNED) return null;
  // 管理员/超级管理员默认已认证 (无需走认证流程)
  const autoVerified = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  return {
    id: user.id, email: user.email, role: user.role, roleId: user.roleId,
    nickname: user.nickname, bannedUntil: user.bannedUntil,
    verified: autoVerified || user.verified,
  };
}

// 获取用户的有效权限码集合:
// 1. SUPER_ADMIN 永远全权限
// 2. 有自定义角色时使用自定义角色的 permissions
// 3. 否则使用系统角色的默认权限
export async function getUserPermissions(user: ReqUser): Promise<Set<string>> {
  await seedRoles(); // 确保系统角色存在
  if (user.role === UserRole.SUPER_ADMIN) {
    return new Set(PERMISSION_CODES);
  }
  if (user.roleId) {
    const customRole = await prisma.role.findUnique({ where: { id: user.roleId } });
    if (customRole?.permissions && Array.isArray(customRole.permissions)) {
      return new Set(customRole.permissions as string[]);
    }
  }
  return new Set(DEFAULT_ROLE_PERMISSIONS[user.role] || []);
}

// 判断用户是否拥有某权限
export async function can(user: ReqUser, permission: string): Promise<boolean> {
  const perms = await getUserPermissions(user);
  return perms.has(permission);
}

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// 强制登录, 否则抛 401
export async function requireUser(req: Request | NextRequest): Promise<ReqUser> {
  const user = await getUserFromRequest(req);
  if (!user) throw new HttpError('未登录或登录已过期', 401);
  return user;
}

// 强制角色, 否则抛 403 (保留兼容: 基于系统角色枚举)
export async function requireRole(req: Request | NextRequest, ...roles: UserRole[]): Promise<ReqUser> {
  const user = await requireUser(req);
  if (!roles.includes(user.role)) {
    throw new HttpError('权限不足, 需要角色: ' + roles.join(', '), 403);
  }
  return user;
}

// 强制权限: 校验当前用户是否拥有指定权限码, 否则抛 403
export async function requirePermission(req: Request | NextRequest, permission: string): Promise<ReqUser> {
  const user = await requireUser(req);
  if (!(await can(user, permission))) {
    throw new HttpError('权限不足, 需要权限: ' + permission, 403);
  }
  return user;
}

export function isHttpError(e: any): e is HttpError {
  return e instanceof HttpError || typeof e?.status === 'number';
}

export function sanitize<T extends Record<string, any>>(user: T): Partial<T> {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest as Partial<T>;
}

// 判断用户是否处于临时封禁期 (bannedUntil 在未来)
export function isUserBanned(user: { bannedUntil?: Date | string | null } | null): boolean {
  if (!user?.bannedUntil) return false;
  const until = typeof user.bannedUntil === 'string' ? new Date(user.bannedUntil) : user.bannedUntil;
  return until.getTime() > Date.now();
}

// 计算封禁剩余时间文本
export function getBanRemainText(user: { bannedUntil?: Date | string | null } | null): string {
  if (!user?.bannedUntil) return '';
  const until = typeof user.bannedUntil === 'string' ? new Date(user.bannedUntil) : user.bannedUntil;
  const diff = until.getTime() - Date.now();
  if (diff <= 0) return '已解禁';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `距离解禁还有 ${days} 天 ${hours} 小时`;
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `距离解禁还有 ${hours} 小时 ${mins} 分钟`;
}
