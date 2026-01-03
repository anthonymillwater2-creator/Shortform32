// PayPal Checkout Integration - Orders v2 API with Buttons SDK
// FIXED: No race conditions, explicit button triggering, visible diagnostics
(function() {
  'use strict';

  // Global state
  let paypalSDKLoaded = false;
  let paypalButtonsRendered = false;
  const diagnostics = {
    configFetch: { status: 'pending', data: null },
    sdkLoad: { status: 'pending', error: null },
    buttonsRender: { status: 'pending', error: null },
    createOrder: { status: 'pending', orderID: null },
    captureOrder: { status: 'pending', captureID: null }
  };

  // Payment state management via sessionStorage
  const PaymentState = {
    get: () => sessionStorage.getItem('sff_payment_confirmed') === 'true',
    set: (value) => sessionStorage.setItem('sff_payment_confirmed', value ? 'true' : 'false'),
    getOrderID: () => sessionStorage.getItem('sff_order_id'),
    setOrderID: (id) => sessionStorage.setItem('sff_order_id', id),
    getCaptureID: () => sessionStorage.getItem('sff_capture_id'),
    setCaptureID: (id) => sessionStorage.setItem('sff_capture_id', id),
    getAmount: () => sessionStorage.getItem('sff_amount'),
    setAmount: (amount) => sessionStorage.setItem('sff_amount', amount),
    clear: () => {
      sessionStorage.removeItem('sff_payment_confirmed');
      sessionStorage.removeItem('sff_order_id');
      sessionStorage.removeItem('sff_capture_id');
      sessionStorage.removeItem('sff_amount');
    }
  };

  // Helper to get selected service and package from main.js state
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

    return { service, package: packageType, addons };
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    setupPayButton();
    checkPaymentStatus();
    setupIntakeButton();
    setupDiagnosticsPanel();
    captureJSErrors();
  });

  // Capture JavaScript errors for diagnostics
  function captureJSErrors() {
    window.addEventListener('error', (e) => {
      updateDiagnostics('jsError', { message: e.message, file: e.filename, line: e.lineno });
    });
    window.addEventListener('unhandledrejection', (e) => {
      updateDiagnostics('jsError', { message: 'Promise rejection: ' + e.reason });
    });
  }

  // Setup diagnostics panel (collapsible)
  function setupDiagnosticsPanel() {
    const container = document.getElementById('paypal-button-container');
    if (!container) return;

    const panel = document.createElement('div');
    panel.id = 'paypal-diagnostics';
    panel.style.cssText = `
      margin-top: 15px;
      padding: 12px;
      background: #0e0e0e;
      border: 1px solid #333;
      border-radius: 8px;
      font-size: 12px;
      font-family: monospace;
      display: none;
    `;
    panel.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 700; color: #ffc107;">🔍 PayPal Diagnostics</div>
      <div id="diag-content"></div>
      <button id="diag-toggle" style="margin-top: 8px; padding: 4px 8px; background: #1b1b1b; color: #fff; border: 1px solid #333; border-radius: 4px; cursor: pointer; font-size: 11px;">Show Details</button>
    `;
    container.parentNode.insertBefore(panel, container.nextSibling);

    document.getElementById('diag-toggle')?.addEventListener('click', toggleDiagnostics);
  }

  function toggleDiagnostics() {
    const content = document.getElementById('diag-content');
    const toggle = document.getElementById('diag-toggle');
    if (!content || !toggle) return;

    if (content.style.display === 'none' || !content.style.display) {
      content.style.display = 'block';
      toggle.textContent = 'Hide Details';
      updateDiagnosticsDisplay();
    } else {
      content.style.display = 'none';
      toggle.textContent = 'Show Details';
    }
  }

  function updateDiagnostics(key, value) {
    if (diagnostics[key]) {
      diagnostics[key] = { ...diagnostics[key], ...value };
    } else {
      diagnostics[key] = value;
    }
    updateDiagnosticsDisplay();
  }

  function updateDiagnosticsDisplay() {
    const content = document.getElementById('diag-content');
    const panel = document.getElementById('paypal-diagnostics');
    if (!content) return;

    let html = '';
    for (const [key, value] of Object.entries(diagnostics)) {
      const status = value.status || 'unknown';
      const icon = status === 'success' ? '✓' : status === 'error' ? '✗' : '○';
      const color = status === 'success' ? '#00C851' : status === 'error' ? '#ff4d4f' : '#666';

      html += `<div style="margin: 4px 0; color: ${color};">${icon} ${key}: ${JSON.stringify(value, null, 2).substring(0, 200)}</div>`;
    }

    content.innerHTML = html;

    // Show panel if there's an error
    const hasError = Object.values(diagnostics).some(v => v.status === 'error' || v.error);
    if (hasError && panel) {
      panel.style.display = 'block';
      content.style.display = 'block';
      document.getElementById('diag-toggle').textContent = 'Hide Details';
    }
  }

  // Setup the "Proceed to PayPal Payment" button to trigger PayPal loading
  function setupPayButton() {
    const payButton = document.getElementById('payButton');
    if (!payButton) return;

    payButton.addEventListener('click', async (e) => {
      e.preventDefault();

      // Validate selection
      const orderData = getOrderData();
      if (!orderData || !orderData.service || !orderData.package) {
        showError('Please select a service and package first');
        updateDiagnostics('validation', { status: 'error', error: 'No service or package selected' });
        return;
      }

      const totalEl = document.getElementById('totalAmount');
      const total = totalEl ? parseFloat(totalEl.textContent.replace(/[^0-9.]/g, '')) : 0;
      if (total <= 0) {
        showError('Total amount must be greater than $0');
        updateDiagnostics('validation', { status: 'error', error: 'Total is $0' });
        return;
      }

      updateDiagnostics('validation', { status: 'success', total, orderData });

      // Start PayPal initialization
      payButton.disabled = true;
      payButton.textContent = 'Loading PayPal...';

      try {
        await initializePayPal();
      } catch (error) {
        showError('Failed to load PayPal: ' + error.message);
        payButton.disabled = false;
        payButton.textContent = 'Retry PayPal Payment';
      }
    });
  }

  async function initializePayPal() {
    const buttonContainer = document.getElementById('paypal-button-container');
    const payButton = document.getElementById('payButton');

    if (!buttonContainer) {
      throw new Error('PayPal button container not found');
    }

    // Check if PayPal SDK is already loaded
    if (typeof window.paypal === 'undefined') {
      updateDiagnostics('sdkLoad', { status: 'error', error: 'PayPal SDK not loaded. Check paypal-loader.js' });
      throw new Error('PayPal SDK not loaded');
    }

    updateDiagnostics('sdkLoad', { status: 'success' });
    paypalSDKLoaded = true;

    // Don't re-render if already rendered
    if (paypalButtonsRendered) {
      buttonContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      // Render PayPal Buttons
      await window.paypal.Buttons({
        // Create order on PayPal
        createOrder: async function(data, actions) {
          const orderData = getOrderData();

          if (!orderData || !orderData.service || !orderData.package) {
            const error = 'Missing service or package';
            updateDiagnostics('createOrder', { status: 'error', error });
            throw new Error(error);
          }

          try {
            updateDiagnostics('createOrder', { status: 'pending', orderData });

            // Call our serverless function to create the order
            const response = await fetch('/api/create-order', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(orderData),
            });

            const responseData = await response.json();

            if (!response.ok || !responseData.orderID) {
              throw new Error(responseData.error || 'Failed to create order');
            }

            updateDiagnostics('createOrder', { status: 'success', orderID: responseData.orderID });
            return responseData.orderID;
          } catch (error) {
            console.error('Create order error:', error);
            updateDiagnostics('createOrder', { status: 'error', error: error.message });
            showError('Failed to initialize payment. Please try again.');
            throw error;
          }
        },

        // User approved payment
        onApprove: async function(data, actions) {
          try {
            updateDiagnostics('captureOrder', { status: 'pending', orderID: data.orderID });

            // Call our serverless function to capture the payment
            const response = await fetch('/api/capture-order', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ orderID: data.orderID }),
            });

            const captureData = await response.json();

            if (captureData.success && captureData.status === 'COMPLETED') {
              // Store payment confirmation in session
              PaymentState.set(true);
              PaymentState.setOrderID(captureData.orderID);
              PaymentState.setCaptureID(captureData.captureID);
              PaymentState.setAmount(JSON.stringify(captureData.amount));

              updateDiagnostics('captureOrder', {
                status: 'success',
                captureID: captureData.captureID,
                amount: captureData.amount
              });

              // Update UI
              unlockIntake();
              showPaymentConfirmation(captureData);
            } else {
              throw new Error('Payment capture failed');
            }
          } catch (error) {
            console.error('Capture error:', error);
            updateDiagnostics('captureOrder', { status: 'error', error: error.message });
            showError('Payment verification failed. Please contact support with Order ID: ' + data.orderID);
          }
        },

        // User cancelled payment
        onCancel: function(data) {
          updateDiagnostics('paymentFlow', { status: 'cancelled', orderID: data.orderID });
          showError('Payment was cancelled. Please try again when ready.');
          if (payButton) {
            payButton.disabled = false;
            payButton.textContent = 'Proceed to PayPal Payment';
          }
        },

        // Error occurred
        onError: function(err) {
          console.error('PayPal error:', err);
          updateDiagnostics('paypalError', { status: 'error', error: err.toString() });
          showError('An error occurred during payment. Please try again.');
          if (payButton) {
            payButton.disabled = false;
            payButton.textContent = 'Retry PayPal Payment';
          }
        },

        // Button styling
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal'
        }
      }).render('#paypal-button-container');

      paypalButtonsRendered = true;
      updateDiagnostics('buttonsRender', { status: 'success' });

      // Hide the trigger button, show the PayPal buttons
      if (payButton) {
        payButton.style.display = 'none';
      }

      // Scroll to PayPal buttons
      buttonContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (error) {
      console.error('PayPal render error:', error);
      updateDiagnostics('buttonsRender', { status: 'error', error: error.message });
      throw error;
    }
  }

  function checkPaymentStatus() {
    // Check if payment was already completed (session persisted)
    if (PaymentState.get()) {
      // Reconstruct captureData from session storage
      const captureData = {
        orderID: PaymentState.getOrderID(),
        captureID: PaymentState.getCaptureID(),
        amount: PaymentState.getAmount() ? JSON.parse(PaymentState.getAmount()) : null
      };

      unlockIntake();
      showPaymentConfirmation(captureData);
      updateDiagnostics('paymentStatus', { status: 'already_completed', captureData });
    }
  }

  function unlockIntake() {
    const submitButton = document.getElementById('submitIntakeButton');
    const intakeNotice = document.getElementById('intakeNotice');

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.add('unlocked');
    }

    if (intakeNotice) {
      intakeNotice.innerHTML = '<span class="check-icon">✓</span> Payment confirmed! Ready to submit project details';
      intakeNotice.classList.add('success');
      intakeNotice.style.display = 'block';
      intakeNotice.style.color = '#00C851';
    }
  }

  function showPaymentConfirmation(captureData) {
    const payButton = document.getElementById('payButton');
    const buttonContainer = document.getElementById('paypal-button-container');

    // Hide PayPal buttons after payment
    if (buttonContainer) {
      buttonContainer.style.display = 'none';
    }

    // Display receipt with order/capture IDs
    if (payButton && captureData) {
      const amount = captureData.amount ? `${captureData.amount.currency_code} ${captureData.amount.value}` : 'N/A';

      payButton.innerHTML = `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <div style="font-weight: 800; color: #00C851; margin-bottom: 8px;">✓ Payment Completed</div>
          <div style="font-weight: 400; font-size: 12px; color: #9aa0a6;">
            <div><strong>Amount:</strong> ${amount}</div>
            <div style="margin-top: 4px;"><strong>Order ID:</strong><br/><code style="font-size: 11px; background: #0e0e0e; padding: 2px 4px; border-radius: 4px;">${captureData.orderID || 'N/A'}</code></div>
            <div style="margin-top: 4px;"><strong>Capture ID:</strong><br/><code style="font-size: 11px; background: #0e0e0e; padding: 2px 4px; border-radius: 4px;">${captureData.captureID || 'N/A'}</code></div>
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: #666;">Screenshot this receipt for your records</div>
        </div>
      `;
      payButton.disabled = true;
      payButton.classList.add('completed');
      payButton.style.display = 'block';
      payButton.style.height = 'auto';
      payButton.style.padding = '16px';
    }
  }

  function showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'payment-notification error';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4d4f;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 320px;
      font-size: 14px;
    `;

    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      errorDiv.style.transition = 'opacity 0.3s ease';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }

  function setupIntakeButton() {
    const submitButton = document.getElementById('submitIntakeButton');
    if (!submitButton) return;

    submitButton.addEventListener('click', handleIntakeSubmit);
  }

  function handleIntakeSubmit(e) {
    e.preventDefault();

    // Verify payment
    if (!PaymentState.get()) {
      showError('Please complete payment first');
      return;
    }

    // Get order data
    const orderData = getOrderData();
    if (!orderData) {
      showError('Please select a service and package');
      return;
    }

    const projectNotes = document.getElementById('projectNotes')?.value || 'None provided';
    const totalAmount = document.getElementById('totalAmount')?.textContent || '$0.00';
    const orderID = PaymentState.getOrderID() || 'N/A';
    const captureID = PaymentState.getCaptureID() || 'N/A';

    // Build email body
    const serviceName = document.getElementById('summaryService')?.textContent || orderData.service;
    const packageName = document.getElementById('summaryPackage')?.textContent || orderData.package;
    const addonsText = document.getElementById('summaryAddons')?.textContent || 'None';

    const emailBody = `
New Order Intake – ${serviceName}

Package: ${packageName}
Add-ons: ${addonsText}
Total Paid: ${totalAmount}
PayPal Order ID: ${orderID}
PayPal Capture ID: ${captureID}

Initial Notes:
${projectNotes}

Footage Links (Drive/Dropbox/etc.):
(Please provide your footage links below)

Social handles for tagging (optional):
TikTok: @short.formfactory
Instagram: @short.formfactory
YouTube: @short.formfactory

Sent from ShortFormFactory order page
    `.trim();

    // Create mailto link
    const mailto = `mailto:shortformfactory.help@gmail.com?subject=${encodeURIComponent('New Order Intake – ' + serviceName)}&body=${encodeURIComponent(emailBody)}`;

    // Open email client
    window.location.href = mailto;
  }

  // Expose for testing
  window.sffPayPal = {
    diagnostics,
    showDiagnostics: () => {
      const panel = document.getElementById('paypal-diagnostics');
      if (panel) panel.style.display = 'block';
      toggleDiagnostics();
    }
  };

})();
