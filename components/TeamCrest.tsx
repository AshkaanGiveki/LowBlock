"use client";

import { useState, useEffect } from "react";

export function TeamCrest({
  name,
  logo,
  className = "",
}: {
  name: string;
  logo?: string | null;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [logo]);

  return logo && !imgError ? (
    <img
      src={logo}
      alt={name}
      onError={() => setImgError(true)}
      className={`h-12 w-12 object-contain ${className}`}
    />
  ) : (
    <span
      className={`grid h-12 w-12 place-items-center rounded-2xl bg-brand-subtle text-sm font-black text-brand ${className}`}
    >
      {name ? name.slice(0, 2).toUpperCase() : "⚽"}
    </span>
  );
}
