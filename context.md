# Sound Inventory Tracker — Context & Guide

## Overview

A mobile-friendly app to track live sound equipment across venues at the NCPA performance center.
Equipment is checked out from one venue, used elsewhere, and returned. The tracker logs who took
what, where, and when.

## Key Concepts

### Item Lifecycle
An item has a **home venue** (where it belongs). A typical trip:

1. Item starts at Base (home venue) — status: **available**
2. Crew checks it out to Venue A — status: **checked_out**, location: Venue A
3. Item can be moved again (Venue A → Outside Venue) — stays **checked_out**, location: Outside Venue
4. Item is returned to Base — status: **available**, location: Base

### History Retention
Movement records are kept while an item is out on a trip. Once an item is returned to its
**home venue**, all movement records for that trip are stamped with `returned_to_base_at`.
A daily cron job deletes any stamped records older than **30 days**.

Items returned to a non-home venue keep their history indefinitely until they eventually
make it back to base.

### Admin Section
The Admin panel (password protected) allows:
- **Venues**: Add new venues (e.g. Outdoor Stage A), delete unused ones
- **Crew**: Add new crew members, delete old ones

Access via the "Admin" tab. Default password is set via the `ADMIN_PASSWORD` environment
variable on Cloudflare (configure in Cloudflare dashboard secrets for production).

## Venues
Six base venues seeded from the Excel file:
- **JBT**, **TATA**, **TET**, **LT**, **GDT** — Storage/performance spaces
- **OFFICE** — Administrative office

Additional venues (outdoor stages, etc.) are added by admin via the app.

## Development

### Prerequisites
- Node.js 18+
- Cloudflare account with D1 database access

### Setup
```bash
npm install
npx wrangler d1 create sound-inventory-prod
# Update wrangler.toml with the database_id returned above
npx wrangler d1 execute sound-inventory-prod --file database/schema.sql
node src/scripts/migrate-excel.js   # seeds venues, equipment, items, crew from Excel
npm run dev                          # local dev on http://localhost:8787
npm run deploy                       # deploy to Cloudflare Workers
```

### Environment Variables
| Variable | Where to set | Description |
|---|---|---|
| `ADMIN_PASSWORD` | Cloudflare dashboard secrets | Password for the admin panel |
| `DB` | wrangler.toml (d1_databases binding) | D1 database binding |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/items | List items (filters: status, venue, equipment) |
| GET | /api/items/:id | Get single item |
| GET | /api/items/:id/history | Full movement history for item |
| POST | /api/movements/checkout | Check out items |
| POST | /api/movements/return | Return items |
| GET | /api/movements | List movements (filters: crew_member_id, item_id, type) |
| GET | /api/alerts/unreturned | Items not returned after N days (default 5) |
| GET | /api/config/venues | List venues |
| POST | /api/config/venues | Add venue (admin) |
| PUT | /api/config/venues/:id | Update venue (admin) |
| DELETE | /api/config/venues/:id | Delete venue (admin) |
| GET | /api/config/crew | List crew members |
| POST | /api/config/crew | Add crew member (admin) |
| PUT | /api/config/crew/:id | Update crew member (admin) |
| DELETE | /api/config/crew/:id | Delete crew member (admin) |
