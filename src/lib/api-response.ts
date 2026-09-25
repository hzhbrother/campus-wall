import { NextResponse } from 'next/server';
import { isHttpError } from './server-auth';

// 统一错误响应: 业务异常带状态码, 其他 500
export function errorResponse(e: any) {
  const status = isHttpError(e) ? (e as any).status : 500;
  const message = e?.message || '服务器内部错误';
  return NextResponse.json({ message }, { status });
}

// 从请求 URL 拿到部署的 origin (用于 OAuth 回调、支付跳转)
export function requestOrigin(req: Request | { headers: { get(n: string): string | null } }): string {
  // Vercel 等反代会设置 x-forwarded-host / x-forwarded-proto
  const headers: any = (req as any).headers;
  const proto = headers.get('x-forwarded-proto') || 'https';
  const host = headers.get('x-forwarded-host') || headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}
