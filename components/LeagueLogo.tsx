export function LeagueLogo({ src, className = "" }: { src: string; className?: string }) {
  return <img src={src} alt="" aria-hidden="true" className={`league-logo ${className}`} />;
}
