"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { friendlyError } from "@/lib/userErrors";

export function ClubLifecycleActions({ clubId, memberCount, isOwner }: { clubId: string; memberCount: number; isOwner: boolean }) {
  const { t } = useLanguage(); const { showToast } = useToast(); const router = useRouter(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  async function closeClub() { setBusy(true); const response = await fetch(`/api/clubs/${clubId}`, { method: "DELETE" }); const data = await response.json().catch(() => ({})); setBusy(false); if (!response.ok) { showToast(friendlyError(data.error, t)); return; } router.replace("/club"); }
  if (!isOwner || memberCount > 1) return null;
  return <><section className="mt-4 rounded-[1.75rem] border border-red-300/15 bg-red-950/10 p-5 sm:p-7"><div className="flex items-center gap-2 text-red-200"><Trash2 size={18}/><h2 className="font-black">{t("بستن باشگاه خالی", "Close an empty Club")}</h2></div><p className="mt-2 text-sm leading-7 text-white/50">{t("اگر این باشگاه را فقط برای امتحان ساخته‌اید، می‌توانید آن را ببندید و بعد به باشگاه دیگری بپیوندید یا باشگاه تازه‌ای بسازید.", "If you created this Club just to try it, you can close it and then join another Club or create a new one.")}</p><button type="button" disabled={busy} onClick={() => setOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm font-black text-red-200 hover:bg-red-400/15 disabled:opacity-50"><Trash2 size={16}/>{t("بستن باشگاه خالی", "Close empty Club")}</button></section><ConfirmModal open={open} title={t("باشگاه بسته شود؟", "Close this Club?")} description={t("باشگاه خالی حذف می‌شود و شما دوباره می‌توانید مسیر عضویت یا ساخت باشگاه را انتخاب کنید.", "Your empty Club will be removed so you can choose to join or create a Club again.")} confirmLabel={t("بستن باشگاه", "Close Club")} cancelLabel={t("انصراف", "Cancel")} onConfirm={closeClub} onCancel={() => setOpen(false)} danger/></>;
}
