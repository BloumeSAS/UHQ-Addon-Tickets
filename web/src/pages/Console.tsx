import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAddon } from '../context';
import { errText, useT } from '../i18n';
import { useApi, useDebounced, useFetch } from '../lib/api';
import { timeAgo, fmtDateTime } from '../lib/format';
import { Macro, Me, Overview, PRIO_TONE, Priority, Settings, Status, STATUS_TONE, TicketDetail, TicketRow, UploadFile } from '../lib/types';
import { Icon } from '../components/icons';
import { FilePicker, Stars, Thread } from '../components/Thread';
import { Badge, Card, Empty, ErrorBox, Field, Modal, Notice, PageSkeleton, Pagination, SearchInput, Seg, Stat, Switch, Tabs, useConfirm } from '../components/ui';

type Tab = 'tickets' | 'macros' | 'settings';
const PAGE = 20;

/** Console du personnel (ADMIN + SUPPORT) : file d'attente, conversation, réponses types, réglages. */
export default function Console({ me }: { me: Me }) {
  const t = useT();
  const ov = useFetch<Overview>('staff/overview');
  const [tab, setTab] = useState<Tab>('tickets');
  const [openId, setOpenId] = useState<string | null>(null);

  if (openId) return <StaffTicket id={openId} me={me} onBack={() => { setOpenId(null); ov.reload(); }} />;
  const o = ov.data;
  const min = (n: number | null) => (n === null ? t('noData') : n >= 120 ? t('hours', { n: Math.round(n / 6) / 10 }) : t('minutes', { n }));

  return (
    <div className="page stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('console')}</h1>
          <p className="page-sub">{t('consoleSub')}</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={ov.reload}><Icon name="refresh" size={14} />{t('ui.refresh')}</button>
      </div>

      {ov.error && !o && <ErrorBox message={ov.error} onRetry={ov.reload} />}
      {o && (
        <div className="stat-grid">
          <Stat label={t('stOpen')} value={o.counts.open} tone={o.counts.open ? 'warn' : undefined} sub={`${t('stUnread')} : ${o.counts.unread}`} />
          <Stat label={t('stAnswered')} value={o.counts.answered} sub={`${t('stUnassigned')} : ${o.counts.unassigned}`} />
          <Stat label={t('stFirst')} value={min(o.avg_first_response_min)} sub={`${t('stNew')} : ${o.new_30d}`} />
          <Stat label={t('stResolution')} value={o.avg_resolution_h === null ? t('noData') : t('hours', { n: o.avg_resolution_h })} />
          <Stat label={t('stCsat')} value={o.csat_avg === null ? t('noData') : t('outOf5', { n: o.csat_avg, c: o.csat_count })} tone={o.csat_avg !== null && o.csat_avg >= 4 ? 'good' : undefined} />
        </div>
      )}

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'tickets', label: t('tabTickets'), icon: 'inbox', count: o?.counts.open },
          { id: 'macros', label: t('tabMacros'), icon: 'message' },
          { id: 'settings', label: t('tabSettings'), icon: 'settings' },
        ]}
      />
      {tab === 'tickets' && <Queue me={me} onOpen={setOpenId} categories={me.settings.categories} />}
      {tab === 'macros' && <Macros me={me} />}
      {tab === 'settings' && <SettingsTab me={me} />}
    </div>
  );
}

