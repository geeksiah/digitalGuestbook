import { Stat } from '@/components/ui/Primitives';

export default function VotingMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-white px-4 py-3.5">
      <Stat label={label} value={value} />
    </div>
  );
}
