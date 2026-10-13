import { Crown } from "lucide-react";
import prickBadge from "@/assets/icons/prick.png";

function isPrickBadgeUser(name: string) {
  return (
    name.trim().toLocaleLowerCase().replace(/[\s_.-]/g, "") ===
    "hadirossoneri8"
  );
}

export function UserAvatar({
  name,
  avatarUrl,
  isDefendingChampion = false,
  className = "h-10 w-10",
  imageClassName = "",
}: {
  name: string;
  avatarUrl?: string | null;
  isDefendingChampion?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  const showPrickBadge = isPrickBadgeUser(name);

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-visible rounded-full bg-brand/15 font-black text-brand ${className}`}
    >
      <span className="grid h-full w-full place-items-center overflow-hidden rounded-full">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className={`h-full w-full object-cover ${imageClassName}`}
          />
        ) : (
          name.trim().slice(0, 2).toUpperCase()
        )}
      </span>
      {
        isDefendingChampion && (
          <span
            title="Defending champion"
            aria-label="Defending champion"
            className="absolute -end-1 -top-1 z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-[#101812] bg-[#e8c66a] text-[#241d08] shadow-[0_2px_10px_rgba(232,198,106,.45)]"
          >
            <Crown size={11} strokeWidth={2.8} />
          </span>
        )
      }
      {showPrickBadge && (
        <span
          title="Hadi Rossoneri badge"
          aria-label="Hadi Rossoneri badge"
          className="absolute -end-1 -bottom-1 z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-[#101812] bg-black shadow-[0_2px_10px_rgba(0,0,0,.55)]"
        >
          <img src={prickBadge.src} alt="" className="h-3.5 w-3.5 object-contain" />
        </span>
      )}
    </span>
  );
}
