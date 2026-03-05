/**
 * Sound Service — Web Audio API synth tones, no external files needed.
 * All sounds are generated procedurally so they work offline in Electron.
 */

let ctx: AudioContext | null = null
let enabled = true

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function setSoundEnabled(v: boolean): void {
  enabled = v
}

export function isSoundEnabled(): boolean {
  return enabled
}

/** Play a short beep: frequency (Hz), duration (s), volume (0-1), waveform */
function beep(
  freq: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  delay = 0
): void {
  if (!enabled) return
  try {
    const ac  = getCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)

    osc.type = type
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay)

    gain.gain.setValueAtTime(0, ac.currentTime + delay)
    gain.gain.linearRampToValueAtTime(volume, ac.currentTime + delay + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration)

    osc.start(ac.currentTime + delay)
    osc.stop(ac.currentTime + delay + duration + 0.05)
  } catch { /* AudioContext blocked, ignore */ }
}

/** Two ascending tones — LONG signal */
export function playLongSignal(): void {
  beep(523, 0.12, 0.25, 'sine', 0)       // C5
  beep(659, 0.18, 0.30, 'sine', 0.13)    // E5
  beep(784, 0.20, 0.28, 'sine', 0.28)    // G5
}

/** Two descending tones — SHORT signal */
export function playShortSignal(): void {
  beep(659, 0.12, 0.25, 'sine', 0)       // E5
  beep(523, 0.18, 0.30, 'sine', 0.13)    // C5
  beep(392, 0.20, 0.28, 'sine', 0.28)    // G4
}

/** Single soft ping — Telegram message */
export function playTelegramMessage(): void {
  beep(880, 0.08, 0.18, 'sine', 0)       // A5 ping
  beep(1108, 0.12, 0.15, 'sine', 0.09)   // C#6 harmonic
}

/** Parsed signal from Telegram — slightly more prominent */
export function playTelegramSignal(direction: 'LONG' | 'SHORT'): void {
  if (direction === 'LONG') {
    beep(659, 0.10, 0.22, 'triangle', 0)
    beep(784, 0.14, 0.25, 'triangle', 0.11)
  } else {
    beep(523, 0.10, 0.22, 'triangle', 0)
    beep(440, 0.14, 0.25, 'triangle', 0.11)
  }
}

/** Strong AI signal — full chord arpeggio */
export function playStrongAiSignal(direction: 'LONG' | 'SHORT'): void {
  if (direction === 'LONG') {
    beep(523, 0.15, 0.22, 'sine', 0)
    beep(659, 0.15, 0.22, 'sine', 0.08)
    beep(784, 0.15, 0.22, 'sine', 0.16)
    beep(1046, 0.25, 0.28, 'sine', 0.25)
  } else {
    beep(784, 0.15, 0.22, 'sine', 0)
    beep(659, 0.15, 0.22, 'sine', 0.08)
    beep(523, 0.15, 0.22, 'sine', 0.16)
    beep(392, 0.25, 0.28, 'sine', 0.25)
  }
}

/** Alert / price target hit */
export function playAlert(): void {
  beep(880, 0.08, 0.30, 'square', 0)
  beep(880, 0.08, 0.30, 'square', 0.15)
  beep(1174, 0.20, 0.35, 'square', 0.30)
}
