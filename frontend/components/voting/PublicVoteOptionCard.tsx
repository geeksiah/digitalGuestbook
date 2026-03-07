import Link from 'next/link';
import { resolvePublicAssetUrl } from '@/lib/utils';

type PublicVoteOptionCardProps = {
  imageSrc?: string;
  name: string;
  description: string;
  votesLabel: string;
  selected: boolean;
  voteButtonLabel: string;
  profileHref: string;
  onVote: () => void;
  onCopyVoteLink: () => void;
};

export default function PublicVoteOptionCard({
  imageSrc,
  name,
  description,
  votesLabel,
  selected,
  voteButtonLabel,
  profileHref,
  onVote,
  onCopyVoteLink,
}: PublicVoteOptionCardProps) {
  const resolvedImageSrc = resolvePublicAssetUrl(imageSrc);
  return (
    <article
      className={`detail-card p-4 transition-all ${
        selected ? 'border-brand-300 bg-brand-50/20' : 'hover:border-brand-200'
      }`}
    >
      <div className="flex items-start gap-4">
        {resolvedImageSrc ? (
          <img src={resolvedImageSrc} alt={name} className="h-16 w-16 rounded-2xl border border-surface-200 object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-2xl border border-surface-200 bg-surface-100" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={profileHref} className="text-base font-semibold tracking-tight text-brand-900 underline-offset-4 hover:underline">
              {name}
            </Link>
            <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-600">{votesLabel}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-surface-500">{description}</p>
          {selected ? (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Selected nominee</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onVote}
          className="btn-primary w-full"
        >
          {voteButtonLabel}
        </button>
        <Link href={profileHref} className="btn-outline w-full text-center">
          View Profile
        </Link>
        <button
          type="button"
          onClick={onCopyVoteLink}
          className="btn-outline w-full"
        >
          Copy Link
        </button>
      </div>
    </article>
  );
}
