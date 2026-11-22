import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type TicketStatus = 'open' | 'answered' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Attachment { id: string; name: string; type: string; size: number }

export interface Message {
  id: string;
  /** 'system' = événement automatique (changement de statut, attribution…). */
  role: 'customer' | 'staff' | 'system';
  author_id: string;
  author_email: string;
  body: string;
  /** Note interne : visible du seul personnel. */
  internal: boolean;
  attachments: Attachment[];
  at: string;
}

export interface Ticket {
  id: string;
  number: number;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  user_id: string;
  user_email: string;
  /** Compte proxy concerné (texte libre, facultatif). */
  account: string;
  assignee_id: string | null;
  assignee_email: string | null;
  tags: string[];
  messages: Message[];
  created_at: string;
  updated_at: string;
  last_reply_at: string;
  last_reply_role: 'customer' | 'staff';
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  rating: { score: number; comment: string; at: string } | null;
  /** Non lu par le personnel / par le client. */
  unread_staff: boolean;
  unread_customer: boolean;
}

export interface Macro { id: string; title: string; body: string }

export interface TicketSettings {
  categories: string[];
  /** Un ticket « résolu » est fermé automatiquement après N jours sans réponse du client (0 = jamais). */
  auto_close_days: number;
  allow_attachments: boolean;
  notify_customer: boolean;
  notify_admins: boolean;
  /** Tickets non fermés simultanés par client (0 = illimité). */
  max_open_per_user: number;
  /** Message automatique posté à la création d'un ticket (vide = aucun). */
  auto_reply: string;
  /** Ajouté à la fin de chaque réponse du personnel (vide = aucune). */
  signature: string;
}

export const DEFAULT_SETTINGS: TicketSettings = {
  categories: ['Question générale', 'Problème technique', 'Facturation', 'Demande de fonctionnalité'],
  auto_close_days: 7,
  allow_attachments: true,
  notify_customer: true,
  notify_admins: true,
  max_open_per_user: 10,
  auto_reply: '',
  signature: '',
};

interface StoreData {
  counter: number;
  tickets: Record<string, Ticket>;
  macros: Record<string, Macro>;
  settings: TicketSettings;
}

/** Persistance JSON atomique (fichier 0600), mise de côté d'un fichier illisible — même mécanique que les autres addons. */
@Injectable()
export class StoreService implements OnModuleInit {
  private readonly logger = new Logger(StoreService.name);
  private readonly dbPath: string;
  readonly filesDir: string;
  private data: StoreData = { counter: 0, tickets: {}, macros: {}, settings: { ...DEFAULT_SETTINGS } };
  private readOnly = false;
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    const defaultDb = path.resolve(__dirname, '..', '..', '..', 'tickets-data.json');
    this.dbPath = path.resolve(process.env.DB_PATH ?? defaultDb);
    this.filesDir = `${this.dbPath}.files`;
  }

  onModuleInit() {
    try {
      fs.mkdirSync(this.filesDir, { recursive: true, mode: 0o700 });
    } catch (e: any) {
      this.logger.error(`Dossier des pièces jointes inutilisable : ${e?.message ?? e}`);
    }
    try {
      if (fs.existsSync(this.dbPath)) {
        const p = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
        this.data = {
          counter: Number(p?.counter) || 0,
          tickets: p?.tickets && typeof p.tickets === 'object' ? p.tickets : {},
          macros: p?.macros && typeof p.macros === 'object' ? p.macros : {},
          settings: { ...DEFAULT_SETTINGS, ...(p?.settings ?? {}) },
        };
        this.logger.log(`Données chargées depuis ${this.dbPath}`);
      } else {
        this.persistNow();
      }
    } catch {
      const aside = `${this.dbPath}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(this.dbPath, aside);
        this.logger.error(`${this.dbPath} illisible — conservé sous ${aside} ; démarrage avec des données vides.`);
      } catch {
        this.logger.error(`${this.dbPath} illisible et impossible à mettre de côté — écritures désactivées pour ne rien écraser.`);
        this.readOnly = true;
      }
    }
  }

  get tickets(): Record<string, Ticket> { return this.data.tickets; }
  get macros(): Record<string, Macro> { return this.data.macros; }
  get settings(): TicketSettings { return this.data.settings; }
  set settings(s: TicketSettings) { this.data.settings = s; this.persist(); }

  nextNumber(): number {
    this.data.counter += 1;
    return this.data.counter;
  }

  exportData(): StoreData { return this.data; }

  restore(d: Partial<StoreData>): void {
    this.data = {
      counter: Number(d.counter) || Object.keys(d.tickets ?? {}).length,
      tickets: d.tickets ?? {},
      macros: d.macros ?? {},
      settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    };
    this.persistNow();
  }

  /** Écriture différée (regroupe les rafales). */
  persist(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.persistNow(); }, 250);
  }

  persistNow(): void {
    if (this.readOnly) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const tmp = this.dbPath + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.data), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tmp, this.dbPath);
    } catch (err) {
      this.logger.error('Erreur de persistance :', err);
    }
  }
}
