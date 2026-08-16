import { redirect } from "next/navigation";

export default function LegacyRoundRedirect() {
  redirect("/matches");
}
