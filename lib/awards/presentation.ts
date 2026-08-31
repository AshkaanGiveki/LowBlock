import { CLUB_LEAGUE_WINNER_TYPE, CLUB_MONTHLY_EXACT_WINNER_TYPE, CLUB_ROUND_WINNER_TYPE, CLUB_WEEKLY_WINNER_TYPE, GLOBAL_WINNER_TYPE, LEAGUE_WINNER_TYPE, MONTHLY_EXACT_WINNER_TYPE, ROUND_WINNER_TYPE, WEEKLY_WINNER_TYPE } from "@/lib/awards/config";

export function getAwardLabel(type: string | undefined, language: "fa" | "en") {
  const labels: Record<string, [string, string]> = {
    [CLUB_WEEKLY_WINNER_TYPE]: ["برنده هفتگی باشگاه", "CLUB WEEKLY WINNER"],
    [WEEKLY_WINNER_TYPE]: ["برنده هفتگی جهانی", "GLOBAL WEEKLY WINNER"],
    [CLUB_ROUND_WINNER_TYPE]: ["برنده دور باشگاه", "CLUB ROUND WINNER"],
    [ROUND_WINNER_TYPE]: ["برنده دور جهانی", "GLOBAL ROUND WINNER"],
    [CLUB_MONTHLY_EXACT_WINNER_TYPE]: ["پیش‌بینی‌گر دقیق ماه باشگاه", "CLUB EXACT PICKER OF THE MONTH"],
    [MONTHLY_EXACT_WINNER_TYPE]: ["پیش‌بینی‌گر دقیق ماه جهانی", "GLOBAL EXACT PICKER OF THE MONTH"],
    [CLUB_LEAGUE_WINNER_TYPE]: ["قهرمان لیگ باشگاه", "CLUB LEAGUE WINNER"],
    [LEAGUE_WINNER_TYPE]: ["قهرمان لیگ جهانی", "GLOBAL LEAGUE WINNER"],
    [GLOBAL_WINNER_TYPE]: ["قهرمان لیگ جهانی", "GLOBAL LEAGUE WINNER"],
  };
  const [fa, en] = labels[type ?? ""] ?? ["جایزه", "AWARD"];
  return language === "fa" ? fa : en;
}

export function getAwardPeriod(award: { type?: string; roundNumber?: number; periodId?: string }, language: "fa" | "en") {
  if (award.type === WEEKLY_WINNER_TYPE || award.type === CLUB_WEEKLY_WINNER_TYPE) return language === "fa" ? "هفته جاری" : "WEEKLY";
  if (award.type === MONTHLY_EXACT_WINNER_TYPE || award.type === CLUB_MONTHLY_EXACT_WINNER_TYPE) return award.periodId ?? (language === "fa" ? "ماهانه" : "MONTHLY");
  if (award.roundNumber) return language === "fa" ? `راند ${award.roundNumber}` : `MD${String(award.roundNumber).padStart(2, "0")}`;
  return language === "fa" ? "فصل" : "SEASON";
}
