// AI 图片真实性检测: 判断上传的认证照片是否存在 AI 生成痕迹
//
// 检测提供商 (通过环境变量 AI_IMAGE_DETECT_PROVIDER 选择):
//   1. local     → 本地启发式检测 (默认, 免费, 零依赖, 准确率有限仅作辅助)
//   2. hive      → Hive AI 图像鉴伪 (需 HIVE_API_KEY)
//   3. sensity   → Sensity AI 深度伪造检测 (需 SENSITY_API_KEY)
//
// 检测结果结构:
//   { isAiGenerated: boolean, confidence: 'low'|'medium'|'high', note: string }

export interface AiImageCheckResult {
  isAiGenerated: boolean;       // 是否疑似 AI 生成
  confidence: 'low' | 'medium' | 'high'; // 置信度
  note: string;                 // 说明文字 (供审核员参考)
  provider?: string;            // 实际使用的检测提供商
  raw?: any;                    // 原始检测数据 (调试用)
}

const PROVIDER = (process.env.AI_IMAGE_DETECT_PROVIDER || 'local').toLowerCase();
const HIVE_API_KEY = process.env.HIVE_API_KEY || '';
const SENSITY_API_KEY = process.env.SENSITY_API_KEY || '';

// 已知 AI 生成工具的软件签名关键词 (大小写不敏感)
const AI_SOFTWARE_MARKERS = [
  'midjourney', 'stable diffusion', 'stablediffusion', 'sdxl', 'sd 1.',
  'dall-e', 'dalle', 'dall·e', 'gan', 'stylegan', 'biggan',
  'novelai', 'niji', 'controlnet', 'comfyui', 'automatic1111',
  'playground', 'playgroundai', 'leonardo', 'runway', 'ideogram',
  'adobe firefly', 'firefly', 'bing image creator', 'copilot',
  'gpt-4o', 'meta ai', 'imagen', 'vega', 'sora', 'luma',
];

/**
 * 检测图片是否存在 AI 生成痕迹
 * @param base64 图片的 base64 (含 data:image/...;base64, 前缀或纯 base64 均可)
 */
export async function detectAiImage(base64: string): Promise<AiImageCheckResult> {
  if (!base64) {
    return { isAiGenerated: false, confidence: 'low', note: '无图片数据' };
  }

  try {
    if (PROVIDER === 'hive' && HIVE_API_KEY) {
      return await detectWithHive(base64);
    }
    if (PROVIDER === 'sensity' && SENSITY_API_KEY) {
      return await detectWithSensity(base64);
    }
    // 默认: 本地启发式检测 (零依赖, 免费)
    return detectWithLocal(base64);
  } catch (e: any) {
    // 检测失败不阻断提交流程, 返回未知状态
    return {
      isAiGenerated: false,
      confidence: 'low',
      note: `AI 检测异常: ${e?.message || '未知错误'}, 请人工复核`,
      provider: PROVIDER,
    };
  }
}

