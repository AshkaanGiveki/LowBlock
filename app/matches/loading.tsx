export default function MatchesLoading() {
  return <main className="min-h-screen px-4 pb-28 pt-24 md:px-8"><div className="mx-auto max-w-7xl animate-pulse space-y-5"><div className="h-24 rounded-[2rem] bg-white/[.06]"/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-64 rounded-[1.75rem] bg-white/[.06]"/>)}</div></div></main>;
}
