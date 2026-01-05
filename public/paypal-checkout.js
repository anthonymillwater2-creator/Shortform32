(function () {
  'use strict';

  // ====== GLOBAL SINGLE SOURCE OF TRUTH ======
  window.ORDER_STATE = window.ORDER_STATE || {
    service: '',
    pack: '',
    addons: [],
    total: 0,
    currency: '',
  };

  var RECEIPT_KEY = 'sff_paid_receipt_v1';
  var UNLOCKED = false;
  var CAPTURE_IN_FLIGHT = false;
  var BUTTONS_RENDERED = false;
  var PAYPAL_ACTIONS = null;

  function $(id) { return document.getElementById(id); }

  function setPayError(msg) {
    var el = $('pay-error');
    if (!el) return;
    if (msg) {
      el.textContent = String(msg);
      el.style.display = 'block';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function lockIntake(reason) {
    var intakeSection = $('intake-section');
    var intakeForm = $('intake-form');
    var paymentSection = $('payment-section');

    if (paymentSection) paymentSection.style.display = '';
    if (intakeSection) {
      intakeSection.hidden = true;
      intakeSection.classList.add('locked');
      intakeSection.setAttribute('aria-disabled', 'true');
    }

    if (intakeForm) {
      var nodes = intakeForm.querySelectorAll('input,select,textarea,button');
      for (var i = 0; i < nodes.length; i++) nodes[i].disabled = true;
      var submit = $('intake-submit');
      if (submit) submit.disabled = true;
    }

    setPayError(reason || '');
  }

  function renderReceipt(receipt) {
    var receiptSection = $('receipt-section');
    if (!receiptSection) return;

    var amountLine = '';
    if (receipt.amount && receipt.currency) {
      amountLine = '<div class="receipt-line"><strong>Amount:</strong> ' +
        escapeHtml(receipt.amount) + ' ' + escapeHtml(receipt.currency) + '</div>';
    }

    receiptSection.innerHTML =
      '<div class="form-card" style="margin-top:16px;">' +
        '<h3 style="margin:0 0 10px 0;">Payment Confirmed</h3>' +
        amountLine +
        '<div class="receipt-line"><strong>Order ID:</strong> ' + escapeHtml(receipt.orderID || '') + '</div>' +
        '<div class="receipt-line"><strong>Capture ID:</strong> ' + escapeHtml(receipt.captureID || '') + '</div>' +
        '<div class="receipt-line"><strong>Payer:</strong> ' + escapeHtml(receipt.payerEmail || '') + '</div>' +
      '</div>';
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function unlockIntakeAndOpen(receipt) {
    if (UNLOCKED) return;
    UNLOCKED = true;

    try {
      localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
    } catch (e) {}

    renderReceipt(receipt);

    var paymentSection = $('payment-section');
    if (paymentSection) paymentSection.style.display = 'none';

    var intakeSection = $('intake-section');
    var intakeForm = $('intake-form');

    if (intakeSection) {
      intakeSection.hidden = false;
      intakeSection.classList.remove('locked');
      intakeSection.removeAttribute('aria-disabled');
    }

    if (intakeForm) {
      var nodes = intakeForm.querySelectorAll('input,select,textarea,button');
      for (var i = 0; i < nodes.length; i++) nodes[i].disabled = false;

      var submit = $('intake-submit');
      if (submit) submit.disabled = false;
    }

    hydrateIntakeHiddenFields(receipt);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (intakeSection && intakeSection.scrollIntoView) {
          intakeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        var first =
          $('intake-first') ||
          (intakeForm ? intakeForm.querySelector('[required]') : null) ||
          (intakeForm ? intakeForm.querySelector('input,select,textarea') : null);
        if (first && first.focus) first.focus({ preventScroll: true });
      });
    });
  }

  function restorePaidStateOnLoad() {
    try {
      var raw = localStorage.getItem(RECEIPT_KEY);
      if (!raw) return;
      var receipt = JSON.parse(raw);
      if (receipt && receipt.paid === true && receipt.captureID && receipt.orderID) {
        unlockIntakeAndOpen(receipt);
      }
    } catch (e) {}
  }

  function extractCaptureFields(cap) {
    var capObj = (cap && cap.purchase_units && cap.purchase_units[0] &&
      cap.purchase_units[0].payments && cap.purchase_units[0].payments.captures &&
      cap.purchase_units[0].payments.captures[0]) || null;

    return {
      captureID: (capObj && capObj.id) || '',
      amount: (capObj && capObj.amount && capObj.amount.value) || '',
      currency: (capObj && capObj.amount && capObj.amount.currency_code) || '',
      payerEmail: (cap && cap.payer && cap.payer.email_address) || ''
    };
  }

  function captureOrder(orderID) {
    if (CAPTURE_IN_FLIGHT) return Promise.reject(new Error('Capture already in progress'));
    CAPTURE_IN_FLIGHT = true;

    return fetch('/api/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderID: orderID })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var msg = (data && (data.error || data.details)) ? (data.error || data.details) : 'Capture failed';
            throw new Error(msg);
          }
          return data;
        });
      })
      .finally(function () {
        CAPTURE_IN_FLIGHT = false;
      });
  }

  function handlePayPalReturn() {
    var params = new URLSearchParams(window.location.search || '');
    var token = params.get('token');
    if (!token) return Promise.resolve();

    // If we already have receipt, just clean URL.
    try {
      var raw = localStorage.getItem(RECEIPT_KEY);
      if (raw) {
        var r = JSON.parse(raw);
        if (r && r.paid && r.captureID && r.orderID) {
          history.replaceState({}, '', window.location.pathname);
          return Promise.resolve();
        }
      }
    } catch (e) {}

    return captureOrder(token)
      .then(function (cap) {
        var fields = extractCaptureFields(cap);
        var receipt = {
          paid: true,
          ts: new Date().toISOString(),
          orderID: token,
          captureID: fields.captureID,
          payerEmail: fields.payerEmail,
          amount: fields.amount,
          currency: fields.currency,
          service: window.ORDER_STATE.service || '',
          package: window.ORDER_STATE.pack || '',
          addons: window.ORDER_STATE.addons || []
        };
        unlockIntakeAndOpen(receipt);
        history.replaceState({}, '', window.location.pathname);
      })
      .catch(function (err) {
        lockIntake('Capture failed: ' + (err && err.message ? err.message : ''));
      });
  }

  function isReadyToPay() {
    var st = window.ORDER_STATE || {};
    return !!(st.service && st.pack && st.total && st.total > 0);
  }

  function syncButtonsEnabled() {
    if (!PAYPAL_ACTIONS) return;
    if (isReadyToPay()) {
      PAYPAL_ACTIONS.enable();
    } else {
      PAYPAL_ACTIONS.disable();
    }
  }

  function renderButtonsOnce() {
    if (BUTTONS_RENDERED) return;
    var container = $('paypal-button-container');
    if (!container) return;

    BUTTONS_RENDERED = true;
    setPayError('');

    // Clear container to avoid any previous partial render
    container.innerHTML = '';

    window.paypal.Buttons({
      style: { layout: 'vertical', shape: 'rect', label: 'paypal' },

      onInit: function (data, actions) {
        PAYPAL_ACTIONS = actions;
        actions.disable();
        syncButtonsEnabled();
      },

      createOrder: function () {
        // Must be sync relative to user tap; no awaits here.
        var st = window.ORDER_STATE || {};
        return fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: st.service || '',
            package: st.pack || '',
            addons: st.addons || []
          })
        })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) {
              var msg = (data && data.error) ? data.error : 'Create order failed';
              throw new Error(msg);
            }
            return data.orderID;
          });
        });
      },

      onApprove: function (data) {
        var orderID = data.orderID;

        return captureOrder(orderID)
          .then(function (cap) {
            var fields = extractCaptureFields(cap);
            var receipt = {
              paid: true,
              ts: new Date().toISOString(),
              orderID: orderID,
              captureID: fields.captureID,
              payerEmail: fields.payerEmail,
              amount: fields.amount,
              currency: fields.currency,
              service: window.ORDER_STATE.service || '',
              package: window.ORDER_STATE.pack || '',
              addons: window.ORDER_STATE.addons || []
            };
            unlockIntakeAndOpen(receipt);
          })
          .catch(function (err) {
            lockIntake('Capture failed: ' + (err && err.message ? err.message : ''));
            throw err;
          });
      },

      onError: function () {
        lockIntake('PayPal error. Please refresh and try again.');
      }
    }).render('#paypal-button-container');
  }

  function hydrateIntakeHiddenFields(receipt) {
    try {
      var st = window.ORDER_STATE || {};
      var svc = $('intake-service'); if (svc) svc.value = st.service || '';
      var pack = $('intake-package'); if (pack) pack.value = st.pack || '';
      var add = $('intake-addons'); if (add) add.value = JSON.stringify(st.addons || []);
      var oid = $('intake-orderID'); if (oid) oid.value = receipt.orderID || '';
      var cid = $('intake-captureID'); if (cid) cid.value = receipt.captureID || '';
    } catch (e) {}
  }

  function wireIntakeSubmit() {
    var form = $('intake-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var receipt = null;
      try {
        receipt = JSON.parse(localStorage.getItem(RECEIPT_KEY) || 'null');
      } catch (err) {}

      if (!receipt || !receipt.paid) return;

      // For now: open mailto with structured payload (webhook-ready data already in hidden fields)
      var email = (form.email && form.email.value) ? form.email.value : '';
      var name = (form.name && form.name.value) ? form.name.value : '';
      var footage = (form.footage && form.footage.value) ? form.footage.value : '';
      var notes = (form.notes && form.notes.value) ? form.notes.value : '';

      var st = window.ORDER_STATE || {};
      var subject = 'SFF Order Intake — ' + (st.service || 'Service');
      var body =
        'Email: ' + email + '\n' +
        'Name/Brand: ' + name + '\n' +
        'Service: ' + (st.service || '') + '\n' +
        'Package: ' + (st.pack || '') + '\n' +
        'Add-ons: ' + JSON.stringify(st.addons || []) + '\n' +
        'Order ID: ' + (receipt.orderID || '') + '\n' +
        'Capture ID: ' + (receipt.captureID || '') + '\n' +
        'Payer: ' + (receipt.payerEmail || '') + '\n' +
        'Footage link: ' + footage + '\n\n' +
        'Notes:\n' + notes + '\n';

      var mailto = 'mailto:shortformfactory.help@gmail.com' +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      window.location.href = mailto;
    }, false);
  }

  function wireGlobalErrors() {
    window.addEventListener('error', function () {
      setPayError('An error occurred. Please refresh and try again.');
    });
    window.addEventListener('unhandledrejection', function () {
      setPayError('An error occurred. Please refresh and try again.');
    });
  }

  function init() {
    wireGlobalErrors();
    restorePaidStateOnLoad();

    // Handle redirect return (token)
    handlePayPalReturn().finally(function () {
      if (!UNLOCKED) lockIntake('');

      // Load SDK once, then render buttons once.
      if (window.loadPayPalSDK) {
        window.loadPayPalSDK().then(function (ok) {
          if (!ok) {
            lockIntake('PayPal unavailable. Please refresh and try again.');
            return;
          }
          renderButtonsOnce();
          syncButtonsEnabled();
        });
      } else {
        lockIntake('PayPal loader missing. Please refresh.');
      }
    });

    // Enable/disable buttons as selections change
    document.addEventListener('order:updated', function () {
      syncButtonsEnabled();
    });

    wireIntakeSubmit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export required functions (if needed elsewhere)
  window.lockIntake = lockIntake;
  window.unlockIntakeAndOpen = unlockIntakeAndOpen;
})();