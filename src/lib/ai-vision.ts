// AI 视觉识别: 实名认证初审 + 信息提取
// 支持任意 OpenAI 兼容接口 (OpenAI / DeepSeek / 通义千问 / 豆包 等)
// 通过 AI_VISION_PROVIDER 选择预设, 或用 AI_VISION_BASE_URL + AI_VISION_MODEL 自定义
// 未配置 API Key 时返回 null, 前端降级为纯人工审核

export interface BBox {
  x: number; // 归一化 0-1
  y: number;
  w: number;
  h: number;
}

export interface TemplateField {
  name: string;
  bbox: BBox;
}

// 模板: 超级管理员上传样图并框选需要识别的字段
export interface VerificationTemplate {
  id: string;
  name: string;
  image: string;       // 样图 base64
  fields: TemplateField[];
}

// 识别结果: 字段动态化 (依据模板), 不再写死 name/studentId 等
export interface AiReviewResult {
  isIdCard: boolean;              // 是否为校园卡/学生证/证明材料
  isClear: boolean;               // 是否清晰可辨
  rejectReason?: string;          // AI 初审驳回原因
  fields: Record<string, string>; // 字段名 -> 识别值 (字段名来自模板)
  bboxes: Record<string, BBox>;   // 字段名 -> 用户图中对应位置
  confidence: 'high' | 'medium' | 'low';
  rawText: string;
}

// 各服务商预设 (均为 OpenAI 兼容的 /v1/chat/completions 接口)
const PROVIDER_PRESETS: Record<string, { baseUrl: string; model: string }> = {
  openai:   { baseUrl: 'https://api.openai.com/v1',                       model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1',                     model: 'deepseek-vl2' },
  doubao:   { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',        model: 'doubao-1-5-vision-pro-32k-250115' },
  qwen:     { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max' },
};

const PROVIDER = (process.env.AI_VISION_PROVIDER || '').toLowerCase();
const preset = PROVIDER_PRESETS[PROVIDER];

const API_KEY = process.env.AI_VISION_API_KEY || '';
const BASE_URL = process.env.AI_VISION_BASE_URL || preset?.baseUrl || 'https://api.openai.com/v1';
const MODEL = process.env.AI_VISION_MODEL || preset?.model || 'gpt-4o-mini';

export function isVisionEnabled() {
  return !!API_KEY;
}

function toDataUrl(b64: string) {
  return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
}

// 调用视觉模型, 可传多张图
async function callVisionMulti(prompt: string, images: string[], maxTokens = 1000): Promise<string | null> {
  if (!API_KEY) return null;
  const content: any[] = [{ type: 'text', text: prompt }];
  for (const img of images) {
    content.push({ type: 'image_url', image_url: { url: toDataUrl(img), detail: 'low' } });
  }
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content }],
        max_tokens: maxTokens,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      console.error('[ai-vision] request failed:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('[ai-vision] error:', e);
    return null;
  }
}

function parseJson(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function normBBox(v: any): BBox | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const x = Number(v.x), y = Number(v.y), w = Number(v.w), h = Number(v.h);
  if ([x, y, w, h].some(n => isNaN(n) || n < 0 || n > 1)) return undefined;
  return { x, y, w, h };
}

// AI 初审 (带模板): 模板样图 + 框选字段定义, 从用户图提取对应字段
export async function preliminaryReview(
  photoBase64: string,
  template?: VerificationTemplate | null,
): Promise<AiReviewResult | null> {
  const hasTemplate = !!template && template.fields.length > 0;
  const fieldNames = hasTemplate ? template!.fields.map(f => f.name) : [];

  // 字段定义文本: 字段名 + 在模板样图上的归一化坐标
  const fieldDefs = hasTemplate
    ? template!.fields.map(f =>
        `- "${f.name}": 模板上位置 {x:${f.bbox.x}, y:${f.bbox.y}, w:${f.bbox.w}, h:${f.bbox.h}}`
      ).join('\n')
    : '';

  const fieldsJson = hasTemplate
    ? fieldNames.map(n => `"${n}": ""`).join(',\n    ')
    : '"name": "",\n    "studentId": "",\n    "school": ""';

  const bboxesJson = hasTemplate
    ? fieldNames.map(n => `"${n}": {"x":0,"y":0,"w":0,"h":0}`).join(',\n    ')
    : '"name": {"x":0,"y":0,"w":0,"h":0},\n    "studentId": {"x":0,"y":0,"w":0,"h":0}';

  const templateNote = hasTemplate
    ? `第一张图是识别模板样图, 其中需要提取的字段及在模板上的位置如下 (坐标为相对图片宽高的归一化值 0-1):\n${fieldDefs}\n请在第二张图 (用户上传) 中找到与模板中每个字段对应的区域, 提取其中的文字。`
    : `请提取以下信息: 姓名、学号、学校名称。`;

  const prompt = `你是校园卡审核助手。${templateNote}

同时请判断第二张图是否为校园卡/学生证/学生证明材料, 以及是否清晰可辨。
请以严格 JSON 返回 (不要任何解释文字):
{
  "isIdCard": true/false,
  "isClear": true/false,
  "rejectReason": "若不是校园卡或不清晰, 说明原因; 否则留空",
  "fields": {
    ${fieldsJson}
  },
  "bboxes": {
    ${bboxesJson}
  },
  "confidence": "high|medium|low"
}
边界框坐标为相对第二张图 (用户图) 宽高的归一化值 (0-1), x/y 为左上角, w/h 为宽高。无法定位或无法识别的字段, 值留空字符串、bbox 可省略。`;

  const images = hasTemplate ? [template!.image, photoBase64] : [photoBase64];
  const text = await callVisionMulti(prompt, images, 1000);
  if (!text) return null;
  const parsed = parseJson(text);
  if (!parsed) return null;

  const fields: Record<string, string> = {};
  const bboxes: Record<string, BBox> = {};
  const names = hasTemplate ? fieldNames : ['name', 'studentId', 'school'];
  for (const n of names) {
    const v = parsed.fields?.[n];
    if (typeof v === 'string' && v.trim()) fields[n] = v.trim();
    const b = normBBox(parsed.bboxes?.[n]);
    if (b) bboxes[n] = b;
  }

  return {
    isIdCard: !!parsed.isIdCard,
    isClear: !!parsed.isClear,
    rejectReason: parsed.rejectReason || undefined,
    fields,
    bboxes,
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    rawText: text,
  };
}

// 兼容旧接口 (管理端手动识图)
export async function extractIdInfo(
  photoBase64: string,
  template?: VerificationTemplate | null,
): Promise<AiReviewResult | null> {
  return preliminaryReview(photoBase64, template);
}
