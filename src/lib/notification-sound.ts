// A tiny synthesized "ding" for new-message alerts. Uses the Web Audio API so
// there's no audio asset to ship or 404 on. Browsers block audio until the user
// interacts with the page, so call primeNotificationSound() from a click/toggle
// to unlock it.

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    return audioContext;
  } catch {
    return null;
  }
}

/** Unlock audio on a user gesture (call from the mute toggle when enabling). */
export function primeNotificationSound(): void {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** Play a short two-tone chime. Safe to call repeatedly; no-op if unavailable. */
export function playNotificationSound(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const tones = [
    { freq: 880, start: 0, dur: 0.12 },
    { freq: 1175, start: 0.1, dur: 0.16 },
  ];
  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = t.freq;
    gain.gain.setValueAtTime(0.0001, now + t.start);
    gain.gain.exponentialRampToValueAtTime(0.18, now + t.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.dur + 0.02);
  }
}
