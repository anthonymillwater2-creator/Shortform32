// PayPal Checkout - Complete Intake Auto-Unlock System
(function() {
  'use strict';

  // ====== CONSTANTS ======
  const RECEIPT_KEY = "sff_paid_receipt_v1";
  let UNLOCKED = false;
  let CAPTURE_IN_FLIGHT = false;

  // dbg is provided by main.js
  const dbg = window.dbg || function(m){ console.log('[PAYPAL]', m); };

  // ====== DOM REFERENCES ======
  let paymentSection, receiptSection, intakeSection, intakeForm, payError;

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

  // ====== LOCK INTAKE ======
  function lockIntake(reason) {
    if (!intakeSection) return;

    intakeSection.hidden = true;
    intakeSection.classList.add("locked");
    intakeSection.setAttribute("aria-disabled", "true");

    // Disable all inputs
    if (intakeForm) {
      intakeForm.querySelectorAll("input,select,textarea,button").forEach(el => {
        el.disabled = true;
      });
    }

    // Show payment section
    if (paymentSection) paymentSection.style.display = "";

    // Show error if provided
    if (reason && payError) {
      payError.textContent = reason;
      payError.style.display = "block";
    }

    dbg("lockIntake: " + (reason || "intake locked"));
  }

  // ====== UNLOCK INTAKE AND AUTO-OPEN ======
  function unlockIntakeAndOpen(receipt) {
    if (UNLOCKED) {
      dbg("unlockIntakeAndOpen: already unlocked, skipping");
      return;
    }

    UNLOCKED = true;

    // Store receipt in localStorage
    try {
      localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
      dbg("Receipt stored in localStorage");
    } catch(e) {
      dbg("localStorage write failed: " + e.message);
    }

    // Render receipt
    if (receiptSection) {
      receiptSection.innerHTML = `
        <div style="background:#0a0a0a;border:2px solid #C6FF40;border-radius:8px;padding:16px;margin:16px 0;">
          <div style="color:#C6FF40;font-weight:bold;font-size:16px;margin-bottom:12px;">✓ Payment Confirmed</div>
          <div style="font-size:13px;color:#9aa0a6;line-height:1.6;">
            <div><strong style="color:#fff;">Amount:</strong> ${receipt.currency || 'USD'} ${receipt.amount || '0.00'}</div>
            <div style="margin-top:4px;"><strong style="color:#fff;">Order ID:</strong><br/><code style="font-size:11px;background:#1a1a1a;padding:2px 6px;border-radius:4px;color:#C6FF40;">${receipt.orderID || 'N/A'}</code></div>
            <div style="margin-top:4px;"><strong style="color:#fff;">Capture ID:</strong><br/><code style="font-size:11px;background:#1a1a1a;padding:2px 6px;border-radius:4px;color:#C6FF40;">${receipt.captureID || 'N/A'}</code></div>
            ${receipt.payerEmail ? `<div style="margin-top:4px;"><strong style="color:#fff;">Email:</strong> ${receipt.payerEmail}</div>` : ''}
          </div>
        </div>
      `;
    }

    // Hide payment section
    if (paymentSection) paymentSection.style.display = "none";

    // Unhide and unlock intake
    if (intakeSection) {
      intakeSection.hidden = false;
      intakeSection.classList.remove("locked");
      intakeSection.removeAttribute("aria-disabled");
    }

    // Enable all inputs
    if (intakeForm) {
      intakeForm.querySelectorAll("input,select,textarea,button").forEach(el => {
        el.disabled = false;
      });
    }

    dbg("✓ Intake unlocked");

    // AUTO-SCROLL + AUTO-FOCUS (after layout settles)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (intakeSection) {
          intakeSection.scrollIntoView({ behavior: "smooth", block: "start" });

          const first = document.getElementById("intake-first") ||
                       intakeForm?.querySelector("[required]") ||
                       intakeForm?.querySelector("input,select,textarea");

          if (first) {
            setTimeout(() => first.focus({ preventScroll: true }), 300);
          }

          dbg("✓ Auto-scrolled and focused");
        }
      });
    });
  }

  // ====== RESTORE PAID STATE ON LOAD ======
  function restorePaidStateOnLoad() {
    try {
      const stored = localStorage.getItem(RECEIPT_KEY);
      if (!stored) return;

      const receipt = JSON.parse(stored);
      if (receipt.paid && receipt.captureID && receipt.orderID) {
        dbg("Restoring paid state from localStorage");
        unlockIntakeAndOpen(receipt);
      }
    } catch(e) {
      dbg("restorePaidStateOnLoad error: " + e.message);
    }
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

  // ====== HANDLE PAYPAL REDIRECT RETURN ======
  async function handlePayPalReturn() {
    const params = new URLSearchParams(location.search);
    const token = params.get("token"); // PayPal orderID on return

    if (!token) return;

    // Check if we already have a receipt
    try {
      const stored = localStorage.getItem(RECEIPT_KEY);
      if (stored) {
        const receipt = JSON.parse(stored);
        if (receipt.paid && receipt.orderID === token) {
          dbg("Return: receipt already exists for this order");
          // Clean URL and return
          history.replaceState({}, "", location.pathname);
          return;
        }
      }
    } catch(e) {
      dbg("Return: localStorage check error: " + e.message);
    }

    // Capture the order
    dbg("Return mode: capturing orderID " + token);

    try {
      const cap = await captureOrder(token);
      const fields = extractCaptureFields(cap);

      const receipt = {
        paid: true,
        ts: new Date().toISOString(),
        orderID: token,
        ...fields,
        service: window.ORDER_STATE?.service || "",
        package: window.ORDER_STATE?.pack || "",
        addons: window.ORDER_STATE?.addons || []
      };

      unlockIntakeAndOpen(receipt);

      // Clean URL
      history.replaceState({}, "", location.pathname);

    } catch(error) {
      dbg("Return capture error: " + error.message);
      lockIntake("Payment return failed: " + error.message);

      if (payError) {
        payError.textContent = "Payment verification failed. Please contact support with Order ID: " + token;
        payError.style.display = "block";
      }
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

          const receipt = {
            paid: true,
            ts: new Date().toISOString(),
            orderID: data.orderID,
            ...fields,
            service: window.ORDER_STATE?.service || "",
            package: window.ORDER_STATE?.pack || "",
            addons: window.ORDER_STATE?.addons || []
          };

          unlockIntakeAndOpen(receipt);

        } catch(error) {
          dbg("onApprove capture error: " + error.message);
          lockIntake("Payment capture failed: " + error.message);

          if (payError) {
            payError.textContent = "Payment verification failed. Please contact support.";
            payError.style.display = "block";
          }
        }
      },

      onCancel: function(data) {
        dbg(`onCancel - orderID=${data.orderID || 'none'}`);
        lockIntake("Payment was cancelled");

        if (payBtn) {
          payBtn.disabled = false;
        }
      },

      onError: function(err) {
        dbg(`onError: ${String(err)}`);
        lockIntake("PayPal error: " + String(err));

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

    // Scroll to PayPal
    container.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Expose globally for main.js to call
  window.renderPayPalButtons = renderPayPalButtons;

  // ====== SHOW ERROR ======
  function showError(message) {
    if (payError) {
      payError.textContent = message;
      payError.style.display = "block";
    }

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

  // ====== INTAKE FORM SUBMIT ======
  function handleIntakeSubmit(e) {
    e.preventDefault();

    const formData = new FormData(intakeForm);
    const email = formData.get("email");
    const footage = formData.get("footage");
    const notes = formData.get("notes") || "None provided";

    if (!email || !footage) {
      showError("Please fill in all required fields");
      return;
    }

    // Get receipt data
    let receipt = {};
    try {
      const stored = localStorage.getItem(RECEIPT_KEY);
      if (stored) receipt = JSON.parse(stored);
    } catch(e) {}

    const totalAmount = document.getElementById("totalAmount")?.textContent || "$0.00";
    const serviceName = document.getElementById("summaryService")?.textContent || receipt.service || "N/A";
    const packageName = document.getElementById("summaryPackage")?.textContent || receipt.package || "N/A";
    const addonsText = document.getElementById("summaryAddons")?.textContent || "None";

    const emailBody = `
New Order Intake – ${serviceName}

Package: ${packageName}
Add-ons: ${addonsText}
Total Paid: ${totalAmount}
PayPal Order ID: ${receipt.orderID || 'N/A'}
PayPal Capture ID: ${receipt.captureID || 'N/A'}

Email: ${email}

Footage Links:
${footage}

Additional Notes:
${notes}

Social handles for tagging (optional):
TikTok: @short.formfactory
Instagram: @short.formfactory
YouTube: @short.formfactory

Sent from ShortFormFactory order page
    `.trim();

    const mailto = `mailto:shortformfactory.help@gmail.com?subject=${encodeURIComponent("New Order Intake – " + serviceName)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailto;
  }

  // ====== INITIALIZATION ======
  document.addEventListener('DOMContentLoaded', () => {
    dbg("paypal-checkout.js DOMContentLoaded");

    // Get DOM references
    paymentSection = document.getElementById("payment-section");
    receiptSection = document.getElementById("receipt-section");
    intakeSection = document.getElementById("intake-section");
    intakeForm = document.getElementById("intake-form");
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

    // Wire intake form submit
    if (intakeForm) {
      intakeForm.addEventListener("submit", handleIntakeSubmit);
    }

    // INITIALIZATION ORDER (per spec):
    // 1) restorePaidStateOnLoad
    // 2) handlePayPalReturn
    // 3) if not unlocked, lockIntake

    restorePaidStateOnLoad();

    // Give restore a moment to complete before checking return
    setTimeout(() => {
      if (!UNLOCKED) {
        handlePayPalReturn();
      }

      // If still not unlocked after both checks, ensure intake is locked
      setTimeout(() => {
        if (!UNLOCKED) {
          lockIntake("");
        }
      }, 100);
    }, 100);

    dbg("✓ Initialization complete");
  });

})();
