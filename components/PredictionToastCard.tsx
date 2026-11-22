"use client";

import { Check, LockKeyhole, Sparkles } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";

type PredictionToastCardProps = {
  homeName: string;
  awayName: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeGoals: number;
  awayGoals: number;
  language: "fa" | "en";
  updated: boolean;
};

export function PredictionToastCard({
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  homeGoals,
  awayGoals,
  language,
  updated,
}: PredictionToastCardProps) {
  const fa = language === "fa";
  return (
    <div className="lowblock-prediction-toast" dir={fa ? "rtl" : "ltr"}>
      <div className="lowblock-prediction-toast__ticket-head">
        <div className="lowblock-prediction-toast__brand-lockup">
          <span className="lowblock-prediction-toast__brand-mark">
            <Sparkles size={13} strokeWidth={2.8} />
          </span>
          <span className="lowblock-prediction-toast__brand-name">LOWBLOCK</span>
        </div>
        <span className="lowblock-prediction-toast__ticket-status">
          <Check size={12} strokeWidth={3} />
          {updated ? (fa ? "به‌روز شد" : "UPDATED") : fa ? "ثبت شد" : "SAVED"}
        </span>
      </div>

      <div className="lowblock-prediction-toast__match-label">
        <span>{fa ? "پیش‌بینی شما" : "YOUR PREDICTION"}</span>
        <span className="lowblock-prediction-toast__match-label-line" />
        <span>{fa ? "نتیجه دقیق" : "EXACT SCORE"}</span>
      </div>

      <div className="lowblock-prediction-toast__fixture" dir="ltr">
        <div className="lowblock-prediction-toast__team-card">
          <TeamCrest name={homeName} logo={homeLogo} className="lowblock-prediction-toast__crest" />
          <span dir="auto">{homeName}</span>
        </div>
        <div className="lowblock-prediction-toast__score-lockup" aria-label={`${homeGoals} ${fa ? "در برابر" : "against"} ${awayGoals}`}>
          <div className="lowblock-prediction-toast__score">
            <strong>{homeGoals}</strong>
            <span>–</span>
            <strong>{awayGoals}</strong>
          </div>
          <span className="lowblock-prediction-toast__score-caption">
            <LockKeyhole size={10} /> {fa ? "قفل شد" : "LOCKED IN"}
          </span>
        </div>
        <div className="lowblock-prediction-toast__team-card">
          <TeamCrest name={awayName} logo={awayLogo} className="lowblock-prediction-toast__crest" />
          <span dir="auto">{awayName}</span>
        </div>
      </div>

      <div className="lowblock-prediction-toast__ticket-foot">
        <span>{fa ? "امتیاز شما از این انتخاب ثبت می‌شود" : "This pick now counts toward your score"}</span>
        <span className="lowblock-prediction-toast__ticket-check"><Check size={11} strokeWidth={3} /></span>
      </div>
    </div>
  );
}
