export default function LeaderboardLoading() {
  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8"><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-48 rounded-[2.25rem] bg-white/[.06]"/><div className="h-16 rounded-2xl bg-white/[.06]"/><div className="space-y-2 rounded-3xl bg-white/[.04] p-5">{Array.from({ length: 10 }, (_, index) => <div key={index} className="h-14 rounded-xl bg-white/[.06]"/>)}</div></div></main>;
}
