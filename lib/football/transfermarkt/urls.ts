import { env } from "@/lib/env"; import { getLeague } from "@/lib/football/leagues";
export function competitionUrl(code:string){const l=getLeague(code);if(!l)throw new Error("Unknown competition");return `${env.TRANSFERMARKT_BASE_URL}/${l.slug}/startseite/wettbewerb/${code}`;}
export function scheduleUrl(code:string,season:number){const l=getLeague(code);if(!l)throw new Error("Unknown competition");return `${env.TRANSFERMARKT_BASE_URL}/${l.slug}/gesamtspielplan/wettbewerb/${code}/saison_id/${season}`;}
export function matchdayUrl(code:string,season:number,matchday:number){const l=getLeague(code);if(!l)throw new Error("Unknown competition");return `${env.TRANSFERMARKT_BASE_URL}/${l.slug}/spieltag/wettbewerb/${code}/saison_id/${season}/spieltag/${matchday}`;}
