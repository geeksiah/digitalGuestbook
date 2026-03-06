type VoteSidebarCardProps = {
  categoryTitle: string;
  nomineeCountLabel: string;
  selectedNomineeName: string;
  selectedNomineeVotesLabel: string;
  canFreeVote: boolean;
  canPaidVote: boolean;
  canVote: boolean;
  showNoGatewayMessage: boolean;
  showNoContestMessage: boolean;
  directVoteNotice?: string;
  onFreeVote: () => void;
  onPaidVote: () => void;
};

export default function VoteSidebarCard({
  categoryTitle,
  nomineeCountLabel,
  selectedNomineeName,
  selectedNomineeVotesLabel,
  canFreeVote,
  canPaidVote,
  canVote,
  showNoGatewayMessage,
  showNoContestMessage,
  directVoteNotice,
  onFreeVote,
  onPaidVote,
}: VoteSidebarCardProps) {
  return (
    <section className="dashboard-canvas p-4 lg:sticky lg:top-20 lg:self-start">
      <div className="space-y-3 rounded-2xl border border-surface-200 bg-white p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600">Category</p>
          <p className="mt-1 text-lg font-semibold text-brand-900">{categoryTitle}</p>
          <p className="mt-1 text-xs text-surface-600">{nomineeCountLabel}</p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
          <p className="text-xs text-surface-500">Selected nominee</p>
          <p className="mt-0.5 text-sm font-semibold text-brand-900">{selectedNomineeName}</p>
          <p className="mt-1 text-xs text-surface-600">{selectedNomineeVotesLabel}</p>
        </div>
        {canFreeVote ? (
          <button className="btn-outline w-full" onClick={onFreeVote} disabled={!canVote}>
            Cast Free Vote
          </button>
        ) : null}
        {canPaidVote ? (
          <button className="btn-accent w-full" onClick={onPaidVote} disabled={!canVote}>
            Pay & Vote
          </button>
        ) : null}
        {showNoGatewayMessage ? (
          <p className="text-xs text-surface-600">
            Paid voting is enabled but no payment gateway is available for this event.
          </p>
        ) : null}
        {showNoContestMessage ? (
          <p className="text-xs text-surface-600">
            This event has no published nominees yet. Check back soon.
          </p>
        ) : null}
        {directVoteNotice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-700">Direct Vote Link Opened</p>
            <p className="mt-0.5 text-sm text-emerald-800">{directVoteNotice}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
