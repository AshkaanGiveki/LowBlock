export default function LeagueRoundLoading() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto max-w-3xl animate-pulse space-y-5">
        <div className="h-10 w-32 rounded-xl bg-white/[.06]" />
        <div className="h-48 rounded-3xl bg-white/[.06]" />
        <div className="h-[620px] rounded-3xl bg-white/[.06]" />
      </div>
    </main>
  );
}
