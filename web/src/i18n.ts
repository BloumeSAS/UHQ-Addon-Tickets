import { useCallback } from 'react';
import { useAddon } from './context';

type Dict = Record<string, string>;

const fr: Dict = {
  'ui.retry': 'Réessayer', 'ui.cancel': 'Annuler', 'ui.confirm': 'Confirmer', 'ui.close': 'Fermer', 'ui.prev': 'Précédent', 'ui.next': 'Suivant',
  'ui.pageOf': 'Page {page} / {pages} — {total} résultats', 'ui.copy': 'Copier', 'ui.copied': 'Copié', 'ui.refresh': 'Actualiser', 'ui.loading': 'Chargement…',
  noToken: 'Connexion requise', noTokenText: 'Ouvrez cette page depuis le panel pour contacter le support.',
  save: 'Enregistrer', saved: 'Enregistré', delete: 'Supprimer', edit: 'Modifier', back: 'Retour', send: 'Envoyer', all: 'Tous', none: 'Aucun',

  // Client
  support: 'Support', supportSub: 'Une question, un souci ? Ouvrez un ticket, nous vous répondons ici.',
  newTicket: 'Nouveau ticket', myTickets: 'Mes tickets', noTickets: 'Aucun ticket', noTicketsText: 'Vous n’avez encore contacté le support. Ouvrez un ticket pour poser une question ou signaler un problème.',
  subject: 'Sujet', category: 'Catégorie', priority: 'Priorité', account: 'Compte concerné', accountHint: 'Facultatif — identifiant du compte proxy concerné.',
  message: 'Message', messagePh: 'Décrivez votre demande avec le plus de détails possible…', attach: 'Joindre un fichier', attachHint: 'PNG, JPG, WEBP, GIF, PDF ou TXT — 2 Mo max, 3 fichiers.',
  create: 'Créer le ticket', created: 'Ticket créé', replied: 'Réponse envoyée', yourReply: 'Votre réponse', reply: 'Répondre', closeTicket: 'Fermer le ticket', closed: 'Ticket fermé',
  closeConfirmT: 'Fermer ce ticket ?', closeConfirmB: 'Vous pourrez le rouvrir en y répondant.', reopenHint: 'Ce ticket est fermé : répondre le rouvrira.',
  lastUpdate: 'Dernière activité', ticketNo: 'Ticket #{n}', replies: '{n} message(s)',
  rateTitle: 'Votre problème est-il résolu ?', rateText: 'Notez la qualité de l’aide reçue.', ratePh: 'Un commentaire ? (facultatif)', rateSend: 'Envoyer ma note', rated: 'Merci pour votre retour !', yourRating: 'Votre note',
  you: 'Vous', team: 'Support', internalNote: 'Note interne',
  'status.open': 'Ouvert', 'status.answered': 'Répondu', 'status.resolved': 'Résolu', 'status.closed': 'Fermé', 'status.active': 'En cours',
  'prio.low': 'Basse', 'prio.normal': 'Normale', 'prio.high': 'Haute', 'prio.urgent': 'Urgente',
  'sys.REOPENED': 'Ticket rouvert', 'sys.CLOSED_BY_CUSTOMER': 'Ticket fermé par le client', 'sys.AUTO_CLOSED': 'Ticket fermé automatiquement (résolu, sans nouvelle réponse)',
  'sys.STATUS': 'Statut → {v}', 'sys.PRIORITY': 'Priorité → {v}', 'sys.CATEGORY': 'Catégorie → {v}', 'sys.ASSIGNED': 'Attribué à {v}', 'sys.UNASSIGNED': 'Ticket libéré',
  'err.RATE_LIMITED': 'Trop de messages en peu de temps, réessayez un peu plus tard.', 'err.TOO_MANY_OPEN': 'Vous avez trop de tickets ouverts : fermez-en avant d’en créer un nouveau.',
  'err.FILE_TYPE': 'Type de fichier non autorisé.', 'err.FILE_SIZE': 'Fichier trop volumineux (2 Mo maximum).', 'err.ATTACHMENTS_DISABLED': 'Les pièces jointes sont désactivées.',
  'err.CATEGORY': 'Catégorie invalide.', 'err.EMPTY': 'Le message est vide.', 'err.NOT_RESOLVED': 'Vous pourrez noter une fois le ticket résolu.', 'err.ALREADY_RATED': 'Ce ticket a déjà été noté.',
  'err.TICKET_NOT_FOUND': 'Ticket introuvable.',

  // Personnel
  console: 'Console du support', consoleSub: 'Répondez aux clients, suivez les délais et la satisfaction.',
  tabTickets: 'Tickets', tabMacros: 'Réponses types', tabSettings: 'Réglages',
  stOpen: 'À traiter', stAnswered: 'En attente du client', stUnread: 'Non lus', stFirst: 'Première réponse (30 j)', stResolution: 'Résolution (30 j)', stCsat: 'Satisfaction', stNew: 'Nouveaux (30 j)', stUnassigned: 'Non attribués',
  minutes: '{n} min', hours: '{n} h', noData: '—', outOf5: '{n}/5 ({c} avis)',
  searchTickets: 'Rechercher (n°, sujet, client, contenu)…', allCategories: 'Toutes les catégories', allPriorities: 'Toutes les priorités', mineOnly: 'Mes tickets', unreadOnly: 'Non lus',
  colTicket: 'Ticket', colCustomer: 'Client', colStatus: 'Statut', colUpdated: 'Mis à jour', colAssignee: 'Attribué à', unassigned: 'Non attribué',
  noResults: 'Aucun résultat', noResultsText: 'Aucun ticket ne correspond à ces filtres.',
  assignMe: 'Me l’attribuer', release: 'Libérer', sendNote: 'Ajouter la note', sendReply: 'Envoyer la réponse', replyAs: 'Statut après envoi', noteMode: 'Note interne (invisible du client)',
  macros: 'Réponse type', insertMacro: 'Insérer une réponse type…', tags: 'Étiquettes', tagsHint: 'Séparées par des virgules', details: 'Détails', customer: 'Client', created_at: 'Créé le', firstResponse: 'Première réponse', resolvedAt: 'Résolu le',
  deleteTicket: 'Supprimer le ticket', deleteConfirmT: 'Supprimer ce ticket ?', deleteConfirmB: 'La conversation et ses pièces jointes seront définitivement supprimées.', deleted: 'Ticket supprimé',
  macrosTitle: 'Réponses types', macrosSub: 'Textes prêts à l’emploi insérables dans une réponse.', newMacro: 'Nouvelle réponse type', macroTitle: 'Titre', macroBody: 'Texte', noMacros: 'Aucune réponse type', noMacrosText: 'Créez vos réponses fréquentes pour gagner du temps.',
  adminOnly: 'Réservé aux administrateurs.',
  setCategories: 'Catégories', setCategoriesHint: 'Une par ligne — proposées au client à la création d’un ticket.', setAutoClose: 'Fermeture automatique', setAutoCloseHint: 'Jours après lesquels un ticket « résolu » sans réponse est fermé (0 = jamais).',
  setAttach: 'Autoriser les pièces jointes', setNotifyCustomer: 'E-mail au client à chaque réponse', setNotifyAdmins: 'E-mail aux administrateurs (nouveau ticket, réponse du client)', setMaxOpen: 'Tickets ouverts max par client', setMaxOpenHint: '0 = illimité.',
  setAutoReply: 'Message automatique', setAutoReplyHint: 'Posté à la création d’un ticket (laisser vide pour aucun).', setSignature: 'Signature', setSignatureHint: 'Ajoutée à la fin de chaque réponse du support.',
};

