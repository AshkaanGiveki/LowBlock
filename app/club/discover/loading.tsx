export default function DiscoverClubsLoading() {
  return (
    <main className="min-h-screen px-5 pb-28 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto max-w-3xl animate-pulse space-y-4">
        <div className="h-10 w-32 rounded-xl bg-white/[.06]" />
        <div className="h-12 w-64 rounded-xl bg-white/[.06]" />
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-20 rounded-2xl bg-white/[.06]" />
        ))}
      </div>
    </main>
  );
}
