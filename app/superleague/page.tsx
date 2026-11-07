import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { isH2HEnabled } from "@/lib/domain/h2h";
import SuperLeagueBoard from "@/components/SuperLeagueBoard";
import SuperLeagueLoading from "./loading";

export const dynamic = "force-dynamic";

async function SuperLeagueData() {
  if (!(await currentUserId())) redirect("/login");
  return <SuperLeagueBoard />;
}

export default function SuperLeaguePage() {
  if (!isH2HEnabled()) redirect("/club");
  return <Suspense fallback={<SuperLeagueLoading />}><SuperLeagueData /></Suspense>;
}
