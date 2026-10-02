// POST /api/quick-links/[id]/click  记录点击次数
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.quickLink.update({
    where: { id: params.id },
    data: { clickCount: { increment: 1 } },
  }).catch(() => {});
  return NextResponse.json({ success: true });
}
