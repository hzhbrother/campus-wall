// GET /api/admin/users/template  下载 Excel 导入模板 (ADMIN+)
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import * as XLSX from 'xlsx';
import { requirePermission } from '@/lib/server-auth';
import { errorResponse } from '@/lib/api-response';

const COLUMNS = {
  nickname: '昵称*',
  email: '邮箱',
  password: '密码',
  realName: '真实姓名',
  grade: '年级',
  className: '班级',
  role: '身份',
  status: '状态',
  remark: '备注',
};

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'user.import');

    const data = [
      { [COLUMNS.nickname]: '张三', [COLUMNS.email]: 'zhangsan@school.edu.cn', [COLUMNS.password]: '123456', [COLUMNS.realName]: '张三', [COLUMNS.grade]: '高一', [COLUMNS.className]: '1班', [COLUMNS.role]: '学生', [COLUMNS.status]: '正常', [COLUMNS.remark]: '示例数据, 导入前请删除此行' },
      { [COLUMNS.nickname]: '李老师', [COLUMNS.email]: 'li@school.edu.cn', [COLUMNS.password]: '123456', [COLUMNS.realName]: '李四', [COLUMNS.grade]: '', [COLUMNS.className]: '', [COLUMNS.role]: '教师', [COLUMNS.status]: '正常', [COLUMNS.remark]: '' },
      {}, {}, {},
    ];
    const ws = XLSX.utils.json_to_sheet(data, { header: Object.values(COLUMNS) });
    ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '用户导入');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="user-import-template.xlsx"',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
