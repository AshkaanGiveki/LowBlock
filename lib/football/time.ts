export const IRAN_TIMEZONE="Asia/Tehran";
export function formatIranTime(value:Date|string){return new Intl.DateTimeFormat("fa-IR",{timeZone:IRAN_TIMEZONE,hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
export function formatIranDate(value:Date|string){return new Intl.DateTimeFormat("fa-IR",{timeZone:IRAN_TIMEZONE,weekday:"long",day:"numeric",month:"long"}).format(new Date(value));}
