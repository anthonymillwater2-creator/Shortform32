(function () {
  'use strict';

  var SDK_PROMISE_KEY = '__SFF_PAYPAL_SDK_PROMISE__';
  var SDK_LOADED_KEY = '__SFF_PAYPAL_SDK_LOADED__';

  function safeText(s) {
    return (s == null) ? '' : String(s);
  }

  function loadPayPalSDK() {
    if (window[SDK_LOADED_KEY] && window.paypal) {
      return Promise.resolve(true);
    }
    if (window[SDK_PROMISE_KEY]) {
      return window[SDK_PROMISE_KEY];
    }

    window[SDK_PROMISE_KEY] = fetch('/api/paypal-config', { method: 'GET', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('PayPal config unavailable');
        return res.json();
      })
      .then(function (cfg) {
        var clientID = safeText(cfg.clientID || cfg.clientId || '');
        var currency = safeText(cfg.currency || 'USD');
        var env = safeText(cfg.env || 'sandbox');

        if (!clientID) throw new Error('PayPal clientID missing');

        // Expose minimal runtime config (no secrets)
        window.SFF_PAYPAL = { env: env, currency: currency, clientID: clientID };

        var src =
          'https://www.paypal.com/sdk/js' +
          '?client-id=' + encodeURIComponent(clientID) +
          '&currency=' + encodeURIComponent(currency) +
          '&intent=capture' +
          '&components=buttons' +
          '&disable-funding=paylater';

        return new Promise(function (resolve, reject) {
          if (document.querySelector('script[data-sff-paypal-sdk="1"]')) {
            // Script tag exists; wait for global
            var tries = 0;
            (function waitForPayPal() {
              tries++;
              if (window.paypal && window.paypal.Buttons) {
                window[SDK_LOADED_KEY] = true;
                return resolve(true);
              }
              if (tries > 200) return reject(new Error('PayPal SDK load timeout'));
              setTimeout(waitForPayPal, 25);
            })();
            return;
          }

          var s = document.createElement('script');
          s.src = src;
          s.async = true;
          s.defer = true;
          s.setAttribute('data-sff-paypal-sdk', '1');
          s.onload = function () {
            window[SDK_LOADED_KEY] = true;
            resolve(true);
          };
          s.onerror = function () {
            reject(new Error('PayPal SDK failed to load'));
          };
          document.head.appendChild(s);
        });
      })
      .catch(function () {
        return false;
      });

    return window[SDK_PROMISE_KEY];
  }

  window.loadPayPalSDK = loadPayPalSDK;
})();