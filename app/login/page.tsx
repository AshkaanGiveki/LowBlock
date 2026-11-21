import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ returnTo?: string }> }) {
  const returnTo = (await searchParams)?.returnTo;
  const safeReturnTo = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/profile";
  if (await currentUserId()) redirect(safeReturnTo);
  return <LoginForm />;
}
