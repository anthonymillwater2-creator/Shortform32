// PayPal Checkout Integration - Orders v2 API with Buttons SDK
(function() {
  'use strict';

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
    initializePayPal();
    checkPaymentStatus();
    setupIntakeButton();
  });

  function initializePayPal() {
    // Check if PayPal SDK is loaded
    if (typeof paypal === 'undefined') {
      console.error('PayPal SDK not loaded');
      return;
    }

    const buttonContainer = document.getElementById('paypal-button-container');
    const payButton = document.getElementById('payButton');

    if (!buttonContainer) return;

    // Render PayPal Buttons
    paypal.Buttons({
      // Create order on PayPal
      createOrder: async function(data, actions) {
        const orderData = getOrderData();

        if (!orderData || !orderData.service || !orderData.package) {
          showError('Please select a service and package');
          throw new Error('Missing service or package');
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

          if (!response.ok || !responseData.orderID) {
            throw new Error(responseData.error || 'Failed to create order');
          }

          return responseData.orderID;
        } catch (error) {
          console.error('Create order error:', error);
          showError('Failed to initialize payment. Please try again.');
          throw error;
        }
      },

      // User approved payment
      onApprove: async function(data, actions) {
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

          if (captureData.success && captureData.status === 'COMPLETED') {
            // Store payment confirmation in session
            PaymentState.set(true);
            PaymentState.setOrderID(captureData.orderID);
            PaymentState.setCaptureID(captureData.captureID);
            PaymentState.setAmount(JSON.stringify(captureData.amount));

            // Update UI
            unlockIntake();
            showPaymentConfirmation(captureData);
          } else {
            throw new Error('Payment capture failed');
          }
        } catch (error) {
          console.error('Capture error:', error);
          showError('Payment verification failed. Please contact support with Order ID: ' + data.orderID);
        }
      },

      // User cancelled payment
      onCancel: function(data) {
        showError('Payment was cancelled. Please try again when ready.');
      },

      // Error occurred
      onError: function(err) {
        console.error('PayPal error:', err);
        showError('An error occurred during payment. Please try again.');
      },

      // Button styling
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal'
      }
    }).render('#paypal-button-container');

    // Hide the old pay button once PayPal buttons render
    if (payButton) {
      payButton.style.display = 'none';
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
