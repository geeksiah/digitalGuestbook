import Link from 'next/link';

export default function PublicLeaderboardEntry({
  rank,
  imageSrc,
  name,
  categoryLabel,
  votesLabel,
  breakdownLabel,
  voteHref,
}: {
  rank: number;
  imageSrc?: string;
  name: string;
  categoryLabel: string;
  votesLabel: string;
  breakdownLabel: string;
  voteHref: string;
}) {
  return (
    <article className="detail-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-surface-200 bg-surface-50 text-sm font-semibold text-brand-900">
            {rank}
          </div>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={name}
              className="h-12 w-12 rounded-2xl border border-surface-200 object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-2xl border border-surface-200 bg-surface-100" />
          )}
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-brand-900">{name}</h3>
            <p className="mt-0.5 text-sm text-surface-500">{categoryLabel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-brand-900">{votesLabel}</p>
          <p className="mt-0.5 text-sm text-surface-500">{breakdownLabel}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Link href={voteHref} className="btn-primary">
          Vote
        </Link>
      </div>
    </article>
  );
}
