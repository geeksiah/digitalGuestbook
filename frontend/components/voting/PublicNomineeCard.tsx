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
    <article className="focus-card">
      <div className="flex items-center gap-3">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={name}
            className="h-11 w-11 rounded-full border border-surface-200 object-cover"
          />
        ) : (
          <div className="h-11 w-11 rounded-full border border-surface-200 bg-surface-100" />
        )}
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-brand-900">{name}</h4>
          <p className="mt-0.5 text-xs text-surface-500">{votesLabel}</p>
        </div>
        <span className="rounded-full border border-surface-200 bg-surface-50 px-2 py-1 text-[11px] text-surface-700">
          {badgeLabel}
        </span>
      </div>
      <p className="mt-2 min-h-[40px] text-sm text-surface-600">{description}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Link href={voteHref} className="btn-accent w-full !min-h-[38px] !rounded-full !py-2 text-center !text-sm">
          Vote
        </Link>
        <Link href={profileHref} className="btn-outline w-full !min-h-[38px] !rounded-full !py-2 text-center !text-sm">
          View Profile
        </Link>
        <button
          type="button"
          onClick={onCopyVoteLink}
          className="btn-outline w-full !min-h-[38px] !rounded-full !py-2 !text-sm"
        >
          Copy Vote Link
        </button>
      </div>
    </article>
  );
}
