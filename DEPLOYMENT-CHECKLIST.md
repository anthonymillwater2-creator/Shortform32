# ShortFormFactory - Deployment & QA Checklist

## ENVIRONMENT VARIABLES

### Required for SANDBOX Testing
```
PAYPAL_CLIENT_ID=<your-sandbox-client-id>
PAYPAL_CLIENT_SECRET=<your-sandbox-client-secret>
PAYPAL_ENV=sandbox
PAYPAL_CURRENCY=USD
```

### Required for LIVE Production
```
PAYPAL_CLIENT_ID=<your-live-client-id>
PAYPAL_CLIENT_SECRET=<your-live-client-secret>
PAYPAL_ENV=live
PAYPAL_CURRENCY=USD
```

**Where to set in Vercel:**
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable above
4. Important: Set environment to "Production, Preview, and Development" OR just "Production" for live values
5. After adding/changing variables, trigger a new deployment

---

## SANDBOX QA TESTING CHECKLIST

### Test A: Successful Payment Flow

**iPhone/Mobile Testing:**
1. ✅ Open https://[your-vercel-url]/qa-sandbox.html on iPhone
2. ✅ Select service: "AI Reel Edit"
3. ✅ Select package: "Standard"
4. ✅ Select add-on: "Rush Delivery"
5. ✅ Verify computed total shows: $85.00 (60 + 25)
6. ✅ Tap PayPal button
7. ✅ Login with PayPal sandbox buyer account
8. ✅ Complete payment with test account
9. ✅ Verify status updates show:
   - Order Created: [OrderID displayed]
   - Payment Approved: Yes
   - Payment Captured: Completed
   - Capture ID: [CaptureID displayed]
   - Amount: USD 85.00
   - Intake Unlocked: Yes
10. ✅ Check event log shows all steps
11. ✅ Screenshot the receipt for records

**Desktop Testing:**
12. ✅ Repeat steps 1-11 on desktop browser (Chrome/Firefox/Safari)
13. ✅ Test with PayPal guest checkout (credit card without PayPal account)
14. ✅ Verify receipt displays correctly with all IDs

### Test B: Payment Cancellation Flow

**iPhone/Mobile Testing:**
1. ✅ Open /qa-sandbox.html
2. ✅ Select service and package
3. ✅ Tap PayPal button
4. ✅ Cancel payment on PayPal screen
5. ✅ Verify error message displays
6. ✅ Verify status stays as "Pending"
7. ✅ Verify intake remains locked

**Desktop Testing:**
8. ✅ Repeat steps 1-7 on desktop

### Test C: Production Order Page

**iPhone Testing:**
1. ✅ Open https://[your-vercel-url]/order.html
2. ✅ Select service: "Social Media Edit"
3. ✅ Select package: "Premium"
4. ✅ Add 2-3 add-ons
5. ✅ Verify total calculates correctly
6. ✅ Complete PayPal payment
7. ✅ Verify receipt displays with orderID and captureID
8. ✅ Verify "Submit Project Details" button unlocks
9. ✅ Click submit button
10. ✅ Verify mailto opens with:
    - Service, package, add-ons
    - Total paid
    - PayPal Order ID
    - PayPal Capture ID
    - Project notes (if any)

**Desktop Testing:**
11. ✅ Repeat steps 1-10 on desktop
12. ✅ Test all 8 services with different packages
13. ✅ Test with various add-on combinations

### Test D: Brand Assets & SEO

1. ✅ Verify logo displays in header on all pages
2. ✅ Verify favicon shows in browser tab
3. ✅ Verify apple-touch-icon (save to iOS home screen test)
4. ✅ Share homepage link on social media, verify OG image displays
5. ✅ Check all pages have correct meta tags

### Test E: Revisions Policy Consistency

Verify revisions policy is consistent and correct on:
1. ✅ index.html (homepage feature cards)
2. ✅ order.html (order summary sidebar)
3. ✅ about.html (about page content)
4. ✅ services.html (services page footer)
5. ✅ terms.html (terms of service section 4)
6. ✅ refunds.html (refund policy)

Expected wording (full): "Revisions Policy: Basic includes 0 revisions. Standard includes 1 revision. Premium includes 2 revisions. Revisions must be requested within 7 days of delivery and must be within scope (no new footage, no new creative direction, no change of service type). Out-of-scope changes require a new order or add-on."

### Test F: Redirects & 404

1. ✅ Navigate to /donations → Should redirect to /
2. ✅ Navigate to /donations.html → Should redirect to /
3. ✅ Navigate to /nonexistent-page → Should show 404 page
4. ✅ Verify 404 page does NOT link to donations

---

## LIVE CUTOVER CHECKLIST

### Pre-Cutover (Complete these BEFORE changing to live)

1. ✅ All sandbox tests passing (Tests A-F above)
2. ✅ PayPal LIVE app created in PayPal Developer Dashboard
3. ✅ PayPal LIVE app approved by PayPal (check approval status)
4. ✅ LIVE client ID and secret obtained from PayPal dashboard
5. ✅ Guest checkout enabled in PayPal LIVE app settings:
   - Login to PayPal Developer Dashboard
   - Go to your LIVE app
   - Under "App Settings" → ensure "Accept payments from buyers without a PayPal account" is enabled
6. ✅ Backup current Vercel environment variables (screenshot)

### Cutover Steps

1. ✅ Go to Vercel → Settings → Environment Variables
2. ✅ Update PAYPAL_CLIENT_ID with LIVE client ID
3. ✅ Update PAYPAL_CLIENT_SECRET with LIVE client secret
4. ✅ Update PAYPAL_ENV=live (case sensitive!)
5. ✅ Keep PAYPAL_CURRENCY=USD
6. ✅ Trigger new Vercel deployment (Deploy → Redeploy)
7. ✅ Wait for deployment to complete (2-3 minutes)

