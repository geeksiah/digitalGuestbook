import Link from 'next/link';

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
  return (
    <article
      className={`rounded-2xl border px-3 py-3 transition-all ${
        selected ? 'border-red-300 bg-red-50/60' : 'border-surface-200 bg-white hover:border-red-200'
      }`}
    >
      <div className="flex items-center gap-3">
        {imageSrc ? (
          <img src={imageSrc} alt={name} className="h-10 w-10 rounded-full border border-surface-200 object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-full border border-surface-200 bg-surface-100" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-brand-900">{name}</p>
            <p className="text-xs text-surface-500">{votesLabel}</p>
          </div>
          <p className="truncate text-xs text-surface-600">{description}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onVote}
          className="btn-accent w-full !min-h-[38px] !rounded-full !px-3 !py-2 !text-xs"
        >
          {voteButtonLabel}
        </button>
        <Link href={profileHref} className="btn-outline w-full !min-h-[38px] !rounded-full !px-3 !py-2 text-center !text-xs">
          View Profile
        </Link>
        <button
          type="button"
          onClick={onCopyVoteLink}
          className="btn-outline w-full !min-h-[38px] !rounded-full !px-3 !py-2 !text-xs"
        >
          Copy Vote Link
        </button>
      </div>
    </article>
  );
}
