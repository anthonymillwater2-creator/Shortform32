// PayPal SDK Dynamic Loader - FIXED for iOS Safari
// Single SDK load with visible debugging
(function() {
  'use strict';

  // Debug helper - visible on page
  function dbg(msg) {
    const el = document.getElementById('pp-debug');
    if (el) {
      const timestamp = new Date().toLocaleTimeString();
      el.textContent = `[${timestamp}] ${msg}\n` + (el.textContent || '');
    }
    console.log('[PayPal]', msg);
  }

  // Global error capture
  window.addEventListener('error', (e) => {
    dbg(`JS ERROR: ${e.message} at ${e.filename}:${e.lineno}`);
  });

  window.addEventListener('unhandledrejection', (e) => {
    dbg(`PROMISE ERROR: ${String(e.reason)}`);
  });

  // Tap probe - detect overlay blocking
  document.addEventListener('click', (e) => {
    const target = e.target;
    dbg(`CLICK: ${target?.tagName || 'null'}.${target?.className || ''}`);
  }, true);

  async function loadPayPalSDK() {
    try {
      dbg('loadPayPalSDK() called');

      // Guard: SDK already loaded
      if (window.paypal && window.paypal.Buttons) {
        dbg('SDK already present - skipping load');
        return true;
      }

      // Guard: Script already injected
      if (document.querySelector('script[data-paypal-sdk="1"]')) {
        dbg('SDK script already in DOM - waiting for load');
        // Wait for SDK to be available
        let attempts = 0;
        while (!window.paypal && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        if (window.paypal) {
          dbg('SDK loaded from existing script');
          return true;
        } else {
          throw new Error('SDK script exists but did not load');
        }
      }

      dbg('Fetching PayPal config from /api/paypal-config');

      // Fetch PayPal public configuration from server
      const response = await fetch('/api/paypal-config');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'CONFIG_FETCH_FAILED');
      }

      const config = await response.json();
      dbg(`Config fetched: env=${config.env}, hasClientId=${!!config.clientId}`);

      // Check for MISSING_ENV error from server
      if (config.ok === false || config.code === 'MISSING_ENV') {
        showSDKError('MISSING_ENV', config.message, config.help, config.missing);
        return false;
      }

      if (!config.clientId) {
        throw new Error('PayPal client ID not configured');
      }

      // Build PayPal SDK URL with fetched configuration
      const sdkURL = `https://www.paypal.com/sdk/js?client-id=${config.clientId}&currency=${config.currency || 'USD'}&intent=capture&components=buttons&enable-funding=card`;

      dbg(`Injecting SDK script: ${sdkURL.substring(0, 80)}...`);

      // Create and append PayPal SDK script tag with guard marker
      const script = document.createElement('script');
      script.src = sdkURL;
      script.async = true;
      script.setAttribute('data-paypal-sdk', '1');

      return new Promise((resolve, reject) => {
        script.onload = function() {
          dbg('SDK script onload fired');
          if (window.paypal && window.paypal.Buttons) {
            dbg('✓ PayPal SDK loaded successfully');
            dbg(`SDK version: ${typeof window.paypal.version === 'string' ? window.paypal.version : 'unknown'}`);
            resolve(true);
          } else {
            dbg('✗ SDK loaded but window.paypal.Buttons not available');
            reject(new Error('SDK loaded but Buttons not available'));
          }
        };

        script.onerror = function() {
          dbg('✗ SDK script failed to load');
          showSDKError('SDK_LOAD_FAILED', 'PayPal SDK failed to load from PayPal servers', 'Check internet connection and try again');
          reject(new Error('SDK load failed'));
        };

        document.body.appendChild(script);
      });

    } catch (error) {
      dbg(`✗ loadPayPalSDK error: ${error.message}`);
      showSDKError('CONFIG_ERROR', error.message);
      return false;
    }
  }

  function showSDKError(errorCode, message, instructions, missingVars) {
    const buttonContainer = document.getElementById('paypal-button-container');
    const payButton = document.getElementById('payButton');

    dbg(`showSDKError: ${errorCode} - ${message}`);

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

  // Expose loader for paypal-checkout.js to use
  window.loadPayPalSDK = loadPayPalSDK;
  window.dbg = dbg;

  // Auto-load SDK on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPayPalSDK);
  } else {
    loadPayPalSDK();
  }

})();
