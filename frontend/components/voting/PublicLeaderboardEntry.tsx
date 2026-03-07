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
    <article className="overflow-hidden rounded-[24px] border border-surface-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <div className="px-3 py-3 sm:p-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[11px] font-bold text-amber-700 sm:h-8 sm:w-8 sm:text-xs">
            {rank}
          </div>
          {resolvedImageSrc ? (
            <img
              src={resolvedImageSrc}
              alt={name}
              className="h-10 w-10 shrink-0 rounded-xl border border-surface-200 object-cover sm:h-11 sm:w-11 sm:rounded-2xl"
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded-xl border border-surface-200 bg-surface-100 sm:h-11 sm:w-11 sm:rounded-2xl" />
          )}
          <div className="min-w-0 flex-1">
            <Link href={profileHref} className="line-clamp-1 text-sm font-semibold text-brand-900 underline-offset-4 hover:underline sm:text-base">
              {name}
            </Link>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold text-brand-900 sm:text-sm">{votesLabel}</p>
          </div>
          <div className="shrink-0">
            <Link href={voteHref} className="btn-primary inline-flex min-h-[38px] px-3 py-2 text-xs sm:min-h-[40px] sm:px-4 sm:text-sm">
              Vote
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
