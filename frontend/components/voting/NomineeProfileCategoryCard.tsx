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
    <article className="detail-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold tracking-tight text-brand-900">{title}</p>
          <p className="mt-1 text-sm text-surface-500">
            {mode} · {votesLabel}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
          <Link href={voteHref} className="btn-primary w-full text-center">
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
