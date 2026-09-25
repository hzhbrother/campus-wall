// 前端 API 客户端: 自动携带 JWT, 统一错误处理
// 部署到 Vercel 后前后端同源, 默认空字符串即同源相对路径
const BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('cw_token');
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as any),
  };
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    // 401: token 失效, 清除登录态并跳转登录页
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('cw_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const message = data?.message || (Array.isArray(data?.message) ? data.message[0] : `请求失败 (${res.status})`);
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  base: BASE,
};
