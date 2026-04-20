# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Local dev server via wrangler (requires Cloudflare auth)
npm run deploy   # Manual deploy to Cloudflare Pages (CI handles this automatically)
```

There are no tests or linters configured. When developing locally, `wrangler dev` binds to the D1 database — you need a Cloudflare account and `wrangler login` for the local server to work against a real database.

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`, which:
1. Injects the real D1 UUID from GitHub Secrets into `wrangler.toml` (replacing `PLACEHOLDER_D1_ID`)
2. Applies `database/schema.sql` idempotently against the remote D1 database
3. Deploys `src/frontend/` as static assets to Cloudflare Pages

**Never commit a real D1 database UUID into `wrangler.toml`** — the placeholder string must stay as `PLACEHOLDER_D1_ID` so CI substitution works. The deploy workflow does not re-run the seed — data seeding is a one-time local operation only.

## Architecture

### Request Flow

All `/api/*` traffic hits the single Cloudflare Pages Function at `functions/api/[[route]].js`. It instantiates `Database(env)` and calls each route handler in sequence. **Each handler returns `null` if the path doesn't match** — the router tries all four handlers before returning 404. When adding a new route group, add a new handler file in `src/backend/routes/` and register it in the catch-all function.

```
Request → functions/api/[[route]].js
              ├── handleItemsRequest()      src/backend/routes/items.js
              ├── handleMovementsRequest()  src/backend/routes/movements.js
              ├── handleAlertsRequest()     src/backend/routes/alerts.js
              └── handleConfigRequest()    src/backend/routes/config.js
```

### Database Layer

`src/backend/db.js` exports a single `Database` class that wraps Cloudflare D1. All SQL lives here — routes never construct SQL directly. The three key query methods:
- `db.query(sql, params)` — returns `{ results: [] }`
- `db.run(sql, params)` — returns `{ meta: { last_row_id } }`
- `db.first(sql, params)` — returns first row or `null`

### Item Status Model

Items have two statuses: `available` and `checked_out`.

| Action | Status after | `returned_to_base_at` |
|---|---|---|
| Checkout | `checked_out` | unchanged (null) |
| Move (non-home venue) | `checked_out` | unchanged (null) |
| Return to base | `available` | stamped on **all** open movements for that item |

When `returned_to_base_at` is stamped, a daily cron deletes those movement records after 30 days. Items moved to non-home venues retain history indefinitely until they return to base.

### Admin Authentication

Admin-only endpoints (POST/DELETE on venues and crew, PUT password) use `requireAdmin()` in `config.js`, which reads `Authorization: Bearer <password>` and compares against the `admin_password` row in the `config` table. The default password is `ls1234`.

### Frontend

Pure vanilla JS SPA — no bundler, no framework. Files in `src/frontend/` are served directly as static assets. The four JS modules (`app.js`, `api.js`, `ui.js`, `storage.js`) load via `<script type="module">` in `index.html`. `storage.js` persists crew selection to `localStorage`. `api.js` is the only layer that calls `fetch` — all network calls go through it.

## Database Schema Notes

- `items.home_venue_id` is immutable — it defines where the item belongs. Return to base always routes to `home_venue_id`, not a caller-supplied venue.
- The `config` table stores key-value app settings (admin password, retention days, alert threshold). Use `db.getConfigValue(key)` to read them.
- `movements.returned_to_base_at` is the cleanup trigger — `NULL` means the trip is open.
