'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/components/LanguageProvider';
import { LanguageProvider } from '@/components/LanguageProvider';

function Inner({ code, userId }: { code: string; userId: string }) {
  const { tr } = useLang();
  const supabase = createClient();
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.from('shifts').select('id').eq('checkin_code', code.toLowerCase()).eq('user_id', userId).limit(1);
      if (!data?.length) { setState('err'); return; }
      await supabase.from('shifts').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', data[0].id);
      setState('ok');
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center' }}>
        {state === 'loading' && <div className="page-sub">{tr('loading')}</div>}
        {state === 'ok' && (
          <>
            <div className="big-num" style={{ color: 'var(--ok)' }}>✓</div>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>{tr('checkedInOk')}</h1>
          </>
        )}
        {state === 'err' && (
          <>
            <div className="big-num" style={{ color: 'var(--danger)' }}>✕</div>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>{tr('wrongCode')}</h1>
          </>
        )}
        <Link href="/shifts" className="btn btn-primary" style={{ display: 'inline-block', marginTop: 14 }}>{tr('shifts')}</Link>
      </div>
    </div>
  );
}

export default function CheckinClient(props: { code: string; userId: string }) {
  return <LanguageProvider><Inner {...props} /></LanguageProvider>;
}
