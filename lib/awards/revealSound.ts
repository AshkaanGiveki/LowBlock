"use client";

let awardAudio: HTMLAudioElement | null = null;

function getAwardAudio() {
  if (!awardAudio) {
    awardAudio = new Audio("/api/awards/reveal-sound");
    awardAudio.preload = "auto";
  }
  return awardAudio;
}

export function prepareAwardRevealSound() {
  const unlock = () => {
    const audio = getAwardAudio();
    audio.muted = true;
    void audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; }).catch(() => undefined);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
}

export function playAwardRevealSound() {
  try {
    const audio = getAwardAudio();
    audio.currentTime = 0;
    audio.muted = false;
    return audio.play().then(() => true).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}
