// 实名认证识别: OCR 文字提取 + (可选) AI 视觉判断
//
// 识别提供商 (通过环境变量 OCR_PROVIDER 选择, 优先级从高到低):
//   1. ocrspace  → OcrSpace 免费 OCR (中文支持, 返回文字坐标)
//   2. baidu     → 百度 OCR (中文识别更准, 需 API Key + Secret Key)
//   3. vision    → OpenAI 兼容视觉大模型 (仅作图片质量判断兜底, 不作为主要文字提取)
//
// 文字提取策略:
//   - 若配置了 OCR Provider: 调用 OCR 拿到带坐标的文字, 按认证模板框选区域映射字段
//   - 若无模板: 用正则从全文中兜底提取 (姓名/学号/学院 等)
//   - 若同时配置了视觉大模型: 用视觉模型判断 "是否校园卡 / 是否清晰"
//   - 否则用 OCR 文本关键词 + 字数启发式判断

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

// OCR 识别出的单个词 (像素坐标)
export interface OcrWord {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

// OCR 原始结果
export interface OcrResult {
  text: string;          // 全文 (按行拼接)
  words: OcrWord[];      // 带坐标的词
  imgWidth: number;      // 图片宽 (px)
  imgHeight: number;     // 图片高 (px)
}

// 识别结果: 字段动态化 (依据模板), 不再写死 name/studentId 等
export interface AiReviewResult {
  isIdCard: boolean;              // 是否为校园卡/学生证/证明材料
  isClear: boolean;               // 是否清晰可辨
  rejectReason?: string;          // 初审驳回原因
  fields: Record<string, string>; // 字段名 -> 识别值 (字段名来自模板)
  bboxes: Record<string, BBox>;   // 字段名 -> 用户图中对应位置 (归一化)
  avatarBbox?: BBox;              // 头像区域的归一化坐标 (模板中名为"头像"的字段)
  confidence: 'high' | 'medium' | 'low';
  rawText: string;                // OCR 全文 (供人工复核参考)
}

// =====================================================================
// Provider 选择
// =====================================================================
const OCR_PROVIDER = (process.env.OCR_PROVIDER || '').toLowerCase();
const hasOcrSpace = !!process.env.OCR_SPACE_API_KEY;
const hasBaidu = !!process.env.BAIDU_OCR_API_KEY && !!process.env.BAIDU_OCR_SECRET_KEY;
const hasVision = !!process.env.AI_VISION_API_KEY;

// 最终选用的 OCR Provider (ocrspace > baidu > vision)
function resolveOcrProvider(): 'ocrspace' | 'baidu' | 'vision' | null {
  if (OCR_PROVIDER === 'ocrspace' && hasOcrSpace) return 'ocrspace';
  if (OCR_PROVIDER === 'baidu' && hasBaidu) return 'baidu';
  if (OCR_PROVIDER === 'vision' && hasVision) return 'vision';
  // 未显式指定时按可用性自动选择
  if (hasOcrSpace) return 'ocrspace';
  if (hasBaidu) return 'baidu';
  if (hasVision) return 'vision';
  return null;
}

export function isVisionEnabled() {
  return resolveOcrProvider() !== null;
}

// =====================================================================
// 图片尺寸解析 (从 base64 提取宽高, 用于把 OCR 像素坐标归一化)
// =====================================================================
export function getImageSize(base64: string): { width: number; height: number } | null {
  const pure = base64.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(pure, 'base64');
  if (buf.length < 24) return null;

  // PNG: 89 50 4E 47 ... IHDR(4) width(4 BE) height(4 BE)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height };
  }

  // JPEG: FF D8 ... 找 SOF0/C0/C1/C2 标记
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 1) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      // SOF0=0xC0, SOF1=0xC1, SOF2=0xC2
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const height = buf.readUInt16BE(i + 5);
        const width = buf.readUInt16BE(i + 7);
        return { width, height };
      }
      // 跳过该段: marker(1) + length(2 BE, 含 length 自身但不含 marker)
      const len = buf.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }

  // WebP: RIFF....WEBP VP8 ....
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    // VP8 (lossy): 'VP8 ' at offset 12, width/height at offset 26 (14-bit LE)
    if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x20) {
      const w = buf.readUInt16LE(26) & 0x3fff;
      const h = buf.readUInt16LE(28) & 0x3fff;
      return { width: w, height: h };
    }
    // VP8L (lossless): 'VP8L', width at offset 21 (14-bit LE)
    if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x4c) {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      const w = 1 + (((b1 & 0x3f) << 8) | b0);
      const h = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width: w, height: h };
    }
  }

  return null;
}

// 把 data URL 转成纯 base64
function toBase64(b64: string) {
  return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
}
function pureBase64(b64: string) {
  return b64.replace(/^data:image\/\w+;base64,/, '');
}

