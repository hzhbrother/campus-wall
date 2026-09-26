// 认证状态标签: 已认证 (亮绿) / 未认证 (蓝色)
interface VerifiedBadgeProps {
  verified: boolean;
  className?: string;
}

export function VerifiedBadge({ verified, className = '' }: VerifiedBadgeProps) {
  if (verified) {
    return (
      <span className={`inline-flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-600 ${className}`}>
        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        已认证
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-500 ${className}`}>
      未认证
    </span>
  );
}
