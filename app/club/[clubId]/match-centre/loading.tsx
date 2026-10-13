export default function ClubMatchCentreLoading() {
  return (
    <main className="min-h-screen px-5 pb-28 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto max-w-5xl animate-pulse space-y-5">
        <div className="h-48 rounded-[2rem] bg-white/[.06]" />
        <div className="h-24 rounded-2xl bg-white/[.06]" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-28 rounded-2xl bg-white/[.06]" />
          ))}
        </div>
      </div>
    </main>
  );
}