function Queue({ me, onOpen, categories }: { me: Me; onOpen: (id: string) => void; categories: string[] }) {
  const t = useT();
  const { lang } = useAddon();
  const [status, setStatus] = useState<string>('active');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [mine, setMine] = useState(false);
  const [unread, setUnread] = useState(false);
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [status, q, category, priority, mine, unread]);

  const params = new URLSearchParams({ status, limit: String(PAGE), offset: String(offset) });
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (priority) params.set('priority', priority);
  if (mine) params.set('mine', '1');
  if (unread) params.set('unread', '1');
  const data = useFetch<{ total: number; tickets: TicketRow[] }>(`staff/tickets?${params}`);

  return (
    <div className="stack-sm">
      <div className="row">
        <Seg<string> value={status} onChange={setStatus} options={[
          { id: 'active', label: t('status.active') }, { id: 'open', label: t('status.open') }, { id: 'answered', label: t('status.answered') },
          { id: 'resolved', label: t('status.resolved') }, { id: 'closed', label: t('status.closed') }, { id: 'all', label: t('all') },
        ]} />
        <SearchInput value={search} onChange={setSearch} placeholder={t('searchTickets')} />
      </div>
      <div className="row">
        <select className="input" style={{ width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('allCategories')}</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">{t('allPriorities')}</option>{(['urgent', 'high', 'normal', 'low'] as Priority[]).map((p) => <option key={p} value={p}>{t(`prio.${p}`)}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{t('mineOnly')}</label>
        <label className="check"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} />{t('unreadOnly')}</label>
      </div>

      {data.error && !data.data && <ErrorBox message={data.error} onRetry={data.reload} />}
      {data.loading && !data.data && <PageSkeleton rows={4} />}
      {data.data && (data.data.tickets.length === 0 ? (
        <Card><Empty icon="inbox" title={t('noResults')} text={t('noResultsText')} /></Card>
      ) : (
        <Card flush>
          <div className="t-list">
            {data.data.tickets.map((x) => (
              <button key={x.id} className="t-row" onClick={() => onOpen(x.id)}>
                {x.unread ? <span className="dot-unread" /> : <span style={{ width: '0.5rem' }} />}
                <div className="t-main">
                  <div className="t-subject">#{x.number} · {x.subject}</div>
                  <div className="t-meta">
                    <span>{x.user_email}</span><span>·</span><span>{x.category}</span><span>·</span>
                    <span>{x.assignee_email ?? t('unassigned')}</span><span>·</span><span>{timeAgo(x.last_reply_at, lang)}</span>
                    {x.tags.map((g) => <Badge key={g} icon="tag">{g}</Badge>)}
                  </div>
                </div>
                {x.rating && <Stars value={x.rating} size={12} />}
                <Badge tone={PRIO_TONE[x.priority]}>{t(`prio.${x.priority}`)}</Badge>
                <Badge tone={STATUS_TONE[x.status]}>{t(`status.${x.status}`)}</Badge>
              </button>
            ))}
          </div>
          <Pagination total={data.data.total} limit={PAGE} offset={offset} onChange={setOffset} />
        </Card>
      ))}
    </div>
  );
}