const en: Dict = {
  'ui.retry': 'Retry', 'ui.cancel': 'Cancel', 'ui.confirm': 'Confirm', 'ui.close': 'Close', 'ui.prev': 'Previous', 'ui.next': 'Next',
  'ui.pageOf': 'Page {page} / {pages} — {total} results', 'ui.copy': 'Copy', 'ui.copied': 'Copied', 'ui.refresh': 'Refresh', 'ui.loading': 'Loading…',
  noToken: 'Sign-in required', noTokenText: 'Open this page from the panel to contact support.',
  save: 'Save', saved: 'Saved', delete: 'Delete', edit: 'Edit', back: 'Back', send: 'Send', all: 'All', none: 'None',

  support: 'Support', supportSub: 'A question or an issue? Open a ticket, we answer right here.',
  newTicket: 'New ticket', myTickets: 'My tickets', noTickets: 'No tickets', noTicketsText: 'You haven’t contacted support yet. Open a ticket to ask a question or report an issue.',
  subject: 'Subject', category: 'Category', priority: 'Priority', account: 'Related account', accountHint: 'Optional — the proxy account this is about.',
  message: 'Message', messagePh: 'Describe your request with as much detail as possible…', attach: 'Attach a file', attachHint: 'PNG, JPG, WEBP, GIF, PDF or TXT — 2 MB max, 3 files.',
  create: 'Create ticket', created: 'Ticket created', replied: 'Reply sent', yourReply: 'Your reply', reply: 'Reply', closeTicket: 'Close ticket', closed: 'Ticket closed',
  closeConfirmT: 'Close this ticket?', closeConfirmB: 'You can reopen it by replying.', reopenHint: 'This ticket is closed: replying will reopen it.',
  lastUpdate: 'Last activity', ticketNo: 'Ticket #{n}', replies: '{n} message(s)',
  rateTitle: 'Is your issue solved?', rateText: 'Rate the help you received.', ratePh: 'Any comment? (optional)', rateSend: 'Send my rating', rated: 'Thanks for your feedback!', yourRating: 'Your rating',
  you: 'You', team: 'Support', internalNote: 'Internal note',
  'status.open': 'Open', 'status.answered': 'Answered', 'status.resolved': 'Resolved', 'status.closed': 'Closed', 'status.active': 'Active',
  'prio.low': 'Low', 'prio.normal': 'Normal', 'prio.high': 'High', 'prio.urgent': 'Urgent',
  'sys.REOPENED': 'Ticket reopened', 'sys.CLOSED_BY_CUSTOMER': 'Ticket closed by the customer', 'sys.AUTO_CLOSED': 'Ticket closed automatically (resolved, no further reply)',
  'sys.STATUS': 'Status → {v}', 'sys.PRIORITY': 'Priority → {v}', 'sys.CATEGORY': 'Category → {v}', 'sys.ASSIGNED': 'Assigned to {v}', 'sys.UNASSIGNED': 'Ticket released',
  'err.RATE_LIMITED': 'Too many messages in a short time, try again a bit later.', 'err.TOO_MANY_OPEN': 'You have too many open tickets: close some before creating a new one.',
  'err.FILE_TYPE': 'File type not allowed.', 'err.FILE_SIZE': 'File too large (2 MB max).', 'err.ATTACHMENTS_DISABLED': 'Attachments are disabled.',
  'err.CATEGORY': 'Invalid category.', 'err.EMPTY': 'The message is empty.', 'err.NOT_RESOLVED': 'You can rate once the ticket is resolved.', 'err.ALREADY_RATED': 'This ticket was already rated.',
  'err.TICKET_NOT_FOUND': 'Ticket not found.',

  console: 'Support console', consoleSub: 'Answer customers, track response times and satisfaction.',
  tabTickets: 'Tickets', tabMacros: 'Canned replies', tabSettings: 'Settings',
  stOpen: 'To handle', stAnswered: 'Waiting for customer', stUnread: 'Unread', stFirst: 'First reply (30 d)', stResolution: 'Resolution (30 d)', stCsat: 'Satisfaction', stNew: 'New (30 d)', stUnassigned: 'Unassigned',
  minutes: '{n} min', hours: '{n} h', noData: '—', outOf5: '{n}/5 ({c} reviews)',
  searchTickets: 'Search (no., subject, customer, content)…', allCategories: 'All categories', allPriorities: 'All priorities', mineOnly: 'My tickets', unreadOnly: 'Unread',
  colTicket: 'Ticket', colCustomer: 'Customer', colStatus: 'Status', colUpdated: 'Updated', colAssignee: 'Assignee', unassigned: 'Unassigned',
  noResults: 'No results', noResultsText: 'No ticket matches these filters.',
  assignMe: 'Assign to me', release: 'Release', sendNote: 'Add note', sendReply: 'Send reply', replyAs: 'Status after sending', noteMode: 'Internal note (hidden from the customer)',
  macros: 'Canned reply', insertMacro: 'Insert a canned reply…', tags: 'Tags', tagsHint: 'Comma-separated', details: 'Details', customer: 'Customer', created_at: 'Created', firstResponse: 'First reply', resolvedAt: 'Resolved',
  deleteTicket: 'Delete ticket', deleteConfirmT: 'Delete this ticket?', deleteConfirmB: 'The conversation and its attachments will be permanently deleted.', deleted: 'Ticket deleted',
  macrosTitle: 'Canned replies', macrosSub: 'Ready-made texts you can insert into a reply.', newMacro: 'New canned reply', macroTitle: 'Title', macroBody: 'Text', noMacros: 'No canned replies', noMacrosText: 'Create your frequent answers to save time.',
  adminOnly: 'Administrators only.',
  setCategories: 'Categories', setCategoriesHint: 'One per line — offered to customers when opening a ticket.', setAutoClose: 'Auto-close', setAutoCloseHint: 'Days after which a “resolved” ticket with no reply is closed (0 = never).',
  setAttach: 'Allow attachments', setNotifyCustomer: 'E-mail the customer on every reply', setNotifyAdmins: 'E-mail administrators (new ticket, customer reply)', setMaxOpen: 'Max open tickets per customer', setMaxOpenHint: '0 = unlimited.',
  setAutoReply: 'Automatic message', setAutoReplyHint: 'Posted when a ticket is created (leave empty for none).', setSignature: 'Signature', setSignatureHint: 'Appended to every support reply.',
};

const DICT: Record<'fr' | 'en', Dict> = { fr, en };

export type Params = Record<string, string | number | null | undefined>;

export function translate(lang: 'fr' | 'en', key: string, params: Params = {}): string {
  const tpl = DICT[lang][key] ?? DICT.fr[key] ?? key;
  return tpl.replace(/\{(\w+)\}/g, (_m, name: string) => (params[name] === undefined || params[name] === null ? '' : String(params[name])));
}

export function useT() {
  const { lang } = useAddon();
  return useCallback((key: string, params?: Params) => translate(lang, key, params), [lang]);
}

/** Message d'erreur API → texte traduit (les codes du serveur sont en MAJUSCULES : TOO_MANY_OPEN…). */
export function errText(t: (k: string) => string, e: any): string {
  const m = String(e?.message ?? e);
  const k = `err.${m}`;
  return t(k) !== k ? t(k) : m;
}
