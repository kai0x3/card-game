// All sound is synthesised with WebAudio: no audio files, nothing fetched.
// A tiny pluck for playing a card, a thud for damage, a rise for healing,
// and a short arpeggio for the win. Created on the first user gesture, so
// the browser's autoplay rules are never in the way.
let context = null;
let muted = false;

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function audio() {
  if (context === null) {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

function tone(freq, when, length, type, gain) {
  const ctx = audio();
  if (ctx === null || muted) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(0.0001, ctx.currentTime + when);
  amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + when + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + length + 0.05);
}

function thud(when) {
  const ctx = audio();
  if (ctx === null || muted) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, ctx.currentTime + when);
  osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + when + 0.12);
  amp.gain.setValueAtTime(0.25, ctx.currentTime + when);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + 0.16);
  osc.connect(amp).connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + 0.2);
}

export const sfx = {
  click() {
    tone(660, 0, 0.06, 'triangle', 0.08);
  },
  play() {
    tone(392, 0, 0.09, 'triangle', 0.14);
    tone(587, 0.05, 0.12, 'triangle', 0.12);
  },
  hit() {
    thud(0);
  },
  heal() {
    tone(523, 0, 0.1, 'sine', 0.1);
    tone(784, 0.08, 0.14, 'sine', 0.1);
  },
  draw() {
    tone(880, 0, 0.05, 'sine', 0.06);
  },
  turn() {
    tone(330, 0, 0.08, 'triangle', 0.1);
    tone(440, 0.07, 0.1, 'triangle', 0.1);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.22, 'triangle', 0.14));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.13, 0.24, 'sawtooth', 0.06));
  },
};
