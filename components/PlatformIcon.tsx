export function PlatformIcon({ provider, className = "h-5 w-5" }: { provider: "telegram" | "bale"; className?: string }) {
  if (provider === "telegram") return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor"><path d="M21.6 3.4 18.3 20c-.25 1.18-.91 1.47-1.85.92l-5.1-3.76-2.46 2.37c-.27.27-.5.5-1.02.5l.36-5.2 9.46-8.55c.41-.36-.09-.56-.64-.2L5.36 13.5.29 11.92c-1.1-.35-1.12-1.1.23-1.6L20.3 2.66c.92-.34 1.72.2 1.3.74Z" /></svg>;
  return <img src="/bale-logo.png" alt="" aria-hidden="true" className={`${className} object-contain`} draggable={false} />;
}
