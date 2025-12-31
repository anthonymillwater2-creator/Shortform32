// PayPal Create Order API - Vercel Serverless Function
// POST /api/create-order
// Body: { service, package, addons: [] }
// Returns: { orderID }

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { service, package: packageType, addons } = req.body;

    // Environment variables
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
    const PAYPAL_ENV = process.env.PAYPAL_ENV || 'live';
    const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return res.status(500).json({ error: 'PayPal credentials not configured' });
    }

    // Select PayPal API base URL
    const PAYPAL_API_BASE = PAYPAL_ENV === 'sandbox'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    // Service pricing table
    const SERVICE_PRICES = {
      aiReel: { basic: 25, standard: 60, premium: 140 },
      socialEdit: { basic: 30, standard: 70, premium: 160 },
      viralCaptions: { basic: 20, standard: 50, premium: 110 },
      podcastRepurpose: { basic: 40, standard: 95, premium: 220 },
      autoCaptions: { basic: 15, standard: 35, premium: 75 },
      smartCut: { basic: 20, standard: 50, premium: 120 },
      backgroundRemoval: { basic: 25, standard: 60, premium: 150 },
      audioSync: { basic: 15, standard: 40, premium: 95 }
    };

    // Addon pricing table (using values from order.html)
    const ADDON_PRICES = {
      rush: 25,
      extraClip: 15,
      extraMinute: 10,
      premiumCaptions: 15,
      colorGrade: 20,
      advancedEffects: 25,
      thumbnails: 20,
      musicLicense: 10,
      sourceFiles: 15
    };

    // Validate service
    if (!service || !SERVICE_PRICES[service]) {
      return res.status(400).json({ error: 'Invalid service selected' });
    }

    // Validate package
    if (!packageType || !['basic', 'standard', 'premium'].includes(packageType)) {
      return res.status(400).json({ error: 'Invalid package selected' });
    }

    // Calculate service price (SERVER-SIDE - never trust client amount)
    let total = SERVICE_PRICES[service][packageType];

    // Validate and calculate addon prices
    if (addons && Array.isArray(addons)) {
      for (const addon of addons) {
        if (!ADDON_PRICES[addon]) {
          return res.status(400).json({ error: `Invalid addon: ${addon}` });
        }
        total += ADDON_PRICES[addon];
      }
    }

    // Ensure total is valid
    if (total <= 0) {
      return res.status(400).json({ error: 'Invalid order total' });
    }

    // Format total to 2 decimals
    const amount = total.toFixed(2);

    // Get PayPal access token
    const authResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('PayPal auth error:', errorText);
      return res.status(500).json({ error: 'PayPal authentication failed' });
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Create PayPal order
    const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: PAYPAL_CURRENCY,
            value: amount
          },
          description: `ShortFormFactory - ${service} (${packageType})`
        }],
        application_context: {
          brand_name: 'ShortFormFactory',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.SITE_ORIGIN || req.headers.origin || 'https://shortformfactory.com'}/order.html?success=true`,
          cancel_url: `${process.env.SITE_ORIGIN || req.headers.origin || 'https://shortformfactory.com'}/order.html?cancel=true`
        }
      })
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error('PayPal order creation error:', errorText);
      return res.status(500).json({ error: 'Failed to create PayPal order' });
    }

    const orderData = await orderResponse.json();

    // Return order ID
    return res.status(200).json({
      orderID: orderData.id
    });

  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
