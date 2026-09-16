"use client";

import { useEffect, useState } from "react";

type Props = {
  value: Date | string | number;
  locale?: string;
  className?: string;
};

function LocalFormat({
  value,
  locale = "en-GB",
  className,
  options,
}: Props & { options: Intl.DateTimeFormatOptions }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const formatted = mounted
    ? new Intl.DateTimeFormat(locale, options).format(new Date(value))
    : "—";
  return (
    <time className={className} dateTime={new Date(value).toISOString()} suppressHydrationWarning>
      {formatted}
    </time>
  );
}

export function LocalDate(props: Props) {
  return (
    <LocalFormat
      {...props}
      options={{ weekday: "long", day: "numeric", month: "long" }}
    />
  );
}

export function LocalTime(props: Props) {
  return <LocalFormat {...props} options={{ hour: "2-digit", minute: "2-digit" }} />;
}

export function LocalDateTime(
  props: Props & { dateStyle?: Intl.DateTimeFormatOptions["dateStyle"]; timeStyle?: Intl.DateTimeFormatOptions["timeStyle"] },
) {
  return (
    <LocalFormat
      {...props}
      options={{ dateStyle: props.dateStyle ?? "medium", timeStyle: props.timeStyle ?? "short" }}
    />
  );
}

export function LocalShortDate(props: Props) {
  return <LocalFormat {...props} options={{ month: "short", day: "numeric" }} />;
}
