// PayPal Public Configuration API
// GET /api/paypal-config
// Returns: { clientID, currency, env }
// NEVER returns client secret

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
    const PAYPAL_ENV = process.env.PAYPAL_ENV || 'live';
    const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';

    // Runtime diagnostics (safe - no secrets)
    console.log('[paypal-config] Runtime check:', {
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV,
      hasClientId: !!PAYPAL_CLIENT_ID,
      hasClientSecret: !!PAYPAL_CLIENT_SECRET,
      clientIdLength: PAYPAL_CLIENT_ID ? PAYPAL_CLIENT_ID.length : 0,
      env: PAYPAL_ENV,
      currency: PAYPAL_CURRENCY
    });

    // Check for missing required environment variables
    const missing = [];
    if (!PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID');
    if (!PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');

    if (missing.length > 0) {
      console.error('[paypal-config] Missing env vars:', missing);
      return res.status(500).json({
        ok: false,
        code: 'MISSING_ENV',
        message: 'PayPal environment variables not configured in Vercel',
        missing: missing,
        help: 'Set these in Vercel env vars for Preview: ' + missing.join(', ') + '. After updating env vars, redeploy Preview for changes to apply.'
      });
    }

    // Return public config only (never expose secret)
    return res.status(200).json({
      ok: true,
      env: PAYPAL_ENV,
      clientId: PAYPAL_CLIENT_ID,
      currency: PAYPAL_CURRENCY
    });

  } catch (error) {
    console.error('PayPal config error:', error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
}
