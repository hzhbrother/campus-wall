// GET /api/auth/oauth/aggregated/:type  聚合登录跳转
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAggregatedLoginUrl, getJuheTypeMeta } from '@/lib/aggregated-login';
import { requestOrigin } from '@/lib/api-response';
import { getUserFromRequest } from '@/lib/server-auth';

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const type = params.type;
  const meta = getJuheTypeMeta(type);
  if (!meta) {
    return NextResponse.json({ message: '不支持的登录方式' }, { status: 400 });
  }

  const origin = requestOrigin(req);
  const redirectUri = `${origin}/api/auth/callback/aggregated`;

  try {
    const url = await getAggregatedLoginUrl(type, redirectUri);
    const state = randomBytes(8).toString('hex');
    const res = NextResponse.redirect(url);
    res.cookies.set('oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' });
    res.cookies.set('juhe_type', type, { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' });
    // 绑定模式: 把当前用户ID写入 cookie, 回调时用于绑定
    if (req.nextUrl.searchParams.get('bind') === '1') {
      const user = await getUserFromRequest(req);
      if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 });
      res.cookies.set('oauth_bind_uid', user.id, { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' });
    }
    return res;
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || '聚合登录初始化失败' }, { status: 503 });
  }
}
