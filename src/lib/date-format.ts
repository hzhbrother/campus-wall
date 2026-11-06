// 固定时区 + locale 的日期格式化
// 服务器 (Vercel, UTC) 与浏览器 (用户本地时区) 必须输出完全一致, 否则 hydration 会报 React #423
const TZ = 'Asia/Shanghai';

const monthDayFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  month: '2-digit',
  day: '2-digit',
});

const fullDateFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "MM-DD" (zh-CN 原始输出是 "11/06", 转成 "11-06") */
export function formatMonthDay(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return monthDayFmt.format(d).replaceAll('/', '-');
  } catch {
    return iso;
  }
}

/** "2026/11/06" 格式的完整日期 */
export function formatDateCN(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return fullDateFmt.format(date);
}
