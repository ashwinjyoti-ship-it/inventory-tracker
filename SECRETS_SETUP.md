# GitHub Secrets Setup - Quick Reference

## Required Secrets to Add to Your GitHub Repository

Add these **3 secrets** to enable auto-deployment:

| Secret Name | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API authentication token |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID (20-char string) |
| `CLOUDFLARE_D1_DATABASE_ID` | Your D1 database UUID (from Cloudflare dashboard) |

---

## How to Get Each Secret

### CLOUDFLARE_API_TOKEN
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Select **"Edit Cloudflare Workers"** template
4. Click **Create Token**
5. Copy the token

### CLOUDFLARE_ACCOUNT_ID
1. Go to https://dash.cloudflare.com
2. Look at **right sidebar** under "Account"
3. Copy the **Account ID** (e.g. `a1b2c3d4e5f6g7h8i9j0a1b2`)

### CLOUDFLARE_D1_DATABASE_ID
You must create a D1 database first (one-time setup):
1. Install wrangler locally: `npm install -g wrangler`
2. Login: `npx wrangler login`
3. Create database: `npx wrangler d1 create sound-inventory`
4. Copy the `database_id` from the output (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

---

## How to Add Secrets to GitHub

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each of the 3 secrets with **exact names above**
4. Click **Add secret** after each one

---

## Initial Data Seeding (One-Time Step)

After secrets are configured and first deploy succeeds, seed the inventory data:

```bash
# On your local machine
npm install
npx wrangler login
npm run migrate   # Generates SQL from Excel file
npx wrangler d1 execute sound-inventory --file database/migrations/001_initial_data.sql --remote
```

This populates the database with all equipment from NCPA_Inventory_All.xlsx.
You only need to do this **once**.

---

## Deployment Process (After Setup)

Every push to `main` will automatically:
1. Install dependencies
2. Deploy database schema (safe to run repeatedly)
3. Deploy the Worker + frontend to Cloudflare

Your app will be live at: `https://sound-inventory-tracker.{your-subdomain}.workers.dev`

---

## Verify Deployment

After deploy succeeds, test the app:
```
https://sound-inventory-tracker.{subdomain}.workers.dev/health
```
Should return: `{"status":"ok"}`