function StaffTicket({ id, me, onBack }: { id: string; me: Me; onBack: () => void }) {
  const { lang } = useAddon();
  const t = useT();
  const api = useApi();
  const tk = useFetch<{ ticket: TicketDetail }>(`staff/tickets/${id}`);
  const macros = useFetch<{ macros: Macro[] }>('staff/macros');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [note, setNote] = useState(false);
  const [after, setAfter] = useState<Status>('answered');
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<string | null>(null);
  const [confirm, confirmEl] = useConfirm();

  if (tk.loading && !tk.data) return <div className="page"><PageSkeleton rows={3} /></div>;
  if (tk.error && !tk.data) return <div className="page stack"><button className="btn btn-outline btn-sm" onClick={onBack}><Icon name="chevronLeft" size={14} />{t('back')}</button><ErrorBox message={tk.error} onRetry={tk.reload} /></div>;
  const x = tk.data!.ticket;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); tk.reload(); } catch (e) { toast.error(errText(t, e)); } finally { setBusy(false); }
  };
  const patch = (b: object) => run(() => api.patch(`staff/tickets/${id}`, b));
  const send = () => run(async () => {
    await api.post(`staff/tickets/${id}/reply`, { body, internal: note, status: note ? undefined : after, attachments: files.map((f) => ({ name: f.name, type: f.type, data: f.data })) });
    setBody(''); setFiles([]);
  }, t('replied'));

  return (
    <div className="page stack">
      <div className="row">
        <button className="btn btn-outline btn-sm" onClick={onBack}><Icon name="chevronLeft" size={14} />{t('back')}</button>
        <span className="grow" />
        {me.admin && <button className="btn btn-danger btn-sm" onClick={async () => { if (await confirm({ title: t('deleteConfirmT'), message: t('deleteConfirmB'), confirmLabel: t('delete') })) { try { await api.del(`staff/tickets/${id}`); toast.success(t('deleted')); onBack(); } catch (e) { toast.error(errText(t, e)); } } }}><Icon name="trash" size={14} />{t('deleteTicket')}</button>}
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

      <div className="split">
        <div className="stack">
          <Card><Thread ticketId={id} messages={x.messages} staff lang={lang} /></Card>

          <div className={`composer ${note ? 'note' : ''}`}>
            <div className="stack-sm">
              <div className="row-between">
                <label className="check"><input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} />{t('noteMode')}</label>
                <select className="input" style={{ width: 'auto' }} value="" onChange={(e) => { const m = macros.data?.macros.find((z) => z.id === e.target.value); if (m) setBody((b) => (b ? `${b}\n\n${m.body}` : m.body)); }}>
                  <option value="">{t('insertMacro')}</option>{macros.data?.macros.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
              <textarea className="input" rows={6} value={body} maxLength={10000} placeholder={t('messagePh')} onChange={(e) => setBody(e.target.value)} />
              {!note && me.settings.allow_attachments && <FilePicker files={files} onChange={setFiles} maxMb={me.settings.max_file_mb} />}
              <div className="row-between">
                {!note ? (
                  <label className="row gap-2 text-sm">{t('replyAs')}
                    <select className="input" style={{ width: 'auto' }} value={after} onChange={(e) => setAfter(e.target.value as Status)}>
                      {(['answered', 'resolved', 'open', 'closed'] as Status[]).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                    </select>
                  </label>
                ) : <span />}
                <button className="btn btn-primary" disabled={busy || !body.trim()} onClick={send}><Icon name="send" size={14} />{note ? t('sendNote') : t('sendReply')}</button>
              </div>
            </div>
          </div>
        </div>

        <Card title={t('details')}>
          <div className="stack-sm">
            <dl className="kv">
              <dt>{t('customer')}</dt><dd>{x.user_email}</dd>
              <dt>{t('created_at')}</dt><dd>{fmtDateTime(x.created_at, lang)}</dd>
              <dt>{t('firstResponse')}</dt><dd>{x.first_response_at ? fmtDateTime(x.first_response_at, lang) : '—'}</dd>
              {x.resolved_at && <><dt>{t('resolvedAt')}</dt><dd>{fmtDateTime(x.resolved_at, lang)}</dd></>}
              {x.rating && <><dt>{t('yourRating')}</dt><dd><Stars value={x.rating.score} size={14} />{x.rating.comment && <div className="text-muted text-sm">{x.rating.comment}</div>}</dd></>}
            </dl>
            <Field label={t('colStatus')}>
              <select className="input" value={x.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })}>{(['open', 'answered', 'resolved', 'closed'] as Status[]).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select>
            </Field>
            <Field label={t('priority')}>
              <select className="input" value={x.priority} disabled={busy} onChange={(e) => patch({ priority: e.target.value })}>{(['low', 'normal', 'high', 'urgent'] as Priority[]).map((p) => <option key={p} value={p}>{t(`prio.${p}`)}</option>)}</select>
            </Field>
            <Field label={t('category')}>
              <select className="input" value={x.category} disabled={busy} onChange={(e) => patch({ category: e.target.value })}>
                {[...new Set([x.category, ...me.settings.categories])].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={t('colAssignee')}>
              <div className="row">
                <span className="grow text-sm">{x.assignee_email ?? t('unassigned')}</span>
                {x.assignee_email === me.email
                  ? <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => patch({ assignee: 'none' })}>{t('release')}</button>
                  : <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => patch({ assignee: 'me' })}>{t('assignMe')}</button>}
              </div>
            </Field>
            <Field label={t('tags')} hint={t('tagsHint')}>
              <input className="input" value={tags ?? x.tags.join(', ')} onChange={(e) => setTags(e.target.value)} onBlur={() => { if (tags !== null) { patch({ tags: tags.split(',').map((s) => s.trim()).filter(Boolean) }); setTags(null); } }} />
            </Field>
          </div>
        </Card>
      </div>
      {confirmEl}
    </div>
  );
}

