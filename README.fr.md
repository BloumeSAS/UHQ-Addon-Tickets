[🇬🇧 English](README.md) · 🇫🇷 Français

# UHQ Tickets — addon de support pour UHQ Panel OS

Support client intégré : vos clients ouvrent des tickets (avec pièces jointes), votre équipe (rôles **Administrateur** et **Support**) répond depuis une console dédiée.

> **Free Addon by [Bloume SAS](https://bloume.fr)** — licence MIT. Documentation : <https://uhq-panel-os-docs.bloume.fr/addons/official/tickets>

## Fonctionnalités

- Espace client : création de ticket (sujet, catégorie, priorité, compte concerné, pièces jointes), conversation, clôture / réouverture, **notation** de l'aide reçue.
- Console du personnel : file d'attente filtrable, attribution, **réponses types**, **notes internes**, étiquettes, statistiques (première réponse, résolution, satisfaction).
- Fermeture automatique des tickets « résolus » sans réponse du client.
- E-mails (via le SMTP du panel) : ticket reçu, réponse, résolu (client) ; nouveau ticket, réponse du client (administrateurs).
- Thème du panel repris automatiquement (clair / sombre / couleurs personnalisées), FR / EN.

## Sécurité

- Chaque appel est **vérifié par le panel** (`/api/panel/security/me`) : le rôle n'est jamais lu dans le jeton.
- Un client ne voit que ses tickets (404 sinon). Les notes internes ne sont jamais renvoyées aux clients.
- Pièces jointes : PNG / JPG / WEBP / GIF / PDF / TXT, 2 Mo × 3 ; type vérifié sur le **contenu** ; téléchargement authentifié, `Content-Disposition: attachment`, `nosniff`, CSP `sandbox`.
- Limites : 10 nouveaux tickets et 40 réponses par heure et par client.

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3107` | Port d'écoute |
| `PANEL_URL` | `http://localhost:8000` | URL du panel (vérification des jetons) |
| `PANEL_API_KEY` | — | Clé API du panel : e-mails et sauvegarde |
| `DB_PATH` | `./tickets-data.json` | Fichier de données (pièces jointes dans `<DB_PATH>.files/`) |

## Développement

```bash
npm run install:all
cd api && npm run start:dev   # API :3107
cd web && npm run dev         # Vite :5177 (proxy vers l'API)
npm run build                 # web + api
```

Embarqué dans l'image du panel : le web se construit avec `--base="/addon-proxy/tickets/"` (voir `addons/build-bundled.sh` du panel).

## API (résumé)

`GET /api/me` · `GET|POST /api/tickets` · `GET /api/tickets/:id` · `POST /api/tickets/:id/{reply,close,rate}` · `GET /api/tickets/:id/files/:fileId`
Personnel : `GET /api/staff/{overview,tickets,macros,settings}` · `POST /api/staff/tickets/:id/reply` · `PATCH|DELETE /api/staff/tickets/:id`
Sauvegarde : `GET /api/backup/export`, `POST /api/backup/import` (`X-Panel-Key`).
