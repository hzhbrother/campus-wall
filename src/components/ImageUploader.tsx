'use client';

import { useRef, useState } from 'react';

interface ImageUploaderProps {
  value?: string;
  onChange: (dataUrl: string | null) => void;
  onUpload?: (file: File) => Promise<string>;
  width?: number;
  height?: number;
  placeholder?: string;
  className?: string;
  compress?: (file: File) => Promise<string>;
}

/**
 * 通用单图上传组件
 * - 点击上传, 上传后显示预览
 * - 再次点击可重新上传 (自动替换)
 * - 右上角 × 删除
 */
export function ImageUploader({
  value,
  onChange,
  onUpload,
  width = 80,
  height = 80,
  placeholder = '上传图片',
  className = '',
  compress,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      if (compress) {
        const dataUrl = await compress(file);
        onChange(dataUrl);
      } else if (onUpload) {
        const url = await onUpload(file);
        onChange(url);
      } else {
        // 兜底: 本地预览
        const reader = new FileReader();
        reader.onload = () => onChange(reader.result as string);
        reader.readAsDataURL(file);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {value ? (
        <div className="relative overflow-hidden rounded-lg" style={{ width, height }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-cover" />
          {/* 删除按钮 */}
          <button
            onClick={() => onChange(null)}
            className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-bl-lg bg-black/60 text-white text-xs leading-none hover:bg-black/80"
            aria-label="删除图片"
          >
            ×
          </button>
          {/* 重新上传覆盖层 */}
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition hover:bg-black/40 hover:opacity-100"
          >
            <span className="text-xs">点击替换</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-500 disabled:opacity-50"
          style={{ width, height }}
        >
          {uploading ? (
            <span className="text-xs">上传中…</span>
          ) : (
            <>
              <svg className="mb-1 h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="text-xs">{placeholder}</span>
            </>
          )}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
