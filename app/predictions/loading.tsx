export default function PredictionsLoading() {
  return (
    <main className="min-h-screen px-4 pb-28 pt-24 md:px-8">
      <div className="mx-auto max-w-5xl animate-pulse space-y-4">
        <div className="h-28 rounded-[2rem] bg-white/[.06]" />
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="h-24 rounded-2xl bg-white/[.06]" />
        ))}
      </div>
    </main>
  );
}