// =====================================================================
// OcrSpace Provider (免费, 中文, 返回文字坐标)
// 文档: https://ocr.space/OCRAPI
// =====================================================================
async function ocrSpaceRecognize(photoBase64: string): Promise<OcrResult | null> {
  const apiKey = process.env.OCR_SPACE_API_KEY!;
  const endpoint = process.env.OCR_SPACE_ENDPOINT || 'https://api.ocr.space/parse/image';
  const body = new URLSearchParams();
  body.append('base64Image', toBase64(photoBase64));
  body.append('language', 'chs');
  body.append('isOverlayRequired', 'true');
  body.append('scale', 'true');
  body.append('OCREngine', '2');
  body.append('detectOrientation', 'true');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'apikey': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      console.error('[ocr-space] http error:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    if (data.IsErroredOnProcessing || data.OCRExitCode !== 1) {
      console.error('[ocr-space] ocr error:', data.ErrorMessage, data.ErrorDetails);
      return null;
    }
    const parsed = data.ParsedResults?.[0];
    if (!parsed) return null;
    const text: string = parsed.ParsedText || '';
    const words: OcrWord[] = [];
    const lines = parsed.TextOverlay?.Lines || [];
    for (const line of lines) {
      for (const w of line.Words || []) {
        words.push({
          text: w.WordText || '',
          left: Number(w.Left) || 0,
          top: Number(w.Top) || 0,
          width: Number(w.Width) || 0,
          height: Number(w.Height) || 0,
        });
      }
    }
    const size = getImageSize(photoBase64) || { width: 0, height: 0 };
    return { text, words, imgWidth: size.width, imgHeight: size.height };
  } catch (e) {
    console.error('[ocr-space] request failed:', e);
    return null;
  }
}

// =====================================================================
// 百度 OCR Provider (中文识别更准)
// 文档: https://ai.baidu.com/ai-doc/OCR/zk3h7xz52
// =====================================================================
let _baiduToken: string | null = null;
let _baiduTokenAt = 0;

async function baiduGetToken(): Promise<string | null> {
  // token 有效期 30 天, 缓存 25 天
  if (_baiduToken && Date.now() - _baiduTokenAt < 25 * 86400 * 1000) return _baiduToken;
  const apiKey = process.env.BAIDU_OCR_API_KEY!;
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY!;
  try {
    const res = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`,
      { method: 'POST' }
    );
    const data = await res.json();
    if (!data.access_token) {
      console.error('[baidu-ocr] token error:', data.error_description);
      return null;
    }
    _baiduToken = data.access_token;
    _baiduTokenAt = Date.now();
    return _baiduToken;
  } catch (e) {
    console.error('[baidu-ocr] token failed:', e);
    return null;
  }
}

async function baiduRecognize(photoBase64: string): Promise<OcrResult | null> {
  const token = await baiduGetToken();
  if (!token) return null;
  // 通用文字识别 (含位置信息版) 返回每个词的坐标
  const endpoint = `https://aip.baidubce.com/rest/2.0/ocr/v1/general?access_token=${token}`;
  const body = new URLSearchParams();
  body.append('image', pureBase64(photoBase64));
  body.append('language_type', 'CHN_ENG');
  body.append('detect_direction', 'true');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    if (data.error_code) {
      console.error('[baidu-ocr] ocr error:', data.error_code, data.error_msg);
      // token 失效则清缓存
      if (data.error_code === 110 || data.error_code === 111) {
        _baiduToken = null;
      }
      return null;
    }
    const wordsResult = data.words_result || [];
    const lines: string[] = [];
    const words: OcrWord[] = [];
    for (const item of wordsResult) {
      lines.push(item.words || '');
      const loc = item.location;
      if (loc) {
        words.push({
          text: item.words || '',
          left: loc.left || 0,
          top: loc.top || 0,
          width: loc.width || 0,
          height: loc.height || 0,
        });
      }
    }
    const size = getImageSize(photoBase64) || { width: 0, height: 0 };
    return { text: lines.join('\n'), words, imgWidth: size.width, imgHeight: size.height };
  } catch (e) {
    console.error('[baidu-ocr] request failed:', e);
    return null;
  }
}

