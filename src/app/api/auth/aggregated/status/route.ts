// GET /api/auth/aggregated/status  查询聚合登录是否已配置
import { NextResponse } from 'next/server';
import { isAggregatedLoginConfigured } from '@/lib/aggregated-login';

export async function GET() {
  return NextResponse.json({ configured: isAggregatedLoginConfigured() });
}
