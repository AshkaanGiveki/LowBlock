import { getDb, closeMongo } from "/app/lib/db/mongo";
import { calibrateH2HTeamRatings, type ResultMatch, type TeamRatingInput } from "@/lib/domain/h2hTeamStrength";
const BASE_FACTOR: Record<string,number>={UCL:1.2,GB1:1.18,ES1:1.16,IT1:1.14,L1:1.12,UEL:1.12,WC_U17:1.08,FR1:1.10,TR1:1.07,GB2:1.05,IR1:1.04};
const score=(r1:number,r2:number,code:string)=>Math.round(
 (0.55*(r1+r2)/2+0.30*Math.min(r1,r2)+0.15*(100-Math.abs(r1-r2)))*
 (1+((BASE_FACTOR[code]??1)-1)*0.3)*100)/100;
async function main(){
 const db=await getDb();
 try{
  const [teams,matches]=await Promise.all([
   db.collection<any>("centralTeams").find({},{projection:{centralTeamId:1,names:1,h2hRating:1,
      h2hRatingVersion:1,h2hLegacyRating:1,currentLeagueCodes:1,isNational:1}}).toArray(),
   db.collection<any>("matches").find({kickoffAt:{$gte:new Date(Date.now()-365*86400000)}},
     {projection:{providerMatchId:1,leagueCode:1,homeGoals:1,awayGoals:1,status:1,
       kickoffAt:1,duplicateOf:1,homeTeam:1,awayTeam:1}}).toArray(),
  ]);
  const calibrated=calibrateH2HTeamRatings(teams as TeamRatingInput[],matches as ResultMatch[],new Date());
  const byId=new Map(calibrated.map(x=>[x.centralTeamId,x]));
  const prevById=new Map(teams.map(t=>[String(t.centralTeamId),Number(t.h2hRating??0)]));
  const names=new Map(teams.map(t=>[String(t.centralTeamId),t.names?.en??t.names?.fa??"unknown"]));
  const rated=calibrated.map(x=>x.rating).sort((a,b)=>a-b);
  const pct=(q:number)=>rated[Math.floor(q*(rated.length-1))];
  const sample=calibrated.filter(x=>/Real Madrid|Chelsea|Stade Brestois|Paris FC|Bologna|Werder Bremen|Nottingham Forest|Bayern|Torreense|Celtic|Juventus|Omonia/i.test(names.get(x.centralTeamId)??"")).map(x=>({
    team:names.get(x.centralTeamId),previous:prevById.get(x.centralTeamId),new:x.rating,
    confidence:x.confidence,played:x.matchesUsed,prior:x.prior,
  })).slice(0,35);
  console.log("STRENGTH_PREVIEW="+JSON.stringify({
    total:teams.length,rated:calibrated.length,
    zeroEvidence:calibrated.filter(x=>x.matchesUsed===0).length,
    hasLegacy:calibrated.filter(x=>x.legacyRating!==null).length,
    distribution:{min:pct(0),p10:pct(.1),p25:pct(.25),median:pct(.5),p75:pct(.75),p90:pct(.9),max:pct(1)},
    samples:sample,
  }));
  for (const date of ["2026-11-27","2026-11-28"]) {
   const rows=matches.filter(m=>String(m.status)==="SCHEDULED" && !m.duplicateOf &&
     new Date(m.kickoffAt).toISOString().slice(0,10)===date &&
     ["GB1","ES1","IT1","L1","FR1","UEL","UCL","GB2","WC_U17","TR1","IR1"].includes(String(m.leagueCode)));
   const pairs=rows.map(m=>{
    const a=String(m.homeTeam?.centralTeamId??""),b=String(m.awayTeam?.centralTeamId??"");
    const hr=byId.get(a)?.rating??51,ar=byId.get(b)?.rating??51;
    const prevH=prevById.get(a)??0,prevA=prevById.get(b)??0;
    return {matchId:m.providerMatchId,home:m.homeTeam?.name,away:m.awayTeam?.name,league:m.leagueCode,
      kickoff:m.kickoffAt,oldScore:Math.round((prevH+prevA)*(BASE_FACTOR[String(m.leagueCode)]??1)*100)/100,
      newScore:score(hr,ar,String(m.leagueCode)),hr,ar,
      evidence:[byId.get(a)?.matchesUsed??0,byId.get(b)?.matchesUsed??0]};
   }).sort((a,b)=>b.newScore-a.newScore);
   console.log("STRENGTH_MATCH_CANDIDATES_"+date+"="+JSON.stringify(pairs.slice(0,20)));
  }
 }finally{await closeMongo();}
}
main().catch(e=>{console.error("STRENGTH_PREVIEW_FAILED",e instanceof Error?e.message:String(e));process.exitCode=1});
