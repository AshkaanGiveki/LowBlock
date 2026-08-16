import { redirect } from "next/navigation";

export default function LegacyLeagueRedirect() {
  redirect("/matches");
}
