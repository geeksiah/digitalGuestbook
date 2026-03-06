export default function VotingMetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="kpi-tile p-3">
      <p className="text-xs text-surface-500">{label}</p>
      <p className="text-lg font-bold text-brand-900">{value}</p>
    </div>
  );
}
