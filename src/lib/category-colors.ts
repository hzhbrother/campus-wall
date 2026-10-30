// 分类颜色: 默认配色 + 管理员自定义配色解析
export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  日常: '#64748b',
  校园: '#3b82f6',
  失物招领: '#f59e0b',
  二手交易: '#10b981',
  表白墙: '#ec4899',
  寻物启事: '#f97316',
  招聘兼职: '#8b5cf6',
  求助问答: '#06b6d4',
  商业推广: '#ef4444',
};

// 管理员新增分类时可选用的配色盘
export const CATEGORY_PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#64748b',
];

export function parseCategoryColors(raw?: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim())) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length];
}

/** 取分类颜色: 管理员配置 > 内置默认 > 按名称生成的稳定颜色 */
export function getCategoryColor(name: string, colors?: Record<string, string> | null): string {
  if (colors?.[name]) return colors[name];
  if (DEFAULT_CATEGORY_COLORS[name]) return DEFAULT_CATEGORY_COLORS[name];
  return hashColor(name);
}

/** 浅色底 + 同色文字 (用于未选中标签) */
export function categoryTintStyle(hex: string): React.CSSProperties {
  return { backgroundColor: `${hex}1f`, color: hex };
}
