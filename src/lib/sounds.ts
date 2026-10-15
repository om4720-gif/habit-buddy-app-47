// Tiny synthesized sound effects (Web Audio), so there are no audio files to load.

const KEY = "soundOn";
let audio: AudioContext | null = null;

export const isSoundOn = () => {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
};

export const setSoundOn = (on: boolean) => {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage can be unavailable (private mode) */
  }
};

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  audio ??= new AC();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

function note(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  sweepFrom?: number,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  if (sweepFrom) {
    o.frequency.setValueAtTime(sweepFrom, start);
    o.frequency.exponentialRampToValueAtTime(freq, start + 0.09);
  } else {
    o.frequency.setValueAtTime(freq, start);
  }
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
}

/** Quick "pop" with a sparkly ding: a habit got stamped. */
export function playTick() {
  if (!isSoundOn()) return;
  try {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    note(c, 880, t, 0.12, "sine", 0.18, 440);
    note(c, 1318.5, t + 0.07, 0.35, "sine", 0.12);
    note(c, 2637, t + 0.07, 0.2, "sine", 0.04);
  } catch {
    /* audio is best-effort */
  }
}

/** Rising fanfare for finishing the last habit of the day. */
export function playAllDone() {
  if (!isSoundOn()) return;
  try {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(c, f, t + i * 0.09, 0.28, "triangle", 0.16));
    [1046.5, 1318.5, 1568].forEach((f) => note(c, f, t + 0.36, 0.7, "sine", 0.08));
  } catch {
    /* audio is best-effort */
  }
}
