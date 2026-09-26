// GET  /api/admin/email-templates       获取所有模板
// POST /api/admin/email-templates       保存模板
// DELETE /api/admin/email-templates/[key]  删除自定义模板(恢复内置)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { requirePermission } from '@/lib/server-auth';
import { getAllTemplates, saveTemplate, deleteTemplate } from '@/lib/email-templates';
import { errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'settings.email');
    const templates = await getAllTemplates();
    return NextResponse.json({ templates });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, 'settings.email');
    const body = await req.json();
    const { key, name, subject, html } = body || {};
    if (!key || !name || !subject || !html) {
      return NextResponse.json({ message: '缺少必要字段: key/name/subject/html' }, { status: 400 });
    }
    await saveTemplate(key, name, subject, html);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
