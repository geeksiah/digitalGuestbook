export default function VotingMetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-brand-900">{value}</p>
    </div>
  );
}
