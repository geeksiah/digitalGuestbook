import Link from 'next/link';

export default function PublicNomineeCard({
  imageSrc,
  name,
  description,
  votesLabel,
  badgeLabel,
  voteHref,
  profileHref,
  onCopyVoteLink,
}: {
  imageSrc?: string;
  name: string;
  description: string;
  votesLabel: string;
  badgeLabel: string;
  voteHref: string;
  profileHref: string;
  onCopyVoteLink: () => void;
}) {
  return (
    <article className="detail-card p-4">
      <div className="flex items-start gap-4">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={name}
            className="h-16 w-16 rounded-2xl border border-surface-200 object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-2xl border border-surface-200 bg-surface-100" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4 className="text-base font-semibold tracking-tight text-brand-900">{name}</h4>
            <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-600">{badgeLabel}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-brand-900">{votesLabel}</p>
          <p className="mt-2 text-sm leading-6 text-surface-500">{description}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Link href={voteHref} className="btn-primary w-full text-center">
          Vote
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
