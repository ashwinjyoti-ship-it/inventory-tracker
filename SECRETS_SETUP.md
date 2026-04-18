# GitHub Secrets Setup - Quick Reference

## Required Secrets to Add to Your GitHub Repository

Add these 2 secrets to enable auto-deployment:

### Secret 1: CLOUDFLARE_API_TOKEN
- **Name in GitHub:** `CLOUDFLARE_API_TOKEN`
- **Value:** Your Cloudflare API Token
- **How to get:**
  1. Go to https://dash.cloudflare.com/profile/api-tokens
  2. Click "Create Token"
  3. Choose "Edit Cloudflare Workers" template (recommended)
  4. Copy the token

### Secret 2: CLOUDFLARE_ACCOUNT_ID
- **Name in GitHub:** `CLOUDFLARE_ACCOUNT_ID`
- **Value:** Your Cloudflare Account ID (20-character string)
- **How to get:**
  1. Go to https://dash.cloudflare.com
  2. Look at right sidebar under "Account"
  3. Copy the Account ID

---

## How to Add Secrets to GitHub

1. Go to your repo: https://github.com/ashwinjyoti-ship-it/inventory-tracker
2. Click **Settings** (top menu)
3. Left sidebar → **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. For each secret:
   - Paste the **Name** (exactly as shown above)
   - Paste the **Value** (from Cloudflare)
   - Click **Add secret**

---

## Verify Setup

After adding secrets:

1. Push any commit to `main` branch
2. Go to **Actions** tab
3. Watch "Deploy to Cloudflare" workflow run
4. Check that all steps pass ✅

---

## Secrets Nomenclature Summary

```
CLOUDFLARE_API_TOKEN    → Cloudflare API authentication
CLOUDFLARE_ACCOUNT_ID   → Cloudflare account identifier
```

These exact names are used in `.github/workflows/deploy.yml`

---

## Once Secrets Are Set Up

Your app will auto-deploy whenever you:
- Push to `main` branch
- Or manually trigger via GitHub Actions

No additional setup needed!