// =====================================================================
// 视觉大模型 Provider (仅用于图片质量判断: 是否校园卡 / 是否清晰)
// 保留原有实现, 不再作为文字提取的主要手段
// =====================================================================
const PROVIDER_PRESETS: Record<string, { baseUrl: string; model: string }> = {
  openai:   { baseUrl: 'https://api.openai.com/v1',                       model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1',                     model: 'deepseek-vl2' },
  doubao:   { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',        model: 'doubao-1-5-vision-pro-32k-250115' },
  qwen:     { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max' },
};

const VISION_PROVIDER = (process.env.AI_VISION_PROVIDER || '').toLowerCase();
const visionPreset = PROVIDER_PRESETS[VISION_PROVIDER];
const VISION_API_KEY = process.env.AI_VISION_API_KEY || '';
const VISION_BASE_URL = process.env.AI_VISION_BASE_URL || visionPreset?.baseUrl || 'https://api.openai.com/v1';
const VISION_MODEL = process.env.AI_VISION_MODEL || visionPreset?.model || 'gpt-4o-mini';

async function visionJudge(photoBase64: string): Promise<{ isIdCard: boolean; isClear: boolean; rejectReason?: string } | null> {
  if (!VISION_API_KEY) return null;
  const prompt = `请判断这张图片是否为校园卡/学生证/学生证明材料, 以及是否清晰可辨。
请以严格 JSON 返回 (不要任何解释文字):
{
  "isIdCard": true/false,
  "isClear": true/false,
  "rejectReason": "若不是校园卡或不清晰, 说明原因; 否则留空"
}`;
  try {
    const res = await fetch(`${VISION_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VISION_API_KEY}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: toBase64(photoBase64), detail: 'low' } },
        ]}],
        max_tokens: 300,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      console.error('[vision-judge] request failed:', res.status);
      return null;
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    return {
      isIdCard: !!parsed.isIdCard,
      isClear: !!parsed.isClear,
      rejectReason: parsed.rejectReason || undefined,
    };
  } catch (e) {
    console.error('[vision-judge] error:', e);
    return null;
  }
}

// =====================================================================
// OCR 统一入口
// =====================================================================
async function recognizeText(photoBase64: string): Promise<OcrResult | null> {
  const provider = resolveOcrProvider();
  if (provider === 'ocrspace') return ocrSpaceRecognize(photoBase64);
  if (provider === 'baidu') return baiduRecognize(photoBase64);
  // vision provider 不做 OCR, 返回 null 由上层处理
  return null;
}

// =====================================================================
// 字段提取: 模板坐标映射 + 正则兜底
// =====================================================================
// 判断两个归一化矩形是否重叠 (重叠面积占 field 面积比例 >= threshold)
function bboxOverlap(field: BBox, word: BBox): number {
  const ix = Math.max(0, Math.min(field.x + field.w, word.x + word.w) - Math.max(field.x, word.x));
  const iy = Math.max(0, Math.min(field.y + field.h, word.y + word.h) - Math.max(field.y, word.y));
  const fieldArea = field.w * field.h;
  if (fieldArea <= 0) return 0;
  return (ix * iy) / fieldArea;
}

// 用模板字段坐标从 OCR words 中提取字段值
function extractFieldsByTemplate(words: OcrWord[], imgW: number, imgH: number, fields: TemplateField[]) {
  const result: Record<string, string> = {};
  const bboxes: Record<string, BBox> = {};
  if (imgW <= 0 || imgH <= 0) return { result, bboxes };

  // 把 OCR 词归一化
  const normWords = words.map(w => ({
    text: w.text,
    x: w.left / imgW,
    y: w.top / imgH,
    w: w.width / imgW,
    h: w.height / imgH,
  }));

  for (const field of fields) {
    // 收集与 field 框有重叠的词, 按从上到下从左到右排序
    // 降低重叠阈值至 0.05, 避免因坐标微小偏差导致漏匹配
    const hits = normWords
      .filter(w => bboxOverlap(field.bbox, { x: w.x, y: w.y, w: w.w, h: w.h }) > 0.05)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    if (hits.length > 0) {
      result[field.name] = hits.map(h => h.text).join(' ').trim();
      // 字段 bbox 取命中词的合并区域
      const minX = Math.min(...hits.map(h => h.x));
      const minY = Math.min(...hits.map(h => h.y));
      const maxX = Math.max(...hits.map(h => h.x + h.w));
      const maxY = Math.max(...hits.map(h => h.y + h.h));
      bboxes[field.name] = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  }
  return { result, bboxes };
}

// 无模板时, 用正则从全文兜底提取常见字段
function extractFieldsByRegex(text: string) {
  const result: Record<string, string> = {};
  // 姓名
  const name = text.match(/姓\s*名[\s:：]*([\u4e00-\u9fa5·]{2,8})/);
  if (name) result['姓名'] = name[1];
  // 学号
  const sid = text.match(/学\s*号[\s:：]*([A-Za-z0-9]{6,20})/);
  if (sid) result['学号'] = sid[1];
  // 学院 / 系
  const college = text.match(/([\u4e00-\u9fa5]{2,12}(?:学院|系|学部))/);
  if (college) result['学院'] = college[1];
  // 学校
  const school = text.match(/([\u4e00-\u9fa5]{2,12}(?:大学|学校|职业技术学院))/);
  if (school) result['学校'] = school[1];
  // 专业
  const major = text.match(/专\s*业[\s:：]*([\u4e00-\u9fa5]{2,12})/);
  if (major) result['专业'] = major[1];
  // 班级
  const cls = text.match(/班\s*级[\s:：]*([A-Za-z0-9\u4e00-\u9fa5]{2,12})/);
  if (cls) result['班级'] = cls[1];
  return result;
}

// 用 OCR 文本启发式判断是否校园卡 + 是否清晰
function judgeByText(text: string): { isIdCard: boolean; isClear: boolean; rejectReason?: string } {
  const keywords = ['校园卡', '学生证', '学生卡', '一卡通', '借书证', '姓名', '学号', '学院', '大学', '学校', '专业', '班级'];
  const found = keywords.filter(k => text.includes(k));
  const isIdCard = found.length >= 2;
  const charCount = text.replace(/\s/g, '').length;
  const isClear = charCount >= 8;
  let rejectReason: string | undefined;
  if (!isIdCard) rejectReason = '未识别到校园卡/学生证相关信息 (如姓名、学号、学院等)';
  else if (!isClear) rejectReason = '识别到的文字过少, 照片可能不清晰';
  return { isIdCard, isClear, rejectReason };
}

// =====================================================================
// 主入口: AI 初审 (带模板)
// =====================================================================
export async function preliminaryReview(
  photoBase64: string,
  template?: VerificationTemplate | null,
): Promise<AiReviewResult | null> {
  const provider = resolveOcrProvider();
  if (!provider) return null;

  // 1. OCR 提取文字 (vision provider 跳过, 直接用视觉模型)
  let ocr: OcrResult | null = null;
  if (provider !== 'vision') {
    ocr = await recognizeText(photoBase64);
  }

  // 2. 图片质量判断: 优先用视觉大模型, 否则用 OCR 文本启发式
  let judge: { isIdCard: boolean; isClear: boolean; rejectReason?: string };
  const vj = hasVision ? await visionJudge(photoBase64) : null;
  if (vj) {
    judge = vj;
  } else if (ocr) {
    judge = judgeByText(ocr.text);
  } else {
    // 既无 OCR 也无视觉判断, 无法识别
    return null;
  }

  // 3. 字段提取
  const fields: Record<string, string> = {};
  const bboxes: Record<string, BBox> = {};
  const rawText = ocr?.text || '';
  let avatarBbox: BBox | undefined;

  if (ocr && template && template.fields.length > 0) {
    // 按模板字段坐标提取
    const mapped = extractFieldsByTemplate(ocr.words, ocr.imgWidth, ocr.imgHeight, template.fields);
    Object.assign(fields, mapped.result);
    Object.assign(bboxes, mapped.bboxes);

    // 如果模板提取到的字段太少, 用正则兜底补充缺失字段
    if (Object.keys(fields).length < template.fields.length) {
      const regexFields = extractFieldsByRegex(ocr.text);
      for (const [k, v] of Object.entries(regexFields)) {
        if (!fields[k]) fields[k] = v;
      }
    }

    // 按字段名在原文中搜索值 (针对 OCR 坐标不匹配的情况)
    for (const field of template.fields) {
      if (fields[field.name]) continue; // 已有值跳过
      const fn = field.name.trim();
      // 在原文中查找 "字段名:值" 或 "字段名 值" 格式
      const re = new RegExp(`${fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s:：]*([^\\n]{1,30})`, 'i');
      const m = ocr.text.match(re);
      if (m && m[1].trim()) {
        fields[field.name] = m[1].trim();
      }
    }

    // 检查模板中是否有"头像"字段, 记录其 bbox 用于前端裁剪
    const avatarField = template.fields.find(f => {
      const n = f.name.toLowerCase().replace(/\s+/g, '');
      return ['头像', 'avatar', 'photo', '照片', '照片'].includes(n);
    });
    if (avatarField) {
      avatarBbox = avatarField.bbox;
    }
  } else if (ocr) {
    // 无模板时正则兜底
    Object.assign(fields, extractFieldsByRegex(ocr.text));
  }
  // vision provider 时字段为空, 仅做图片质量判断

  // 置信度: OCR 命中字段多且文本充足 → high
  const fieldCount = Object.keys(fields).length;
  const charCount = rawText.replace(/\s/g, '').length;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (fieldCount >= 2 && charCount >= 20) confidence = 'high';
  else if (fieldCount >= 1 || charCount >= 10) confidence = 'medium';

  return {
    isIdCard: judge.isIdCard,
    isClear: judge.isClear,
    rejectReason: judge.rejectReason,
    fields,
    bboxes,
    avatarBbox,
    confidence,
    rawText,
  };
}

// 兼容旧接口 (管理端手动识图)
export async function extractIdInfo(
  photoBase64: string,
  template?: VerificationTemplate | null,
): Promise<AiReviewResult | null> {
  return preliminaryReview(photoBase64, template);
}
