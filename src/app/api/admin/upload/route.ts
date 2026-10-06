// POST /api/admin/upload  上传图片, 保存到 public/uploads, 返回可访问的 URL
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireRole } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, UserRole.SUPER_ADMIN);
    const { image } = await req.json();
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ message: '缺少图片数据' }, { status: 400 });
    }

    // 支持 base64 data URI 或纯 base64
    const base64Data = image.startsWith('data:') ? image.split(',')[1] : image;
    const ext = (image.match(/data:image\/(\w+)/) || [, 'png'])[1];
    const buffer = Buffer.from(base64Data, 'base64');

    const uploadDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    writeFileSync(join(uploadDir, filename), buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (e) {
    return errorResponse(e);
  }
}
