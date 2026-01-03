// PayPal Health Check API - Vercel Serverless Function
// GET /api/paypal-health
// Returns: { ok: boolean, missing: string[], env: string, currency: string, runtime: object }
// NEVER returns secrets

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read environment variables
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
    const PAYPAL_ENV = process.env.PAYPAL_ENV || 'live';
    const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';

    // Runtime information (safe to expose)
    const runtime = {
      VERCEL_ENV: process.env.VERCEL_ENV || 'unknown',
      NODE_ENV: process.env.NODE_ENV || 'unknown',
      hasClientId: !!PAYPAL_CLIENT_ID,
      hasClientSecret: !!PAYPAL_CLIENT_SECRET,
      clientIdLength: PAYPAL_CLIENT_ID ? PAYPAL_CLIENT_ID.length : 0,
      clientSecretLength: PAYPAL_CLIENT_SECRET ? PAYPAL_CLIENT_SECRET.length : 0,
      env: PAYPAL_ENV,
      currency: PAYPAL_CURRENCY
    };

    // Check for missing required environment variables
    const missing = [];
    if (!PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID');
    if (!PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');

    const ok = missing.length === 0;

    // Determine API base (for display only, not actual call)
    const apiBase = PAYPAL_ENV === 'sandbox'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    return res.status(ok ? 200 : 500).json({
      ok,
      missing,
      env: PAYPAL_ENV,
      currency: PAYPAL_CURRENCY,
      apiBase,
      runtime,
      message: ok
        ? 'PayPal configuration is complete'
        : `Missing required environment variables: ${missing.join(', ')}. Set these in Vercel → Project Settings → Environment Variables for the current environment (${runtime.VERCEL_ENV}).`
    });

  } catch (error) {
    console.error('PayPal health check error:', error);
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
}
