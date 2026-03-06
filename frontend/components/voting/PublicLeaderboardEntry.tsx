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
    <article className="focus-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-surface-200 bg-surface-100 text-xs font-semibold text-brand-900">
            {rank}
          </div>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={name}
              className="h-10 w-10 rounded-full border border-surface-200 object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full border border-surface-200 bg-surface-100" />
          )}
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-brand-900">{name}</h3>
            <p className="text-xs text-surface-500">{categoryLabel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-brand-900">{votesLabel}</p>
          <p className="text-xs text-surface-500">{breakdownLabel}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Link href={voteHref} className="btn-accent !min-h-[38px] !rounded-full !py-2 !text-sm">
          Vote
        </Link>
      </div>
    </article>
  );
}
