<div align="center">

# 🎫 UHQ Tickets Add-on

**Built-in customer support: customers open tickets, your team answers from a dedicated console.**

Official free add-on for [UHQ Panel OS](https://github.com/BloumeSAS/UHQ-Panel-OS) — by [Bloume SAS](https://bloume.fr)

[![Release](https://img.shields.io/github/v/release/BloumeSAS/UHQ-Addon-Tickets?color=f97316)](https://github.com/BloumeSAS/UHQ-Addon-Tickets/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-0ea5e9)](https://uhq-panel-os-docs.bloume.fr/addons/official/tickets)
[![Video](https://img.shields.io/badge/video-YouTube-red?logo=youtube)](https://youtu.be/1_OG1qAr-N4)

🇬🇧 English · [🇫🇷 Français](README.fr.md)

</div>

---

## Features

- Customer area: tickets with attachments (PNG, JPG, WEBP, GIF, PDF, TXT — type checked on content)
- Staff console (Admin + Support roles): queue, filters, assignment, tags
- Canned replies and internal notes
- Satisfaction ratings, first-response and resolution times
- Auto-close of resolved tickets, e-mail notifications

▶️ **Video — install, test and tour:** https://youtu.be/1_OG1qAr-N4

## Requirements

- UHQ Panel OS (latest version recommended)
- No other add-on required

## Installation

### Bundled (recommended)

The add-on is already included in the UHQ Panel OS image. In the panel, open **Extensions**, find **Tickets** and click **Enable**. Nothing else to configure: the panel starts it as an internal process and serves it under `/addon-proxy/tickets/`.

### Standalone (Docker)

```bash
docker run -d --name uhq-addon-tickets -p 3107:3107 \
  -e PANEL_URL=https://panel.example.com \
  -e PANEL_API_KEY=your-panel-api-key \
  -v uhq-addon-tickets:/app/data \
  ghcr.io/bloumesas/uhq-addon-tickets:latest
```

Then add its URL in **Extensions → Add an add-on**.

## Configuration

| Variable | Description |
|---|---|
| `PORT` | Listening port (default `3107`) |
| `PANEL_URL` | Panel URL (token verification, panel API) |
| `PANEL_API_KEY` | Panel API key (Settings → API key): backups, e-mails, add-on to add-on calls |
| `DB_PATH` | Data file (JSON) |
| `NODE_ENV` | `production` or `development` |

## Security

Every request is verified by the panel (`/api/panel/security/me`): roles are never read from the token alone. Add-on to add-on calls and backups require the panel API key (`X-Panel-Key`, constant-time comparison). Report vulnerabilities privately — see the [UHQ Panel OS security policy](https://github.com/BloumeSAS/UHQ-Panel-OS/blob/main/SECURITY.md).

## Development

```bash
npm run install:all
cd api && npm run start:dev   # API :3107
cd web && npm run dev         # Vite dev server
npm run build                 # web + api
```

When bundled in the panel image, the web app is built with `--base="/addon-proxy/tickets/"`.

## Documentation

https://uhq-panel-os-docs.bloume.fr/addons/official/tickets

## License

[MIT](LICENSE) © [Bloume SAS](https://bloume.fr)
