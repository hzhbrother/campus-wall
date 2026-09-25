// 服务端 JWT 与登录态辅助: 用于 Next.js Route Handler
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import type { UserRole } from '@prisma/client';
import { UserStatus } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string | null;
  role: UserRole;
}

export interface ReqUser {
  id: string;
  email: string | null;
  role: UserRole;
  nickname: string;
  bannedUntil: Date | null;
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
  return { id: user.id, email: user.email, role: user.role, nickname: user.nickname, bannedUntil: user.bannedUntil };
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

// 强制角色, 否则抛 403
export async function requireRole(req: Request | NextRequest, ...roles: UserRole[]): Promise<ReqUser> {
  const user = await requireUser(req);
  if (!roles.includes(user.role)) {
    throw new HttpError('权限不足, 需要角色: ' + roles.join(', '), 403);
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
