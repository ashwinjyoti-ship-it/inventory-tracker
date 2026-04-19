# NCPA Sound Inventory Tracker

Mobile-first inventory tracker for sound equipment at NCPA. Built on Cloudflare
Pages + D1, no frameworks.

## Live URLs

- Mobile (crew): <https://inventory-tracker.pages.dev>
- Admin: <https://inventory-tracker.pages.dev/admin>

## What it does

- 1192 individual items (115 models) seeded from `NCPA_Inventory_All.xlsx`
  across 6 home venues (JBT, TATA, TET, LT, GDT, OFFICE).
- Crew picks their name, then **Checkout** (from venue → to venue) or
  **Return** ("Back to Base" or to another venue).
- Movement history + alerts for items unreturned 5+ days.
- Admin UI (`/admin`, password protected) for venues, crew, full equipment
  list with current locations, and the full movement log.

## Initial admin password

`Lsi@123456` — change it from the admin UI as soon as you sign in. The
password is stored as a PBKDF2-SHA256 hash in D1 (not in the repo or in any
environment variable), so rotating it from the UI is the canonical path.

## Stack

- Frontend: vanilla HTML/CSS/JS in `public/`
- API: Cloudflare Pages Functions in `functions/`
- DB: Cloudflare D1 (SQLite), schema in `db/schema.sql`, seed in `db/seed.sql`
- CI: `.github/workflows/deploy.yml` — auto-deploys on push to `main`

## Local dev

```sh
npm install
npm run build:seed          # regenerate db/seed.sql from the Excel sheet
npm run dev                 # wrangler pages dev
```
