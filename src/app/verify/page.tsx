'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { compressImage } from '@/lib/image-compress';
import { formatUserCode } from '@/lib/user-number';

type PhotoType = 'CARD' | 'FACE';
type VerificationStatus = 'NONE' | 'AI_REVIEWING' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface Template {
  id: string;
  name: string;
  type: string;
  image: string | null;
  isActive: boolean;
}

interface VerificationState {
  verified: boolean;
  verifiedAt: string | null;
  verificationStatus: VerificationStatus;
  verificationRejectReason: string | null;
}

// ---- 图标 (内联 SVG, 与项目其他页面风格一致) ----
const Icon = {
  Back: () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Check: () => (
    <svg className="h-10 w-10 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Robot: () => (
    <svg className="h-10 w-10 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 4v4M8 2h8" strokeLinecap="round" />
      <circle cx="9" cy="14" r="1" fill="currentColor" />
      <circle cx="15" cy="14" r="1" fill="currentColor" />
    </svg>
  ),
  Clock: () => (
    <svg className="h-10 w-10 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  ),
  X: () => (
    <svg className="h-10 w-10 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  ),
  Camera: () => (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Refresh: () => (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function VerifyPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();

  // 认证状态 (来自 GET /api/users/me/verification)
  const [verifyState, setVerifyState] = useState<VerificationState | null>(null);
  const [stateLoading, setStateLoading] = useState(true);

  // 表单状态
  const [photoType, setPhotoType] = useState<PhotoType>('CARD');
  const [photoData, setPhotoData] = useState<string>(''); // base64 data URL (压缩后)
  const [compressing, setCompressing] = useState(false);
  const [faceName, setFaceName] = useState('');
  const [faceId, setFaceId] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'ok' | 'err' | 'info'>('info');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- 加载认证状态 + 模板 ----
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    const load = async () => {
      setStateLoading(true);
      try {
        const data = await api.get<VerificationState>('/api/users/me/verification');
        setVerifyState(data);
      } catch (e: any) {
        setMessage(e.message || '加载失败');
        setMessageType('err');
      } finally {
        setStateLoading(false);
      }
      // 加载模板
      try {
        const res = await api.get<{ templates: Template[] }>('/api/verification-templates?type=IDENTITY');
        setTemplates(res.templates || []);
        if (!selectedTemplateId && (res.templates || []).length > 0) {
          const active = res.templates.find(t => t.isActive);
          setSelectedTemplateId(active?.id || res.templates[0].id);
        }
      } catch { /* 模板可选 */ }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, !!user]);

  // ---- 轮询: AI_REVIEWING / PENDING 每 3 秒刷新 ----
  useEffect(() => {
    if (!verifyState) return;
    const s = verifyState.verificationStatus;
    const shouldPoll = s === 'AI_REVIEWING' || s === 'PENDING';
    if (!shouldPoll) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const data = await api.get<VerificationState>('/api/users/me/verification');
        setVerifyState(data);
        // 如果变成终态, 同时刷新 auth context
        if (data.verificationStatus === 'APPROVED' || data.verificationStatus === 'REJECTED') {
          refreshUser();
        }
      } catch { /* 忽略轮询错误 */ }
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [verifyState?.verificationStatus, refreshUser]);

  // 超级管理员自动通过身份认证 (前端显示绿色卡片)
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const effectiveStatus: VerificationStatus = isSuperAdmin
    ? 'APPROVED'
    : (verifyState?.verificationStatus || 'NONE');

  const showForm = effectiveStatus === 'NONE' || effectiveStatus === 'REJECTED';

  // ---- 处理拍照 ----
  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setMessage('');
    setMessageType('info');
    try {
      // canvas 最大边 1280px, 质量 0.8
      const compressed = await compressImage(file, 1280, 0.8);
      setPhotoData(compressed);
    } catch {
      setMessage('图片处理失败, 请重试');
      setMessageType('err');
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  // ---- 提交认证 ----
  const handleSubmit = async () => {
    if (!photoData) { setMessage('请先拍摄证件照片'); setMessageType('err'); return; }
    if (photoType === 'FACE' && !faceName.trim()) { setMessage('请填写真实姓名'); setMessageType('err'); return; }
    if (photoType === 'FACE' && !faceId.trim()) { setMessage('请填写学号/工号'); setMessageType('err'); return; }

    setSubmitting(true);
    setMessage('');
    setMessageType('info');
    try {
      const payload: any = {
        photo: photoData,
        photoType,
      };
      if (photoType === 'CARD' && selectedTemplateId) {
        payload.templateId = selectedTemplateId;
      }
      if (photoType === 'FACE') {
        payload.faceName = faceName.trim();
        payload.faceId = faceId.trim();
      }
      const res = await api.post<{ message: string; verificationStatus: VerificationStatus }>(
        '/api/users/me/verification',
        payload,
      );
      setMessage(res.message || '提交成功');
      setMessageType('ok');
      // 刷新用户信息 + 本地状态
      await refreshUser();
      // 立即查一次状态, 进入轮询
      const data = await api.get<VerificationState>('/api/users/me/verification');
      setVerifyState(data);
      // 清空表单, 避免重复提交
      setPhotoData('');
    } catch (e: any) {
      setMessage(e.message || '提交失败');
      setMessageType('err');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || stateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">加载中…</div>
    );
  }
  if (!user) {
    // 未登录, 跳转由路由处理
    return null;
  }

  // ---- 状态卡片 ----
  const StatusCard = () => {
    if (effectiveStatus === 'APPROVED') {
      return (
        <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 p-6 text-center">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <Icon.Check />
          </div>
          <div className="text-lg font-bold text-green-700">✅ 已认证</div>
          {verifyState?.verifiedAt && (
            <div className="mt-1 text-xs text-gray-500">
              认证时间: {new Date(verifyState.verifiedAt).toLocaleString('zh-CN')}
            </div>
          )}
          {isSuperAdmin && (
            <div className="mt-2 text-xs text-green-600">超级管理员自动通过身份认证</div>
          )}
          {!isSuperAdmin && (
            <button
              onClick={async () => {
                if (!confirm('申请更改实名信息需重新提交认证, 原认证将被重置。确定继续?')) return;
                try {
                  await api.del('/api/users/me/verification');
                  await refreshUser();
                  // 清除今天的提醒标记, 回到 profile 后弹出提醒
                  localStorage.removeItem('auth_reminder_date');
                  router.push('/profile');
                } catch (e: any) {
                  alert(e.message || '操作失败');
                }
              }}
              className="mt-4 text-xs text-blue-500 hover:underline"
            >
              更改实名
            </button>
          )}
        </div>
      );
    }

    if (effectiveStatus === 'AI_REVIEWING') {
      return (
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6 text-center">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center animate-pulse">
            <Icon.Robot />
          </div>
          <div className="text-lg font-bold text-blue-700">🤖 AI 初审中</div>
          <div className="mt-1 text-xs text-gray-500">AI 正在识别照片, 通常几秒钟完成</div>
          <div className="mt-4 h-2 w-full rounded-full bg-blue-100 overflow-hidden">
            <div className="h-full w-2/3 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full animate-pulse" />
          </div>
        </div>
      );
    }

    if (effectiveStatus === 'PENDING') {
      return (
        <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-6 text-center">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center">
            <Icon.Clock />
          </div>
          <div className="text-lg font-bold text-orange-700">⏳ 等待人工复核</div>
          <div className="mt-1 text-xs text-gray-500">AI 初审已通过, 管理员将尽快完成复核</div>
          <div className="mt-4 h-2 w-full rounded-full bg-orange-100 overflow-hidden">
            <div className="h-full w-3/4 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full" />
          </div>
        </div>
      );
    }

    if (effectiveStatus === 'REJECTED') {
      return (
        <div className="rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 p-6 text-center">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <Icon.X />
          </div>
          <div className="text-lg font-bold text-red-700">❌ 认证被驳回</div>
          {verifyState?.verificationRejectReason && (
            <div className="mt-2 rounded-lg bg-white/60 border border-red-100 px-3 py-2 text-sm text-red-600">
              原因: {verifyState.verificationRejectReason}
            </div>
          )}
          <div className="mt-4 text-xs text-gray-500">请核对照片后重新提交</div>
        </div>
      );
    }

    return null;
  };

  // ---- 表单 ----
  const Form = () => (
    <div className="space-y-5">
      {/* 照片类型切换 */}
      <div className="rounded-2xl bg-white shadow-sm p-4">
        <div className="mb-3 text-sm font-medium text-gray-700">照片类型</div>
        <div className="flex gap-2">
          {([
            { k: 'CARD', label: '卡面' },
            { k: 'FACE', label: '人脸' },
          ] as { k: PhotoType; label: string }[]).map(t => (
            <button
              key={t.k}
              onClick={() => { setPhotoType(t.k); setPhotoData(''); setMessage(''); }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
                photoType === t.k
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* [卡面模式] 模板选择 */}
      {photoType === 'CARD' && templates.length > 0 && (
        <div className="rounded-2xl bg-white shadow-sm p-4">
          <div className="mb-3 text-sm font-medium text-gray-700">选择模板 (可选)</div>
          <div className="grid grid-cols-2 gap-2">
            {templates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => setSelectedTemplateId(tpl.id)}
                className={`rounded-xl border p-2 text-left transition ${
                  selectedTemplateId === tpl.id
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tpl.image ? (
                  <img src={tpl.image} alt={tpl.name} className="w-full h-20 object-cover rounded-lg mb-2" />
                ) : (
                  <div className="w-full h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400 mb-2">
                    案例图
                  </div>
                )}
                <div className="text-xs font-medium text-gray-700 truncate">{tpl.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 拍照区 */}
      <div className="rounded-2xl bg-white shadow-sm p-4">
        <div className="mb-3 text-sm font-medium text-gray-700">
          {photoType === 'CARD' ? '拍摄卡面照片' : '拍摄人脸照片'}
        </div>

        {photoData ? (
          <div className="relative">
            <img src={photoData} alt="preview" className="w-full rounded-xl border border-gray-200" />
            <button
              onClick={() => setPhotoData('')}
              className="mt-3 w-full rounded-xl border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1"
            >
              <Icon.Refresh /> 重新拍摄
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={compressing}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-10 text-center hover:border-blue-400 hover:bg-blue-50 transition disabled:opacity-50"
          >
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
              <Icon.Camera />
            </div>
            <div className="text-sm font-medium text-gray-700">
              {compressing ? '处理中…' : '拍摄证件照片'}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              {photoType === 'CARD' ? '请确保卡面清晰, 信息可辨识' : '请正对镜头, 光线充足'}
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoFile}
        />
      </div>

      {/* [人脸模式] 姓名 + 学号/工号 */}
      {photoType === 'FACE' && (
        <div className="rounded-2xl bg-white shadow-sm p-4 space-y-3">
          <div>
            <div className="mb-1 text-sm font-medium text-gray-700">真实姓名</div>
            <input
              type="text"
              value={faceName}
              onChange={e => setFaceName(e.target.value)}
              maxLength={32}
              placeholder="请输入真实姓名"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-gray-700">学号 / 工号</div>
            <input
              type="text"
              value={faceId}
              onChange={e => setFaceId(e.target.value)}
              maxLength={32}
              placeholder="请输入学号或工号"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {message && (
        <div className={`rounded-xl px-4 py-2.5 text-sm ${
          messageType === 'ok' ? 'bg-green-50 text-green-700 border border-green-100' :
          messageType === 'err' ? 'bg-red-50 text-red-700 border border-red-100' :
          'bg-blue-50 text-blue-700 border border-blue-100'
        }`}>{message}</div>
      )}

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        disabled={submitting || compressing}
        className="w-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 py-3.5 text-[15px] font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? '提交中…' : effectiveStatus === 'REJECTED' ? '重新提交' : '提交认证'}
      </button>

      <p className="text-center text-xs text-gray-400 leading-relaxed">
        提交后将进入 AI 初审 → 人工复核流程 <br />
        认证通过前部分功能可能受限
      </p>
    </div>
  );

  // ---- 渲染 ----
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-lg px-4 h-12 flex items-center">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
          >
            <Icon.Back />
            <span className="text-sm">返回</span>
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="mx-auto max-w-lg px-4 py-5 space-y-5">
        {/* 标题 */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">身份认证</h1>
          <p className="mt-1 text-sm text-gray-500">完成认证后可解锁全部功能</p>
        </div>

        {/* 状态区 */}
        {StatusCard()}

        {/* 表单 (仅 NONE / REJECTED / 或超管手动重置后显示) */}
        {showForm && <Form />}
      </div>
    </div>
  );
}
