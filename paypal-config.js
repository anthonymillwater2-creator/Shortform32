// PayPal Checkout Integration
// Implements PayPal Orders v2 API with proper intake unlocking

(function() {
  'use strict';

  // Payment state management
  const PaymentState = {
    get: () => sessionStorage.getItem('sff_payment_confirmed') === 'true',
    set: (value) => sessionStorage.setItem('sff_payment_confirmed', value ? 'true' : 'false'),
    getOrderID: () => sessionStorage.getItem('sff_order_id'),
    setOrderID: (id) => sessionStorage.setItem('sff_order_id', id),
    clear: () => {
      sessionStorage.removeItem('sff_payment_confirmed');
      sessionStorage.removeItem('sff_order_id');
    }
  };

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', () => {
    initializePayPalCheckout();
    checkPaymentStatus();
  });

  function initializePayPalCheckout() {
    const payButton = document.getElementById('payButton');
    if (!payButton) return;

    // Replace button click handler
    payButton.addEventListener('click', handlePaymentClick);
  }

  function checkPaymentStatus() {
    // Check if payment was already completed
    if (PaymentState.get()) {
      unlockIntake();
      showPaymentConfirmation();
    }

    // Check URL parameters for return from PayPal
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      // Payment successful - confirmation already handled by PayPal button
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('cancel') === 'true') {
      showError('Payment was cancelled. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  async function handlePaymentClick(e) {
    e.preventDefault();

    const service = document.getElementById('serviceSelect')?.value;
    const selectedPackage = document.querySelector('.package-option.selected');
    const totalAmount = document.getElementById('totalAmount')?.textContent.replace('$', '');

    if (!service || !selectedPackage || !totalAmount || totalAmount === '0') {
      showError('Please select a service and package');
      return;
    }

    // Get package details
    const packageName = selectedPackage.dataset.package;

    // Get selected addons
    const addonCheckboxes = document.querySelectorAll('.addon-checkbox input[type="checkbox"]:checked');
    const addons = Array.from(addonCheckboxes).map(cb => cb.dataset.name).join(', ');

    // Show loading state
    const payButton = document.getElementById('payButton');
    const originalText = payButton.textContent;
    payButton.disabled = true;
    payButton.textContent = 'Processing...';

    try {
      // Create PayPal order via our API
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(totalAmount),
          service,
          package: packageName,
          addons: addons || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.orderID) {
        throw new Error(data.error || 'Failed to create order');
      }

      // Redirect to PayPal for payment
      const approveUrl = `https://www.paypal.com/checkoutnow?token=${data.orderID}`;
      window.location.href = approveUrl;

    } catch (error) {
      console.error('Payment error:', error);
      showError('Payment initialization failed. Please try again.');
      payButton.disabled = false;
      payButton.textContent = originalText;
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
    }
  }

  function showPaymentConfirmation() {
    const payButton = document.getElementById('payButton');
    if (payButton) {
      payButton.textContent = 'Payment Completed ✓';
      payButton.disabled = true;
      payButton.classList.add('completed');
    }
  }

  function showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'payment-error';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(errorDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorDiv.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }

  // Handle intake form submission
  document.addEventListener('DOMContentLoaded', () => {
    const submitButton = document.getElementById('submitIntakeButton');
    if (submitButton) {
      submitButton.addEventListener('click', handleIntakeSubmit);
    }
  });

  function handleIntakeSubmit(e) {
    e.preventDefault();

    if (!PaymentState.get()) {
      showError('Please complete payment first');
      return;
    }

    // Get all form data
    const service = document.getElementById('serviceSelect')?.value;
    const selectedPackage = document.querySelector('.package-option.selected')?.dataset.package;
    const projectNotes = document.getElementById('projectNotes')?.value || '';
    const totalAmount = document.getElementById('totalAmount')?.textContent;

    // Get selected addons
    const addonCheckboxes = document.querySelectorAll('.addon-checkbox input[type="checkbox"]:checked');
    const addons = Array.from(addonCheckboxes).map(cb => cb.dataset.name).join(', ');

    // Build email body
    const emailBody = `
Service: ${service}
Package: ${selectedPackage}
Add-ons: ${addons || 'None'}
Total Paid: ${totalAmount}
Order ID: ${PaymentState.getOrderID()}

Initial Notes:
${projectNotes || 'None provided'}

Next steps: Please send your footage links to this email.
    `.trim();

    // Create mailto link
    const mailto = `mailto:shortformfactory.help@gmail.com?subject=Project Submission - ${service}&body=${encodeURIComponent(emailBody)}`;

    // Open email client
    window.location.href = mailto;

    // Show success message
    showError = function(msg) {}; // Override temporarily
    const successDiv = document.createElement('div');
    successDiv.className = 'payment-error';
    successDiv.textContent = 'Email client opened! Please send the email to complete your submission.';
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #00C851;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
    `;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 5000);
  }

  // Handle PayPal return (when user comes back after payment)
  window.addEventListener('message', async (event) => {
    // Listen for PayPal messages
    if (event.data && event.data.action === 'paypal_payment_complete') {
      const orderID = event.data.orderID;

      if (orderID) {
        try {
          // Capture the payment
          const response = await fetch('/api/capture-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderID }),
          });

          const data = await response.json();

          if (data.success) {
            PaymentState.set(true);
            PaymentState.setOrderID(orderID);
            unlockIntake();
            showPaymentConfirmation();
          } else {
            throw new Error('Payment capture failed');
          }
        } catch (error) {
          console.error('Capture error:', error);
          showError('Payment verification failed. Please contact support.');
        }
      }
    }
  });

})();
