/**
 * NEARVIA Tactile Sound Synthesis (Web Audio API)
 * Zero-dependency, lightweight synthesized sound design for Apple-grade tactile feedback.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Plays a subtle, ultra-short mechanical tick (12ms) for keypad presses and tactile buttons.
 */
export function playMechanicalTick(volume: number = 0.08): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.012);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.012);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.012);
  } catch {
    // Autoplay or audio disabled
  }
}

/**
 * Plays a pleasant, harmonic two-tone chime for completed payments and verified receipts.
 */
export function playPaymentSuccessChime(volume: number = 0.12): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // First chime note: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime);

    gain1.gain.setValueAtTime(volume, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start();
    osc1.stop(ctx.currentTime + 0.35);

    // Second chime note: E5 (659.25 Hz) slightly delayed (90ms)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.09);

    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(volume * 1.1, ctx.currentTime + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.48);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(ctx.currentTime + 0.09);
    osc2.stop(ctx.currentTime + 0.48);
  } catch {
    // Autoplay or audio disabled
  }
}
