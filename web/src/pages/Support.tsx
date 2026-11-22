import { useState } from 'react';
import { toast } from 'sonner';
import { useAddon } from '../context';
import { errText, useT } from '../i18n';
import { useApi, useFetch } from '../lib/api';
import { timeAgo } from '../lib/format';
import { Me, PRIO_TONE, Priority, STATUS_TONE, TicketDetail, TicketRow, UploadFile } from '../lib/types';
import { Icon } from '../components/icons';
import { FilePicker, Stars, Thread } from '../components/Thread';
import { Badge, Card, Empty, ErrorBox, Field, Modal, Notice, PageSkeleton, useConfirm } from '../components/ui';

/** Espace client : liste des tickets, création, conversation, clôture et notation. */
export default function Support({ me }: { me: Me }) {
  const { lang } = useAddon();
  const t = useT();
  const list = useFetch<{ tickets: TicketRow[] }>('tickets');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (openId) return <TicketView id={openId} onBack={() => { setOpenId(null); list.reload(); }} />;
  if (list.loading && !list.data) return <div className="page"><PageSkeleton rows={4} /></div>;
  if (list.error && !list.data) return <div className="page"><ErrorBox message={list.error} onRetry={list.reload} /></div>;
  const tickets = list.data?.tickets ?? [];

  return (
    <div className="page stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('support')}</h1>
          <p className="page-sub">{t('supportSub')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} />{t('newTicket')}</button>
      </div>

      {tickets.length === 0 ? (
        <Card><Empty icon="lifebuoy" title={t('noTickets')} text={t('noTicketsText')} action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={15} />{t('newTicket')}</button>} /></Card>
      ) : (
        <Card flush title={t('myTickets')}>
          <div className="t-list">
            {tickets.map((x) => (
              <button key={x.id} className="t-row" onClick={() => setOpenId(x.id)}>
                {x.unread ? <span className="dot-unread" aria-label="unread" /> : <span style={{ width: '0.5rem' }} />}
                <div className="t-main">
                  <div className="t-subject">#{x.number} · {x.subject}</div>
                  <div className="t-meta"><span>{x.category}</span><span>·</span><span>{t('lastUpdate')} {timeAgo(x.updated_at, lang)}</span><span>·</span><span>{t('replies', { n: x.messages })}</span></div>
                </div>
                <Badge tone={STATUS_TONE[x.status]}>{t(`status.${x.status}`)}</Badge>
                <Icon name="chevronRight" size={15} />
              </button>
            ))}
          </div>
        </Card>
      )}

      {creating && <NewTicket me={me} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); list.reload(); setOpenId(id); }} />}
    </div>
  );
}