### Post-Cutover Validation

**CRITICAL: Use real money for this test (minimum $1 test or use a real service)**

1. ✅ Open /order.html on production URL
2. ✅ Select lowest-price service (Auto Captions - Basic - $15)
3. ✅ Complete REAL payment with REAL PayPal account OR real credit card
4. ✅ Verify payment completes successfully
5. ✅ Verify receipt shows real orderID and captureID
6. ✅ Login to PayPal business account, verify payment received
7. ✅ Verify intake email opens with correct transaction IDs
8. ✅ If test successful: issue refund via PayPal dashboard (optional)
9. ✅ Test on mobile device with real payment
10. ✅ Test guest checkout (card payment without PayPal account)

### Final Checks

1. ✅ All branding assets loading correctly
2. ✅ All pages load without errors (check browser console)
3. ✅ Social media links working
4. ✅ All legal pages accessible (terms, privacy, refunds, liability)
5. ✅ Contact page functional
6. ✅ Services page displays all 8 services correctly
7. ✅ Mobile responsive on iPhone/Android
8. ✅ Desktop experience on Chrome/Firefox/Safari

### Monitoring (First 48 Hours)

1. ✅ Monitor first 3 real orders closely
2. ✅ Verify all PayPal notifications in business email
3. ✅ Verify all intake emails received correctly
4. ✅ Check Vercel logs for any API errors
5. ✅ Test payment failure handling (attempt payment with insufficient funds)
6. ✅ Verify refund process works if needed

---

## TROUBLESHOOTING

### PayPal Button Not Showing
- Check browser console for errors
- Verify PAYPAL_CLIENT_ID is set in Vercel
- Verify /api/paypal-config returns valid client ID
- Clear browser cache and reload

### Payment Fails at Capture
- Check PAYPAL_CLIENT_SECRET is correct
- Verify PAYPAL_ENV matches your app type (sandbox vs live)
- Check Vercel function logs for detailed error
- Verify PayPal app is not restricted/suspended

### Guest Checkout Not Available
- Login to PayPal Developer Dashboard
- Go to your app settings
- Enable "Accept payments without PayPal account"
- Wait 5-10 minutes for setting to propagate

### Receipt Not Showing After Payment
- Check browser console for JavaScript errors
- Verify /api/capture-order returns captureID in response
- Check sessionStorage is enabled in browser
- Try in incognito/private mode

---

## QA HARNESS ACCESS

**Hidden QA page:** https://[your-vercel-url]/qa-sandbox.html

**Purpose:** Internal testing only - not linked from public pages

**Features:**
- Sandbox-only testing interface
- Real-time status display
- Event logging
- Quick reset functionality
- Isolated from production order flow

**Usage:**
- Use for all pre-launch testing
- Use for regression testing after changes
- Share with team members for QA
- DO NOT share publicly

---

## ROLLBACK PROCEDURE

If live payments fail:

1. **Immediate:** Change PAYPAL_ENV=sandbox in Vercel
2. **Redeploy:** Trigger new deployment
3. **Verify:** Test with sandbox to ensure system operational
4. **Investigate:** Check Vercel logs and PayPal dashboard
5. **Fix:** Correct issue
6. **Re-test:** Run full sandbox checklist
7. **Re-cutover:** Follow live cutover steps again

**Emergency Contact:**
- Vercel Support: https://vercel.com/support
- PayPal Support: https://www.paypal.com/merchantsupport
- Repository: https://github.com/anthonymillwater2-creator/Shortform32

---

## FILES CHANGED IN THIS DEPLOYMENT

**Payment Infrastructure:**
- ✅ /api/paypal-config.js (NEW - public config endpoint)
- ✅ /api/capture-order.js (UPDATED - explicit captureID return)
- ✅ /public/paypal-loader.js (NEW - dynamic SDK loading)
- ✅ /public/paypal-checkout.js (UPDATED - receipt display, captureID tracking)
- ✅ /public/order.html (UPDATED - use dynamic loader)

**QA Infrastructure:**
- ✅ /public/qa-sandbox.html (NEW - complete QA harness)

**Policy & Content:**
- ✅ /public/index.html (UPDATED - revisions policy)
- ✅ /public/about.html (VERIFIED - already correct)
- ✅ /public/services.html (VERIFIED - already correct)
- ✅ /public/terms.html (VERIFIED - already correct)
- ✅ /public/refunds.html (VERIFIED - already correct)

**Configuration:**
- ✅ /vercel.json (UPDATED - redirects for /donations)

**Total Files Changed:** 12
**New Files Created:** 3
**Files Verified/Unchanged:** 4

---

## SUCCESS CRITERIA

### Sandbox Testing Complete When:
- ✅ All Test A-F sections pass
- ✅ Both iPhone and desktop tested
- ✅ Both PayPal account and guest checkout tested
- ✅ Payment success and cancellation tested
- ✅ Receipt displays correctly with all IDs
- ✅ Intake email includes orderID and captureID

### Ready for Live When:
- ✅ Sandbox testing 100% complete
- ✅ PayPal LIVE app approved
- ✅ Guest checkout enabled and verified
- ✅ Branding assets all loading
- ✅ All policies updated and consistent

### Live Deployment Successful When:
- ✅ At least 1 real payment completed successfully
- ✅ Real money received in PayPal business account
- ✅ Receipt displayed with real transaction IDs
- ✅ Intake email sent with correct data
- ✅ No errors in Vercel logs
- ✅ Mobile and desktop both functional

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Sandbox Test Results:** ⬜ Pass ⬜ Fail
**Live Test Results:** ⬜ Pass ⬜ Fail
**Production Approved:** ⬜ Yes ⬜ No
