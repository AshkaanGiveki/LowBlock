import Image from "next/image";

export function LeagueLogo({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={64}
      height={64}
      sizes="64px"
      className={`league-logo ${className}`}
    />
  );
}
