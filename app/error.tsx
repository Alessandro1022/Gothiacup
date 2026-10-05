'use client';
// Fångar fel i en enskild sida. Resten av appen – meny, topbar – står kvar.
export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="panel" style={{ maxWidth: 560, margin: '24px auto', padding: 22 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        Sidan kunde inte visas
      </div>
      <p className="muted" style={{ margin: '0 0 16px' }}>
        Ett fel uppstod när den här sidan laddades. Övriga delar av systemet fungerar.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => reset()}>Försök igen</button>
        <a className="btn btn-ghost" href="/dashboard">Till översikten</a>
      </div>
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13 }} className="muted">
          Teknisk information
        </summary>
        <pre
          className="muted"
          style={{
            marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontSize: 12, background: 'var(--bg)', padding: 10, borderRadius: 8
          }}
        >
          {error?.message || 'Okänt fel'}
          {error?.digest ? `\n\nKod: ${error.digest}` : ''}
        </pre>
      </details>
    </div>
  );
}
