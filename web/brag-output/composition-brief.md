# Hyperframes Composition Brief: PayMate

## Objective
Create a short launch-style brag video for PayMate, optimized for winning a hackathon.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20

## Source Material
- Project root: `C:\Users\salma\.gemini\antigravity\scratch\paymate-new\web`
- Primary files read: `src/app/page.tsx`, `src/app/globals.css`, `README.md`
- Product name: PayMate
- Tagline / strongest claim: Work, settled.
- Key UI or visual moment to recreate: Live settlement trace and prompt card.
- Copy that must appear verbatim:
  - FOR TOO LONG, INDEPENDENT WORK MEANT WAITING.
  - AI DRAFTING.
  - ON-CHAIN GOAT SETTLEMENT.
  - ERC-8004 REPUTATION.
  - ZK PRIVACY.
  - AAVE YIELD.
  - AI ARBITRATION.
  - PAYMATE. WORK, SETTLED.

## Creative Direction
- Tone preset: cinematic
- Creative direction: Dramatic, trailer-scale, big motion, bigger claims. Perfect for winning a hackathon!
- Interpretation: Epic. Short declarative sentences. Full-bleed scenes, large type.
- Angle: Epic, cinematic reveal of a financial tool that treats independent work with the gravity of a blockbuster. Highlighting the God Tier hackathon features.
- Hook: FOR TOO LONG, INDEPENDENT WORK MEANT WAITING.
- Outro / punchline: PAYMATE. WORK, SETTLED.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #f5f3ed
- Text: #171813
- Accent: #ff5b2e
- Display font: var(--font-display)
- Body font: var(--font-manrope)
- Visual references from the project: Prompt card styling, live settlement trace styling, typography from globals.css.

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. The Hook — 4s — "FOR TOO LONG, INDEPENDENT WORK MEANT WAITING."
2. AI Drafting — 4s — Prompt card with "AI DRAFTING."
3. God Tier Features — 8s — God tier features slamming onto the screen sequentially.
4. The Drop — 4s — "PAYMATE. WORK, SETTLED."

## Audio
- Audio role: cinematic support
- Audio arc: A dramatic, slowly building trailer that explodes into massive, punchy impacts.
- Music: trailer-style cinematic track.
- Music treatment: slow build, massive drop on the highlights, fade out
- Music cue guidance: detect at composition via analyze_music_cues.py / hyperframes beats. Focus strong hits for Scene 3 feature slams.
- Audio-reactive treatment: subtle glow on the text responding to RMS.
- Audio-coupled moments:
  - Scene 2 — simulated typing with high-tech clicks
  - Scene 3 — beat-aligned reveals for feature slams
- SFX selection guidance: Heavy cinematic booms for the feature text entering, and high-tech UI ticks for AI Drafting.
- SFX analysis guidance: use lower high-frequency-risk sounds for repeated or polished moments
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Use the current `hyperframes` skill and CLI workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer unless audio was explicitly disabled or documented as intentionally silent.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability, scene pacing, or the product story.
- Major reveals may move toward nearby strong cues within about 0.15s. Smaller entrances may align to nearby beat points within about 0.10s. Use only 1-3 strong cue locks in a 15-25s video unless the edit clearly benefits from more.
- Use SFX to support motion and interaction: card sounds for card-like reveals, short announcement cues for major payoffs, key/click sounds for text or user actions, and restraint when the edit is already busy.
- Honor planned music treatment such as fade-outs, ducking, beat-aligned reveals, or letting a final SFX ring over the music, using the best Hyperframes-supported implementation.
- When music is present and the treatment is not `none`, consider Hyperframes audio-reactive workflow: extract audio data and use RMS/frequency bands for subtle, brand-specific motion. Good targets are glow, depth, background warmth, card presence, title emphasis, or other existing visual elements. Avoid waveform/equalizer visuals, musical-note graphics, generic particle systems, strobing, or heavy pulsing.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run Hyperframes lint and validate before render.
