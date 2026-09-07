export default function LeaguesLoading() {
  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8"><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-28 rounded-[2rem] bg-white/[.06]"/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 9 }, (_, index) => <div key={index} className="h-36 rounded-2xl bg-white/[.06]"/>)}</div></div></main>;
}
