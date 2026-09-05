export const APP_TIMEZONE = "UTC";
export function formatUtcTime(value:Date|string,locale="fa-IR"){return new Intl.DateTimeFormat(locale,{timeZone:APP_TIMEZONE,hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
export function formatUtcDate(value:Date|string,locale="fa-IR"){return new Intl.DateTimeFormat(locale,{timeZone:APP_TIMEZONE,weekday:"long",day:"numeric",month:"long"}).format(new Date(value));}
export const formatIranTime = formatUtcTime;
export const formatIranDate = formatUtcDate;
