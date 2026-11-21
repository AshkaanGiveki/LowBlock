import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminConsole } from "@/components/admin/AdminConsole";

export async function AdminGate() {
  if (!(await currentUserId())) redirect("/login?returnTo=%2F");
  const auth = await requireAdmin();
  if ("response" in auth) {
    if (auth.response?.status === 401) redirect("/login?returnTo=%2F");
    return <main className="grid min-h-screen place-items-center px-5 py-16 text-center text-white">
      <section className="max-w-lg rounded-3xl border border-white/10 bg-white/[.04] p-8">
        <p className="text-xs font-black tracking-[.2em] text-brand">LOWBLOCK ADMIN</p>
        <h1 className="mt-3 text-2xl font-black">Administrator access required</h1>
        <p className="mt-3 text-sm leading-7 text-white/60">This account is signed in, but it does not have administrator access. Sign in with an administrator account to open the console.</p>
        <a className="mt-6 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/75" href="https://lowblock.ir/">Open LowBlock</a>
      </section>
    </main>;
  }
  return <AdminConsole username={auth.user.username ?? "Admin"} />;
}
