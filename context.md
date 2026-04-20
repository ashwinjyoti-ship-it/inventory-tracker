# NCPA Sound Inventory Tracker

## What It Does

A mobile-friendly web app for tracking live sound equipment across venues at the NCPA performance centre. Crew members log when they take equipment from one location to another, and when they return it. The app shows where every item is at any time, who last moved it, and flags anything that hasn't come back in over 5 days.

---

## How to Use the App

### Selecting Your Name
When you first open the app, pick your name from the dropdown at the top. The app remembers your selection on that device.

### Check Out Equipment
Use this when you are taking equipment from a venue to another location.

1. Tap **Checkout** in the bottom navigation
2. Select your name
3. Select the venue you are taking items **from**
4. Select the venue you are taking items **to**
5. Tick the items you are taking — items already in transit show an "In Transit" badge and can still be selected to move them again
6. Add notes if needed, then tap **Check Out Selected Items**
7. The form clears automatically ready for the next entry

### Return / Move Equipment
Use this when you are bringing items back or moving them to another location.

Tap **Return** in the bottom navigation. There are two tabs:

**Return to Base**
- Use this when items are going back to their home venue (where they belong)
- Select your name, tick the items, tap **Return to Base**
- No need to select a venue — the app knows each item's home location
- This marks the end of a trip; history is kept for 30 days then cleared automatically

**Move to Another Venue**
- Use this when moving items between venues without returning them to base
- This is logged as a **Move**, not a Return
- Select your name, select the destination venue, tick the items, tap **Move Items**
- Items stay marked as in transit

### Movement History
Tap **History** to see all recent movements. Filter by crew member to see their activity.
Each entry is labelled:
- **Checked Out** — taken from a venue
- **Moved** — transferred between venues
- **Returned** — brought back to home base

### Unreturned Items Alert
Tap **Alerts** to see any equipment that has been out for 5 or more days. This helps track down items before they go missing.

---

## Admin Panel

Tap **Admin** in the bottom navigation. Enter the admin password to access settings.

**Default password: ls1234**

Each section — Venues, Crew, Password — is a collapsible card. Click the
title to expand or collapse; all sections start collapsed so you can see the
full list of admin actions at a glance without scrolling.

### Manage Venues
Add new venues (e.g. Outdoor Stage North) so crew can select them when checking out. Delete venues that are no longer in use — the app will not allow deleting a venue that currently has items at it.

### Manage Crew Members
Add new crew members so they appear in the name dropdown. Delete crew members who have left. Deleting a crew member does not remove their movement history.

### Change Admin Password
Enter a new password and confirm it, then tap **Change Password**. The change takes effect immediately. There is no recovery option if the password is forgotten — contact the development team to reset it directly in the database.

---

## Item Lifecycle

A typical path for an item:

1. Starts at its **home venue** (e.g. JBT) — status: Available
2. Crew checks it out to **Venue A** (e.g. TATA) — status: In Transit
3. Crew moves it again to an **outside venue** — status: In Transit
4. Crew returns it to its **home venue** — status: Available, trip history queued for cleanup

Items can be moved as many times as needed before returning to base. Each move is individually logged with who did it, when, and between which venues.

---

## Venues

Six base venues seeded from the inventory spreadsheet:
- **JBT**, **TATA**, **TET**, **LT**, **GDT** — performance and storage spaces
- **OFFICE** — administrative office

Additional venues (outdoor stages, etc.) can be added at any time via the Admin panel.

---

## History Retention

Movement records are kept indefinitely while an item is out on a trip. Once an item is **returned to its home venue**, all records for that trip are marked for deletion. A daily automated job removes any records older than **30 days** from the return date. Items moved to non-home venues retain their history until they eventually return to base.

---

## Deployment

The app runs on **Cloudflare Pages** with **Pages Functions** for the backend API. Frontend static files live in `src/frontend/`; the backend is a single catch-all route at `functions/api/[[route]].js` that dispatches to `src/backend/routes/*.js`. Data lives in a Cloudflare D1 database called `sound-inventory`.

**Live URLs:**
- Crew app: https://ls-inventory.pages.dev
- Admin panel: https://ls-inventory.pages.dev/admin

**Auto-deploy:** Every push to the `main` branch on GitHub triggers an automatic deployment via GitHub Actions (`.github/workflows/deploy.yml`). The workflow:
1. Substitutes the D1 database ID into `wrangler.toml` from the `CLOUDFLARE_D1_DATABASE_ID` secret (never hardcoded).
2. Applies `database/schema.sql` to D1 (idempotent — safe to re-run).
3. Creates the Pages project if it does not yet exist.
4. Deploys `src/frontend` as the static assets; Pages Functions are picked up automatically.

**Required GitHub secrets** (Settings → Secrets → Actions):
| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages + D1 permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CLOUDFLARE_D1_DATABASE_ID` | The D1 database UUID from the Cloudflare dashboard |

**Initial data seeding** (one-time only, already done):
6 venues, 12 crew members, 115 equipment models, and 1192 items were seeded from `NCPA_Inventory_All.xlsx` via `src/scripts/build_seed.py` → `database/seed.sql`. The deploy workflow does **not** re-seed on every deploy — the schema step is idempotent, but data seeding is a one-shot local operation. If the database is ever wiped and needs to be re-seeded, run `build_seed.py` then apply `database/seed.sql` via `wrangler d1 execute sound-inventory --remote --file=database/seed.sql`.

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/items | — | List items (filters: status, venue, equipment) |
| GET | /api/items/:id | — | Get single item |
| GET | /api/items/:id/history | — | Movement history for one item |
| POST | /api/movements/checkout | — | Check out items |
| POST | /api/movements/return | — | Return items to their home venue |
| POST | /api/movements/move | — | Move items to another venue |
| GET | /api/movements | — | List movements (filters: crew, item, type) |
| GET | /api/alerts/unreturned | — | Items out for 5+ days |
| GET | /api/config/venues | — | List venues |
| POST | /api/config/venues | Admin | Add venue |
| DELETE | /api/config/venues/:id | Admin | Delete venue |
| GET | /api/config/crew | — | List crew members |
| POST | /api/config/crew | Admin | Add crew member |
| DELETE | /api/config/crew/:id | Admin | Delete crew member |
| PUT | /api/config/password | Admin | Change admin password |
