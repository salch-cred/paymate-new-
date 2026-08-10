# Brag Plan: PayMate

## What is this app?
PayMate is a non-custodial Web3 invoicing and settlement platform that converts plain-text job descriptions into cryptographically verifiable smart invoices, settled in USDC on the GOAT Network.

## The angle
The gig economy runs on trust. PayMate replaces trust with math. In 40 seconds, we show the entire lifecycle: you describe the work → PayMate structures the invoice → client pays with one click → USDC lands in your wallet → your reputation mints on-chain. Every step is verifiable. No middlemen. No excuses.

## Hook (first 2-3 seconds)
Black screen. A single orange pulse-dot appears center frame. The word "PAID." slams in, bold, white — 0.5s hold. Then cuts instantly to the PayMate dashboard.

## Key moments (the middle)
- The invoice composer: user types "Brand system sprint - 2,480 USDC" — text types out live with keystroke sounds, then a green "Invoice generated" badge slides in from the right.
- The payment screen: the `2,480.00 USDC` amount in huge display type. The orange "Pay Now" button gets clicked. A green "Payment Verified" confirmation card pops in.
- The reputation mint: an ERC-8004 credential card animates in with score "94/100" and a glowing green ring. "+8 REPUTATION" counter ticks up.

## Outro / punchline
The PayMate logo locks to center. White tagline fades in below it: "Work, Settled." The orange pulse-dot blinks once. Cut to black.

## User flow worth showing
1. **Entry**: Invoice composer on dashboard — user types plain-text job description
2. **Key action**: Client-facing payment screen — client clicks "Pay Now" with wallet
3. **Result**: Settlement verified, USDC in wallet, ERC-8004 reputation minted

## Tone
- Preset: `cinematic`
- Creative direction: confident SaaS launch trailer — no fluff, all product
- Interpretation: Wide, confident shots. Big typography. Every frame earns its place. Pace is fast but never rushed.

## Format: landscape — 1920x1080
## Duration: 40 seconds

## Visual identity (from the project)
- Background: `#f1efe9` (site) / `#0a0a0a` for cinematic dark scenes
- Primary accent: `#ff5b2e` (orange — `var(--orange)`)
- Secondary accent: `#317454` (green — GOAT Network brand color)
- Tertiary: `#c9fa78` (lime — `var(--lime)`)
- Text: `#171813` (`var(--ink)`) / white on dark scenes
- Display font: Manrope (bold, tight letter-spacing -.05em)
- Body font: Manrope
- Strongest visual elements: the glassmorphism invoice preview window, the orange CTA button, the dark reputation score panel with lime ring

## Share copy (draft)
PayMate is live. Describe the work, send the link, get paid — cryptographically verified on the GOAT Network.

## Audio direction
- Role: cinematic support — big, confident, energetic
- Music: driving electronic/ambient cinematic track with a strong low-end pulse and clean melodic overlay — the kind of track that makes a product feel inevitable
- Music treatment: starts at 0 with full presence, slight swell at the reputation mint scene (30s), fades with the logo landing (38-40s)
- Music cue guidance: detect at composition time via `npx hyperframes beats`; lock the "PAID." hook to the first strong beat; lock the PayMate logo landing to the strongest cue near 38s
- Audio-reactive treatment: subtle — the orange pulse-dot and the green reputation ring should breathe gently with the music's RMS
- SFX posture: moderate, motion-matched; professional restraint
- Audio-coupled moments:
  - Scene 2 (invoice typing) — keyboard tap sounds fire with each character appearance
  - Scene 3 (payment) — a clean, confident "ding" confirmation sound on payment verified
  - Scene 4 (reputation) — a short electronic ascending tone on the +8 counter
  - Scene 5 (logo) — single dry low-frequency "thud" on logo lock
- Restraint rule: music must never overpower the voiceover; duck to 0.13 during the VO, return to full after

