// Soft, short UI sounds synthesized with the Web Audio API — no audio
// assets, no dependencies. Every call site is inside a user-gesture click
// handler (submit/approve/reject), so browser autoplay policies are never
// an issue. Never throws — a sound failure must never block the action
// it's celebrating.

let ctx = null;
function getContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

// notes: array of { freq, start, duration }, all in seconds relative to now.
function playTones(notes, peakGain = 0.15) {
  try {
    const audioCtx = getContext();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    notes.forEach(({ freq, start, duration }) => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const t0 = now + start;
      const t1 = t0 + duration;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t1);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    });
  } catch {
    // Sound is decorative — never let it break the caller.
  }
}

// Soft two-note ascending chime — contributor submission, admin approval.
export function playSuccessSound() {
  playTones([
    { freq: 587.33, start: 0,    duration: 0.16 }, // D5
    { freq: 880.00, start: 0.12, duration: 0.22 }, // A5
  ]);
}

// Softer two-note descending tone — admin rejection.
export function playWarningSound() {
  playTones([
    { freq: 523.25, start: 0,    duration: 0.16 }, // C5
    { freq: 392.00, start: 0.12, duration: 0.24 }, // G4
  ], 0.12);
}
