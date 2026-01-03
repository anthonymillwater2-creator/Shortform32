# PayPal Diagnostic Guide - ShortFormFactory

## Quick Diagnosis Steps

### Step 1: Check Health Endpoint
Visit: `https://shortform32.vercel.app/api/paypal-health`

**Expected Output (Working):**
```json
{
  "ok": true,
  "missing": [],
  "env": "sandbox",
  "currency": "USD",
  "apiBase": "https://api-m.sandbox.paypal.com",
  "runtime": {
    "VERCEL_ENV": "production",
    "NODE_ENV": "production",
    "hasClientId": true,
    "hasClientSecret": true,
    "clientIdLength": 80,
    "clientSecretLength": 80,
    "env": "sandbox",
    "currency": "USD"
  },
  "message": "PayPal configuration is complete"
}
```

**Expected Output (Broken):**
```json
{
  "ok": false,
  "missing": ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"],
  "env": "live",
  "currency": "USD",
  "runtime": {
    "VERCEL_ENV": "production",
    "hasClientId": false,
    "hasClientSecret": false,
    "clientIdLength": 0,
    "clientSecretLength": 0
  },
  "message": "Missing required environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET. Set these in Vercel → Project Settings → Environment Variables for the current environment (production)."
}
```

### Step 2: Check Vercel Logs
1. Go to Vercel dashboard → Shortform32 project
2. Go to "Deployments" → Latest Production deployment
3. Click "View Function Logs"
4. Look for lines starting with `[paypal-config]`, `[create-order]`, `[capture-order]`

**Example Log Output:**
```
[paypal-config] Runtime check: {
  VERCEL_ENV: 'production',
  NODE_ENV: 'production',
  hasClientId: false,
  hasClientSecret: false,
  clientIdLength: 0,
  env: 'live',
  currency: 'USD'
}
[paypal-config] Missing env vars: [ 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET' ]
```

---

## Root Cause Analysis

### Common Issue: Environment Variable Scope Mismatch

Vercel has THREE environment scopes:
- **Production** - Only used by production deployment (shortform32.vercel.app)
- **Preview** - Only used by preview deployments (branch deployments)
- **Development** - Only used by `vercel dev` locally

**THE PROBLEM:** Environment variables must be scoped to the environment where they'll be used.

### How to Fix:

1. **Go to Vercel Dashboard:**
   - https://vercel.com/your-team/shortform32/settings/environment-variables

2. **For EACH variable, ensure "Production" is checked:**
   - `PAYPAL_CLIENT_ID` - Must check ✅ Production
   - `PAYPAL_CLIENT_SECRET` - Must check ✅ Production
   - `PAYPAL_ENV` - Must check ✅ Production
   - `PAYPAL_CURRENCY` - Must check ✅ Production

3. **After saving, REDEPLOY:**
   - Go to Deployments → Latest Production → ⋯ → Redeploy
   - **CRITICAL:** Changing env vars does NOT auto-redeploy. You MUST manually redeploy.

---

## Environment Variable Values

### For Sandbox Testing (DO THIS FIRST):
```
PAYPAL_CLIENT_ID     = <your-sandbox-client-id>
PAYPAL_CLIENT_SECRET = <your-sandbox-secret>
PAYPAL_ENV           = sandbox
PAYPAL_CURRENCY      = USD
```

Get sandbox credentials from:
https://developer.paypal.com/dashboard/applications/sandbox

### For Live Production (AFTER sandbox works):
```
PAYPAL_CLIENT_ID     = <your-live-client-id>
PAYPAL_CLIENT_SECRET = <your-live-secret>
PAYPAL_ENV           = live
PAYPAL_CURRENCY      = USD
```

Get live credentials from:
https://developer.paypal.com/dashboard/applications/live

---

## Verification Checklist

After setting env vars and redeploying:

1. ✅ Visit `/api/paypal-health` → Should return `ok: true`
2. ✅ Visit `/order.html` → Select service → Click "Proceed to PayPal Payment"
3. ✅ PayPal buttons should appear (no error)
4. ✅ Click PayPal → Opens sandbox login
5. ✅ Login with sandbox test account → Approve
6. ✅ Capture succeeds → Receipt shows orderID + captureID
7. ✅ Intake unlocks → Can submit project details

---

## Troubleshooting

### Issue: Still showing MISSING_ENV after redeploy
**Solution:** Clear browser cache, or open in incognito mode. The client may be caching the old API response.

### Issue: Authentication failed
**Symptoms:** "PayPal authentication failed" error in create-order
**Cause:** Client ID/Secret are incorrect or for wrong environment
**Solution:** Double-check credentials match the environment (sandbox vs live)

### Issue: Buttons don't appear, diagnostics shows SDK_LOAD_FAILED
**Cause:** PayPal SDK couldn't load from PayPal servers
**Solution:** Check internet connection, try different browser

### Issue: Create-order succeeds, but capture fails
**Symptoms:** PayPal popup opens, user approves, but capture returns error
**Cause:** Usually a PayPal account issue (insufficient funds in sandbox, account restrictions)
**Solution:** Use a different sandbox test account

---

## PayPal Sandbox Test Accounts

Login to PayPal Developer Dashboard:
https://developer.paypal.com/dashboard/accounts

Create test accounts:
- **Business Account** (merchant) - This is what ShortFormFactory uses
- **Personal Account** (buyer) - Use this to test payments

Test payment flow:
1. Load order page
2. Select service
3. Click PayPal
4. Login with **Personal** test account email/password
5. Approve payment
6. System captures with **Business** credentials

---

## Support

If issues persist after following this guide:
1. Screenshot the `/api/paypal-health` response
2. Screenshot the Vercel env vars settings page (hide secrets)
3. Copy the error from browser console (F12 → Console tab)
4. Copy the Vercel function logs

Contact: shortformfactory.help@gmail.com
