import { Crown } from "lucide-react";

export function UserAvatar({ name, avatarUrl, isDefendingChampion = false, className = "h-10 w-10", imageClassName = "" }: { name: string; avatarUrl?: string | null; isDefendingChampion?: boolean; className?: string; imageClassName?: string }) {
  const hasHadiBadge = name === "Hadirossoneri8";
  return <span className={`relative inline-grid shrink-0 place-items-center overflow-visible rounded-full bg-brand/15 font-black text-brand ${className}`}>
    <span className="grid h-full w-full place-items-center overflow-hidden rounded-full">
      {avatarUrl ? <img src={avatarUrl} alt={name} className={`h-full w-full object-cover ${imageClassName}`} /> : name.trim().slice(0, 2).toUpperCase()}
    </span>
    {hasHadiBadge ? <span title="Hadirossoneri8 badge" aria-label="Hadirossoneri8 badge" className="absolute -end-1 -top-1 z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-[#101812] bg-[#8b5e3c] text-[11px] leading-none shadow-[0_2px_10px_rgba(139,94,60,.55)]">💩</span> : isDefendingChampion && <span title="Defending champion" aria-label="Defending champion" className="absolute -end-1 -top-1 z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-[#101812] bg-[#e8c66a] text-[#241d08] shadow-[0_2px_10px_rgba(232,198,106,.45)]"><Crown size={11} strokeWidth={2.8} /></span>}
  </span>;
}
