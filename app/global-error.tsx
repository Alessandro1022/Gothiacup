'use client';
// Sista skyddsnätet. Kraschar rotlayouten visas detta i stället för vit skärm.
// Inline-stilar med flit: globals.css kanske inte hann laddas.
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const hardReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const rs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(rs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const ks = await caches.keys();
        await Promise.all(ks.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignorera */
    }
    window.location.href = '/dashboard';
  };

  return (
    <html lang="sv">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#F2F5F9',
          color: '#16202B',
          font: '15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: 24
        }}
      >
        <div style={{ maxWidth: 440, width: '100%' }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #DCE3EC',
              borderRadius: 14,
              padding: 22,
              boxShadow: '0 1px 3px rgba(16,32,48,.08)'
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Appen kunde inte starta
            </div>
            <p style={{ margin: '0 0 16px', color: '#5A6B7D' }}>
              Något gick fel vid uppstarten. Prova knappen nedan – den rensar appens
              sparade filer och startar om.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={hardReload}
                style={{
                  flex: '1 1 auto',
                  minHeight: 46,
                  border: 'none',
                  borderRadius: 10,
                  background: '#1D6FA8',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Rensa och starta om
              </button>
              <button
                onClick={() => reset()}
                style={{
                  flex: '0 0 auto',
                  minHeight: 46,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: '1px solid #DCE3EC',
                  background: '#fff',
                  color: '#16202B',
                  fontSize: 15,
                  cursor: 'pointer'
                }}
              >
                Försök igen
              </button>
            </div>
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', color: '#5A6B7D', fontSize: 13 }}>
                Teknisk information
              </summary>
              <pre
                style={{
                  marginTop: 8,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 12,
                  color: '#5A6B7D',
                  background: '#F2F5F9',
                  padding: 10,
                  borderRadius: 8
                }}
              >
                {error?.message || 'Okänt fel'}
                {error?.digest ? `\n\nKod: ${error.digest}` : ''}
              </pre>
            </details>
          </div>
        </div>
      </body>
    </html>
  );
}
