// PayPal Checkout - iOS Safari Click Handler Fix
// GOAL: Prove click events fire, then mount PayPal buttons
(function() {
  'use strict';

  // ====== HELPER FUNCTIONS - VISIBLE DEBUG ======
  function toast(msg) {
    const t = document.getElementById("pp-toast");
    if (t) {
      t.textContent = msg + " @ " + new Date().toLocaleTimeString();
    }
    console.log("[TOAST]", msg);
  }

  function dbg(msg) {
    const el = document.getElementById("pp-debug");
    if (el) {
      const timestamp = new Date().toLocaleTimeString();
      el.textContent = `[${timestamp}] ${msg}\n` + (el.textContent || "");
    }
    console.log("[DEBUG]", msg);
  }

  // ====== GLOBAL ERROR HANDLERS ======
  window.addEventListener("error", (e) => {
    dbg(`JS ERROR: ${e.message} at ${e.filename}:${e.lineno}`);
  });

  window.addEventListener("unhandledrejection", (e) => {
    dbg(`PROMISE ERROR: ${String(e.reason)}`);
  });

  // ====== PAYMENT STATE MANAGEMENT ======
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

    return { service, package: packageType, addons };
  }

  // ====== DOM READY ======
  document.addEventListener("DOMContentLoaded", () => {
    dbg("DOMContentLoaded fired");

    const btn = document.getElementById("proceed-paypal");
    if (!btn) {
      dbg("FATAL: proceed-paypal button missing");
      toast("ERROR: Button not found");
      return;
    }

    dbg("proceed-paypal button found - wiring handlers");

    // Wire both pointerup AND click for iOS Safari
    btn.addEventListener("pointerup", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      toast("CLICK FIRED (pointerup)");
      dbg("CLICK FIRED (pointerup)");
      await proceedPayPal();
    }, { passive: false });

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      toast("CLICK FIRED (click)");
      dbg("CLICK FIRED (click)");
      await proceedPayPal();
    }, { passive: false });

    dbg("✓ Handlers attached to proceed-paypal button");

    // Check if payment already completed
    checkPaymentStatus();
    setupIntakeButton();
  });

  // ====== PROCEED TO PAYPAL ======
  async function proceedPayPal() {
    dbg("proceedPayPal() called");

    // Get current selections
    const orderData = getOrderData();
    const totalEl = document.getElementById('totalAmount');
    const total = totalEl ? parseFloat(totalEl.textContent.replace(/[^0-9.]/g, '')) : 0;

    dbg(`Selected: service=${orderData?.service || 'NONE'}, package=${orderData?.package || 'NONE'}, total=$${total}`);

    // Validate
    if (!orderData || !orderData.service || !orderData.package) {
      toast("ERROR: Select service + package first");
      dbg("Validation failed: missing service or package");
      showError("Please select a service and package first");
      return;
    }

    if (total <= 0) {
      toast("ERROR: Total must be > $0");
      dbg("Validation failed: total is $0");
      showError("Total amount must be greater than $0");
      return;
    }

    dbg("✓ Validation passed");

    // Check container exists
    const container = document.getElementById("paypal-button-container");
    if (!container) {
      dbg("FATAL: paypal-button-container missing");
      toast("ERROR: Container missing");
      return;
    }

    dbg("✓ PayPal container found");

    // Disable button
    const btn = document.getElementById("proceed-paypal");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Loading PayPal...";
    }

    // Mount PayPal Buttons
    try {
      await mountPayPalButtons();
      toast("✓ PayPal Buttons Ready");
      dbg("✓ mountPayPalButtons succeeded");
    } catch (error) {
      toast("ERROR: " + error.message);
      dbg("mountPayPalButtons error: " + error.message);
      showError("Failed to load PayPal: " + error.message);

      // Re-enable button
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Retry PayPal Payment";
      }
    }
  }

  // ====== MOUNT PAYPAL BUTTONS ======
  async function mountPayPalButtons() {
    dbg("mountPayPalButtons start");

    const container = document.getElementById("paypal-button-container");
    const btn = document.getElementById("proceed-paypal");

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

        const response = await fetch("/api/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderID: data.orderID })
        });

        const captureData = await response.json();
        dbg(`capture-order response: ok=${response.ok}, status=${captureData.status}`);

        if (captureData.success && captureData.status === "COMPLETED") {
          // Store payment
          PaymentState.set(true);
          PaymentState.setOrderID(captureData.orderID);
          PaymentState.setCaptureID(captureData.captureID);
          PaymentState.setAmount(JSON.stringify(captureData.amount));

          dbg(`✓ Payment captured: ${captureData.captureID}`);
          toast("✓ Payment Complete");

          unlockIntake();
          showPaymentConfirmation(captureData);
        } else {
          throw new Error("Payment capture failed");
        }
      },

      onCancel: function(data) {
        dbg(`onCancel - orderID=${data.orderID || 'none'}`);
        toast("Payment cancelled");
        showError("Payment was cancelled");

        if (btn) {
          btn.disabled = false;
          btn.textContent = "Proceed to PayPal Payment";
        }
      },

      onError: function(err) {
        dbg(`onError: ${String(err)}`);
        toast("PayPal error");
        showError("An error occurred during payment");

        if (btn) {
          btn.disabled = false;
          btn.textContent = "Retry PayPal Payment";
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
    if (btn) {
      btn.style.display = "none";
    }

    // Scroll to PayPal
    container.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ====== PAYMENT STATUS CHECK ======
  function checkPaymentStatus() {
    if (PaymentState.get()) {
      dbg("Payment already completed - showing receipt");

      const captureData = {
        orderID: PaymentState.getOrderID(),
        captureID: PaymentState.getCaptureID(),
        amount: PaymentState.getAmount() ? JSON.parse(PaymentState.getAmount()) : null
      };

      unlockIntake();
      showPaymentConfirmation(captureData);
    }
  }

  // ====== UNLOCK INTAKE ======
  function unlockIntake() {
    const submitButton = document.getElementById("submitIntakeButton");
    const intakeNotice = document.getElementById("intakeNotice");

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.add("unlocked");
    }

    if (intakeNotice) {
      intakeNotice.innerHTML = '<span class="check-icon">✓</span> Payment confirmed! Ready to submit project details';
      intakeNotice.classList.add("success");
      intakeNotice.style.display = "block";
      intakeNotice.style.color = "#00C851";
    }
  }

  // ====== SHOW PAYMENT CONFIRMATION ======
  function showPaymentConfirmation(captureData) {
    const btn = document.getElementById("proceed-paypal");
    const container = document.getElementById("paypal-button-container");

    if (container) {
      container.style.display = "none";
    }

    if (btn && captureData) {
      const amount = captureData.amount ? `${captureData.amount.currency_code} ${captureData.amount.value}` : "N/A";

      btn.innerHTML = `
        <div style="text-align: left; font-size: 13px; line-height: 1.6;">
          <div style="font-weight: 800; color: #00C851; margin-bottom: 8px;">✓ Payment Completed</div>
          <div style="font-weight: 400; font-size: 12px; color: #9aa0a6;">
            <div><strong>Amount:</strong> ${amount}</div>
            <div style="margin-top: 4px;"><strong>Order ID:</strong><br/><code style="font-size: 11px; background: #0e0e0e; padding: 2px 4px; border-radius: 4px;">${captureData.orderID || "N/A"}</code></div>
            <div style="margin-top: 4px;"><strong>Capture ID:</strong><br/><code style="font-size: 11px; background: #0e0e0e; padding: 2px 4px; border-radius: 4px;">${captureData.captureID || "N/A"}</code></div>
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: #666;">Screenshot this receipt for your records</div>
        </div>
      `;
      btn.disabled = true;
      btn.classList.add("completed");
      btn.style.display = "block";
      btn.style.height = "auto";
      btn.style.padding = "16px";
    }
  }

  // ====== SHOW ERROR ======
  function showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "payment-notification error";
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

    setTimeout(() => {
      errorDiv.style.opacity = "0";
      errorDiv.style.transition = "opacity 0.3s ease";
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }

  // ====== INTAKE BUTTON ======
  function setupIntakeButton() {
    const submitButton = document.getElementById("submitIntakeButton");
    if (!submitButton) return;

    submitButton.addEventListener("click", handleIntakeSubmit);
  }

  function handleIntakeSubmit(e) {
    e.preventDefault();

    if (!PaymentState.get()) {
      showError("Please complete payment first");
      return;
    }

    const orderData = getOrderData();
    if (!orderData) {
      showError("Please select a service and package");
      return;
    }

    const projectNotes = document.getElementById("projectNotes")?.value || "None provided";
    const totalAmount = document.getElementById("totalAmount")?.textContent || "$0.00";
    const orderID = PaymentState.getOrderID() || "N/A";
    const captureID = PaymentState.getCaptureID() || "N/A";

    const serviceName = document.getElementById("summaryService")?.textContent || orderData.service;
    const packageName = document.getElementById("summaryPackage")?.textContent || orderData.package;
    const addonsText = document.getElementById("summaryAddons")?.textContent || "None";

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

    const mailto = `mailto:shortformfactory.help@gmail.com?subject=${encodeURIComponent("New Order Intake – " + serviceName)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailto;
  }

})();
