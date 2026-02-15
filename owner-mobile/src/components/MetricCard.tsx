interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

const MetricCard = ({ label, value, hint }: MetricCardProps) => (
  <article className="surface-card metric-card">
    <p className="metric-label">{label}</p>
    <p className="metric-value">{value}</p>
    {hint ? <p className="metric-hint">{hint}</p> : null}
  </article>
);

export default MetricCard;
