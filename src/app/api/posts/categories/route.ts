// GET /api/posts/categories  分类目录
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(['校园', '失物招领', '二手交易', '表白墙', '寻物启事', '招聘兼职', '求助问答']);
}
