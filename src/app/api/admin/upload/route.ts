// POST /api/admin/upload  上传图片, 压缩后返回 data URL (不依赖文件系统)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const { image } = await req.json();
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ message: '缺少图片数据' }, { status: 400 });
    }
    // image 已经是前端 compressImage 压缩后的 data URL, 直接返回
    return NextResponse.json({ url: image });
  } catch (e) {
    return errorResponse(e);
  }
}
