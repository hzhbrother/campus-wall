// DELETE /api/admin/email-templates/[key]  删除自定义模板 (恢复内置)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requirePermission } from '@/lib/server-auth';
import { deleteTemplate } from '@/lib/email-templates';
import { errorResponse } from '@/lib/api-response';

export async function DELETE(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    await requirePermission(req, 'settings.email');
    await deleteTemplate(params.key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
