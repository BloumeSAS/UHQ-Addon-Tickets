import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { errText, useT } from '../i18n';
import { useApi } from '../lib/api';
import { fmtDateTime, initials } from '../lib/format';
import { Attachment, Message, UploadFile } from '../lib/types';
import { Icon } from './icons';

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'];

function kb(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;
}

/** Lecture d'un fichier choisi → base64 (sans préfixe data:). */
function readFile(f: File): Promise<UploadFile> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('FILE_TYPE'));
    r.onload = () => resolve({ name: f.name, type: f.type || 'application/octet-stream', size: f.size, data: String(r.result).split(',')[1] ?? '' });
    r.readAsDataURL(f);
  });
}

/** Pièce jointe cliquable : téléchargement protégé par le jeton du panel. */
export function FileChip({ ticketId, file }: { ticketId: string; file: Attachment }) {
  const api = useApi();
  const t = useT();
  return (
    <button
      type="button"
      className="chip-file"
      title={`${file.name} — ${kb(file.size)}`}
      onClick={() => api.download(`tickets/${ticketId}/files/${file.id}`, file.name).catch((e) => toast.error(errText(t, e)))}
    >
      <Icon name={file.type.startsWith('image/') ? 'eye' : 'file'} size={12} />
      <span className="truncate" style={{ maxWidth: 180 }}>{file.name}</span>
      <span className="text-muted">{kb(file.size)}</span>
    </button>
  );
}

/** Conversation d'un ticket : messages client / support, notes internes (personnel) et événements système. */
export function Thread({ ticketId, messages, staff, lang }: { ticketId: string; messages: Message[]; staff: boolean; lang: 'fr' | 'en' }) {
  const t = useT();

  const sysText = (body: string): string => {
    const raw = body.startsWith('sys:') ? body.slice(4) : body;
    if (!body.startsWith('sys:')) return body; // message automatique rédigé par l'admin
    const [code, ...rest] = raw.split(':');
    const v = rest.join(':');
    const label = code === 'STATUS' ? t(`status.${v}`) : code === 'PRIORITY' ? t(`prio.${v}`) : v;
    return t(`sys.${code}`, { v: label });
  };

  return (
    <div className="msgs">
      {messages.map((m) => {
        if (m.role === 'system') {
          // Les messages automatiques rédigés par l'admin (pas de préfixe) s'affichent comme une réponse du support.
          if (!m.body.startsWith('sys:')) {
            return (
              <div key={m.id} className="msg staff">
                <span className="avatar"><Icon name="lifebuoy" size={14} /></span>
                <div className="bubble"><div className="who"><b>{t('team')}</b><span>{fmtDateTime(m.at, lang)}</span></div><div className="text">{m.body}</div></div>
              </div>
            );
          }
          return <div key={m.id} className="sys-line">{sysText(m.body)} · {fmtDateTime(m.at, lang)}</div>;
        }
        const mine = m.role === 'customer';
        const cls = `msg ${mine ? '' : 'staff'} ${m.internal ? 'note' : ''}`;
        return (
          <div key={m.id} className={cls}>
            <span className="avatar">{mine ? initials(m.author_email) : <Icon name="lifebuoy" size={14} />}</span>
            <div className="bubble">
              <div className="who">
                <b>{staff ? m.author_email : mine ? t('you') : t('team')}</b>
                {m.internal && <span className="badge badge-warn">{t('internalNote')}</span>}
                <span>{fmtDateTime(m.at, lang)}</span>
              </div>
              <div className="text">{m.body}</div>
              {m.attachments.length > 0 && <div className="chips">{m.attachments.map((a) => <FileChip key={a.id} ticketId={ticketId} file={a} />)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Sélecteur de pièces jointes (3 fichiers, 2 Mo) : valide type et taille côté navigateur, le serveur revérifie. */
export function FilePicker({ files, onChange, max = 3, maxMb = 2 }: { files: UploadFile[]; onChange: (f: UploadFile[]) => void; max?: number; maxMb?: number }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (list: FileList | null) => {
    if (!list) return;
    setBusy(true);
    try {
      const next = [...files];
      for (const f of Array.from(list)) {
        if (next.length >= max) break;
        if (!ALLOWED.includes(f.type)) { toast.error(t('err.FILE_TYPE')); continue; }
        if (f.size > maxMb * 1024 * 1024) { toast.error(t('err.FILE_SIZE')); continue; }
        next.push(await readFile(f));
      }
      onChange(next);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="stack-sm">
      <div className="row">
        <button type="button" className="btn btn-outline btn-sm" disabled={busy || files.length >= max} onClick={() => input.current?.click()}>
          <Icon name="paperclip" size={13} />{t('attach')}
        </button>
        <span className="text-xs text-muted">{t('attachHint')}</span>
        <input ref={input} type="file" hidden multiple accept={ALLOWED.join(',')} onChange={(e) => pick(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div className="chips">
          {files.map((f, i) => (
            <span key={i} className="chip-file" style={{ cursor: 'default' }}>
              <Icon name="file" size={12} />{f.name}<span className="text-muted">{kb(f.size)}</span>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ padding: 0, height: 'auto', width: 'auto' }} aria-label={t('delete')} onClick={() => onChange(files.filter((_, j) => j !== i))}><Icon name="x" size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Stars({ value, onChange, size = 20 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" className={n <= value ? 'on' : ''} aria-label={`${n}`} onClick={() => onChange(n)}><Icon name="star" size={size} /></button>
        ) : (
          <span key={n} className={n <= value ? 'on' : ''} style={{ color: n <= value ? undefined : 'var(--border)' }}><Icon name="star" size={size} /></span>
        ),
      )}
    </span>
  );
}
