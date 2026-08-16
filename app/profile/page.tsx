"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LogOut, Save, UserRound } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { ConnectedAccounts } from "@/components/ConnectedAccounts";

type User = { username: string; avatarUrl: string | null };

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [rawImage, setRawImage] = useState("");
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.json()).then((data) => {
      if (!data.user) return router.replace("/login");
      setUser(data.user);
      setAvatarUrl(data.user.avatarUrl ?? "");
    });
  }, [router]);

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2_000_000) return setMessage("Use a PNG, JPEG, or WebP image under 2 MB");
    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(String(reader.result));
      setAvatarUrl(String(reader.result));
      setCropX(50);
      setCropY(50);
      setZoom(1);
    };
    reader.readAsDataURL(file);
  }

  async function cropImage() {
    if (!rawImage) return avatarUrl;
    return new Promise<string>((resolve) => {
      const image = new Image();
      image.onload = () => {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d")!;
        const scale = Math.max(size / image.width, size / image.height) * zoom;
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) * cropX / 100, (size - height) * cropY / 100, width, height);
        resolve(canvas.toDataURL("image/jpeg", .9));
      };
      image.src = rawImage;
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const cropped = await cropImage();
    const response = await fetch("/api/auth/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ avatarData: cropped, password }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(data.error ?? "Could not save your profile");
    setPassword("");
    setRawImage("");
    setAvatarUrl(data.user.avatarUrl ?? cropped);
    setUser(data.user);
    window.dispatchEvent(new Event("lowblock-profile-updated"));
    setMessage(t("پروفایل شما به‌روز شد.", "Profile updated."));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return <main className="min-h-screen px-5 pb-28 pt-24 md:px-8 md:pt-32">
    <div className="mx-auto max-w-2xl">
      <section className="rounded-2xl border border-white/[.1] bg-[linear-gradient(135deg,#18231e,#0c100e)] p-6 md:p-8">
        <p className="text-xs font-black tracking-[.18em] text-brand">{t("حساب کاربری", "ACCOUNT SETTINGS")}</p>
        <h1 className="mt-2 text-3xl font-black">{t("پروفایل شما", "Your profile")}</h1>
      </section>

      <ConnectedAccounts/>

      <form onSubmit={save} className="mt-4 rounded-2xl border border-white/[.08] bg-[#101512] p-5 md:p-7">
        <div className="mb-7 flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-brand/30 bg-brand/10 text-brand">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover"/> : <UserRound size={26}/>}</div>
          <div><b>{user?.username ?? "…"}</b><p className="mt-1 text-xs text-[var(--muted)]">{t("عکس انتخابی شما", "Your selected photo")}</p></div>
        </div>
        <label className="block text-sm font-bold text-[var(--muted)]">{t("نام کاربری (قابل تغییر نیست)", "Username (cannot be changed)")}<input value={user?.username ?? ""} readOnly className="mt-2 w-full cursor-not-allowed rounded-lg border border-white/10 bg-black/10 px-3.5 py-3 text-white/60"/></label>
        <label className="mt-4 block text-sm font-bold"><span className="flex items-center gap-2"><Camera size={15}/>{t("عکس پروفایل", "Profile image")}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} className="mt-2 block w-full rounded-lg border border-dashed border-white/20 bg-black/20 px-3 py-2.5 text-sm text-[var(--muted)] file:mr-3 file:rounded-md file:border-0 file:bg-brand/15 file:px-3 file:py-1.5 file:font-bold file:text-brand"/></label>
        {rawImage && <div className="mt-4 rounded-xl border border-brand/20 bg-black/20 p-4">
          <p className="mb-3 text-xs font-bold text-brand">{t("قسمتی را که می‌خواهید انتخاب کنید", "Adjust your avatar crop")}</p>
          <div className="mx-auto h-40 w-40 overflow-hidden rounded-full border-2 border-brand/50"><img src={rawImage} alt="Crop preview" className="h-full w-full object-cover" style={{ objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${zoom})` }}/></div>
          <label className="mt-3 block text-xs text-[var(--muted)]">{t("افقی", "Horizontal")}<input type="range" min="0" max="100" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} className="w-full"/></label>
          <label className="mt-2 block text-xs text-[var(--muted)]">{t("عمودی", "Vertical")}<input type="range" min="0" max="100" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} className="w-full"/></label>
          <label className="mt-2 block text-xs text-[var(--muted)]">{t("بزرگ‌نمایی", "Zoom")}<input type="range" min="1" max="3" step=".05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full"/></label>
        </div>}
        <label className="mt-4 block text-sm font-bold">{t("رمز عبور جدید", "New password")}<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("برای حفظ رمز فعلی، خالی بگذارید", "Leave blank to keep current")} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3.5 py-3 text-white"/></label>
        {message && <p className="mt-4 rounded-lg bg-brand/10 p-3 text-sm text-brand">{message}</p>}
        <div className="mt-6 flex flex-wrap gap-3"><button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-black text-white"><Save size={16}/>{busy ? "…" : t("ذخیره تغییرات", "Save changes")}</button><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 px-4 py-3 text-sm font-black text-red-300"><LogOut size={16}/>{t("خروج", "Log out")}</button></div>
      </form>
    </div>
  </main>;
}
