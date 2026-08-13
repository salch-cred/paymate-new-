import type { NextConfig } from "next";

const securityHeaders = [
  // Sniffing protection: never let the browser guess the MIME type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking protection
  { key: "X-Frame-Options", value: "DENY" },
  // Referrer policy: never leak the full URL to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Prevent browsers from interpreting this as a cross-origin opener.
  // NOTE: must NOT be plain "same-origin" — Coinbase Wallet SDK and Base
  // Account SDK (smart wallets) require same-origin-allow-popups to
  // communicate with their native apps via popups.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Basic CSP: restrict script sources to self + inline (Next injects
  // inline scripts for hydration). Report-only so it can be tightened
  // without breaking wallet SDKs (wagmi/Privy inject dynamic scripts).
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "frame-src 'self' https:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Hide the floating Next.js DevTools "N" bubble and Issues badge in dev
  // (dev-only artifact; it overlapped the landing footer's bottom-left).
  devIndicators: false,
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Stale dev/test routes: redirect to home instead of 404. A 404 page
      // makes the Coinbase/Base SDKs' COOP check fail (they fetch the current
      // URL and log "HTTP error! status: 404" in the console).
      { source: "/clawup-test", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
