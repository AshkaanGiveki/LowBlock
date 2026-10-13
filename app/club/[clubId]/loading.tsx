export default function ClubDetailLoading() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto max-w-5xl animate-pulse space-y-5">
        <div className="h-56 rounded-[2.25rem] bg-white/[.06]" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-28 rounded-2xl bg-white/[.06]" />
          ))}
        </div>
        <div className="h-80 rounded-3xl bg-white/[.06]" />
      </div>
    </main>
  );
}
