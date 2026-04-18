# Sound Inventory Tracker - Setup & User Guide

## Overview

A simple mobile-friendly app to track live sound equipment across venues at the NCPA performance center. Equipment is checked out from one venue, used elsewhere, and returned. This tracker logs who took what, where, and when.

**Problem Solved**: Equipment is no longer tracked after movement, causing lost or misplaced items. This app ensures accountability and visibility.

## For Users (Crew)

### Accessing the App
1. Open the app in any mobile browser
2. Select your name from the dropdown (no login required)
3. Choose action: **Checkout**, **Return**, **View History**, or **Alerts**

### Checkout Equipment
1. Tap **Checkout**
2. Select "From" venue (where equipment is now)
3. Select equipment items you're taking (e.g., "2x KM184")
4. Select "To" venue (destination)
5. Tap "Confirm" — logged and done

### Return Equipment
1. Tap **Return**
2. See list of items YOU checked out
3. Select items you're returning
4. Tap "Back to Base" (goes to original venue) or "To Another Venue"
5. Tap "Confirm" — returned

### View History
1. Tap **History**
2. See all your checkouts and returns in timeline
3. Tap item name to see full movement history across all crew

### Check Alerts
1. Tap **Alerts**
2. See equipment not yet returned after 5 days
3. Know what to follow up on

## For Admin (Head of Department)

### Accessing Admin Panel
1. Open app
2. Tap **Admin** (password protected)
3. Manage venues and crew

### Configure Venues
1. **Add Venue**: Enter name and description (e.g., "Outdoor Stage A")
2. **Edit Venue**: Change name/description
3. **Delete Venue**: Remove venue (can't delete if items currently there)

### Configure Crew
1. **Add Crew Member**: Enter name (e.g., "John Smith")
2. **Edit Crew Member**: Update name
3. **Deactivate**: Mark as inactive (don't delete to preserve history)

### View All Data
- See all equipment items and their current locations
- See complete movement history
- Export data (future feature)

## Initial Setup (For Developers)

### Prerequisites
- Node.js 18+
- Cloudflare account with D1 database access
- NCPA_Inventory_All.xlsx (already in repo)

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Cloudflare D1 Database
```bash
npx wrangler d1 create sound-inventory-prod
# Copy database_id from output and update wrangler.toml
```

### 3. Deploy Database Schema
```bash
npx wrangler d1 execute sound-inventory-prod --file database/schema.sql
```

### 4. Seed Data from Excel
```bash
node src/scripts/migrate-excel.js
# This parses NCPA_Inventory_All.xlsx and inserts:
# - All venues (JBT, TATA, TET, LT, GDT, OFFICE)
# - All equipment types and categories
# - All individual items (e.g., KM184 #001, KM184 #002...)
# - Initial crew members (first 11 + admin)
```

### 5. Start Local Development
```bash
npm run dev
# Server runs on http://localhost:8787
# Open in browser and test
```

### 6. Deploy to Production
```bash
npm run deploy
# Pushes to Cloudflare Workers and binds to D1
```

## Understanding the Data

### Venues
6 base venues (can add more via admin):
- **JBT**, **TATA**, **TET**, **LT**, **GDT** — Storage/performance spaces
- **OFFICE** — Administrative office

Plus custom outdoor venues added via admin.

### Equipment
Categories from Excel:
- Consoles & Mixers (e.g., ALLEN & HEATH AVANTIS SOLO)
- Stage Racks & I/O (e.g., FOCUSRITE 18I20)
- Microphones (e.g., KM184)
- Speakers, Cables, etc.

Each equipment type can have multiple instances (e.g., 5x KM184 = KM184 #001 through #005).

### Items
Each physical piece of equipment gets:
- **Unique ID**: system-generated (KM184 #001)
- **Home Venue**: where it originally belongs (JBT, TATA, etc.)
- **Current Venue**: where it is right now
- **Status**: available or checked_out

### Movements
Every checkout and return is logged:
- Who (crew member)
- What (equipment item)
- From venue
- To venue
- When (timestamp)

## Key Workflows

### Normal Day
1. Crew arrives, checks app for equipment location
2. Takes equipment from venue A to venue B, logs checkout
3. Uses equipment for show
4. Returns to venue A (or another) and logs return
5. Equipment is now available at that venue

### Missing Equipment Alert
1. Admin checks "Alerts" page daily
2. Sees items not returned after 5 days
3. Contacts crew member who checked it out
4. Crew member returns item and logs it
5. Alert clears

### Adding New Crew Member
1. Admin opens Admin Panel
2. Taps "Add Crew"
3. Enters name
4. Crew member can now select themselves in dropdown

### Adding Outdoor Venue
1. Admin opens Admin Panel
2. Taps "Add Venue"
3. Enters name (e.g., "Outdoor Stage - North")
4. Crew can now select it as destination for checkout

## Troubleshooting

**Q: I don't see my name in the dropdown**
- Admin may not have added you yet. Ask head of department to add you in Admin Panel.

**Q: Equipment shows as checked out but I returned it**
- Make sure you tapped "Confirm" on the return screen. Check History to verify.

**Q: Where is equipment X?**
- Search by item name in "View History" or ask admin to check full data report.

**Q: I need to move equipment to a venue that's not in the app**
- Ask admin to add it in Admin Panel under "Add Venue".

## Support

For bugs or feature requests, contact the development team or file an issue in the project repository.
