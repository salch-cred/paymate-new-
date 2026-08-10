# Hyperframes Composition Brief: PayMate

## Objective
Create a 40-second cinematic SaaS launch video for PayMate — a non-custodial Web3 invoicing platform. Full voiceover, full background music, orange and green brand colors throughout. This is a confident, product-first film.

## Output
- Composition directory: `brag-output-2026-08-10-154000/composition/`
- Rendered video: `brag-output-2026-08-10-154000/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 40 seconds

## Source Material
- Project root: `C:\Users\salma\Downloads\paymate-new-`
- Primary files read: `web/src/app/page.tsx`, `web/src/app/globals.css`, `web/src/app/dashboard/page.tsx`, `web/src/app/pay/[id]/page.tsx`, `README.md`
- Product name: PayMate
- Tagline: "Work, Settled."
- Strongest claim: "Describe the work in plain language. PayMate structures it into a client-ready payment request — instantly."
- Key UI moments to recreate:
  1. The dark glassmorphism invoice composer on the dashboard — form fields, the orange icon-box, the compose button
  2. The payment screen — dark left panel with "2,480.00 USDC" large display type, orange "Pay Now" button
  3. The reputation score panel — dark background, lime conic ring filling to 94/100, "+8 REPUTATION" counter
- Copy that must appear verbatim:
  - "PAID."
  - "Invoice Generated ✓"
  - "2,480.00 USDC"
  - "Payment Verified"
  - "94 / 100"
  - "ERC-8004"
  - "Work, Settled."
  - "paymateagent.xyz"

## Creative Direction
- Tone preset: `cinematic`
- Creative direction: confident SaaS launch trailer — no fluff, all product, every frame earns its place
- Interpretation: wide confident shots, big typography slams, product UI in the foreground — never abstract filler
- Angle: Replace trust with math. Show the entire lifecycle of a single $2,480 invoice in 40 seconds.
- Hook: Black screen → orange pulse-dot → "PAID." slams in white with bass hit — 3s, then hard cut to dashboard
- Outro / punchline: PayMate logo drops from above and locks center with a thud. "Work, Settled." fades below. "paymateagent.xyz" in lime. Holds 4s then fade to black.
- Avoid:
  - Generic SaaS language ("streamline your workflow")
  - Abstract color washes or filler motion graphics
  - Unrelated visual redesign — honor the PayMate brand

## Visual Identity
- Background (dark scenes): `#0a0a0a`
- Background (app scenes): `#f1efe9`
- Primary accent / brand orange: `#ff5b2e`
- Secondary accent / GOAT green: `#317454`
- Tertiary accent / lime: `#c9fa78`
- Text (dark mode): `#ffffff`
- Text (light mode): `#171813`
- Display font: Manrope — bold (700), tight letter-spacing (-.05em for headings)
- Body font: Manrope — regular/medium
- Visual references:
  - Orange pulse-dot with radial glow (rgba(255,91,46,.13)) from `.pulse-dot` 
  - Glassmorphism panels: `rgba(255,255,255,.52)` bg, `1px solid rgba(255,255,255,.8)` border, `backdrop-filter: blur(20px)`
  - Score ring: `conic-gradient(#c9fa78 0 338deg, rgba(255,255,255,.1) 338deg)` on dark `#1d1e1a` background
  - Orange CTA button: `background: #ff5b2e`, `box-shadow: 0 12px 28px rgba(255,91,46,.2)`
  - Status badge green: `background: #e7f5ec`, `color: #317454`

## Storyboard
See full storyboard in `brag-output-2026-08-10-154000/brag-plan.md`.

Scene summary:
1. Hook — 3s — "PAID." slams white on black with bass hit; orange pulse-dot
2. Invoice Composer — 9s — dashboard UI, text types live with keyboard SFX, green badge slides in
3. Payment Screen — 10s — 2,480 USDC in big display type; cursor clicks orange Pay Now; Payment Verified card rises
4. Reputation Mint — 11s — dark score panel; lime ring fills 0→94; +8 counter ticks; stats pop one by one
5. Logo Outro — 7s — black screen; PayMate logo drops with thud; "Work, Settled."; paymateagent.xyz in lime; fade to black

## Audio
- Audio role: cinematic support — driving electronic bed
- Audio arc: silence → bass impact hook → building bed during product scenes → swell at reputation → graceful fade to silence on logo
- Music: select a driving cinematic electronic / modern ambient track from Hyperframes bundled assets — confident, inevitable-sounding
- Music treatment: starts at full presence from Scene 2 (4s); ducks to 0.13 during all voiceover sections; swells at 30s (ring fill completion); fades out 37-40s
- Music cue guidance: detect at composition time via `npx hyperframes beats`; lock "PAID." bass hit to first strong beat; lock logo thud to strongest cue near 38s
- Audio-reactive treatment: subtle — orange pulse-dot opacity/glow and lime reputation ring presence breathe gently with RMS
- Audio-coupled moments:
  - Scene 1 (0-3s) — deep bass hit locked to "PAID." text arrival
  - Scene 2 (4-12s) — keyboard tap SFX per typed character (~0.06s spacing)
  - Scene 2 (12s) — clean pop SFX on badge slide-in
  - Scene 3 (22s) — click SFX on Pay Now button press
  - Scene 3 (23s) — ascending "ding" on Payment Verified card arrival
  - Scene 4 (23-33s) — short ascending electronic tone on each stat pop; subtle audio-reactive glow on ring fill
  - Scene 5 (34s) — low-frequency thud on logo lock
- SFX selection guidance: prefer low high-frequency-risk files for keyboard taps (avoid harsh clicks); use a single clean ascending ding for payment verified; use a deep thud (not sharp) for logo
- Exact SFX choice: Hyperframes chooses exact filenames based on implemented animation
- Audio files: copy chosen music to `brag-output-2026-08-10-154000/composition/assets/music/`

## Voiceover
Generate voiceover using `npx hyperframes tts` with voice `af_heart`. Wire to track-index 3 at volume 1.0. Music ducks to 0.13 for voiceover duration then returns.

Voiceover script (one line per scene):
- 4s: "Describe the work in plain language. PayMate structures it into a client-ready payment request — instantly."
- 13s: "Your client gets a secure payment link. One click. USDC settles directly to your wallet on the GOAT Network."
- 23s: "Every verified settlement builds your ERC-8004 reputation. Portable proof of your work — on-chain, forever."
- 34s: "PayMate. Work, Settled."

## Hyperframes Instructions
Use the current `hyperframes` skill and CLI workflow. Prefer native Hyperframes conventions.

Requirements:
- Show the actual PayMate dashboard UI, payment screen, and reputation panel — not abstract diagrams
- All text must be readable in the final render (hold each line to its reading floor)
- Total duration: exactly 40 seconds
- Voiceover is required — generate with `npx hyperframes tts` as specified above
- Music bed required — select from bundled assets
- At least one visual element reacts subtly to music (pulse-dot glow or ring presence)
- Major reveal "PAID." locks to first strong beat; logo thud locks to strong cue near 38s
- Sequential text (keyboard typing in Scene 2, stat pops in Scene 4) snaps to beat grid
- Run lint, validate, and inspect before render; fix all errors
- Render at high quality: `npx hyperframes render --quality high --output ../brag.mp4`
