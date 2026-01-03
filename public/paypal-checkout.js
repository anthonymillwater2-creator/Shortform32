// PayPal Checkout Integration - FIXED for iOS Safari
// Simplified with visible debugging
(function() {
  'use strict';

  const dbg = window.dbg || console.log;

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
    dbg('[checkout] DOMContentLoaded - initializing');
    setupPayButton();
    checkPaymentStatus();
    setupIntakeButton();
    probeOverlayIssues();
  });

  // Probe for overlay issues after buttons mount
  function probeOverlayIssues() {
    setTimeout(() => {
      const container = document.getElementById('paypal-button-container');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const topElement = document.elementFromPoint(centerX, centerY);
      if (topElement) {
        dbg(`TOP ELEMENT @ PayPal center: ${topElement.tagName}.${topElement.className || ''} id=${topElement.id || 'none'}`);
      } else {
        dbg('TOP ELEMENT @ PayPal center: null (off-screen?)');
      }
    }, 2000); // Wait 2s for buttons to render
  }

  // Setup the "Proceed to PayPal Payment" button to trigger PayPal loading
  function setupPayButton() {
    const payButton = document.getElementById('payButton');
    if (!payButton) {
      dbg('[checkout] payButton not found');
      return;
    }

    dbg('[checkout] payButton found - adding click handler');

    payButton.addEventListener('click', async (e) => {
      e.preventDefault();
      dbg('[checkout] payButton clicked');

      // Validate selection
      const orderData = getOrderData();
      if (!orderData || !orderData.service || !orderData.package) {
        showError('Please select a service and package first');
        dbg('[checkout] Validation failed - no service/package');
        return;
      }

      const totalEl = document.getElementById('totalAmount');
      const total = totalEl ? parseFloat(totalEl.textContent.replace(/[^0-9.]/g, '')) : 0;
      if (total <= 0) {
        showError('Total amount must be greater than $0');
        dbg('[checkout] Validation failed - total is $0');
        return;
      }

      dbg(`[checkout] Validation passed - service=${orderData.service}, package=${orderData.package}, total=$${total}`);

      // Start PayPal initialization
      payButton.disabled = true;
      payButton.textContent = 'Loading PayPal...';

      try {
        await mountPayPalButtons();
      } catch (error) {
        dbg(`[checkout] mountPayPalButtons error: ${error.message}`);
        showError('Failed to load PayPal: ' + error.message);
        payButton.disabled = false;
        payButton.textContent = 'Retry PayPal Payment';
      }
    });
  }

  async function mountPayPalButtons() {
    dbg('[checkout] mountPayPalButtons start');

    const buttonContainer = document.getElementById('paypal-button-container');
    const payButton = document.getElementById('payButton');

    if (!buttonContainer) {
      throw new Error('PayPal button container not found');
    }

    // Load SDK (will use cached if already loaded)
    dbg('[checkout] Calling loadPayPalSDK');
    const sdkLoaded = await window.loadPayPalSDK();

    if (!sdkLoaded) {
      throw new Error('SDK load returned false');
    }

    // Verify SDK is ready
    if (!window.paypal || !window.paypal.Buttons) {
      throw new Error('window.paypal.Buttons not available after load');
    }

    dbg('[checkout] SDK ready - window.paypal.Buttons exists');

    // Clear container
    buttonContainer.innerHTML = '';

    // Render PayPal Buttons
    dbg('[checkout] Calling paypal.Buttons().render()');

    try {
      await window.paypal.Buttons({
        // Create order on PayPal
        createOrder: async function() {
          dbg('[checkout] createOrder start');
          const orderData = getOrderData();

          if (!orderData || !orderData.service || !orderData.package) {
            const error = 'Missing service or package';
            dbg(`[checkout] createOrder error: ${error}`);
            throw new Error(error);
          }

          try {
            // Call our serverless function to create the order
            const response = await fetch('/api/create-order', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(orderData),
            });

            const responseData = await response.json();
            dbg(`[checkout] create-order response: ok=${response.ok}, hasOrderID=${!!responseData.orderID}`);

            if (!response.ok || !responseData.orderID) {
              throw new Error(responseData.error || 'Failed to create order');
            }

            dbg(`[checkout] createOrder success - orderID=${responseData.orderID}`);
            return responseData.orderID;
          } catch (error) {
            dbg(`[checkout] createOrder fetch error: ${error.message}`);
            showError('Failed to initialize payment. Please try again.');
            throw error;
          }
        },

        // User approved payment
        onApprove: async function(data) {
          dbg(`[checkout] onApprove - orderID=${data.orderID}`);
          try {
            // Call our serverless function to capture the payment
            const response = await fetch('/api/capture-order', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ orderID: data.orderID }),
            });

            const captureData = await response.json();
            dbg(`[checkout] capture-order response: ok=${response.ok}, status=${captureData.status}`);

            if (captureData.success && captureData.status === 'COMPLETED') {
              // Store payment confirmation in session
              PaymentState.set(true);
              PaymentState.setOrderID(captureData.orderID);
              PaymentState.setCaptureID(captureData.captureID);
              PaymentState.setAmount(JSON.stringify(captureData.amount));

              dbg(`[checkout] ✓ Payment captured - captureID=${captureData.captureID}`);

              // Update UI
              unlockIntake();
              showPaymentConfirmation(captureData);
            } else {
              throw new Error('Payment capture failed');
            }
          } catch (error) {
            dbg(`[checkout] capture error: ${error.message}`);
            showError('Payment verification failed. Please contact support with Order ID: ' + data.orderID);
          }
        },

        // User cancelled payment
        onCancel: function(data) {
          dbg(`[checkout] onCancel - orderID=${data.orderID || 'none'}`);
          showError('Payment was cancelled. Please try again when ready.');
          if (payButton) {
            payButton.disabled = false;
            payButton.textContent = 'Proceed to PayPal Payment';
          }
        },

        // Error occurred
        onError: function(err) {
          dbg(`[checkout] onError: ${String(err)}`);
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

      dbg('[checkout] ✓ Buttons rendered successfully');

      // Hide the trigger button, show the PayPal buttons
      if (payButton) {
        payButton.style.display = 'none';
      }

      // Scroll to PayPal buttons
      buttonContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (error) {
      dbg(`[checkout] Buttons render error: ${error.message}`);
      throw error;
    }
  }

  function checkPaymentStatus() {
    // Check if payment was already completed (session persisted)
    if (PaymentState.get()) {
      dbg('[checkout] Payment already completed - showing receipt');
      // Reconstruct captureData from session storage
      const captureData = {
        orderID: PaymentState.getOrderID(),
        captureID: PaymentState.getCaptureID(),
        amount: PaymentState.getAmount() ? JSON.parse(PaymentState.getAmount()) : null
      };

      unlockIntake();
      showPaymentConfirmation(captureData);
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

})();
