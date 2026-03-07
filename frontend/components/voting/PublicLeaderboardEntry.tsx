import Link from 'next/link';
import { resolvePublicAssetUrl } from '@/lib/utils';

export default function PublicLeaderboardEntry({
  rank,
  imageSrc,
  name,
  votesLabel,
  voteHref,
  profileHref,
}: {
  rank: number;
  imageSrc?: string;
  name: string;
  votesLabel: string;
  voteHref: string;
  profileHref: string;
}) {
  const resolvedImageSrc = resolvePublicAssetUrl(imageSrc);
  return (
    <article className="overflow-hidden rounded-[24px] border border-surface-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-700">
            {rank}
          </div>
          {resolvedImageSrc ? (
            <img
              src={resolvedImageSrc}
              alt={name}
              className="h-11 w-11 shrink-0 rounded-2xl border border-surface-200 object-cover"
            />
          ) : (
            <div className="h-11 w-11 shrink-0 rounded-2xl border border-surface-200 bg-surface-100" />
          )}
          <div className="min-w-0 flex-1">
            <Link href={profileHref} className="truncate text-sm font-semibold text-brand-900 underline-offset-4 hover:underline sm:text-base">
              {name}
            </Link>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-brand-900 sm:text-base">{votesLabel}</p>
          </div>
          <div className="shrink-0">
            <Link href={voteHref} className="btn-primary inline-flex min-h-[40px] px-4 py-2 text-xs sm:text-sm">
              Vote
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