// ---------- 本地启发式检测 (零依赖, 免费) ----------
// 综合多项特征给出风险提示, 准确率有限, 仅供人工复核参考:
//   1. EXIF 相机信息: 有真实相机厂商/型号 → 真拍概率高
//   2. 软件签名: EXIF/PNG tEXt 含已知 AI 工具名 → 疑似 AI
//   3. 尺寸特征: 正方形且边长为 2 的幂 (256/512/1024 等) → 轻微可疑
//   4. EXIF 完整度: 完全无相机元数据 → 中性 (压缩也会去 EXIF)
function detectWithLocal(base64: string): AiImageCheckResult {
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  let buf: Buffer;
  try {
    buf = Buffer.from(cleanBase64, 'base64');
  } catch {
    return { isAiGenerated: false, confidence: 'low', note: '图片数据解析失败, 请人工复核', provider: 'local' };
  }

  if (buf.length < 4) {
    return { isAiGenerated: false, confidence: 'low', note: '图片数据过小, 请人工复核', provider: 'local' };
  }

  const meta = parseImageMeta(buf);
  const reasons: string[] = [];
  let score = 0; // 累计可疑分

  // 1. 软件签名命中 AI 工具 → 强信号
  const software = (meta.software || '').toLowerCase();
  const hitMarker = AI_SOFTWARE_MARKERS.find(m => software.includes(m));
  if (hitMarker) {
    score += 60;
    reasons.push(`软件签名含「${hitMarker}」`);
  }

  // 2. 相机信息: 有真实 Make/Model → 真拍概率高 (减分)
  if (meta.make || meta.model) {
    score -= 40;
    reasons.push(`含相机信息: ${[meta.make, meta.model].filter(Boolean).join(' ')}`);
  }

  // 3. 尺寸: 正方形 + 2 的幂 → 轻微可疑
  if (meta.width && meta.height) {
    const isSquare = meta.width === meta.height;
    const isPow2 = (n: number) => n > 0 && (n & (n - 1)) === 0;
    if (isSquare && isPow2(meta.width)) {
      score += 25;
      reasons.push(`尺寸 ${meta.width}×${meta.height} (AI 常见正方形 2 的幂)`);
    }
  }

  // 4. 完全无 EXIF 相机信息且非纯压缩图 → 轻微中性提示
  if (!meta.make && !meta.model && !meta.hasExif) {
    score += 10;
    reasons.push('无相机 EXIF 元数据');
  }

  // 归一化到 0-100
  const finalScore = Math.max(0, Math.min(100, score));
  const isAi = finalScore >= 50;
  const confidence: 'low' | 'medium' | 'high' =
    finalScore >= 75 ? 'high' : finalScore >= 50 ? 'medium' : 'low';

  const note = reasons.length
    ? `${isAi ? '疑似 AI 生成' : '未检测到明显 AI 痕迹'} (本地启发式, 分值 ${finalScore}): ${reasons.join('; ')}。请人工复核`
    : '本地启发式检测未发现明显特征, 请人工复核';

  return {
    isAiGenerated: isAi,
    confidence,
    note,
    provider: 'local',
    raw: { score: finalScore, reasons, ...meta },
  };
}

// 解析 JPEG EXIF + PNG tEXt 的基础元数据 (零依赖)
function parseImageMeta(buf: Buffer): {
  make?: string; model?: string; software?: string;
  width?: number; height?: number; hasExif: boolean; format: string;
} {
  const result: any = { hasExif: false, format: 'unknown' };

  // JPEG: FFD8FF
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    result.format = 'jpeg';
    // 扫描 APP1 (FFE1) EXIF 段
    let i = 2;
    while (i < buf.length - 4) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      // APP0 (E0) / APP1 (E1) / APP2 (E2) ...
      if (marker >= 0xe0 && marker <= 0xef) {
        const segLen = buf.readUInt16BE(i + 2);
        if (marker === 0xe1 && segLen >= 8) {
          // 检查 "Exif\0\0" 头
          const head = buf.toString('ascii', i + 4, i + 10);
          if (head.startsWith('Exif')) {
            result.hasExif = true;
            const tiffStart = i + 10;
            const endian = buf[tiffStart] === 0x49 ? 'LE' : 'BE';
            readIfdEntries(buf, tiffStart, endian, result);
          }
        }
        i += 2 + segLen;
      } else if (marker === 0xda) { // SOS 图像数据开始
        break;
      } else if (marker >= 0xc0 && marker <= 0xc3) { // SOF0-3 含尺寸
        const h = buf.readUInt16BE(i + 5);
        const w = buf.readUInt16BE(i + 7);
        result.width = w; result.height = h;
        i += 2 + buf.readUInt16BE(i + 2);
      } else if ((marker >= 0xc4 && marker <= 0xc8) || marker === 0xdb || marker === 0xdd) {
        i += 2 + buf.readUInt16BE(i + 2);
      } else {
        i += 2;
      }
    }
  }
  // PNG: 89504E47
  else if (buf[0] === 0x89 && buf[1] === 0x50) {
    result.format = 'png';
    let i = 8;
    while (i < buf.length - 8) {
      const len = buf.readUInt32BE(i);
      const type = buf.toString('ascii', i + 4, i + 8);
      if (type === 'IHDR') {
        result.width = buf.readUInt32BE(i + 8);
        result.height = buf.readUInt32BE(i + 12);
      } else if (type === 'tEXt' || type === 'zTXt') {
        const text = buf.toString('latin1', i + 8, i + 8 + Math.min(len, 200));
        const sep = text.indexOf('\0');
        const key = text.slice(0, sep).toLowerCase();
        const val = text.slice(sep + 1);
        if (key === 'software') result.software = val;
        if (key === 'description') result.software = result.software || val;
      } else if (type === 'IEND') break;
      i += 12 + len; // 4(len) + 4(type) + data + 4(crc)
    }
  }

  return result;
}

