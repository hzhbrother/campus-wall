'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const CATEGORIES = ['校园', '失物招领', '二手交易', '表白墙', '寻物启事', '招聘兼职', '求助问答'];
const MAX_LEN = 1000;

export default function NewPostPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [showCategory, setShowCategory] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [pinToTop, setPinToTop] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setImages(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (i: number) => setImages(prev => prev.filter((_, idx) => idx !== i));

  const onSubmit = async () => {
    if (!content.trim()) { setErr('请输入内容'); return; }
    if (!category) { setErr('请选择主题分类'); return; }
    setErr(''); setBusy(true);
    try {
      const res = await api.post<{ id: string; status: string }>('/api/posts', {
        title: content.slice(0, 30) + (content.length > 30 ? '…' : ''),
        content,
        category,
        images,
        isAnonymous,
      });

      // 发布后置顶: 创建置顶订单并跳转支付
      if (pinToTop) {
        try {
          const pay = await api.post<{ order: { id: string }; payment: { payUrl?: string } }>('/api/payment/orders', {
            type: 'PIN', postId: res.id,
          });
          if (pay.payment.payUrl) {
            window.location.href = pay.payment.payUrl;
            return;
          }
        } catch (e: any) {
          alert('帖子已发布, 但置顶订单创建失败: ' + e.message);
        }
      }

      if (res.status === 'PENDING') {
        alert('发布成功! 帖子正在审核中, 通过后将显示在信息流。');
      }
      router.push('/');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-center text-slate-400 py-10">加载中…</p>;

  return (
    <div className="pb-28">
      {/* 顶部提示 */}
      <div className="mx-4 mt-3 rounded-lg bg-orange-50 px-3 py-2 text-center text-xs text-orange-600">
        禁止发布重复信息, 广告营销类, 含二维码等内容
      </div>

      {/* 内容输入 */}
      <div className="relative mt-3 px-4">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value.slice(0, MAX_LEN))}
          placeholder="说点什么吧~（请输入投稿内容）"
          className="w-full min-h-[180px] resize-none bg-transparent text-base text-slate-800 placeholder:text-slate-300 focus:outline-none"
        />
        <div className="absolute bottom-1 right-4 text-xs text-slate-300">{content.length}/{MAX_LEN}</div>
      </div>

      {/* 图片 + 提示 */}
      <div className="flex items-start gap-3 px-4 mt-2">
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="h-full w-full object-cover" />
              <button onClick={() => removeImage(i)} className="absolute top-0 right-0 h-5 w-5 rounded-bl-lg bg-black/50 text-white text-xs">×</button>
            </div>
          ))}
          {images.length < 9 && (
            <button onClick={() => fileRef.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center rounded-lg bg-slate-50 text-slate-300 hover:bg-slate-100">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImage} />

        <div className="flex-1 text-xs leading-relaxed text-red-500">
          <p>1.普通消息免费发布</p>
          <p>2.商业推广联系<span className="text-blue-500">管理员</span>审核</p>
          <p>3.招聘/商业推广私自发布会被禁言</p>
        </div>
      </div>

      {/* 选项区域 */}
      <div className="mt-4 bg-white">
        {/* 切换第二身份 (匿名) */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-lg">🕶️</span>
            <span className="text-sm text-slate-700">切换第二身份</span>
            {isAnonymous && <span className="text-xs text-slate-400">匿名 · 功能开发中</span>}
          </div>
          <button
            type="button"
            onClick={() => setIsAnonymous(v => !v)}
            className={`relative h-6 w-11 rounded-full transition ${isAnonymous ? 'bg-green-500' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isAnonymous ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        {/* 发布后置顶 */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-lg">📌</span>
            <span className="text-sm text-slate-700">发布后置顶</span>
            <span className="text-xs text-orange-500">¥1/次</span>
          </div>
          <button
            type="button"
            onClick={() => setPinToTop(v => !v)}
            className={`relative h-6 w-11 rounded-full transition ${pinToTop ? 'bg-green-500' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${pinToTop ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        {/* 主题分类 */}
        <button
          type="button"
          onClick={() => setShowCategory(true)}
          className="flex w-full items-center justify-between px-4 py-3.5"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">#️⃣</span>
            <span className="text-sm text-slate-700">主题分类</span>
          </div>
          <span className={`text-sm ${category ? 'text-slate-900' : 'text-slate-400'}`}>
            {category || '未选择'}
            <svg className="ml-1 inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        </button>
      </div>

      {/* 社区规范提示 */}
      <p className="px-4 py-3 text-center text-xs text-slate-400">
        *请自觉遵守《社区规范》, 如有违规会被删帖、禁言、关小黑屋*
      </p>

      {err && <div className="mx-4 mb-3 bg-red-50 text-red-600 text-sm p-3 rounded-lg">{err}</div>}

      {/* 发布按钮 */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-100 bg-white px-4 py-3">
        <button
          onClick={onSubmit}
          disabled={busy}
          className="mx-auto block w-full max-w-[600px] rounded-xl bg-blue-500 py-3.5 text-base font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {busy ? '发布中…' : '发布'}
        </button>
      </div>

      {/* 分类选择弹窗 */}
      {showCategory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowCategory(false)}>
          <div className="w-full max-w-[640px] rounded-t-2xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
            <h3 className="mb-3 text-center text-base font-medium text-slate-900">选择主题分类</h3>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => { setCategory(c); setShowCategory(false); }}
                  className={`rounded-lg py-3 text-sm ${category === c ? 'bg-blue-500 text-white' : 'bg-slate-50 text-slate-700'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCategory(false)} className="mt-4 w-full rounded-lg bg-slate-100 py-2.5 text-sm text-slate-600">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
