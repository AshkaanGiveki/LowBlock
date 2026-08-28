"use client";

let awardAudio: HTMLAudioElement | null = null;

export function playAwardRevealSound() {
  try {
    awardAudio?.pause();
    awardAudio = new Audio("/api/awards/reveal-sound");
    awardAudio.volume = 0.8;
    void awardAudio.play().catch(() => undefined);
  } catch {
    /* Audio is an optional enhancement and may be blocked by the browser. */
  }
}
