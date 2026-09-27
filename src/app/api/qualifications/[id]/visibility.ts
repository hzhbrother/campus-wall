// 资质/奖状详情页可见性校验共享逻辑
// 三个 API 文件 (detail route / comments route / 未来 comment-detail route) 共用
import { VerificationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface QualificationVisibilityInput {
  userId: string;      // 资质 owner 的 userId
  visibility: string;   // PUBLIC | FOLLOWERS | PRIVATE
  status?: string;      // VerificationStatus
}

export interface VisibilityDecision {
  visible: boolean;
  status?: number;      // HTTP 状态码 (404 / 403)
  message?: string;
}

// 判断 viewer 是否可查看该 qualification
// 规则:
//  - 未通过审核 (status != APPROVED) 且非 owner → 404 (不泄露存在)
//  - PRIVATE   → 仅 owner 本人可见, 否则 403「对方已设为不公开」
//  - FOLLOWERS → 仅 owner 本人或 owner 的粉丝可见, 否则 403「仅粉丝可见」
//  - PUBLIC    → 所有人可见 (含匿名)
export async function isQualificationVisible(
  q: QualificationVisibilityInput,
  viewerId: string | null,
): Promise<VisibilityDecision> {
  const isOwner = !!viewerId && viewerId === q.userId;

  // 未通过审核的, 非 owner 看不到 (返回 404, 不泄露存在)
  if (q.status && q.status !== VerificationStatus.APPROVED && !isOwner) {
    return { visible: false, status: 404, message: '资质/奖状不存在或未通过审核' };
  }

  switch (q.visibility) {
    case 'PRIVATE':
      if (!isOwner) {
        return { visible: false, status: 403, message: '对方已设为不公开' };
      }
      return { visible: true };
    case 'FOLLOWERS': {
      if (isOwner) return { visible: true };
      if (!viewerId) {
        return { visible: false, status: 403, message: '仅粉丝可见' };
      }
      // 校验 viewer 是否为 owner 的粉丝
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: viewerId, followingId: q.userId },
        },
      });
      if (!follow) {
        return { visible: false, status: 403, message: '仅粉丝可见' };
      }
      return { visible: true };
    }
    case 'PUBLIC':
    default:
      return { visible: true };
  }
}
