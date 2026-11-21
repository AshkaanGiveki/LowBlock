import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminMatchPage } from "@/components/admin/AdminMatchPage";

export const dynamic = "force-dynamic";

export default async function AdminMatchRoute({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  if (!(await currentUserId())) redirect(`/login?returnTo=${encodeURIComponent(`/admin/matches/${matchId}`)}`);
  const auth = await requireAdmin();
  if ("response" in auth) redirect("/login");
  return <AdminMatchPage matchId={matchId} username={auth.user.username ?? "Admin"} />;
}
