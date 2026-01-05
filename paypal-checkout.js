// PayPal Checkout + Intake Lock/Unlock (one-pass final patch)
(function () {
  'use strict';

  // dbg is provided by main.js (writes to #pp-debug). Fall back to console.
  const dbg = window.dbg || function (m) { console.log('[PAYPAL]', m); };

  // ========================
  // B) CLIENT STATE + GUARDS
  // ========================
  const RECEIPT_KEY = "sff_paid_receipt_v1";
  let UNLOCKED = false;
  let CAPTURE_IN_FLIGHT = false;

  // ========================
  // DOM HELPERS
  // ========================
  const $ = (id) => document.getElementById(id);

  function safeText(el, text) {
    if (!el) return;
    el.textContent = String(text || '');
  }

  // ========================
  // C) REQUIRED FUNCTIONS
  // ========================
  function lockIntake(reason) {
    const intakeSection = $('intake-section');
    const intakeForm = $('intake-form');
    const payError = $('pay-error');
    const paymentSection = $('payment-section');

    if (paymentSection) {
      paymentSection.style.display = '';
    }

    if (intakeSection) {
      intakeSection.classList.add('locked');
      intakeSection.setAttribute('aria-disabled', 'true');
      intakeSection.hidden = true;
    }

    if (intakeForm) {
      const controls = intakeForm.querySelectorAll('input,select,textarea,button');
      controls.forEach((c) => { c.disabled = true; });
      const submitBtn = $('submitIntakeButton');
      if (submitBtn) submitBtn.disabled = true;
    }

    if (reason) {
      safeText(payError, reason);
    } else {
      safeText(payError, '');
    }
  }

  function unlockIntakeAndOpen(receipt) {
    if (UNLOCKED) return;
    UNLOCKED = true;

    const paymentSection = $('payment-section');
    const receiptSection = $('receipt-section');
    const intakeSection = $('intake-section');
    const intakeForm = $('intake-form');
    const payError = $('pay-error');

    try {
      localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
    } catch (_) {}

    // Render receipt
    if (receiptSection) {
      const amountLine = (receipt.amount && receipt.currency)
        ? `${receipt.currency} ${receipt.amount}`
        : '';

      receiptSection.innerHTML = `
        <div style="margin-top:12px;padding:14px;border:1px solid rgba(255,255,255,0.12);border-radius:12px;background:rgba(0,0,0,0.45);">
          <div style="font-weight:900;color:#00C851;margin-bottom:8px;">Payment Confirmed</div>
          <div style="font-size:12px;line-height:1.6;color:#c7cbd1;">
            ${amountLine ? `<div><strong>Amount:</strong> ${amountLine}</div>` : ''}
            <div style="margin-top:4px;"><strong>Order ID:</strong><br/><code style="font-size:11px;background:#0e0e0e;padding:2px 4px;border-radius:4px;">${receipt.orderID || ''}</code></div>
            <div style="margin-top:4px;"><strong>Capture ID:</strong><br/><code style="font-size:11px;background:#0e0e0e;padding:2px 4px;border-radius:4px;">${receipt.captureID || ''}</code></div>
            ${receipt.payerEmail ? `<div style="margin-top:4px;"><strong>Payer Email:</strong> ${receipt.payerEmail}</div>` : ''}
          </div>
        </div>
      `;
    }

    // Hide payment section so they can't miss the step
    if (paymentSection) {
      paymentSection.style.display = 'none';
    }

    // Clear any visible pay errors
    safeText(payError, '');

    // Unhide + unlock intake
    if (intakeSection) {
      intakeSection.hidden = false;
      intakeSection.classList.remove('locked');
      intakeSection.removeAttribute('aria-disabled');
    }

    if (intakeForm) {
      const controls = intakeForm.querySelectorAll('input,select,textarea,button');
      controls.forEach((c) => { c.disabled = false; });
      const submitBtn = $('submitIntakeButton');
      if (submitBtn) submitBtn.disabled = false;
    }

    // Update notice
    const intakeNotice = $('intakeNotice');
    if (intakeNotice) {
      intakeNotice.innerHTML = '<span class="check-icon">✓</span> Payment confirmed! Submit your project details below.';
      intakeNotice.classList.add('success');
      intakeNotice.style.display = 'block';
      intakeNotice.style.color = '#00C851';
    }

    // AUTO-SCROLL + AUTO-FOCUS AFTER LAYOUT
    if (intakeSection && intakeForm) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
          intakeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {}
        const first = $('intake-first') || intakeForm.querySelector('[required]') || intakeForm.querySelector('input,select,textarea');
        if (first && first.focus) {
          try { first.focus({ preventScroll: true }); } catch (_) { try { first.focus(); } catch (_) {} }
        }
      }));
    }
  }

  function restorePaidStateOnLoad() {
    try {
      const raw = localStorage.getItem(RECEIPT_KEY);
      if (!raw) return;
      const receipt = JSON.parse(raw);
      if (receipt && receipt.paid === true && receipt.captureID && receipt.orderID) {
        dbg('restorePaidStateOnLoad: found receipt, unlocking');
        unlockIntakeAndOpen(receipt);
      }
    } catch (_) {}
  }

  function extractCaptureFields(capJson) {
    const cap = capJson || {};
    const captureID = cap.purchase_units?.[0]?.payments?.captures?.[0]?.id || "";
    const amount = cap.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || "";
    const currency = cap.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code || "";
    const payerEmail = cap.payer?.email_address || "";
    return { captureID, amount, currency, payerEmail };
  }

  // ========================
  // E) CAPTURE ENDPOINT CALL
  // ========================
  async function captureOrder(orderID) {
    if (CAPTURE_IN_FLIGHT) {
      throw new Error('Capture already in progress');
    }
    CAPTURE_IN_FLIGHT = true;
    try {
      const res = await fetch('/api/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID })
      });

      let json = null;
      try { json = await res.json(); } catch (_) {}

      if (!res.ok) {
        const msg = (json && (json.error || json.message)) ? (json.error || json.message) : 'Capture failed';
        throw new Error(msg);
      }
      return json;
    } finally {
      CAPTURE_IN_FLIGHT = false;
    }
  }

  // ========================
  // D) REDIRECT RETURN HANDLER
  // ========================
  async function handlePayPalReturn() {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (!token) return;

    // If already paid, don't re-capture
    try {
      const raw = localStorage.getItem(RECEIPT_KEY);
      if (raw) {
        const receipt = JSON.parse(raw);
        if (receipt && receipt.paid === true && receipt.captureID && receipt.orderID) {
          dbg('handlePayPalReturn: receipt already stored, skipping capture');
          history.replaceState({}, '', location.pathname);
          return;
        }
      }
    } catch (_) {}

    dbg('handlePayPalReturn: token found, capturing...');
    try {
      const cap = await captureOrder(token);
      const fields = extractCaptureFields(cap);
      const receipt = {
        paid: true,
        ts: new Date().toISOString(),
        orderID: token,
        captureID: fields.captureID,
        payerEmail: fields.payerEmail,
        amount: fields.amount,
        currency: fields.currency,
        service: window.ORDER_STATE?.service || "",
        package: window.ORDER_STATE?.pack || "",
        addons: window.ORDER_STATE?.addons || []
      };
      unlockIntakeAndOpen(receipt);
      // CLEAN URL
      history.replaceState({}, '', location.pathname);
    } catch (err) {
      lockIntake('Capture failed: ' + (err?.message || 'Unknown error'));
    }
  }

  // ========================
  // F) PAYPAL BUTTONS CONFIG
  // ========================
  async function renderPayPalButtons() {
    dbg('renderPayPalButtons start');

    const container = $('paypal-button-container');
    if (!container) throw new Error('PayPal container not found');

    if (!window.loadPayPalSDK) {
      throw new Error('window.loadPayPalSDK not found - paypal-loader.js missing?');
    }

    const sdkLoaded = await window.loadPayPalSDK();
    if (!sdkLoaded) throw new Error('SDK load returned false');

    if (!window.paypal || !window.paypal.Buttons) {
      throw new Error('window.paypal.Buttons not available');
    }

    // Clear container and render
    container.innerHTML = '';

    await window.paypal.Buttons({
      createOrder: async function () {
        dbg('createOrder start');

        // Collect order data from current selection
        const serviceSelect = $('serviceSelect');
        const selectedPackageRadio = document.querySelector('input[name="sff-package"]:checked');
        const addonCheckboxes = document.querySelectorAll('.addon-checkbox input[type="checkbox"]:checked');

        if (!serviceSelect || !selectedPackageRadio) {
          throw new Error('Missing service or package');
        }

        const orderData = {
          service: serviceSelect.value,
          package: selectedPackageRadio.value,
          addons: Array.from(addonCheckboxes).map(cb => cb.value)
        };

        // Keep ORDER_STATE updated for receipts
        window.ORDER_STATE = {
          service: orderData.service,
          pack: orderData.package,
          addons: orderData.addons
        };

        const response = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });

        const responseData = await response.json();
        if (!response.ok || !responseData.orderID) {
          throw new Error(responseData.error || 'Failed to create order');
        }

        dbg('✓ Order created: ' + responseData.orderID);
        return responseData.orderID;
      },

      onApprove: async function (data) {
        const orderID = data.orderID;
        dbg('onApprove - orderID=' + orderID);
        try {
          const cap = await captureOrder(orderID);
          const fields = extractCaptureFields(cap);
          const receipt = {
            paid: true,
            ts: new Date().toISOString(),
            orderID,
            captureID: fields.captureID,
            payerEmail: fields.payerEmail,
            amount: fields.amount,
            currency: fields.currency,
            service: window.ORDER_STATE?.service || "",
            package: window.ORDER_STATE?.pack || "",
            addons: window.ORDER_STATE?.addons || []
          };
          unlockIntakeAndOpen(receipt);
        } catch (err) {
          lockIntake('Capture failed: ' + (err?.message || 'Unknown error'));
        }
      },

      onCancel: function () {
        lockIntake('Payment was cancelled.');
      },

      onError: function (err) {
        lockIntake('Payment error: ' + (String(err?.message || err) || 'Unknown error'));
      },

      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal'
      }
    }).render('#paypal-button-container');

    dbg('✓ Buttons rendered successfully');

    // Proceed button should only reveal PayPal section; keep it visible logic in main.js.
    try {
      container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
  }

  // Expose globally for main.js to call
  window.renderPayPalButtons = renderPayPalButtons;

  // ========================
  // INTAKE SUBMIT (MAILTO)
  // ========================
  function wireIntakeSubmit() {
    const form = $('intake-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Must be paid/unlocked
      let receipt = null;
      try { receipt = JSON.parse(localStorage.getItem(RECEIPT_KEY) || 'null'); } catch (_) {}
      if (!receipt || receipt.paid !== true) {
        lockIntake('Please complete payment first.');
        return;
      }

      const footageLink = ($('intake-first')?.value || '').trim();
      if (!footageLink) {
        try { $('intake-first')?.focus(); } catch (_) {}
        return;
      }

      const extraNotes = ($('intakeNotes')?.value || '').trim();
      const projectNotes = ($('projectNotes')?.value || '').trim();
      const totalAmount = $('totalAmount')?.textContent || '';
      const serviceName = $('summaryService')?.textContent || receipt.service || '';
      const packageName = $('summaryPackage')?.textContent || receipt.package || '';
      const addonsText = $('summaryAddons')?.textContent || (Array.isArray(receipt.addons) ? receipt.addons.join(', ') : '');

      const emailBody = `
New Order Intake – ${serviceName}

Package: ${packageName}
Add-ons: ${addonsText || 'None'}
Total Paid: ${totalAmount || ''}
PayPal Order ID: ${receipt.orderID || ''}
PayPal Capture ID: ${receipt.captureID || ''}
Payer Email: ${receipt.payerEmail || ''}

Footage Link (Required):
${footageLink}

Initial Notes (from order page):
${projectNotes || 'None provided'}

Extra Project Details:
${extraNotes || 'None provided'}

Sent from ShortFormFactory order page
      `.trim();

      const mailto = `mailto:shortformfactory.help@gmail.com?subject=${encodeURIComponent('New Order Intake – ' + serviceName)}&body=${encodeURIComponent(emailBody)}`;
      window.location.href = mailto;
    });
  }

  // ========================
  // G) INITIALIZATION ORDER
  // ========================
  document.addEventListener('DOMContentLoaded', () => {
    // 1) Global error handlers -> #pay-error
    const payError = $('pay-error');
    window.addEventListener('error', (e) => {
      if (!payError) return;
      safeText(payError, 'Error: ' + (e?.message || 'Unknown error'));
    });
    window.addEventListener('unhandledrejection', (e) => {
      if (!payError) return;
      safeText(payError, 'Error: ' + (e?.reason?.message || String(e?.reason || 'Unknown error')));
    });

    // 2) restore paid state
    restorePaidStateOnLoad();

    // 3) handle PayPal redirect return
    handlePayPalReturn();

    // 4) if not unlocked, lock intake
    if (!UNLOCKED) {
      lockIntake('');
    }

    wireIntakeSubmit();
    dbg('paypal-checkout.js patched + loaded');
  });
})();
