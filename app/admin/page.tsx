import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await currentUserId())) redirect("/login?returnTo=%2Fadmin");
  const auth = await requireAdmin();
  if ("response" in auth) redirect("/");
  return <AdminConsole username={auth.user.username ?? "Admin"} />;
}
