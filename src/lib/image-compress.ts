// 图片压缩工具: 使用 canvas 压缩后返回 base64 data URL
// preserveTransparency=true 时, 对 PNG 保留透明背景 (输出 PNG), 其他类型仍用 JPEG
export function compressImage(file: File, maxWidth = 1024, quality = 0.7, preserveTransparency = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas 不可用')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        // PNG 保留透明背景 (徽章/奖牌等透明图), 其他用 JPEG
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        if (preserveTransparency && isPng) {
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(canvas.toDataURL('image/jpeg', quality));
        }
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}
