'use client';
// Bilder och filer på en uppgift, en incident, en felanmälan eller ett
// meddelande. Filen ligger i en privat hink i Supabase Storage. Raden i
// attachments avgör vem som får se den: samma personer som ser det den hör
// till (del 22). Ett foto i ett direktmeddelande är lika privat som texten.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, X, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/components/TenantProvider';

export type ParentType = 'task' | 'incident' | 'room_issue' | 'message';
export type Att = {
  id: string; parent_id: string; file_name: string; mime_type: string; size_bytes: number | null;
  storage_path: string; uploaded_by: string | null; created_at: string; url?: string | null;
};
type Client = ReturnType<typeof createClient>;

const BUCKET = 'bilagor';
const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt';

const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

// Krymp foton före uppladdning. En mobilbild på 4 MB blir ett par hundra kB,
// vilket märks på dålig täckning ute på en plan.
export async function shrinkImage(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const src = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = src;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(src);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

// Laddar upp en fil. Raden skapas först: lagringens behörighet kräver att
// sökvägen redan är registrerad som bilaga av samma person. Misslyckas själva
// uppladdningen tas raden bort igen. Returnerar ett felmeddelande eller null.
export async function uploadAttachment(supabase: Client, o: {
  tenantId: string; parentType: ParentType; parentId: string; userId: string; file: File;
}): Promise<string | null> {
  const blob = await shrinkImage(o.file);
  const shrunk = blob !== o.file;
  const name = shrunk ? `${o.file.name.replace(/\.[^.]+$/, '') || 'bild'}.jpg` : o.file.name;
  if (blob.size > MAX_BYTES) return `${o.file.name} är större än 10 MB.`;
  const safe = name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80) || 'fil';
  const path = `${o.tenantId}/${o.parentType}/${o.parentId}/${uid()}-${safe}`;
  const type = shrunk ? 'image/jpeg' : (o.file.type || 'application/octet-stream');

  const { data: row, error: e1 } = await supabase.from('attachments').insert({
    parent_type: o.parentType, parent_id: o.parentId, storage_path: path,
    file_name: name, mime_type: type, size_bytes: blob.size, uploaded_by: o.userId
  }).select('id').single();
  if (e1) {
    return /row-level security/i.test(e1.message)
      ? 'Du har inte behörighet att bifoga här.'
      : `Bilagan gick inte att spara: ${e1.message}`;
  }

  const { error: e2 } = await supabase.storage.from(BUCKET)
    .upload(path, await blob.arrayBuffer(), { contentType: type, upsert: false });
  if (e2) {
    await supabase.from('attachments').delete().eq('id', row.id);
    return /bucket not found/i.test(e2.message)
      ? 'Lagringen för bilagor saknas. Kör del 22 i Supabase.'
      : `Uppladdningen misslyckades: ${e2.message}`;
  }
  return null;
}

// Signerade länkar för en uppsättning bilagor (giltiga en timme)
export async function signAttachments(supabase: Client, rows: Att[]): Promise<Att[]> {
  if (!rows.length) return rows;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({ ...r, url: byPath.get(r.storage_path) ?? null }));
}

export async function removeAttachment(supabase: Client, a: Att): Promise<string | null> {
  // Filen först: lagringens behörighet slås upp via raden
  const { error: e1 } = await supabase.storage.from(BUCKET).remove([a.storage_path]);
  if (e1) return e1.message;
  const { error: e2 } = await supabase.from('attachments').delete().eq('id', a.id);
  return e2 ? e2.message : null;
}

export const isImage = (a: Att) => a.mime_type.startsWith('image/');
const kb = (n: number | null) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} kB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`);

export function AttachmentList({ items, canDelete, onDelete }: {
  items: Att[]; canDelete?: (a: Att) => boolean; onDelete?: (a: Att) => void;
}) {
  if (!items.length) return null;
  const images = items.filter(isImage);
  const files = items.filter((a) => !isImage(a));
  return (
    <div className="att-list">
      {images.length > 0 && (
        <div className="att-thumbs">
          {images.map((a) => (
            <div key={a.id} className="att-thumb">
              {a.url
                ? <a href={a.url} target="_blank" rel="noopener noreferrer"><img src={a.url} alt={a.file_name} loading="lazy" /></a>
                : <span className="att-missing">Bilden går inte att visa</span>}
              {canDelete?.(a) && onDelete && (
                <button className="att-del" onClick={() => onDelete(a)} aria-label={`Ta bort ${a.file_name}`}><X size={13} /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {files.map((a) => (
        <div key={a.id} className="att-file">
          <FileText size={15} />
          {a.url
            ? <a href={a.url} target="_blank" rel="noopener noreferrer">{a.file_name}</a>
            : <span>{a.file_name}</span>}
          <span className="li-meta" style={{ marginTop: 0 }}>{kb(a.size_bytes)}</span>
          {canDelete?.(a) && onDelete && (
            <button className="att-del inline" onClick={() => onDelete(a)} aria-label={`Ta bort ${a.file_name}`}><X size={13} /></button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Attachments({ parentType, parentId, userId, isAdmin = false, canAdd = true, label = 'Bifoga bild eller fil' }: {
  parentType: ParentType; parentId: string; userId: string;
  isAdmin?: boolean; canAdd?: boolean; label?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const tn = useTenant();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Att[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('attachments').select('*')
      .eq('parent_type', parentType).eq('parent_id', parentId).order('created_at');
    // Saknas tabellen (del 19 inte körd) visas bara knappen inte
    if (error) { setItems([]); return; }
    setItems(await signAttachments(supabase, (data ?? []) as Att[]));
  }, [supabase, parentType, parentId]);

  useEffect(() => { load(); }, [load]);

  const pick = async (list: FileList | null) => {
    if (!list || !list.length) return;
    setBusy(true); setErr('');
    const tenantId = tn.active?.id ?? 'okand';
    for (const file of Array.from(list)) {
      const e = await uploadAttachment(supabase, { tenantId, parentType, parentId, userId, file });
      if (e) { setErr(e); break; }
    }
    if (input.current) input.current.value = '';
    setBusy(false);
    load();
  };

  const del = async (a: Att) => {
    if (!confirm(`Ta bort ${a.file_name}?`)) return;
    const e = await removeAttachment(supabase, a);
    if (e) setErr(e);
    load();
  };

  return (
    <div className="att-box">
      <AttachmentList items={items} canDelete={(a) => a.uploaded_by === userId || isAdmin} onDelete={del} />
      {err && <div className="form-error" style={{ marginTop: 6 }}>{err}</div>}
      {canAdd && (
        <label className={`btn btn-sm att-add ${busy ? 'busy' : ''}`}>
          <Paperclip size={14} /> {busy ? 'Laddar upp…' : label}
          <input ref={input} type="file" accept={ACCEPT} multiple hidden disabled={busy}
            onChange={(e) => pick(e.target.files)} />
        </label>
      )}
    </div>
  );
}
