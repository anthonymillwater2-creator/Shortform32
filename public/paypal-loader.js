// PayPal SDK Dynamic Loader
// Fetches PayPal configuration from server and loads SDK with correct environment
(function() {
  'use strict';

  async function loadPayPalSDK() {
    try {
      // Fetch PayPal public configuration from server
      const response = await fetch('/api/paypal-config');

      if (!response.ok) {
        throw new Error('Failed to fetch PayPal configuration');
      }

      const config = await response.json();

      if (!config.clientID) {
        throw new Error('PayPal client ID not configured');
      }

      // Build PayPal SDK URL with fetched configuration
      const sdkURL = `https://www.paypal.com/sdk/js?client-id=${config.clientID}&currency=${config.currency || 'USD'}`;

      // Create and append PayPal SDK script tag
      const script = document.createElement('script');
      script.src = sdkURL;
      script.async = true;

      // Load paypal-checkout.js after SDK loads
      script.onload = function() {
        console.log('PayPal SDK loaded successfully (Environment: ' + config.env + ')');

        // Load the checkout integration script
        const checkoutScript = document.createElement('script');
        checkoutScript.src = '/paypal-checkout.js';
        checkoutScript.async = true;
        document.body.appendChild(checkoutScript);
      };

      script.onerror = function() {
        console.error('Failed to load PayPal SDK');
        showSDKError();
      };

      document.body.appendChild(script);

    } catch (error) {
      console.error('PayPal loader error:', error);
      showSDKError();
    }
  }

  function showSDKError() {
    const buttonContainer = document.getElementById('paypal-button-container');
    if (buttonContainer) {
      buttonContainer.innerHTML = `
        <div style="padding: 15px; background: #ff4d4f; color: white; border-radius: 8px; text-align: center;">
          ⚠️ Payment system unavailable. Please contact support.
        </div>
      `;
    }
  }

  // Load PayPal SDK when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPayPalSDK);
  } else {
    loadPayPalSDK();
  }

})();