function NewTicket({ me, onClose, onCreated }: { me: Me; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useT();
  const api = useApi();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(me.settings.categories[0] ?? '');
  const [priority, setPriority] = useState<Priority>('normal');
  const [account, setAccount] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await api.post<{ ticket: TicketDetail }>('tickets', {
        subject, category, priority, account: account || undefined, body,
        attachments: files.map((f) => ({ name: f.name, type: f.type, data: f.data })),
      });
      toast.success(t('created'));
      onCreated(r.ticket.id);
    } catch (e) {
      setErr(errText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('newTicket')} onClose={onClose} busy={busy} size="lg"
      footer={<><button className="btn btn-outline" onClick={onClose} disabled={busy}>{t('ui.cancel')}</button><button className="btn btn-primary" onClick={submit} disabled={busy || subject.trim().length < 3 || !body.trim()}>{t('create')}</button></>}
    >
      <div className="stack-sm">
        {err && <Notice tone="error">{err}</Notice>}
        <Field label={t('subject')}><input className="input" value={subject} maxLength={160} onChange={(e) => setSubject(e.target.value)} autoFocus /></Field>
        <div className="form-grid">
          <Field label={t('category')}>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{me.settings.categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </Field>
          <Field label={t('priority')}>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>{(['low', 'normal', 'high', 'urgent'] as Priority[]).map((p) => <option key={p} value={p}>{t(`prio.${p}`)}</option>)}</select>
          </Field>
          <Field label={t('account')} hint={t('accountHint')}><input className="input" value={account} maxLength={120} onChange={(e) => setAccount(e.target.value)} /></Field>
        </div>
        <Field label={t('message')}><textarea className="input" rows={7} value={body} maxLength={10000} placeholder={t('messagePh')} onChange={(e) => setBody(e.target.value)} /></Field>
        {me.settings.allow_attachments && <FilePicker files={files} onChange={setFiles} maxMb={me.settings.max_file_mb} />}
      </div>
    </Modal>
  );
}

function TicketView({ id, onBack }: { id: string; onBack: () => void }) {
  const { lang } = useAddon();
  const t = useT();
  const api = useApi();
  const me = useFetch<Me>('me');
  const tk = useFetch<{ ticket: TicketDetail }>(`tickets/${id}`);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [confirm, confirmEl] = useConfirm();

  if (tk.loading && !tk.data) return <div className="page"><PageSkeleton rows={3} /></div>;
  if (tk.error && !tk.data) return <div className="page stack"><button className="btn btn-outline btn-sm" onClick={onBack}><Icon name="chevronLeft" size={14} />{t('back')}</button><ErrorBox message={tk.error} onRetry={tk.reload} /></div>;
  const x = tk.data!.ticket;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); tk.reload(); } catch (e) { toast.error(errText(t, e)); } finally { setBusy(false); }
  };

  const send = () => run(async () => {
    await api.post(`tickets/${id}/reply`, { body, attachments: files.map((f) => ({ name: f.name, type: f.type, data: f.data })) });
    setBody(''); setFiles([]);
  }, t('replied'));

  const hasStaffReply = x.messages.some((m) => m.role === 'staff');
  const canRate = (x.status === 'resolved' || x.status === 'closed') && hasStaffReply && !x.rating;

  return (
    <div className="page stack">
      <div className="row">
        <button className="btn btn-outline btn-sm" onClick={onBack}><Icon name="chevronLeft" size={14} />{t('back')}</button>
        <span className="grow" />
        {x.status !== 'closed' && <button className="btn btn-outline btn-sm" disabled={busy} onClick={async () => { if (await confirm({ title: t('closeConfirmT'), message: t('closeConfirmB'), tone: 'primary' })) run(() => api.post(`tickets/${id}/close`), t('closed')); }}><Icon name="check" size={14} />{t('closeTicket')}</button>}
      </div>

      <div>
        <h1 className="page-title">#{x.number} · {x.subject}</h1>
        <div className="row mt-2">
          <Badge tone={STATUS_TONE[x.status]}>{t(`status.${x.status}`)}</Badge>
          <Badge tone={PRIO_TONE[x.priority]}>{t(`prio.${x.priority}`)}</Badge>
          <Badge>{x.category}</Badge>
          {x.account && <Badge icon="user">{x.account}</Badge>}
        </div>
      </div>

      <Card><Thread ticketId={id} messages={x.messages} staff={false} lang={lang} /></Card>

      {canRate && (
        <Card title={t('rateTitle')}>
          <div className="stack-sm">
            <p className="text-sm text-muted">{t('rateText')}</p>
            <Stars value={score} onChange={setScore} />
            <textarea className="input" rows={2} value={comment} maxLength={1000} placeholder={t('ratePh')} onChange={(e) => setComment(e.target.value)} />
            <div><button className="btn btn-primary btn-sm" disabled={!score || busy} onClick={() => run(() => api.post(`tickets/${id}/rate`, { score, comment: comment || undefined }), t('rated'))}>{t('rateSend')}</button></div>
          </div>
        </Card>
      )}
      {x.rating && <Notice tone="success" icon="star"><span className="row gap-2">{t('yourRating')} <Stars value={x.rating.score} size={15} /></span></Notice>}

      <Card title={x.status === 'closed' ? t('reply') : t('yourReply')}>
        <div className="stack-sm">
          {x.status === 'closed' && <Notice tone="info">{t('reopenHint')}</Notice>}
          <textarea className="input" rows={5} value={body} maxLength={10000} placeholder={t('messagePh')} onChange={(e) => setBody(e.target.value)} />
          {me.data?.settings.allow_attachments && <FilePicker files={files} onChange={setFiles} maxMb={me.data.settings.max_file_mb} />}
          <div><button className="btn btn-primary" disabled={busy || !body.trim()} onClick={send}><Icon name="send" size={14} />{t('send')}</button></div>
        </div>
      </Card>
      {confirmEl}
    </div>
  );
}
