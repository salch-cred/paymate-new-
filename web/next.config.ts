import type { NextConfig } from "next";

const securityHeaders = [
  // Sniffing protection: never let the browser guess the MIME type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking protection
  { key: "X-Frame-Options", value: "DENY" },
  // Referrer policy: never leak the full URL to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Prevent browsers from interpreting this as a cross-origin opener
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
