/**
 * PayMate Checkout — embeddable "Pay with PayMate" button.
 *
 * Merchants drop one line into their site:
 *
 *   <a href="https://paymateagent.xyz/pay/<checkoutId>"
 *      data-paymate-checkout data-amount="12.50" data-title="Pro plan">
 *     Pay with PayMate
 *   </a>
 *   <script src="https://paymateagent.xyz/paymate-checkout.js" defer></script>
 *
 * The script turns every `[data-paymate-checkout]` anchor into a styled
 * button (gold GOAT accent, dark label) that opens the hosted checkout in a
 * new tab. If the anchor is missing its href, the script falls back to
 * `data-checkout-id` to build the URL.
 */
(function () {
  "use strict";
  var BASE = "https://paymateagent.xyz";
  if (window.__paymateCheckoutLoaded) return;
  window.__paymateCheckoutLoaded = true;

  var style = document.createElement("style");
  style.textContent =
    ".paymate-checkout-btn{" +
    "display:inline-flex;align-items:center;justify-content:center;gap:8px;" +
    "padding:13px 22px;border-radius:12px;border:0;cursor:pointer;" +
    "background:#FAAD14;color:#111;font-weight:800;font-size:14px;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
    "text-decoration:none;line-height:1;box-shadow:0 10px 24px rgba(250,173,20,.28);" +
    "transition:transform .15s ease,box-shadow .15s ease;}" +
    ".paymate-checkout-btn:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(250,173,20,.38);}" +
    ".paymate-checkout-btn .pc-label{background:#111;color:#fff;padding:4px 9px;border-radius:7px;font-size:10px;letter-spacing:.05em;font-weight:700;}";
  document.head.appendChild(style);

  function mount() {
    var anchors = document.querySelectorAll("a[data-paymate-checkout]");
    anchors.forEach(function (a) {
      if (a.getAttribute("data-paymate-mounted")) return;
      a.setAttribute("data-paymate-mounted", "1");
      var href = a.getAttribute("href") || a.getAttribute("data-checkout-id");
      if (href && href.indexOf("/pay/") !== 0 && href.indexOf("http") !== 0) {
        href = BASE + "/pay/" + href;
      }
      if (href && href.indexOf("/pay/") === 0) href = BASE + href;
      if (href) a.setAttribute("href", href);
      a.classList.add("paymate-checkout-btn");
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noreferrer noopener");
      if (!a.textContent.trim()) a.textContent = "Pay with PayMate";
      var amount = a.getAttribute("data-amount");
      if (amount) {
        var badge = document.createElement("span");
        badge.className = "pc-label";
        badge.textContent = "$" + amount + " USDC";
        a.appendChild(badge);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
