'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { tenant } from '@/lib/tenant';
import { useLang } from '@/components/LanguageProvider';

export default function LoginPage() {
  const { tr } = useLang();
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true); setError(''); setMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.push('/dashboard');
    router.refresh();
  };

  const magic = async () => {
    setBusy(true); setError(''); setMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setMsg(tr('magicSent'));
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand" style={{ padding: 0, marginBottom: 16 }}>
          <div className="brand-badge">{tenant.event.logoText}</div>
          <div>
            <div className="brand-name">{tenant.event.name}</div>
            <div className="brand-sub" style={{ color: '#6b7280' }}>TournamentOps</div>
          </div>
        </div>

        <label className="label">{tr('email')}</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />

        <label className="label">{tr('password')}</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />

        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          <button className="btn btn-primary" disabled={busy || !email} onClick={signIn}>{tr('signIn')}</button>
          <button className="btn" disabled={busy || !email} onClick={magic}>{tr('magicLink')}</button>
        </div>

        {error && <div className="form-error">{error}</div>}
        {msg && <div className="ok-msg">{msg}</div>}
      </div>
    </div>
  );
}
