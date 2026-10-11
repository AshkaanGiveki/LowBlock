import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { isH2HEnabled } from "@/lib/domain/h2h";
import H2HBoard from "@/components/H2HBoard";

export const dynamic = "force-dynamic";

export default async function H2HPage() {
  if (!isH2HEnabled()) redirect("/club");
  if (!(await currentUserId())) redirect("/login");
  return <H2HBoard />;
}
