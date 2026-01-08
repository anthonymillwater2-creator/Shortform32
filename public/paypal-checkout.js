// PayPal Checkout - Tally.so External Form Integration
(function() {
  'use strict';

  // ====== CONSTANTS ======
  const TALLY_FORM_URL = "https://tally.so/r/YOUR_FORM_ID"; // UPDATE THIS AFTER CREATING TALLY FORM
  let CAPTURE_IN_FLIGHT = false;

  const dbg = window.dbg || function(m){ console.log('[PAYPAL]', m); };

  // ====== DOM REFERENCES ======
  let payError;

  // ====== HELPER: Extract capture fields from PayPal API response ======
  function extractCaptureFields(cap) {
    try {
      const purchase = cap.purchase_units?.[0] || {};
      const capture = purchase.payments?.captures?.[0] || {};

      return {
        captureID: capture.id || "",
        amount: capture.amount?.value || "",
        currency: capture.amount?.currency_code || "",
        payerEmail: cap.payer?.email_address || ""
      };
    } catch(e) {
      dbg("extractCaptureFields error: " + e.message);
      return { captureID: "", amount: "", currency: "", payerEmail: "" };
    }
  }

  // ====== REDIRECT TO TALLY WITH PAYMENT DATA ======
  function redirectToTallyIntake(orderID, captureID, amount, currency, payerEmail) {
    // Get order details from window.ORDER_STATE
    const service = window.ORDER_STATE?.service || '';
    const pack = window.ORDER_STATE?.pack || '';
    const addons = window.ORDER_STATE?.addons || [];

    // Store in sessionStorage for backup
    try {
      sessionStorage.setItem('sff_payment_confirmed', '1');
      sessionStorage.setItem('sff_order_id', orderID);
      sessionStorage.setItem('sff_capture_id', captureID);
      sessionStorage.setItem('sff_total', amount);
      sessionStorage.setItem('sff_service', service);
      sessionStorage.setItem('sff_package', pack);
      sessionStorage.setItem('sff_addons', JSON.stringify(addons));
    } catch(e) {
      dbg("sessionStorage write failed: " + e.message);
    }

    // Build Tally URL with query params for hidden fields
    const params = new URLSearchParams({
      service: service,
      package: pack,
      addons: addons.join(', '),
      total: `${currency} ${amount}`,
      paypal_order_id: orderID,
      paypal_capture_id: captureID,
      customer_email: payerEmail || ''
    });

    const tallyURL = `${TALLY_FORM_URL}?${params.toString()}`;

    dbg(`Redirecting to Tally: ${tallyURL}`);

    // Redirect to external Tally form
    window.location.href = tallyURL;
  }

  // ====== CAPTURE ORDER (SERVER CALL) ======
  async function captureOrder(orderID) {
    if (CAPTURE_IN_FLIGHT) {
      throw new Error("Capture already in progress");
    }

    CAPTURE_IN_FLIGHT = true;
    dbg("captureOrder start: " + orderID);

    try {
      const response = await fetch("/api/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderID })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Capture failed: ${response.status}`);
      }

      dbg("✓ Capture successful");
      return data;

    } finally {
      CAPTURE_IN_FLIGHT = false;
    }
  }

  // ====== GET ORDER DATA ======
  function getOrderData() {
    const serviceSelect = document.getElementById('serviceSelect');
    const selectedPackageRadio = document.querySelector('input[name="sff-package"]:checked');
    const addonCheckboxes = document.querySelectorAll('.addon-checkbox input[type="checkbox"]:checked');

    if (!serviceSelect || !selectedPackageRadio) {
      return null;
    }

    const service = serviceSelect.value;
    const packageType = selectedPackageRadio.value;
    const addons = Array.from(addonCheckboxes).map(cb => cb.value);

    // Store in global for receipt generation
    window.ORDER_STATE = {
      service,
      pack: packageType,
      addons
    };

    return { service, package: packageType, addons };
  }

  // ====== RENDER PAYPAL BUTTONS ======
  async function renderPayPalButtons() {
    dbg("renderPayPalButtons start");

    const container = document.getElementById("paypal-button-container");
    const payBtn = document.getElementById("payButton");

    if (!container) {
      throw new Error("PayPal container not found");
    }

    // Load SDK
    dbg("Calling loadPayPalSDK()");

    if (!window.loadPayPalSDK) {
      throw new Error("window.loadPayPalSDK not found - paypal-loader.js missing?");
    }

    const sdkLoaded = await window.loadPayPalSDK();

    if (!sdkLoaded) {
      throw new Error("SDK load returned false");
    }

    // Verify SDK ready
    if (!window.paypal || !window.paypal.Buttons) {
      throw new Error("window.paypal.Buttons not available");
    }

    dbg("✓ SDK ready - window.paypal.Buttons exists");

    // Clear container
    container.innerHTML = "";
    dbg("Rendering PayPal Buttons...");

    // Render
    await window.paypal.Buttons({
      createOrder: async function() {
        dbg("createOrder start");
        const orderData = getOrderData();

        if (!orderData || !orderData.service || !orderData.package) {
          throw new Error("Missing service or package");
        }

        const response = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData)
        });

        const responseData = await response.json();
        dbg(`create-order response: ok=${response.ok}, orderID=${responseData.orderID || 'NONE'}`);

        if (!response.ok || !responseData.orderID) {
          throw new Error(responseData.error || "Failed to create order");
        }

        dbg(`✓ Order created: ${responseData.orderID}`);
        return responseData.orderID;
      },

      onApprove: async function(data) {
        dbg(`onApprove - orderID=${data.orderID}`);

        try {
          const cap = await captureOrder(data.orderID);
          const fields = extractCaptureFields(cap);

          dbg(`✓ Capture successful: ${fields.captureID}, Amount: ${fields.currency} ${fields.amount}`);

          // Redirect to Tally form with payment data
          redirectToTallyIntake(
            data.orderID,
            fields.captureID,
            fields.amount,
            fields.currency,
            fields.payerEmail
          );

        } catch(error) {
          dbg("onApprove capture error: " + error.message);

          if (payError) {
            payError.textContent = "Payment verification failed. Please contact support.";
            payError.style.display = "block";
          }
        }
      },

      onCancel: function(data) {
        dbg(`onCancel - orderID=${data.orderID || 'none'}`);

        if (payError) {
          payError.textContent = "Payment was cancelled. Please try again.";
          payError.style.display = "block";
        }

        if (payBtn) {
          payBtn.disabled = false;
        }
      },

      onError: function(err) {
        dbg(`onError: ${String(err)}`);

        if (payError) {
          payError.textContent = "An error occurred during payment. Please try again.";
          payError.style.display = "block";
        }

        if (payBtn) {
          payBtn.disabled = false;
        }
      },

      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "paypal"
      }
    }).render("#paypal-button-container");

    dbg("✓ Buttons rendered successfully");

    // Hide proceed button, show PayPal buttons
    if (payBtn) {
      payBtn.style.display = "none";
    }

    container.style.display = "block";

    // Scroll to PayPal
    container.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Expose globally for main.js to call
  window.renderPayPalButtons = renderPayPalButtons;

  // ====== INITIALIZATION ======
  document.addEventListener('DOMContentLoaded', () => {
    dbg("paypal-checkout.js DOMContentLoaded (Tally integration)");

    // Get DOM references
    payError = document.getElementById("pay-error");

    // Wire global error handlers
    window.addEventListener("error", (e) => {
      if (payError) {
        payError.textContent = "JS ERROR: " + e.message;
        payError.style.display = "block";
      }
    });

    window.addEventListener("unhandledrejection", (e) => {
      if (payError) {
        payError.textContent = "PROMISE ERROR: " + String(e.reason);
        payError.style.display = "block";
      }
    });

    dbg("✓ Initialization complete - ready for payment");
  });

})();
