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
  校园: 'bg-blue-50 text-blue-600',
  失物招领: 'bg-amber-50 text-amber-600',
  二手交易: 'bg-emerald-50 text-emerald-600',
  表白墙: 'bg-pink-50 text-pink-600',
  寻物启事: 'bg-orange-50 text-orange-600',
  招聘兼职: 'bg-violet-50 text-violet-600',
  求助问答: 'bg-cyan-50 text-cyan-600',
};

export function PostCard({ post }: { post: PostListItem }) {
  return (
    <Link href={`/post/${post.id}`} className="block card p-4 hover:shadow-md transition no-underline">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`tag ${CATEGORY_COLOR[post.category] || 'bg-slate-100 text-slate-600'}`}>{post.category}</span>
        {post.pinned && <span className="tag bg-red-50 text-red-600">置顶</span>}
        <span className="text-xs text-slate-400">{new Date(post.createdAt).toLocaleString('zh-CN')}</span>
      </div>
      <h3 className="font-semibold text-slate-900 mb-1 truncate">{post.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-2 mb-2">{post.content}</p>
      {post.images?.length > 0 && (
        <div className="flex gap-2 mb-2">
          {post.images.slice(0, 3).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{post.author.nickname}</span>
        <span className="flex gap-3">
          <span>👁 {post.viewCount}</span>
          <span>💬 {post.commentCount}</span>
          <span>❤ {post.likeCount}</span>
        </span>
      </div>
    </Link>
  );
}
