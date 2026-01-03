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

    // Check for missing required environment variables
    const missing = [];
    if (!PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID');
    if (!PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');

    if (missing.length > 0) {
      return res.status(500).json({
        error: 'MISSING_ENV',
        message: 'PayPal environment variables not configured in Vercel',
        missing: missing,
        instructions: 'Go to Vercel → Project Settings → Environment Variables and add: ' + missing.join(', ')
      });
    }

    // Return public config only (never expose secret)
    return res.status(200).json({
      clientID: PAYPAL_CLIENT_ID,
      currency: PAYPAL_CURRENCY,
      env: PAYPAL_ENV
    });

  } catch (error) {
    console.error('PayPal config error:', error);
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
}
