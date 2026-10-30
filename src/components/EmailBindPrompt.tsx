'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

// 邮箱绑定引导 (7 天一个周期)
// - 已绑定邮箱 → 永不弹出
// - 刚注册的本次会话 → 不弹 (下次打开网站再弹)
// - 点「以后再说」→ 7 天后再弹
const SNOOZE_KEY = 'email_prompt_snooze_until';
const SESSION_SKIP_KEY = 'email_prompt_skip_session';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export default function EmailBindPrompt() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (!user || user.email) { setOpen(false); return; }
    try {
      if (sessionStorage.getItem(SESSION_SKIP_KEY)) return;
      const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      if (snoozeUntil > Date.now()) return;
    } catch { /* 隐私模式下 storage 不可用, 正常弹 */ }
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [user]);

  if (!open) return null;

  const snooze = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SEVEN_DAYS)); } catch {}
    setOpen(false);
  };

  const sendCode = async () => {
    if (!email.trim()) { setMsg('请先输入邮箱'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg('邮箱格式不正确'); return; }
    setSending(true); setMsg('');
    try {
      await api.post('/api/users/me/email/send-code', { email: email.trim() });
      setCountdown(60);
      setMsg('验证码已发送, 请查收邮件');
    } catch (e: any) { setMsg(e.message); }
    finally { setSending(false); }
  };

  const confirm = async () => {
    if (!email.trim()) { setMsg('请输入邮箱'); return; }
    if (!code.trim()) { setMsg('请输入验证码'); return; }
    setSaving(true); setMsg('');
    try {
      await api.patch('/api/users/me', { email: email.trim(), emailCode: code.trim() });
      await refreshUser?.();
      setOpen(false);
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={snooze}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-3xl">📧</div>
        <h3 className="text-center text-base font-bold text-gray-900">绑定邮箱 (选填)</h3>
        <p className="mt-1 text-center text-xs text-gray-500 leading-relaxed">
          绑定后可找回密码、接收通知。<br />也可以随时在个人中心绑定。
        </p>

        <div className="mt-4 space-y-3">
          <input
            type="email"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
            placeholder="请输入邮箱"
            value={email}
            onChange={e => { setEmail(e.target.value); setMsg(''); }}
          />

          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="6位验证码"
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setMsg(''); }}
            />
            <button
              type="button"
              onClick={sendCode}
              disabled={sending || countdown > 0}
              className="shrink-0 rounded-xl bg-blue-500 px-4 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {sending ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码'}
            </button>
          </div>

          {msg && <p className="text-center text-xs text-red-500">{msg}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={snooze}
              disabled={saving}
              className="flex-1 rounded-xl bg-gray-100 py-3 text-sm text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              以后再说
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={saving}
              className="flex-1 rounded-xl bg-blue-500 py-3 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '绑定中…' : '确认绑定'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
