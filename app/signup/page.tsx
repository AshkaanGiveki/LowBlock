import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import SignupForm from "./SignupForm";

export default async function SignupPage() {
  if (await currentUserId()) redirect("/profile");
  return <SignupForm />;
}
