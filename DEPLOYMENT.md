# Deployment Guide - Sound Inventory Tracker

## GitHub Repository Secrets Required

Add these secrets to your GitHub repository settings:

### Required Secrets Nomenclature

| Secret Name | Description | Where to Get |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API authentication token | Cloudflare Dashboard → Account Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Cloudflare Dashboard → Right side panel (Account ID) |

### Optional Secrets

| Secret Name | Description |
|---|---|
| `ADMIN_PASSWORD` | Admin panel password (if different from default) |
| `SLACK_WEBHOOK_URL` | For deployment notifications to Slack |

---

## Steps to Set Up Secrets

### 1. Get Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click your profile icon → **My Profile**
3. Navigate to **API Tokens** tab
4. Click **Create Token**
5. Use template: **Edit Cloudflare Workers** OR create custom token with:
   - **Permissions**: 
     - Account.Cloudflare Workers Scripts:Edit
     - Account.D1:Edit
     - Zone.Workers Routes:Edit
   - **Account Resources**: Include specific account OR All accounts
6. Copy token and save securely

### 2. Get Cloudflare Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Look at right sidebar under **Account**
3. Copy the **Account ID** (20-character string)

### 3. Add Secrets to GitHub

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each secret:
   - Name: `CLOUDFLARE_API_TOKEN` → Value: (paste token)
   - Name: `CLOUDFLARE_ACCOUNT_ID` → Value: (paste account ID)
4. Click **Add secret**

---

## Deployment Process

### Automatic Deployment (GitHub Actions)

**Triggered by:**
- Push to `main` branch
- Manual trigger via GitHub UI (Actions tab → Deploy → Run workflow)

**Workflow steps:**
1. Install Node dependencies
2. Deploy D1 database schema
3. Seed initial data from Excel
4. Deploy Workers code to Cloudflare
5. Notification on success/failure

**View logs:**
1. Go to GitHub repo → **Actions** tab
2. Click latest **Deploy to Cloudflare** workflow
3. Click job to see detailed logs

### Manual Deployment (Local)

If you prefer to deploy locally:

```bash
# Install dependencies
npm install

# Set Cloudflare credentials (from .env or environment)
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"

# Deploy schema
npx wrangler d1 execute sound-inventory-prod --file database/schema.sql

# Seed data
npm run migrate

# Deploy Workers
npm run deploy
```

---

## Cloudflare Configuration

### Create D1 Database (One-time setup)

```bash
npx wrangler d1 create sound-inventory-prod
```

Output will show:
- `database_id` - Copy this value

### Update wrangler.toml

Replace `YOUR_PROD_DATABASE_ID` with the actual ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "sound-inventory"
database_id = "YOUR_PROD_DATABASE_ID"
```

---

## Troubleshooting

### "401 Unauthorized" Error

**Cause:** Invalid API token or account ID

**Fix:**
1. Verify secrets are set correctly in GitHub
2. Check API token hasn't expired
3. Regenerate token with correct permissions

### "Database not found" Error

**Cause:** Database ID mismatch

**Fix:**
1. Run `npx wrangler d1 list` to see all databases
2. Copy correct `database_id` to `wrangler.toml`

### Deployment Stuck or Timeout

**Cause:** Large Excel data import taking too long

**Fix:**
1. Check Cloudflare Workers limits
2. Increase timeout in workflow YAML (under Deploy step)
3. Split migration into smaller batches

### Excel Migration Fails

**Cause:** File format issues or missing dependencies

**Fix:**
```bash
# Manually test migration locally
npm install
npm run migrate

# If still fails, check NCPA_Inventory_All.xlsx format
```

---

## Environment Variables

Set these in `wrangler.toml` or GitHub Actions secrets:

```toml
[env.production.vars]
ADMIN_PASSWORD = "your-secure-password"
ENVIRONMENT = "production"
ALERT_THRESHOLD_DAYS = "5"
```

---

## Post-Deployment Checks

After successful deployment:

1. **Verify Worker is live:**
   ```
   curl https://your-workers-domain.com/health
   ```
   Expected response: `{"status":"ok"}`

2. **Test D1 connection:**
   - Check if venues load: `GET /api/config/venues`
   - Should return list of 6 venues

3. **Check crew members:**
   - `GET /api/config/crew`
   - Should return 12 members (11 crew + 1 admin)

4. **Verify equipment:**
   - `GET /api/items`
   - Should return all items from Excel

---

## Rollback Procedure

If deployment fails:

1. **GitHub Actions shows failure:** Review logs, fix code, push to `main` again
2. **Issue after deployment:** Revert commit on `main` branch and push
3. **Database corruption:** Restore from backup (if available) or recreate D1

```bash
# Delete D1 database
npx wrangler d1 delete sound-inventory-prod

# Recreate from scratch
npx wrangler d1 create sound-inventory-prod
npm run deploy
```

---

## Support

For issues:
1. Check [Cloudflare Workers docs](https://developers.cloudflare.com/workers/)
2. Check [D1 docs](https://developers.cloudflare.com/d1/)
3. Review GitHub Actions logs for detailed error messages
4. Contact your administrator
