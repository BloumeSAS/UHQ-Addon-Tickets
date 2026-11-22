export type Status = 'open' | 'answered' | 'resolved' | 'closed';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface Attachment { id: string; name: string; type: string; size: number }
export interface Message { id: string; role: 'customer' | 'staff' | 'system'; author_id: string; author_email: string; body: string; internal: boolean; attachments: Attachment[]; at: string }

export interface TicketRow {
  id: string; number: number; subject: string; category: string; priority: Priority; status: Status; user_email: string; account: string;
  assignee_email: string | null; tags: string[]; created_at: string; updated_at: string; last_reply_at: string; last_reply_role: 'customer' | 'staff';
  unread: boolean; messages: number; rating: number | null;
}
export interface TicketDetail extends Omit<TicketRow, 'rating' | 'messages'> {
  user_id?: string; first_response_at: string | null; resolved_at: string | null; closed_at: string | null;
  rating: { score: number; comment: string; at: string } | null; messages: Message[];
}
export interface Me { staff: boolean; admin: boolean; email: string; settings: { categories: string[]; allow_attachments: boolean; max_file_mb: number; auto_close_days: number } }
export interface Settings {
  categories: string[]; auto_close_days: number; allow_attachments: boolean; notify_customer: boolean; notify_admins: boolean;
  max_open_per_user: number; auto_reply: string; signature: string;
}
export interface Macro { id: string; title: string; body: string }
export interface Overview {
  counts: { open: number; answered: number; resolved: number; closed: number; unread: number; unassigned: number; total: number };
  new_30d: number; avg_first_response_min: number | null; avg_resolution_h: number | null; csat_avg: number | null; csat_count: number; by_category: Record<string, number>;
}
export interface UploadFile { name: string; type: string; data: string; size: number }

export const STATUS_TONE: Record<Status, 'warn' | 'info' | 'good' | 'muted'> = { open: 'warn', answered: 'info', resolved: 'good', closed: 'muted' };
export const PRIO_TONE: Record<Priority, 'muted' | 'info' | 'warn' | 'bad'> = { low: 'muted', normal: 'info', high: 'warn', urgent: 'bad' };
