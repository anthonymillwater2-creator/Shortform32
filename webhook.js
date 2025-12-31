// PayPal Webhook Endpoint
// Vercel Serverless Function
// Verifies PayPal webhook signatures and processes events

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookEvent = req.body;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    // Get PayPal credentials
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
    const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !webhookId) {
      console.error('PayPal webhook configuration missing');
      return res.status(500).json({ error: 'Webhook configuration missing' });
    }

    // Get access token
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'Failed to authenticate' });
    }

    // Verify webhook signature
    const verifyResponse = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_time: req.headers['paypal-transmission-time'],
        cert_url: req.headers['paypal-cert-url'],
        auth_algo: req.headers['paypal-auth-algo'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.verification_status !== 'SUCCESS') {
      console.error('Webhook verification failed:', verifyData);
      return res.status(400).json({ error: 'Webhook verification failed' });
    }

    // Process the event
    const eventType = webhookEvent.event_type;

    switch (eventType) {
      case 'CHECKOUT.ORDER.COMPLETED':
      case 'PAYMENT.CAPTURE.COMPLETED':
        // Log successful payment
        console.log('Payment completed:', webhookEvent.resource.id);
        break;

      case 'PAYMENT.CAPTURE.DENIED':
      case 'CHECKOUT.ORDER.DECLINED':
        // Log failed payment
        console.log('Payment failed:', webhookEvent.resource.id);
        break;

      default:
        console.log('Unhandled webhook event:', eventType);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
