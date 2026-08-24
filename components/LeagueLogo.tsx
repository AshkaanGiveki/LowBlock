import type { CSSProperties } from "react";

export function LeagueLogo({ src, className = "" }: { src: string; className?: string }) {
  const style = { "--league-logo-image": `url("${src}")` } as CSSProperties;
  return <span aria-hidden="true" className={`league-logo-mark ${className}`} style={style} />;
}
