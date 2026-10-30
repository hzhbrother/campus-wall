'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function VerifyPage() {
  const router = useRouter();
  const { user } = useAuth();

  if (!user) { router.push('/login'); return null; }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-lg px-4 h-12 flex items-center">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm">返回</span>
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 flex items-center justify-center text-4xl">
          🎉
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">身份认证已取消</h1>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed mx-auto mb-1">
          校园墙已取消强制身份认证，所有同学登录后即可自由发帖、评论、点赞。
        </p>
        <p className="text-xs text-gray-400 mb-8">
          如果需要展示 <strong className="text-gray-600">学生会/社团/荣誉资质</strong> 可在个人中心提交「资质认证」。
        </p>
        <button
          onClick={() => router.push('/profile')}
          className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-8 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          返回个人中心
        </button>
      </div>
    </div>
  );
}
