import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { isH2HEnabled } from "@/lib/domain/h2h";
import H2HBoard from "@/components/H2HBoard";

export const dynamic = "force-dynamic";

function H2HLoading() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto max-w-7xl animate-pulse space-y-5">
        <div className="h-44 rounded-[1.75rem] bg-white/[.06]" />
        <div className="h-20 rounded-2xl bg-white/[.06]" />
        <div className="h-72 rounded-[1.75rem] bg-white/[.06]" />
        <div className="h-96 rounded-[1.75rem] bg-white/[.06]" />
      </div>
    </main>
  );
}

async function H2HData() {
  if (!(await currentUserId())) redirect("/login");
  return <H2HBoard />;
}

export default function H2HPage() {
  if (!isH2HEnabled()) redirect("/club");
  return (
    <Suspense fallback={<H2HLoading />}>
      <H2HData />
    </Suspense>
  );
}
