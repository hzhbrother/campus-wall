'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', nickname: '', studentId: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        nickname: form.nickname,
        studentId: form.studentId || undefined,
      });
      router.push('/');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">注册</h1>
      {err && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{err}</div>}
      <form onSubmit={onSubmit} className="space-y-3 card p-5">
        <input className="input" placeholder="昵称" value={form.nickname} onChange={(e) => set('nickname', e.target.value)} required />
        <input className="input" type="email" placeholder="邮箱" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        <input className="input" type="password" placeholder="密码 (至少6位)" value={form.password} onChange={(e) => set('password', e.target.value)} required />
        <input className="input" placeholder="学号 (可选)" value={form.studentId} onChange={(e) => set('studentId', e.target.value)} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? '注册中…' : '注册'}</button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-4">
        已有账号? <Link href="/login">去登录</Link>
      </p>
    </div>
  );
}
