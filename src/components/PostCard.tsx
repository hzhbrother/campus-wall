import Link from 'next/link';

export interface PostListItem {
  id: string;
  title: string;
  content: string;
  category: string;
  images: string[];
  pinned: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  author: { id: string; nickname: string; avatar?: string | null };
}

const CATEGORY_COLOR: Record<string, string> = {
  校园: 'bg-blue-500 text-white',
  失物招领: 'bg-amber-500 text-white',
  二手交易: 'bg-emerald-500 text-white',
  表白墙: 'bg-pink-500 text-white',
  寻物启事: 'bg-orange-500 text-white',
  招聘兼职: 'bg-violet-500 text-white',
  求助问答: 'bg-cyan-500 text-white',
};

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}-${dd}`;
  } catch {
    return iso;
  }
}

export function PostCard({ post }: { post: PostListItem }) {
  return (
    <Link href={`/post/${post.id}`} className="block no-underline">
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        {/* 顶部: 头像 + 昵称/日期 + 分类标签 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-medium">
              {post.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.author.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                (post.author.nickname || 'U')[0].toUpperCase()
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">{post.author.nickname}</div>
              <div className="text-xs text-slate-400">{fmtDate(post.createdAt)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {post.pinned && <span className="rounded-md bg-red-500 px-2 py-0.5 text-xs font-medium text-white">置顶</span>}
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${CATEGORY_COLOR[post.category] || 'bg-slate-400 text-white'}`}>
              #{post.category}
            </span>
          </div>
        </div>

        {/* 内容 */}
        <div className="mt-3">
          {post.title && <div className="font-semibold text-slate-900 mb-1">{post.title}</div>}
          <p className="text-sm leading-relaxed text-slate-700 line-clamp-4 whitespace-pre-wrap">{post.content}</p>
        </div>

        {/* 图片 */}
        {post.images?.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl">
            {post.images.length === 1 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.images[0]} alt="" className="w-full max-h-80 object-cover" />
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {post.images.slice(0, 3).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" className="aspect-square w-full object-cover rounded-lg" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 底部互动栏 */}
        <div className="mt-3 flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1 text-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {post.likeCount}
            </span>
            <span className="flex items-center gap-1 text-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {post.commentCount}
            </span>
            <span className="flex items-center gap-1 text-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              0
            </span>
          </div>
          <span className="text-xs">{post.viewCount} 浏览</span>
        </div>
      </div>
    </Link>
  );
}