function Macros({ me }: { me: Me }) {
  const t = useT();
  const api = useApi();
  const list = useFetch<{ macros: Macro[] }>('staff/macros');
  const [edit, setEdit] = useState<Partial<Macro> | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmEl] = useConfirm();

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const b = { title: edit.title ?? '', body: edit.body ?? '' };
      if (edit.id) await api.put(`staff/macros/${edit.id}`, b);
      else await api.post('staff/macros', b);
      toast.success(t('saved'));
      setEdit(null);
      list.reload();
    } catch (e) { toast.error(errText(t, e)); } finally { setBusy(false); }
  };

  return (
    <div className="stack-sm">
      <div className="row-between">
        <div><h3 className="section-title" style={{ marginBottom: 0 }}>{t('macrosTitle')}</h3><p className="text-sm text-muted">{t('macrosSub')}</p></div>
        {me.admin && <button className="btn btn-primary btn-sm" onClick={() => setEdit({ title: '', body: '' })}><Icon name="plus" size={14} />{t('newMacro')}</button>}
      </div>
      {list.data && list.data.macros.length === 0 && <Card><Empty icon="message" title={t('noMacros')} text={t('noMacrosText')} /></Card>}
      {list.data?.macros.map((m) => (
        <Card key={m.id} title={m.title} right={me.admin ? <>
          <button className="btn btn-outline btn-sm" onClick={() => setEdit(m)}><Icon name="edit" size={13} />{t('edit')}</button>
          <button className="btn btn-danger btn-sm" onClick={async () => { if (await confirm({ title: t('delete'), message: m.title })) { await api.del(`staff/macros/${m.id}`); list.reload(); } }}><Icon name="trash" size={13} /></button>
        </> : undefined}>
          <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>
        </Card>
      ))}
      {edit && (
        <Modal title={edit.id ? t('edit') : t('newMacro')} onClose={() => setEdit(null)} busy={busy}
          footer={<><button className="btn btn-outline" onClick={() => setEdit(null)}>{t('ui.cancel')}</button><button className="btn btn-primary" disabled={busy || !edit.title?.trim() || !edit.body?.trim()} onClick={save}>{t('save')}</button></>}>
          <div className="stack-sm">
            <Field label={t('macroTitle')}><input className="input" value={edit.title ?? ''} maxLength={80} onChange={(e) => setEdit({ ...edit, title: e.target.value })} autoFocus /></Field>
            <Field label={t('macroBody')}><textarea className="input" rows={7} value={edit.body ?? ''} maxLength={5000} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {confirmEl}
    </div>
  );
}

function SettingsTab({ me }: { me: Me }) {
  const t = useT();
  const api = useApi();
  const cur = useFetch<{ settings: Settings }>('staff/settings');
  const [s, setS] = useState<Settings | null>(null);
  const [cats, setCats] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (cur.data) { setS(cur.data.settings); setCats(cur.data.settings.categories.join('\n')); } }, [cur.data]);

  if (!me.admin) return <Notice tone="info">{t('adminOnly')}</Notice>;
  if (!s) return <PageSkeleton rows={3} />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const save = async () => {
    setBusy(true);
    try {
      await api.put('staff/settings', { ...s, categories: cats.split('\n').map((c) => c.trim()).filter(Boolean) });
      toast.success(t('saved'));
      cur.reload();
    } catch (e) { toast.error(errText(t, e)); } finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="stack-sm">
        <Field label={t('setCategories')} hint={t('setCategoriesHint')}><textarea className="input" rows={5} value={cats} onChange={(e) => setCats(e.target.value)} /></Field>
        <div className="form-grid">
          <Field label={t('setAutoClose')} hint={t('setAutoCloseHint')}><input className="input" type="number" min={0} max={365} value={s.auto_close_days} onChange={(e) => set('auto_close_days', Number(e.target.value))} /></Field>
          <Field label={t('setMaxOpen')} hint={t('setMaxOpenHint')}><input className="input" type="number" min={0} max={200} value={s.max_open_per_user} onChange={(e) => set('max_open_per_user', Number(e.target.value))} /></Field>
        </div>
        <label className="row gap-2"><Switch checked={s.allow_attachments} onChange={(v) => set('allow_attachments', v)} label={t('setAttach')} />{t('setAttach')}</label>
        <label className="row gap-2"><Switch checked={s.notify_customer} onChange={(v) => set('notify_customer', v)} label={t('setNotifyCustomer')} />{t('setNotifyCustomer')}</label>
        <label className="row gap-2"><Switch checked={s.notify_admins} onChange={(v) => set('notify_admins', v)} label={t('setNotifyAdmins')} />{t('setNotifyAdmins')}</label>
        <Field label={t('setAutoReply')} hint={t('setAutoReplyHint')}><textarea className="input" rows={3} value={s.auto_reply} maxLength={2000} onChange={(e) => set('auto_reply', e.target.value)} /></Field>
        <Field label={t('setSignature')} hint={t('setSignatureHint')}><textarea className="input" rows={2} value={s.signature} maxLength={1000} onChange={(e) => set('signature', e.target.value)} /></Field>
        <div><button className="btn btn-primary" disabled={busy} onClick={save}>{t('save')}</button></div>
      </div>
    </Card>
  );
}
