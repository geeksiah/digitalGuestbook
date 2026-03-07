import Link from 'next/link';

export default function PublicNomineeCard({
  imageSrc,
  name,
  description,
  votesLabel,
  badgeLabel,
  categoryLabel,
  voteHref,
  profileHref,
  onCopyVoteLink,
}: {
  imageSrc?: string;
  name: string;
  description: string;
  votesLabel: string;
  badgeLabel: string;
  categoryLabel: string;
  voteHref: string;
  profileHref: string;
  onCopyVoteLink: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-[26px] border border-surface-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-4 p-4">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={name}
            className="h-16 w-16 rounded-2xl border border-surface-200 object-cover sm:h-20 sm:w-20"
          />
        ) : (
          <div className="h-16 w-16 rounded-2xl border border-surface-200 bg-surface-100 sm:h-20 sm:w-20" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={profileHref} className="text-base font-semibold tracking-tight text-brand-900 underline-offset-4 hover:underline">
              {name}
            </Link>
            <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-600">{badgeLabel}</span>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">{categoryLabel}</p>
          <p className="mt-2 text-sm font-medium text-brand-900">{votesLabel}</p>
          <p className="mt-2 text-sm leading-6 text-surface-500">{description}</p>
          <p className="mt-2 text-sm text-surface-500">Open the vote page for this category.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-surface-100 bg-surface-50/70 p-4 sm:grid-cols-3">
        <Link href={voteHref} className="btn-primary w-full text-center" title={`Vote in ${categoryLabel}`}>
          Vote In {categoryLabel}
        </Link>
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
