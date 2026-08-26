"use client";
export function playAwardRevealSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass(); const now = context.currentTime; const master = context.createGain(); const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.setValueAtTime(2600, now); master.gain.setValueAtTime(.0001, now); master.gain.exponentialRampToValueAtTime(.16, now + .06); master.gain.exponentialRampToValueAtTime(.0001, now + 1.34); filter.connect(master); master.connect(context.destination);
    const notes = [523.25, 659.25, 783.99, 1046.5]; notes.forEach((frequency, index) => { const oscillator = context.createOscillator(); const gain = context.createGain(); const start = now + index * .12; oscillator.type = index === 3 ? "sine" : "triangle"; oscillator.frequency.setValueAtTime(frequency, start); oscillator.detune.setValueAtTime(-5, start); oscillator.detune.linearRampToValueAtTime(5, start + .42); gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(index === 3 ? .7 : .42, start + .035); gain.gain.exponentialRampToValueAtTime(.0001, start + .68); oscillator.connect(gain); gain.connect(filter); oscillator.start(start); oscillator.stop(start + .72); });
    const bass = context.createOscillator(); const bassGain = context.createGain(); bass.type = "sine"; bass.frequency.value = 130.81; bassGain.gain.setValueAtTime(.0001, now); bassGain.gain.exponentialRampToValueAtTime(.5, now + .05); bassGain.gain.exponentialRampToValueAtTime(.0001, now + .78); bass.connect(bassGain); bassGain.connect(filter); bass.start(now); bass.stop(now + .82);
    window.setTimeout(() => void context.close(), 1500);
  } catch { /* Audio is an optional enhancement and may be blocked by the browser. */ }
}
