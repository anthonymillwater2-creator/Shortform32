# PayPal Sandbox Testing Setup Guide

## ✅ Current Status

Your PayPal integration is **READY FOR SANDBOX TESTING**. The code has been properly configured for sandbox mode.

## 🔧 Required Environment Variables in Vercel

You MUST set these environment variables in your Vercel project dashboard:

1. **PAYPAL_CLIENT_ID** (Sandbox)
   - Your PayPal sandbox client ID
   - Get this from: https://developer.paypal.com/dashboard/applications/sandbox

2. **PAYPAL_CLIENT_SECRET** (Sandbox)
   - Your PayPal sandbox client secret
   - Get this from the same location as client ID

3. **PAYPAL_ENV**
   - Set to: `sandbox`
   - This tells the API to use sandbox endpoints

4. **PAYPAL_CURRENCY** (Optional)
   - Set to: `USD`
   - Defaults to USD if not set

5. **PAYPAL_WEBHOOK_ID** (Optional - NOT needed for testing)
   - Only required for production webhook notifications
   - See WEBHOOK_SETUP.md for complete details
   - Skip this for sandbox testing

## 📋 How to Set Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project: **Shortform32**
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - Name: `PAYPAL_CLIENT_ID`
   - Value: Your sandbox client ID
   - Environment: Production, Preview, Development (select all)

5. Repeat for all 4 variables
6. **IMPORTANT**: After adding variables, you must redeploy your site for changes to take effect

## 🎯 Frontend Configuration (Already Done)

The frontend in `public/order.html` line 275 is already configured with your sandbox client ID:

```html
<script src="https://www.paypal.com/sdk/js?client-id=AatxDoez5Fdm48uLKgvEFbVxWCbjrq0N1mSQv_toBzfiFfJLdGblcwysOHxA5A1B1c1XXPtTOohdq3Up&currency=USD"></script>
```

**IMPORTANT**: This client ID must match the `PAYPAL_CLIENT_ID` environment variable in Vercel.

## 🧪 Testing the PayPal Button

### Step 1: Get PayPal Sandbox Test Accounts

1. Go to https://developer.paypal.com/dashboard/accounts/sandbox
2. You should see 2 test accounts:
   - **Business Account** (receives payments)
   - **Personal Account** (makes payments)
3. Click on the Personal Account → View/Edit Account
4. Note the email and password - you'll use these to log in during testing

### Step 2: Test the Payment Flow

1. Visit your deployed site: https://shortformfactory.com/order.html
2. Select a service (e.g., "AI Reel Edit")
3. Choose a package (Basic/Standard/Premium)
4. Optional: Add add-ons
5. Click the **PayPal button**
6. A PayPal popup will appear
7. **DO NOT USE YOUR REAL PAYPAL ACCOUNT**
8. Log in with your **sandbox Personal Account** credentials
9. Complete the payment
10. You should see "Payment Completed ✓"
11. The "Submit Project Details" button should unlock

### Step 3: Verify Payment in Sandbox

1. Go to https://developer.paypal.com/dashboard/accounts/sandbox
2. Click on your **Business Account**
3. Click "View/Edit Account"
4. Check the balance - it should reflect the test payment

## 🔍 How the Payment Flow Works

1. **User selects service** → Frontend calculates display price (client-side)
2. **User clicks PayPal button** → `createOrder()` calls `/api/create-order`
3. **Server validates & creates order** → Uses PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET
4. **PayPal popup opens** → User logs in with sandbox account
5. **User approves payment** → `onApprove()` calls `/api/capture-order`
6. **Server captures payment** → Verifies and completes transaction
7. **Success** → Frontend shows confirmation and unlocks project submission

## 🛡️ Security Features

- **Server-side price validation**: Client can't manipulate prices
- **Secure credential storage**: API keys stored in Vercel environment variables
- **Sandbox isolation**: Test payments don't affect real money
- **Order verification**: Each capture is verified against PayPal's API

## 🔧 What Each File Does

### Frontend Files:
- `public/order.html` - Order page with PayPal SDK loaded
- `public/paypal-config.js` - PayPal button configuration and event handlers
- `public/main.js` - UI logic, price calculation display, form handling

### API Files:
- `api/create-order.js` - Creates PayPal order (server-side price validation)
- `api/capture-order.js` - Captures payment after user approval

## ⚠️ Common Issues & Solutions

### Issue: "PayPal credentials not configured"
- **Solution**: Environment variables not set in Vercel. Follow step "How to Set Environment Variables in Vercel" above.

### Issue: "Payment capture failed"
- **Solution**: Client ID mismatch. The client ID in `order.html` must match `PAYPAL_CLIENT_ID` in Vercel.
- **Check**: Verify `PAYPAL_ENV=sandbox` is set in Vercel.

### Issue: PayPal button doesn't appear
- **Solution**: Check browser console for errors. Likely the PayPal SDK failed to load or client ID is invalid.

### Issue: Payment shows "COMPLETED" but capture fails
- **Solution**: Environment mismatch. Frontend using LIVE client ID but backend using SANDBOX credentials (or vice versa).

## 🚀 When Ready for Production

1. Get LIVE PayPal credentials from https://developer.paypal.com/dashboard/applications/live
2. Update Vercel environment variables:
   - `PAYPAL_CLIENT_ID` → Live client ID
   - `PAYPAL_CLIENT_SECRET` → Live client secret
   - `PAYPAL_ENV` → `live`
3. Update `public/order.html` line 275 with LIVE client ID
4. Deploy changes
5. Test with small real payment first

## 📧 Support Email

After successful payment, users send project details to: **shortformfactory.help@gmail.com**

---

**Last Updated**: January 2, 2026
**Status**: ✅ Ready for sandbox testing
**Current Environment**: Sandbox
