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
    <section className="detail-card lg:sticky lg:top-24 lg:self-start">
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Ready to vote</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">{categoryTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-surface-500">{nomineeCountLabel}</p>
        </div>

        <div className="rounded-3xl border border-surface-200 bg-surface-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-600">Selected nominee</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-brand-900">{selectedNomineeName}</p>
          <p className="mt-1 text-sm text-surface-500">{selectedNomineeVotesLabel}</p>
        </div>

        <div className="grid gap-2">
          {canPaidVote && !showNoGatewayMessage ? (
            <button className="btn-primary w-full" onClick={onPaidVote} disabled={!canVote}>
              Continue To Payment
            </button>
          ) : null}
          {canFreeVote ? (
            <button className="btn-outline w-full" onClick={onFreeVote} disabled={!canVote}>
              Submit Free Vote
            </button>
          ) : null}
        </div>

        {showNoGatewayMessage ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Paid voting is enabled but no payment gateway is available for this event.
          </p>
        ) : null}
        {showNoContestMessage ? (
          <p className="rounded-2xl bg-surface-50 px-4 py-3 text-sm text-surface-600">
            This event has no published nominees yet. Check back soon.
          </p>
        ) : null}
        {directVoteNotice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Direct vote link</p>
            <p className="mt-1 text-sm text-emerald-800">{directVoteNotice}</p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4">
          <p className="text-sm font-semibold text-brand-900">How this works</p>
          <ol className="mt-3 space-y-2 text-sm text-surface-500">
            <li>1. Pick a nominee below.</li>
            <li>2. Review the quantity or payment method if needed.</li>
            <li>3. Confirm your vote.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}
