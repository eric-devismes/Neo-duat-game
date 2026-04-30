export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-40 rounded bg-brand-100 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card h-24 animate-pulse" />
        <div className="card h-24 animate-pulse" />
        <div className="card h-24 animate-pulse" />
      </div>
      <div className="card h-64 animate-pulse" />
    </div>
  );
}
