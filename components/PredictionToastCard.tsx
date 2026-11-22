"use client";

import { Check } from "lucide-react";
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
      <div className="lowblock-prediction-toast__eyebrow">
        <span className="lowblock-prediction-toast__eyebrow-mark">
          <Check size={12} strokeWidth={3} />
        </span>
        <span>{fa ? "انتخاب شما" : "YOUR PICK"}</span>
        <span className="lowblock-prediction-toast__dot" />
        <span className="lowblock-prediction-toast__state">
          {updated ? (fa ? "به‌روزرسانی شد" : "UPDATED") : fa ? "ذخیره شد" : "SAVED"}
        </span>
      </div>

      <div className="lowblock-prediction-toast__match" dir="ltr">
        <div className="lowblock-prediction-toast__team">
          <TeamCrest name={homeName} logo={homeLogo} className="lowblock-prediction-toast__crest" />
          <span dir="auto">{homeName}</span>
        </div>
        <div className="lowblock-prediction-toast__score" aria-label={`${homeGoals} ${fa ? "در برابر" : "against"} ${awayGoals}`}>
          <strong>{homeGoals}</strong>
          <span>–</span>
          <strong>{awayGoals}</strong>
        </div>
        <div className="lowblock-prediction-toast__team lowblock-prediction-toast__team--away">
          <TeamCrest name={awayName} logo={awayLogo} className="lowblock-prediction-toast__crest" />
          <span dir="auto">{awayName}</span>
        </div>
      </div>

      <p className="lowblock-prediction-toast__hint">
        {fa ? "پیش‌بینی شما برای این مسابقه ثبت شد" : "Your score prediction is locked in"}
      </p>
    </div>
  );
}
