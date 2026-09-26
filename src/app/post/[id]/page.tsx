'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { usePageRefresh } from '@/lib/use-page-refresh';

interface Author { id: string; nickname: string; avatar?: string | null; role?: string }
interface Comment { id: string; content: string; createdAt: string; author: Author; parentId?: string | null }
interface PostDetail {
  id: string; title: string; content: string; category: string; images: string[];
  isAnonymous: boolean; status: string; pinned: boolean;
  viewCount: number; likeCount: number; commentCount: number;
  favorited?: boolean;
  createdAt: string; author: Author; comments: Comment[];
}

export default function PostDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { user } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [err, setErr] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [favorited, setFavorited] = useState(false);

  const load = async () => {
    try {
      const p = await api.get<PostDetail>(`/api/posts/${id}`);
      setPost(p);
      setFavorited(!!p.favorited);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  // 挂载 + 标签页激活时刷新
  usePageRefresh(load, [id]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const like = async () => {
    if (!user) { router.push('/login'); return; }
    try {
      const res = await api.post<{ liked: boolean; likeCount: number }>(`/api/posts/${id}/like`);
      setPost(p => p ? { ...p, likeCount: res.likeCount } : p);
    } catch (e: any) { alert(e.message); }
  };

  const favorite = async () => {
    if (!user) { router.push('/login'); return; }
    try {
      const res = await api.post<{ favorited: boolean }>(`/api/posts/${id}/favorite`);
      setFavorited(res.favorited);
    } catch (e: any) { alert(e.message); }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push('/login'); return; }
    setBusy(true);
    try {
      await api.post('/api/comments', { postId: id, content: comment });
      setComment('');
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  // 管理员/教师置顶/取消置顶
  const togglePin = async () => {
    if (!user) return;
    try {
      const res = await api.post<{ pinned: boolean }>(`/api/admin/posts/${id}/pin`, { pinned: !post.pinned });
      setPost(p => p ? { ...p, pinned: res.pinned } : p);
    } catch (e: any) { alert(e.message); }
  };

  if (err) return <div className="card p-6 text-center text-red-500">{err}</div>;
  if (!post) return <p className="text-center text-slate-400 py-10">加载中…</p>;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2 text-sm">
          <span className="tag bg-blue-50 text-blue-600">{post.category}</span>
          {post.pinned && <span className="tag bg-red-50 text-red-600">置顶</span>}
          {post.status !== 'APPROVED' && <span className="tag bg-amber-50 text-amber-600">待审核</span>}
          <span className="text-slate-400 ml-auto">{new Date(post.createdAt).toLocaleString('zh-CN')}</span>
        </div>
        <h1 className="text-xl font-bold mb-3">{post.title}</h1>
        <div className="text-slate-700 whitespace-pre-wrap leading-relaxed mb-4">{post.content}</div>
        {post.images?.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {post.images.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-500">发布人: {post.author.nickname}</span>
          <div className="flex gap-4 text-slate-500">
            <button onClick={like} className="hover:text-red-500">❤ {post.likeCount}</button>
            <span>💬 {post.commentCount}</span>
            <span>👁 {post.viewCount}</span>
            <button onClick={favorite} className={favorited ? 'text-yellow-500' : 'hover:text-yellow-500'}>
              {favorited ? '★' : '☆'} 收藏
            </button>
          </div>
        </div>
      </div>

      {/* 管理员/教师置顶操作 */}
      {user && ['ADMIN', 'SUPER_ADMIN', 'TEACHER'].includes(user.role) && (
        <div className="flex gap-2">
          <button
            className={`text-sm flex-1 ${post.pinned ? 'btn-primary' : 'btn-ghost'}`}
            onClick={togglePin}
          >
            📌 {post.pinned ? '取消置顶' : '置顶'}
          </button>
        </div>
      )}

      {/* 评论 */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3">评论 ({post.comments.length})</h2>
        <form onSubmit={addComment} className="flex gap-2 mb-4">
          <input className="input flex-1" placeholder={user ? '写下你的评论…' : '请先登录后评论'} value={comment} onChange={(e) => setComment(e.target.value)} disabled={!user} />
          <button className="btn-primary" disabled={!user || busy}>发送</button>
        </form>
        <div className="space-y-3">
          {post.comments.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-slate-700">{c.author.nickname}</span>
                <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
              </div>
              <p className="text-slate-600 pl-1">{c.content}</p>
            </div>
          ))}
          {post.comments.length === 0 && <p className="text-slate-400 text-sm">还没有评论, 来抢沙发~</p>}
        </div>
      </div>
    </div>
  );
}
