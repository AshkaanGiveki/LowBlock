"use client";
export function playAwardRevealSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass(); const now = context.currentTime; const gain = context.createGain(); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.12, now + .04); gain.gain.exponentialRampToValueAtTime(.0001, now + 1.05); gain.connect(context.destination);
    [392, 587.33, 783.99].forEach((frequency, index) => { const oscillator = context.createOscillator(); oscillator.type = index === 0 ? "sine" : "triangle"; oscillator.frequency.value = frequency; oscillator.detune.value = index * 4; oscillator.connect(gain); oscillator.start(now + index * .045); oscillator.stop(now + 1.05); });
    window.setTimeout(() => void context.close(), 1300);
  } catch { /* Audio is an optional enhancement and may be blocked by the browser. */ }
}
