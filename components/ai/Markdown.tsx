'use client';
// Enkel formatering av AI-svaren: rubriker, fetstil, punktlistor.
import React from 'react';

function inline(text: string, key: number) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <React.Fragment key={key}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </React.Fragment>
  );
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();

    if (!trimmed) { out.push(<div key={idx} style={{ height: 8 }} />); return; }

    // Rubrik: ## Text  eller  **Text:** ensam på raden
    if (/^#{1,4}\s/.test(trimmed)) {
      out.push(
        <h3 key={idx} style={{ fontSize: 15.5, margin: '16px 0 6px' }}>
          {trimmed.replace(/^#{1,4}\s/, '')}
        </h3>
      );
      return;
    }
    if (/^\*\*[^*]+\*\*:?$/.test(trimmed)) {
      out.push(
        <h3 key={idx} style={{ fontSize: 15.5, margin: '16px 0 6px' }}>
          {trimmed.replace(/\*\*/g, '').replace(/:$/, '')}
        </h3>
      );
      return;
    }

    // Punktlista, med indrag för undernivåer
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      const indent = (line.length - line.trimStart().length) >= 2 ? 16 : 0;
      out.push(
        <div key={idx} style={{
          display: 'flex', gap: 9, marginLeft: indent,
          padding: '3px 0', alignItems: 'flex-start'
        }}>
          <span style={{ color: 'var(--primary)', lineHeight: 1.5, flexShrink: 0 }}>•</span>
          <span style={{ flex: 1 }}>{inline(bullet[1], idx)}</span>
        </div>
      );
      return;
    }

    // Numrerad rad
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      out.push(
        <div key={idx} style={{ display: 'flex', gap: 9, padding: '3px 0' }}>
          <b style={{ color: 'var(--primary)', flexShrink: 0 }}>{numbered[1]}.</b>
          <span style={{ flex: 1 }}>{inline(numbered[2], idx)}</span>
        </div>
      );
      return;
    }

    out.push(<p key={idx} style={{ padding: '3px 0' }}>{inline(trimmed, idx)}</p>);
  });

  return <div style={{ fontSize: 15, lineHeight: 1.55 }}>{out}</div>;
}