// 读取 IFD0 的 Make/Model/Software 条目
function readIfdEntries(buf: Buffer, tiffStart: number, endian: 'LE' | 'BE', out: any) {
  try {
    const read16 = endian === 'LE'
      ? (o: number) => buf.readUInt16LE(tiffStart + o)
      : (o: number) => buf.readUInt16BE(tiffStart + o);
    const read32 = endian === 'LE'
      ? (o: number) => buf.readUInt32LE(tiffStart + o)
      : (o: number) => buf.readUInt32BE(tiffStart + o);

    const ifdOffset = read16(2);       // IFD0 偏移 (相对 TIFF 头)
    const count = read16(ifdOffset);
    for (let n = 0; n < count; n++) {
      const entry = ifdOffset + 2 + n * 12;
      const tag = read16(entry);
      const count2 = read32(entry + 4);
      // tag: 0x010F=Make, 0x0110=Model, 0x0131=Software
      if (tag === 0x010f || tag === 0x0110 || tag === 0x0131) {
        const valOffset = read32(entry + 8);
        // ASCII type=2, 值在 valOffset 指向的位置 (若 >4 字节)
        const strLen = count2;
        let str: string;
        if (strLen <= 4) {
          str = buf.toString('ascii', tiffStart + entry + 8, tiffStart + entry + 8 + strLen);
        } else {
          str = buf.toString('ascii', tiffStart + valOffset, tiffStart + valOffset + strLen);
        }
        str = str.replace(/\0+$/, '').trim();
        if (tag === 0x010f) out.make = str;
        else if (tag === 0x0110) out.model = str;
        else if (tag === 0x0131) out.software = str;
      }
    }
  } catch {
    // EXIF 解析失败不致命, 静默忽略
  }
}

// ---------- Hive AI 图像鉴伪 ----------
// 文档: https://docs.thehive.ai/reference/post-visual-ai-generated-image-detection
async function detectWithHive(base64: string): Promise<AiImageCheckResult> {
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  const resp = await fetch('https://api.thehive.ai/api/v2/task/sync', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${HIVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_public_url: cleanBase64.startsWith('http') ? cleanBase64 : undefined,
      image_raw: cleanBase64.startsWith('http') ? undefined : cleanBase64,
      options: { model: 'genai-detector' },
    }),
  });
  if (!resp.ok) throw new Error(`Hive API ${resp.status}`);
  const data = await resp.json();
  const output = data?.status?.[0]?.response?.output?.[0];
  // Hive 返回 classes: [{ class: 'ai_generated', score: 0.9 }, { class: 'not_ai_generated', score: 0.1 }]
  const aiScore = output?.classes?.find((c: any) => c.class === 'ai_generated')?.score ?? 0;
  const isAi = aiScore >= 0.6;
  const confidence: 'low' | 'medium' | 'high' =
    aiScore >= 0.85 ? 'high' : aiScore >= 0.6 ? 'medium' : 'low';
  return {
    isAiGenerated: isAi,
    confidence,
    note: isAi
      ? `疑似 AI 生成 (置信度 ${(aiScore * 100).toFixed(0)}%), 请人工复核`
      : `未检测到明显 AI 痕迹 (AI 概率 ${(aiScore * 100).toFixed(0)}%)`,
    provider: 'hive',
    raw: data,
  };
}

// ---------- Sensity AI 深度伪造检测 ----------
async function detectWithSensity(base64: string): Promise<AiImageCheckResult> {
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  const resp = await fetch('https://api.sensity.ai/v1/detect', {
    method: 'POST',
    headers: {
      'X-API-Key': SENSITY_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image_base64: cleanBase64 }),
  });
  if (!resp.ok) throw new Error(`Sensity API ${resp.status}`);
  const data = await resp.json();
  // Sensity 返回 deepfake_probability (0-1)
  const prob = data?.deepfake_probability ?? 0;
  const isAi = prob >= 0.6;
  const confidence: 'low' | 'medium' | 'high' =
    prob >= 0.85 ? 'high' : prob >= 0.6 ? 'medium' : 'low';
  return {
    isAiGenerated: isAi,
    confidence,
    note: isAi
      ? `疑似 AI/深度伪造 (概率 ${(prob * 100).toFixed(0)}%), 请人工复核`
      : `未检测到明显 AI 痕迹 (AI 概率 ${(prob * 100).toFixed(0)}%)`,
    provider: 'sensity',
    raw: data,
  };
}
