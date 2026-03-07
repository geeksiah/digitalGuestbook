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
    <article className="rounded-[26px] border border-surface-200 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold tracking-tight text-brand-900">{title}</p>
          <p className="mt-1 text-sm text-surface-500">{mode} category</p>
          <p className="mt-2 text-sm font-medium text-brand-900">{votesLabel}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-2">
          <Link href={voteHref} className="btn-primary col-span-2 w-full text-center sm:col-span-1" title={`Vote in ${title}`}>
            Vote
          </Link>
          <button
            type="button"
            onClick={onCopyVoteLink}
            className="btn-outline w-full"
          >
            Copy Link
          </button>
        </div>
      </div>
    </article>
  );
}

