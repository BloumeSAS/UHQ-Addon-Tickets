import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AuthUser } from '../auth/panel-auth.service';
import { PanelMailClient } from './mail.client';
import { AttachmentDto, CreateTicketDto, MacroDto, SettingsDto, StaffReplyDto, UpdateTicketDto } from './tickets.dto';
import { Attachment, Message, StoreService, Ticket, TicketPriority, TicketStatus } from './store.service';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf', 'text/plain': 'txt',
};
const HOUR = 3_600_000;

/** Nettoie un texte saisi : caractères de contrôle retirés (sauf retours à la ligne / tabulations), espaces de fin supprimés. */
function clean(s: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

/** Vérifie que le contenu correspond au type annoncé (le navigateur peut mentir sur le MIME). */
function magicOk(type: string, buf: Buffer): boolean {
  switch (type) {
    case 'image/png': return buf.length > 8 && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    case 'image/jpeg': return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'image/gif': return buf.subarray(0, 4).toString('latin1') === 'GIF8';
    case 'image/webp': return buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
    case 'application/pdf': return buf.subarray(0, 5).toString('latin1') === '%PDF-';
    case 'text/plain': return !buf.subarray(0, 2048).includes(0);
    default: return false;
  }
}

@Injectable()
export class TicketsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TicketsService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly store: StoreService, private readonly mail: PanelMailClient) {}

  onModuleInit() {
    this.timer = setInterval(() => this.autoClose(), HOUR);
    setTimeout(() => this.autoClose(), 30_000);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** Limite de débit en mémoire : `max` actions par heure et par clé. */
  private throttle(key: string, max: number): void {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < HOUR);
    if (list.length >= max) throw new HttpException('RATE_LIMITED', 429);
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < HOUR)) this.hits.delete(k);
  }

  // ─── Utilitaires ─────────────────────────────────────────────────────────────

  private get(id: string): Ticket {
    const t = this.store.tickets[id];
    if (!t) throw new NotFoundException('TICKET_NOT_FOUND');
    return t;
  }

  /** Ticket lisible par son propriétaire ; sinon 404 (on ne révèle pas l'existence d'un ticket d'autrui). */
  private mine(user: AuthUser, id: string): Ticket {
    const t = this.store.tickets[id];
    if (!t || t.user_id !== user.id) throw new NotFoundException('TICKET_NOT_FOUND');
    return t;
  }

  private saveFiles(list: AttachmentDto[] | undefined): Attachment[] {
    if (!list?.length) return [];
    if (!this.store.settings.allow_attachments) throw new BadRequestException('ATTACHMENTS_DISABLED');
    const out: Attachment[] = [];
    try {
      for (const a of list) {
        const type = String(a.type).toLowerCase();
        if (!ALLOWED_TYPES[type]) throw new BadRequestException('FILE_TYPE');
        const buf = Buffer.from(a.data, 'base64');
        if (!buf.length || buf.length > MAX_FILE_BYTES) throw new BadRequestException('FILE_SIZE');
        if (!magicOk(type, buf)) throw new BadRequestException('FILE_TYPE');
        const id = randomUUID();
        fs.writeFileSync(path.join(this.store.filesDir, id), buf, { mode: 0o600 });
        const name = clean(a.name, 120).replace(/[\\/:*?"<>|]+/g, '_') || `file.${ALLOWED_TYPES[type]}`;
        out.push({ id, name, type, size: buf.length });
      }
    } catch (e) {
      for (const f of out) this.removeFile(f.id);
      throw e;
    }
    return out;
  }

  private removeFile(id: string): void {
    if (!/^[0-9a-f-]{36}$/.test(id)) return;
    try { fs.unlinkSync(path.join(this.store.filesDir, id)); } catch { /* déjà absent */ }
  }

  private push(t: Ticket, m: Omit<Message, 'id' | 'at'>): Message {
    const msg: Message = { id: randomUUID(), at: new Date().toISOString(), ...m };
    t.messages.push(msg);
    t.updated_at = msg.at;
    return msg;
  }

  private system(t: Ticket, body: string): void {
    this.push(t, { role: 'system', author_id: '', author_email: '', body, internal: false, attachments: [] });
  }

  private excerpt(s: string): string {
    return clean(s, 300).replace(/\n+/g, ' ').slice(0, 220);
  }

  private setStatus(t: Ticket, status: TicketStatus): void {
    if (t.status === status) return;
    t.status = status;
    const now = new Date().toISOString();
    if (status === 'resolved') t.resolved_at = now;
    if (status === 'closed') t.closed_at = now;
    if (status === 'open' || status === 'answered') { t.closed_at = null; if (status === 'open') t.resolved_at = null; }
  }

  // ─── Vues ────────────────────────────────────────────────────────────────────

  summary(t: Ticket, staff: boolean) {
    return {
      id: t.id, number: t.number, subject: t.subject, category: t.category, priority: t.priority, status: t.status,
      user_email: t.user_email, account: t.account, assignee_email: t.assignee_email, tags: t.tags,
      created_at: t.created_at, updated_at: t.updated_at, last_reply_at: t.last_reply_at, last_reply_role: t.last_reply_role,
      unread: staff ? t.unread_staff : t.unread_customer, messages: t.messages.filter((m) => staff || (!m.internal && m.role !== 'system')).length,
      rating: t.rating?.score ?? null,
    };
  }

  private detail(t: Ticket, staff: boolean) {
    return {
      ...this.summary(t, staff),
      user_id: staff ? t.user_id : undefined,
      first_response_at: t.first_response_at, resolved_at: t.resolved_at, closed_at: t.closed_at,
      rating: t.rating,
      messages: t.messages.filter((m) => staff || !m.internal),
    };
  }

  currentSettings() { return this.store.settings; }

  publicSettings() {
    const s = this.store.settings;
    return { categories: s.categories, allow_attachments: s.allow_attachments, max_file_mb: MAX_FILE_BYTES / 1024 / 1024, auto_close_days: s.auto_close_days };
  }

  // ─── Client ──────────────────────────────────────────────────────────────────

  listMine(user: AuthUser) {
    return Object.values(this.store.tickets)
      .filter((t) => t.user_id === user.id)
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
      .map((t) => this.summary(t, false));
  }

  getMine(user: AuthUser, id: string) {
    const t = this.mine(user, id);
    if (t.unread_customer) { t.unread_customer = false; this.store.persist(); }
    return this.detail(t, false);
  }

  create(user: AuthUser, dto: CreateTicketDto) {
    this.throttle(`new:${user.id}`, 10);
    const s = this.store.settings;
    const category = clean(dto.category, 80);
    if (!s.categories.includes(category)) throw new BadRequestException('CATEGORY');
    if (s.max_open_per_user > 0) {
      const open = Object.values(this.store.tickets).filter((t) => t.user_id === user.id && t.status !== 'closed').length;
      if (open >= s.max_open_per_user) throw new BadRequestException('TOO_MANY_OPEN');
    }
    const body = clean(dto.body, 10_000);
    const subject = clean(dto.subject, 160);
    if (!body || subject.length < 3) throw new BadRequestException('EMPTY');
    const files = this.saveFiles(dto.attachments);
    const now = new Date().toISOString();
    const t: Ticket = {
      id: randomUUID(), number: this.store.nextNumber(), subject, category,
      priority: (dto.priority as TicketPriority) ?? 'normal', status: 'open',
      user_id: user.id, user_email: user.email, account: clean(dto.account ?? '', 120),
      assignee_id: null, assignee_email: null, tags: [], messages: [],
      created_at: now, updated_at: now, last_reply_at: now, last_reply_role: 'customer',
      first_response_at: null, resolved_at: null, closed_at: null, rating: null, unread_staff: true, unread_customer: false,
    };
    this.push(t, { role: 'customer', author_id: user.id, author_email: user.email, body, internal: false, attachments: files });
    if (s.auto_reply.trim()) this.push(t, { role: 'system', author_id: '', author_email: '', body: clean(s.auto_reply, 2000), internal: false, attachments: [] });
    this.store.tickets[t.id] = t;
    this.store.persist();
    const vars = { ticketId: `#${t.number}`, subject, from: user.email, excerpt: this.excerpt(body) };
    if (s.notify_customer) void this.mail.send('tickets.created', user.email, vars);
    if (s.notify_admins) void this.mail.send('tickets.admin-new', 'admins', vars);
    return this.detail(t, false);
  }

  reply(user: AuthUser, id: string, dto: { body: string; attachments?: AttachmentDto[] }) {
    this.throttle(`reply:${user.id}`, 40);
    const t = this.mine(user, id);
    const body = clean(dto.body, 10_000);
    if (!body) throw new BadRequestException('EMPTY');
    const files = this.saveFiles(dto.attachments);
    const reopened = t.status === 'closed' || t.status === 'resolved';
    this.push(t, { role: 'customer', author_id: user.id, author_email: user.email, body, internal: false, attachments: files });
    if (reopened) this.system(t, 'sys:REOPENED');
    this.setStatus(t, 'open');
    t.last_reply_at = new Date().toISOString();
    t.last_reply_role = 'customer';
    t.unread_staff = true;
    this.store.persist();
    if (this.store.settings.notify_admins) {
      void this.mail.send('tickets.admin-reply', 'admins', { ticketId: `#${t.number}`, subject: t.subject, from: user.email, excerpt: this.excerpt(body) });
    }
    return this.detail(t, false);
  }

  close(user: AuthUser, id: string) {
    const t = this.mine(user, id);
    if (t.status !== 'closed') {
      this.setStatus(t, 'closed');
      this.system(t, 'sys:CLOSED_BY_CUSTOMER');
      this.store.persist();
    }
    return this.detail(t, false);
  }

  rate(user: AuthUser, id: string, score: number, comment?: string) {
    const t = this.mine(user, id);
    if (t.status !== 'resolved' && t.status !== 'closed') throw new BadRequestException('NOT_RESOLVED');
    if (t.rating) throw new BadRequestException('ALREADY_RATED');
    if (!t.messages.some((m) => m.role === 'staff' && !m.internal)) throw new BadRequestException('NOT_RESOLVED');
    t.rating = { score, comment: clean(comment ?? '', 1000), at: new Date().toISOString() };
    this.store.persist();
    return this.detail(t, false);
  }

  /** Pièce jointe lisible par le propriétaire (hors notes internes) ou par le personnel. */
  attachment(user: AuthUser, staff: boolean, ticketId: string, attId: string): { file: string; meta: Attachment } {
    const t = staff ? this.get(ticketId) : this.mine(user, ticketId);
    for (const m of t.messages) {
      if (m.internal && !staff) continue;
      const a = m.attachments.find((x) => x.id === attId);
      if (a) return { file: path.join(this.store.filesDir, a.id), meta: a };
    }
    throw new NotFoundException('FILE_NOT_FOUND');
  }

  // ─── Personnel ───────────────────────────────────────────────────────────────

  list(q: { status?: string; q?: string; category?: string; priority?: string; assignee?: string; mine?: boolean; unread?: boolean; limit?: number; offset?: number }, user: AuthUser) {
    const needle = (q.q ?? '').toLowerCase().trim();
    let rows = Object.values(this.store.tickets);
    if (q.status === 'active') rows = rows.filter((t) => t.status === 'open' || t.status === 'answered');
    else if (q.status && q.status !== 'all') rows = rows.filter((t) => t.status === q.status);
    if (q.category) rows = rows.filter((t) => t.category === q.category);
    if (q.priority) rows = rows.filter((t) => t.priority === q.priority);
    if (q.mine) rows = rows.filter((t) => t.assignee_id === user.id);
    else if (q.assignee === 'none') rows = rows.filter((t) => !t.assignee_id);
    if (q.unread) rows = rows.filter((t) => t.unread_staff);
    if (needle) {
      rows = rows.filter((t) => `#${t.number} ${t.subject} ${t.user_email} ${t.account} ${t.tags.join(' ')}`.toLowerCase().includes(needle)
        || t.messages.some((m) => m.body.toLowerCase().includes(needle)));
    }
    const weight: Record<TicketPriority, number> = { urgent: 3, high: 2, normal: 1, low: 0 };
    rows.sort((a, b) => {
      const aw = a.status === 'open' ? 1 : 0, bw = b.status === 'open' ? 1 : 0;
      if (aw !== bw) return bw - aw;
      if (aw && weight[a.priority] !== weight[b.priority]) return weight[b.priority] - weight[a.priority];
      return Date.parse(b.last_reply_at) - Date.parse(a.last_reply_at);
    });
    const limit = Math.min(100, Math.max(1, q.limit ?? 25));
    const offset = Math.max(0, q.offset ?? 0);
    return { total: rows.length, limit, offset, tickets: rows.slice(offset, offset + limit).map((t) => this.summary(t, true)) };
  }

  getStaff(id: string) {
    const t = this.get(id);
    if (t.unread_staff) { t.unread_staff = false; this.store.persist(); }
    return this.detail(t, true);
  }

  staffReply(user: AuthUser, id: string, dto: StaffReplyDto) {
    const t = this.get(id);
    let body = clean(dto.body, 10_000);
    if (!body) throw new BadRequestException('EMPTY');
    const internal = !!dto.internal;
    if (!internal && this.store.settings.signature.trim()) body += `\n\n${clean(this.store.settings.signature, 1000)}`;
    const files = this.saveFiles(dto.attachments);
    this.push(t, { role: 'staff', author_id: user.id, author_email: user.email, body, internal, attachments: files });
    if (!t.assignee_id) { t.assignee_id = user.id; t.assignee_email = user.email; }
    if (!internal) {
      const now = t.updated_at;
      t.last_reply_at = now;
      t.last_reply_role = 'staff';
      t.unread_customer = true;
      if (!t.first_response_at) t.first_response_at = now;
      const wanted = (dto.status as TicketStatus | undefined) ?? 'answered';
      this.setStatus(t, wanted);
      if (this.store.settings.notify_customer) {
        void this.mail.send(wanted === 'resolved' ? 'tickets.resolved' : 'tickets.reply', t.user_email, { ticketId: `#${t.number}`, subject: t.subject, excerpt: this.excerpt(body) });
      }
    } else if (dto.status) {
      this.setStatus(t, dto.status as TicketStatus);
    }
    this.store.persist();
    return this.detail(t, true);
  }

  update(user: AuthUser, id: string, dto: UpdateTicketDto) {
    const t = this.get(id);
    const notes: string[] = [];
    if (dto.status && dto.status !== t.status) { this.setStatus(t, dto.status as TicketStatus); notes.push(`sys:STATUS:${dto.status}`); }
    if (dto.priority && dto.priority !== t.priority) { t.priority = dto.priority as TicketPriority; notes.push(`sys:PRIORITY:${dto.priority}`); }
    if (dto.category && dto.category !== t.category) { t.category = clean(dto.category, 80); notes.push(`sys:CATEGORY:${t.category}`); }
    if (dto.assignee === 'me') { t.assignee_id = user.id; t.assignee_email = user.email; notes.push(`sys:ASSIGNED:${user.email}`); }
    if (dto.assignee === 'none' && t.assignee_id) { t.assignee_id = null; t.assignee_email = null; notes.push('sys:UNASSIGNED'); }
    if (dto.tags) t.tags = [...new Set(dto.tags.map((x) => clean(x, 30)).filter(Boolean))].slice(0, 10);
    for (const n of notes) this.push(t, { role: 'system', author_id: user.id, author_email: user.email, body: n, internal: true, attachments: [] });
    t.updated_at = new Date().toISOString();
    this.store.persist();
    return this.detail(t, true);
  }

  remove(id: string): void {
    const t = this.get(id);
    for (const m of t.messages) for (const a of m.attachments) this.removeFile(a.id);
    delete this.store.tickets[id];
    this.store.persist();
  }

  overview() {
    const all = Object.values(this.store.tickets);
    const count = (s: TicketStatus) => all.filter((t) => t.status === s).length;
    const since = Date.now() - 30 * 24 * HOUR;
    const recent = all.filter((t) => Date.parse(t.created_at) >= since);
    const firstResp = recent.filter((t) => t.first_response_at).map((t) => Date.parse(t.first_response_at as string) - Date.parse(t.created_at));
    const resolved = recent.filter((t) => t.resolved_at || t.closed_at).map((t) => Date.parse((t.resolved_at ?? t.closed_at) as string) - Date.parse(t.created_at));
    const rated = all.filter((t) => t.rating);
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const byCat: Record<string, number> = {};
    for (const t of recent) byCat[t.category] = (byCat[t.category] ?? 0) + 1;
    return {
      counts: { open: count('open'), answered: count('answered'), resolved: count('resolved'), closed: count('closed'), unread: all.filter((t) => t.unread_staff).length, unassigned: all.filter((t) => !t.assignee_id && (t.status === 'open' || t.status === 'answered')).length, total: all.length },
      new_30d: recent.length,
      avg_first_response_min: avg(firstResp) === null ? null : Math.round((avg(firstResp) as number) / 60_000),
      avg_resolution_h: avg(resolved) === null ? null : Math.round(((avg(resolved) as number) / HOUR) * 10) / 10,
      csat_avg: avg(rated.map((t) => (t.rating as { score: number }).score)) === null ? null : Math.round((avg(rated.map((t) => (t.rating as { score: number }).score)) as number) * 10) / 10,
      csat_count: rated.length,
      by_category: byCat,
    };
  }

  // ─── Réponses types / réglages ───────────────────────────────────────────────

  macros() { return Object.values(this.store.macros).sort((a, b) => a.title.localeCompare(b.title)); }
  saveMacro(dto: MacroDto, id?: string) {
    if (id && !this.store.macros[id]) throw new NotFoundException('MACRO_NOT_FOUND');
    const m = { id: id ?? randomUUID(), title: clean(dto.title, 80), body: clean(dto.body, 5000) };
    this.store.macros[m.id] = m;
    this.store.persist();
    return m;
  }
  deleteMacro(id: string) { delete this.store.macros[id]; this.store.persist(); }

  updateSettings(dto: SettingsDto) {
    const cur = this.store.settings;
    const next = { ...cur };
    if (dto.categories) {
      const cats = [...new Set(dto.categories.map((c) => clean(c, 80)).filter(Boolean))];
      if (!cats.length) throw new BadRequestException('CATEGORY');
      next.categories = cats;
    }
    if (dto.auto_close_days !== undefined) next.auto_close_days = dto.auto_close_days;
    if (dto.allow_attachments !== undefined) next.allow_attachments = dto.allow_attachments;
    if (dto.notify_customer !== undefined) next.notify_customer = dto.notify_customer;
    if (dto.notify_admins !== undefined) next.notify_admins = dto.notify_admins;
    if (dto.max_open_per_user !== undefined) next.max_open_per_user = dto.max_open_per_user;
    if (dto.auto_reply !== undefined) next.auto_reply = clean(dto.auto_reply, 2000);
    if (dto.signature !== undefined) next.signature = clean(dto.signature, 1000);
    this.store.settings = next;
    return next;
  }

  // ─── Tâche de fond ───────────────────────────────────────────────────────────

  /** Ferme les tickets « résolus » restés sans réponse du client depuis `auto_close_days`. */
  autoClose(): void {
    const days = this.store.settings.auto_close_days;
    if (!days) return;
    const limit = Date.now() - days * 24 * HOUR;
    let n = 0;
    for (const t of Object.values(this.store.tickets)) {
      if (t.status !== 'resolved' || Date.parse(t.last_reply_at) > limit) continue;
      this.setStatus(t, 'closed');
      this.system(t, 'sys:AUTO_CLOSED');
      n += 1;
    }
    if (n) { this.logger.log(`${n} ticket(s) résolu(s) fermé(s) automatiquement.`); this.store.persist(); }
  }
}
