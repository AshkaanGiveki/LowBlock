"use client";

let awardAudio: HTMLAudioElement | null = null;

function getAwardAudio() {
  if (!awardAudio) {
    awardAudio = new Audio("/api/awards/reveal-sound");
    awardAudio.preload = "auto";
  }
  return awardAudio;
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
