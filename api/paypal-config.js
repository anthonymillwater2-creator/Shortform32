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
    const PAYPAL_ENV = process.env.PAYPAL_ENV || 'live';
    const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';

    if (!PAYPAL_CLIENT_ID) {
      return res.status(500).json({ error: 'PayPal configuration missing' });
    }

    // Return public config only (never expose secret)
    return res.status(200).json({
      clientID: PAYPAL_CLIENT_ID,
      currency: PAYPAL_CURRENCY,
      env: PAYPAL_ENV
    });

  } catch (error) {
    console.error('PayPal config error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
