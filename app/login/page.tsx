import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  if (await currentUserId()) redirect("/profile");
  return <LoginForm />;
}
