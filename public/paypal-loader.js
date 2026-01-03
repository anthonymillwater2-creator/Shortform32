// PayPal SDK Dynamic Loader
// Fetches PayPal configuration from server and loads SDK with correct environment
(function() {
  'use strict';

  async function loadPayPalSDK() {
    try {
      // Fetch PayPal public configuration from server
      const response = await fetch('/api/paypal-config');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'CONFIG_FETCH_FAILED');
      }

      const config = await response.json();

      // Check for MISSING_ENV error from server
      if (config.error === 'MISSING_ENV') {
        showSDKError('MISSING_ENV', config.message, config.instructions, config.missing);
        return;
      }

      if (!config.clientID) {
        throw new Error('PayPal client ID not configured');
      }

      // Build PayPal SDK URL with fetched configuration
      // Enable all funding sources: card (guest checkout), Apple Pay, Google Pay
      const sdkURL = `https://www.paypal.com/sdk/js?client-id=${config.clientID}&currency=${config.currency || 'USD'}&intent=capture&components=buttons`;

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
        showSDKError('SDK_LOAD_FAILED', 'PayPal SDK failed to load from PayPal servers', 'Check internet connection and try again');
      };

      document.body.appendChild(script);

    } catch (error) {
      console.error('PayPal loader error:', error);
      showSDKError('CONFIG_ERROR', error.message);
    }
  }

  function showSDKError(errorCode, message, instructions, missingVars) {
    const buttonContainer = document.getElementById('paypal-button-container');
    const payButton = document.getElementById('payButton');

    if (!buttonContainer) return;

    let errorHTML = `
      <div style="padding: 16px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; color: #856404; text-align: left; font-size: 13px; line-height: 1.6;">
        <div style="font-weight: 700; margin-bottom: 8px; font-size: 14px;">⚠️ Payment System Unavailable</div>
        <div style="margin-bottom: 6px;"><strong>Error:</strong> ${errorCode || 'UNKNOWN'}</div>
    `;

    if (message) {
      errorHTML += `<div style="margin-bottom: 6px;">${message}</div>`;
    }

    if (missingVars && missingVars.length > 0) {
      errorHTML += `<div style="margin-bottom: 6px;"><strong>Missing:</strong> ${missingVars.join(', ')}</div>`;
    }

    if (instructions) {
      errorHTML += `<div style="margin-top: 10px; padding: 10px; background: white; border-radius: 4px; font-size: 12px;">${instructions}</div>`;
    }

    errorHTML += `
        <div style="margin-top: 12px; font-size: 12px; opacity: 0.8;">Contact shortformfactory.help@gmail.com if this persists.</div>
      </div>
    `;

    buttonContainer.innerHTML = errorHTML;

    // Disable the pay button if it exists
    if (payButton) {
      payButton.disabled = true;
      payButton.style.opacity = '0.5';
    }
  }

  // Load PayPal SDK when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPayPalSDK);
  } else {
    loadPayPalSDK();
  }

})();
