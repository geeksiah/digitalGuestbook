import Link from 'next/link';

export default function NomineeProfileCategoryCard({
  title,
  mode,
  votesLabel,
  voteHref,
  onCopyVoteLink,
}: {
  title: string;
  mode: string;
  votesLabel: string;
  voteHref: string;
  onCopyVoteLink: () => void;
}) {
  return (
    <article className="rounded-2xl border border-surface-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-brand-900">{title}</p>
          <p className="mt-0.5 text-xs text-surface-600">
            {mode} | {votesLabel}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
          <Link href={voteHref} className="btn-accent w-full !min-h-[38px] !rounded-full !py-2 text-center !text-sm">
            Vote
          </Link>
          <button
            type="button"
            onClick={onCopyVoteLink}
            className="btn-outline w-full !min-h-[38px] !rounded-full !py-2 !text-sm"
          >
            Copy Vote Link
          </button>
        </div>
      </div>
    </article>
  );
}
