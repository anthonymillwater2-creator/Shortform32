# PayPal Sandbox - Quick Test Checklist

## ⚡ BEFORE YOU TEST - Critical Setup Required

### Step 1: Set Environment Variables in Vercel (5 minutes)

Go to: https://vercel.com/dashboard → Select "Shortform32" → Settings → Environment Variables

Add these 3 variables (click "Add" for each):

| Variable Name | Value | Notes |
|---------------|-------|-------|
| `PAYPAL_CLIENT_ID` | `AatxDoez5Fdm48uLKgvEFbVxWCbjrq0N1mSQv_toBzfiFfJLdGblcwysOHxA5A1B1c1XXPtTOohdq3Up` | Your sandbox client ID (currently in order.html) |
| `PAYPAL_CLIENT_SECRET` | `YOUR_SANDBOX_SECRET_HERE` | Get from PayPal Developer Dashboard |
| `PAYPAL_ENV` | `sandbox` | MUST be "sandbox" for testing |

**To get your Client Secret:**
1. Go to https://developer.paypal.com/dashboard/applications/sandbox
2. Click on your app (or create one if you don't have one)
3. Copy the "Secret" value
4. Paste it into the `PAYPAL_CLIENT_SECRET` field in Vercel

### Step 2: Redeploy Your Site

After adding environment variables:
1. Go to Vercel → Deployments
2. Click the "..." menu on your latest deployment
3. Click "Redeploy"
4. Wait for deployment to complete (~30 seconds)

**⚠️ CRITICAL**: Environment variables only take effect after redeployment!

---

## 🧪 Testing Steps (2 minutes)

### Prerequisites:
- ✅ You have a PayPal sandbox **Personal** account (for paying)
- ✅ You have the email and password for that test account
- ✅ Environment variables are set in Vercel
- ✅ Site has been redeployed

### Test the Payment Flow:

1. **Open your site**: https://shortformfactory.com/order.html

2. **Select a service**: Choose "AI Reel Edit" (or any service)

3. **Choose package**: Click "Basic" ($25)

4. **Check the total**: Should show "$25.00"

5. **Click the PayPal button**: Gold PayPal button should appear below "Proceed to PayPal Payment"

6. **PayPal popup opens**:
   - ⚠️ **DO NOT use your real PayPal account!**
   - Click "Log In" if needed
   - Use your **sandbox Personal account** email and password

7. **Complete payment**: Click "Pay Now" or "Complete Purchase"

8. **Success indicators**:
   - ✅ Popup closes
   - ✅ Page shows "Payment Completed ✓"
   - ✅ "Submit Project Details" button is now UNLOCKED (blue, clickable)
   - ✅ Message says "Payment confirmed! Ready to submit project details"

9. **Click "Submit Project Details"**:
   - Your email client should open
   - Email should be pre-filled to: shortformfactory.help@gmail.com
   - Subject: "New Order Intake – AI Reel Edit"
   - Body should include PayPal Order ID

---

## ❌ If Something Goes Wrong

### Error: "PayPal credentials not configured"
- **Problem**: Environment variables not set in Vercel
- **Fix**: Complete Step 1 above, then redeploy

### Error: Payment button doesn't appear
- **Problem**: Client ID might be invalid
- **Fix**: Check browser console (F12) for errors
- **Verify**: The client ID in Vercel matches the one in order.html

### Error: "Payment capture failed"
- **Problem**: Environment mismatch (frontend vs backend)
- **Fix**: Make sure `PAYPAL_ENV=sandbox` is set in Vercel
- **Fix**: Make sure client IDs match

### Payment completes but capture fails
- **Problem**: Using wrong credentials (mixing sandbox/live)
- **Fix**: Verify ALL credentials are from sandbox

---

## 🔍 How to Verify Payment Worked in PayPal Sandbox

1. Go to https://www.sandbox.paypal.com
2. Log in with your **Business** account (the one receiving payments)
3. Check "Activity" - you should see the $25 payment

---

## 📞 Need Help?

If you get stuck, check the browser console (press F12) for error messages.

Common console errors and what they mean:
- `PayPal SDK not loaded` → Check your internet connection
- `Failed to create order` → Environment variables not set
- `Authentication failed` → Wrong client secret
- `Capture failed` → Environment mismatch (sandbox vs live)

---

**Current Configuration Status:**
- ✅ Code is properly configured
- ✅ Frontend has sandbox client ID
- ✅ API functions are ready
- ⏳ **PENDING**: Environment variables in Vercel
- ⏳ **PENDING**: Redeploy after setting variables

**Once you complete Step 1 & 2, you're ready to test!**
