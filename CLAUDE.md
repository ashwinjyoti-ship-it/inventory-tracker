# Sound Inventory Tracker - Codebase Overview

## Project Summary
A simple live sound inventory tracker for a multi-venue performance center. Tracks equipment movements across venues, managed by 11 crew members. Deployed on Cloudflare (Workers + D1).

## Architecture

### Tech Stack
- **Frontend**: Mobile-friendly vanilla JS + HTML/CSS
- **Backend**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite)
- **Data Source**: NCPA_Inventory_All.xlsx (Excel inventory)

### Key Features
- Track equipment checkout/return between venues
- Individual item-level tracking (not quantities)
- Movement history for all items
- Unreturned items alerts (5+ days)
- Admin panel to configure venues and crew

## Project Structure

```
/
├── CLAUDE.md                          # This file
├── context.md                         # User guide & setup
├── NCPA_Inventory_All.xlsx            # Source inventory data
├── config/
│   ├── venues.json                    # Venue configuration
│   └── equipment-mapping.json         # Equipment reference
├── src/
│   ├── backend/
│   │   ├── index.js                   # Worker entry point
│   │   ├── db.js                      # D1 query helpers
│   │   ├── middleware.js              # Request parsing
│   │   ├── utils.js                   # Utility functions
│   │   └── routes/
│   │       ├── items.js               # GET items, locations
│   │       ├── movements.js           # POST checkout/return, GET history
│   │       ├── config.js              # Admin: venues, crew
│   │       └── alerts.js              # GET unreturned items
│   ├── frontend/
│   │   ├── index.html                 # Main app entry
│   │   ├── js/
│   │   │   ├── app.js                 # Main app logic
│   │   │   ├── api.js                 # API calls
│   │   │   ├── ui.js                  # UI rendering
│   │   │   └── storage.js             # Session state
│   │   ├── css/
│   │   │   └── style.css              # Mobile-first styles
│   │   └── pages/
│   │       ├── checkout.html          # Checkout form
│   │       ├── return.html            # Return form
│   │       ├── history.html           # Movement history
│   │       ├── alerts.html            # Unreturned items
│   │       └── admin.html             # Admin panel
│   └── scripts/
│       └── migrate-excel.js           # Parse & seed Excel data
├── database/
│   ├── schema.sql                     # D1 schema
│   └── migrations/                    # Future migrations
├── package.json
├── wrangler.toml                      # Cloudflare Workers config
└── .gitignore
```

## Database Schema

### Tables
- **venues**: Storage locations (JBT, TATA, TET, LT, GDT, OFFICE, custom outdoor venues)
- **equipment**: Equipment types from Excel (Consoles, Microphones, etc.)
- **items**: Individual items (each microphone/console instance)
- **crew_members**: 11 crew + admin
- **movements**: All checkout/return history
- **config**: App-wide settings

Key relationships:
- Each item has: equipment_id, home_venue_id (original location), current_venue_id (current location)
- Each movement logs: item_id, crew_member_id, from_venue_id, to_venue_id, movement_type (checkout/return)

## API Endpoints

### Items
- `GET /api/items` — List all items with current location
- `GET /api/items/:id` — Get single item details
- `GET /api/items?status=checked_out` — Filter by status

### Movements (Checkout/Return)
- `POST /api/movements/checkout` — Log checkout
  ```json
  { "item_ids": [1,2], "crew_member_id": 1, "from_venue_id": 1, "to_venue_id": 2 }
  ```
- `POST /api/movements/return` — Log return
  ```json
  { "item_ids": [1,2], "crew_member_id": 1, "to_venue_id": 1 }
  ```
- `GET /api/movements` — Movement history (filterable)
- `GET /api/items/:id/history` — History for one item

### Alerts
- `GET /api/alerts/unreturned` — Items not returned after 5 days

### Admin Config
- `GET /api/config/venues` — List venues
- `POST /api/config/venues` — Create venue
- `PUT /api/config/venues/:id` — Update venue
- `DELETE /api/config/venues/:id` — Delete venue
- Same for crew_members

## Setup & Deployment

### Local Development
1. `npm install`
2. `npx wrangler d1 create sound-inventory-dev`
3. `npx wrangler d1 execute sound-inventory-dev --file database/schema.sql`
4. `node src/scripts/migrate-excel.js` (to seed data locally)
5. `npm run dev` (start local Worker)

### Production
1. Create D1 database on Cloudflare account
2. Deploy schema to production
3. Update `wrangler.toml` with production DB binding
4. `npm run deploy`

## Key Design Decisions

1. **Item IDs**: System-generated per equipment type (KM184 #001, #002) for human readability
2. **Back to Base**: Returns item to its home_venue, not a special location
3. **Crew**: Configurable in admin panel (11 crew + admin)
4. **Venues**: Configurable, starts with 6 base venues + outdoor space option
5. **No Login**: Crew selects name from dropdown on each action
6. **Mobile-First**: Responsive UI optimized for phone usage by crew
7. **Simple Notifications**: In-app alerts for unreturned items at 5 days

## Development Workflow

1. Make changes in feature branch: `claude/sound-inventory-tracker-EoG5k`
2. Test locally: `npm run dev`
3. Commit changes with clear messages
4. Push to feature branch: `git push origin claude/sound-inventory-tracker-EoG5k`
5. PR review before merging to main

## Testing

- **Unit**: API endpoint tests
- **Integration**: Checkout → Return → History flow
- **Mobile**: Responsive design on phone/tablet
- **Data**: Verify Excel import creates correct item counts

## Notes

- Excel data (NCPA_Inventory_All.xlsx) is one-time import
- Equipment names/categories are read-only after initial load
- Items can only be added/removed by admin via API (not UI yet)
- Future: QR code scanning, email notifications, bulk operations
