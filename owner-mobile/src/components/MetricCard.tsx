import { IonIcon } from '@ionic/react';
import type { ComponentProps } from 'react';

type MetricIcon = ComponentProps<typeof IonIcon>['icon'];

interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: MetricIcon;
}

const MetricCard = ({ label, value, hint, icon }: MetricCardProps) => (
  <article className="surface-card metric-card">
    <div className="metric-head">
      <p className="metric-label">{label}</p>
      {icon ? (
        <span className="metric-icon">
          <IonIcon icon={icon} />
        </span>
      ) : null}
    </div>
    <p className="metric-value">{value}</p>
    {hint ? <p className="metric-hint">{hint}</p> : null}
  </article>
);

export default MetricCard;
