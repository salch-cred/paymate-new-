# Hyperframes Composition Brief: PayMate

## Objective
Create a short launch-style brag video for PayMate.

## Output
- Composition directory: `brag-output-2026-08-08-085400/composition/`
- Rendered video: `brag-output-2026-08-08-085400/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `C:\Users\salma\Downloads\paymate-new-\web`
- Primary files read: `src/app/page.tsx`, `src/app/globals.css`
- Product name: PayMate
- Tagline / strongest claim: Get paid. Keep the proof.
- Key UI or visual moment to recreate: The natural language prompt card that types out the invoice request, and the live settlement trace console.
- Copy that must appear verbatim:
  - Get paid. Keep the proof.
  - Brand strategy and launch system...
  - Live Settlement Trace
  - Invoice created, Transfer submitted, Settlement verified
  - From done to paid.

## Creative Direction
- Tone preset: polished
- Creative direction: Twitter launch video with human voiceover explanation
- Interpretation: Confident pacing, premium visuals, and deliberate holds to allow the voiceover and text to breathe. Not chaotic, just smooth.
- Angle: A sleek, fast-paced product launch that highlights the real-world utility: you do the work, you get paid in USDC, and you get a verified reputation.
- Hook: The phrase "Get paid. Keep the proof." types out character-by-character over the dark, premium gradient background.
- Outro / punchline: "From done to paid." PayMate logo locks up.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #f5f3ed (paper) and #171813 (ink)
- Text: #171813
- Accent: #ff5b2e (orange) and #c9fa78 (lime)
- Display font: Trebuchet MS, sans-serif
- Body font: Noto Sans, Arial, sans-serif
- Visual references from the project: Glowing ambient backgrounds, glass-morphism panels (`.glass-heavy`), orange pulse dots, green settlement verified badges.

## Storyboard
Use the storyboard in `brag-output-2026-08-08-085400/brag-plan.md` as the creative contract.

Scene summary:
1. Scene 1 — The Hook — 4s — Text "Get paid. Keep the proof." types out.
2. Scene 2 — Intelligent Draft — 5s — Prompt card types text, then invoice preview slides in.
3. Scene 3 — Settlement Trace — 7s — Live settlement trace lights up sequentially.
4. Scene 4 — Outro — 4s — Logo lockup and final tagline.

## Audio
- Audio role: voiceover + sparse professional accents
- Audio arc: Relies on voiceover for the narrative, with UI sounds reinforcing visuals.
- Music: subtle ambient warmth (no heavy beat)
- Music treatment: low volume to let the voiceover shine, subtle fade at the end
- Music cue guidance: unavailable / none needed
- Audio-reactive treatment: none
- Audio-coupled moments:
  - Scene 1 — typing hook
  - Scene 2 — typing draft and slide-in success chime
  - Scene 3 — sequential trace checks
- SFX selection guidance: use clean UI interactions (keyboard clicks, success chimes) rather than swooshes.
- SFX analysis guidance: N/A
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: voiceover will be generated as `voiceover.wav`.

## Hyperframes Instructions
Use the current `hyperframes` skill and CLI workflow. Prefer native Hyperframes conventions.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 20 seconds.
- Voiceover will be in `assets/voiceover.wav`. Configure it on a separate track in HTML `<audio id="vo" src="assets/voiceover.wav" data-track-index="3"></audio>`.
- Run Hyperframes lint and validate before render.