## Voiceover script
Scene 1 (hook, 0-3s): [SILENCE — let the visual speak]
Scene 2 (composer, 4-12s): "Describe the work in plain language. PayMate structures it into a client-ready payment request — instantly."
Scene 3 (payment, 13-22s): "Your client gets a secure payment link. One click. USDC settles directly to your wallet on the GOAT Network."
Scene 4 (reputation, 23-33s): "Every verified settlement builds your ERC-8004 reputation. Portable proof of your work — on-chain, forever."
Scene 5 (logo, 34-40s): "PayMate. Work, Settled."

---

## Storyboard

### Scene 1 — Hook — 3s
Black screen. Center frame: a single, glowing orange pulse-dot appears (0.2s). The word "PAID." slams in — massive white display type, 95% screen width — with a heavy bass hit. Holds for 1.2s. Hard cut.
Sequential/interaction: none
Audio intent: impact — the viewer leans forward
Audio-coupled idea: bass hit on "PAID." lock
Music: none yet — silence then the first beat fires
Transition mood: hard → Scene 2

### Scene 2 — Invoice Composer — 9s
The PayMate dashboard slides up from below. The app shell is visible — sidebar with brand mark, the invoice composer form is centered. Text types character by character: "Brand system sprint — 2,480 USDC". After the last character, a green animated badge slides from the right edge: "Invoice Generated ✓". The orange icon-box glows subtly.
Sequential/interaction: yes — text types live with keyboard sounds; badge slides in after last character
Audio intent: productive, building energy — the tool is working
Audio-coupled idea: keyboard tap SFX per character (spaced ~0.06s), clean pop on badge arrival
Music: driving electronic bed, low presence during VO
Transition mood: clean slide → Scene 3

### Scene 3 — Payment Screen — 10s
Cut to the payment-aside dark panel on the left + payment-card on the right. The amount "2,480.00 USDC" is in huge display type (50px). The "GOAT Network" badge pulses green. A simulated cursor moves to the orange "Pay Now" button and clicks it. The button depresses. A green "Payment Verified" card animates in from below with a checkmark icon. A small "0x8F2A…E19C" hash fades in below it.
Sequential/interaction: yes — cursor moves, button clicks, verified card rises from bottom
Audio intent: decisive, satisfying — the transaction is done
Audio-coupled idea: short click SFX on button press; clean ascending "ding" on verified card arrival
Music: swells slightly on verified card
Transition mood: soft crossfade → Scene 4

### Scene 4 — Reputation Mint — 11s
The dark score-panel from the dashboard slides in. The score ring (dark background, lime conic gradient at 338deg) animates: the ring fills from 0° to 338°, number counts from 0 to 94. The "+8 REPUTATION" label ticks up digit by digit in orange. Two mini-stats appear one by one below: "Total Earned: $12,840" and "Jobs: 23". The green ERC-8004 credential tag pulses at the bottom.
Sequential/interaction: yes — ring fills, number counts, stats pop in one by one with the beat
Audio intent: achievement — this is what makes PayMate different
Audio-coupled idea: short ascending electronic tone on each stat arrival; subtle audio-reactive glow on ring
Music: strongest music moment — align the ring-fill completion to a strong beat cue
Transition mood: dramatic wipe → Scene 5

### Scene 5 — Logo + Outro — 7s
Pure black background. The PayMate brand mark (orange square, "P" letter-mark) drops from above and locks center with a deep thud SFX. "PayMate" in white Manrope display type fades in at 34px, letter-spacing -.05em. "Work, Settled." in smaller weight fades beneath it. "paymateagent.xyz" in 12px lime appears below the tagline. The orange pulse-dot blinks once on the right of the URL. Holds 4s. Fade to black.
Sequential/interaction: none — confident hold
Audio intent: landed — this is the final statement
Audio-coupled idea: thud on logo lock; music fades to silence over the final 3s
Music: fading out from 37s to 40s
Transition mood: fade to black

**Music mood for this video:** driving cinematic electronic — confident, modern, inevitable
**Audio summary:** Silence to impact for the hook, then a driving bed builds through the invoice and payment scenes, swells on the reputation mint, and gracefully fades as the logo holds to silence.
