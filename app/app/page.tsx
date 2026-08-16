import { redirect } from "next/navigation";

// Compatibility for existing links and bookmarks; the application no longer has an /app screen.
export default function LegacyAppRedirect() {
  redirect("/matches");
}
