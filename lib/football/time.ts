export const IRAN_TIMEZONE="Asia/Tehran";
export function formatIranTime(value:Date|string,locale="fa-IR"){return new Intl.DateTimeFormat(locale,{timeZone:IRAN_TIMEZONE,hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
export function formatIranDate(value:Date|string,locale="fa-IR"){return new Intl.DateTimeFormat(locale,{timeZone:IRAN_TIMEZONE,weekday:"long",day:"numeric",month:"long"}).format(new Date(value));}
