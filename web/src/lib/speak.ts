/**
 * speak.ts — browser text-to-speech for the Voice AI Agent.
 *
 * Picks the best available English voice (preferring Google / natural-sounding
 * voices) instead of whatever the OS default is, guards against Chrome's async
 * voice loading, and works around the known Chrome stall where long utterances
 * pause after ~15 seconds.
 */

function refreshVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return []
  return window.speechSynthesis.getVoices()
}

// Prime voice loading immediately — Chrome only populates getVoices() after a
// call + the voiceschanged event, so without this the first click can hit an
// empty list and fall back to a silent/robotic default.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    refreshVoices()
  }
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase()
  const lang = v.lang.toLowerCase()
  let score = 0
  if (lang.startsWith("en")) score += 20
  if (name.includes("google")) score += 15
  if (/natural|neural|premium|online|enhanced/.test(name)) score += 10
  if (/en[-_]us/.test(lang)) score += 8
  // Known pleasant English voices across platforms
  if (
    /samantha|karen|daniel|aria|jenny|guy|zira|david|mark|libby|sonia|joanna|matthew|salli|joey|kimberly|kendra|ivy|ruth|kevin|brian|amy|emma|oliver|ava|isabella|james|george/.test(
      name
    )
  )
    score += 8
  if (v.default) score += 2
  return score
}

export function pickBestVoice(): SpeechSynthesisVoice | null {
  const voices = refreshVoices()
  if (voices.length === 0) return null
  let best = voices[0]
  let bestScore = -1
  for (const v of voices) {
    const s = scoreVoice(v)
    if (s > bestScore) {
      bestScore = s
      best = v
    }
  }
  return best
}

export function speakText(text: string, opts?: { rate?: number; pitch?: number }): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false
  const synth = window.speechSynthesis
  synth.cancel() // never queue a stale reply behind a new one
  const utter = new SpeechSynthesisUtterance(text)
  const voice = pickBestVoice()
  if (voice) utter.voice = voice
  utter.rate = opts?.rate ?? 1
  utter.pitch = opts?.pitch ?? 1
  utter.volume = 1
  // Chrome quirk: long utterances can pause mid-way; nudge them along.
  const keepAlive = setInterval(() => {
    if (synth.speaking && !synth.paused) synth.resume()
  }, 10_000)
  utter.onend = () => clearInterval(keepAlive)
  utter.onerror = () => clearInterval(keepAlive)
  synth.speak(utter)
  return true
}
