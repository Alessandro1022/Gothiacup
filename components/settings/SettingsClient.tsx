'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { tenant } from '@/lib/tenant';

export default function SettingsClient() {
  const { tr } = useLang();
  const supabase = createClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('event_settings').select('event_name,primary_color').eq('id', 1).single();
    if (data) { setName(data.event_name ?? ''); setColor(data.primary_color ?? ''); }
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const save = async (reset = false) => {
    await supabase.from('event_settings').update({
      event_name: reset ? null : (name || null),
      primary_color: reset ? null : (color || null),
      updated_at: new Date().toISOString()
    }).eq('id', 1);
    if (reset) { setName(''); setColor(''); }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <>
      <h1 className="page-title">{tr('settings')}</h1>
      <div className="page-sub">White-label · standard: {tenant.event.name}</div>

      <div className="card" style={{ maxWidth: 560 }}>
        <label className="label">{tr('eventName')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={tenant.event.name} />
        <label className="label">{tr('primaryColor')}</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" value={color} onChange={(e) => setColor(e.target.value)} placeholder={tenant.theme.primary} style={{ flex: 1 }} />
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : tenant.theme.primary}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 46, height: 42, border: '1px solid var(--line)', borderRadius: 10, background: '#fff', padding: 3 }} />
        </div>
        <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-primary" onClick={() => save(false)}>{tr('saveSettings')}</button>
          <button className="btn" onClick={() => save(true)}>{tr('resetLbl')}</button>
        </div>
        {saved && <div className="ok-msg">{tr('settingsSaved')}</div>}
      </div>
    </>
  );
}
