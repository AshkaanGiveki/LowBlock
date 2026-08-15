export type ScoreCategory = "EXACT_SCORE" | "CORRECT_GOAL_DIFFERENCE" | "CORRECT_OUTCOME" | "PARTICIPATION" | "NO_PREDICTION";
export function calculatePredictionScore(predictedHomeGoals:number|null, predictedAwayGoals:number|null, homeGoals:number|null, awayGoals:number|null): { points:number; category:ScoreCategory } {
 if(predictedHomeGoals===null||predictedAwayGoals===null||homeGoals===null||awayGoals===null) return {points:0,category:"NO_PREDICTION"};
 if(predictedHomeGoals===homeGoals&&predictedAwayGoals===awayGoals) return {points:10,category:"EXACT_SCORE"};
 const outcome=(h:number,a:number)=>h===a?"D":h>a?"H":"A";
 const po=outcome(predictedHomeGoals,predictedAwayGoals), ro=outcome(homeGoals,awayGoals);
 if(po===ro&&ro!=="D"&&predictedHomeGoals-predictedAwayGoals===homeGoals-awayGoals) return {points:7,category:"CORRECT_GOAL_DIFFERENCE"};
 if(po===ro) return {points:5,category:"CORRECT_OUTCOME"};
 return {points:2,category:"PARTICIPATION"};
}
