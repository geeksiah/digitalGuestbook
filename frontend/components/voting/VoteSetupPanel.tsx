type VoteSetupPanelProps = {
  title: string;
  helperText: string;
  selectedContestId: string;
  voteCount: number;
  selectedGatewayId: string;
  hasContests: boolean;
  canUsePaidVoting: boolean;
  maxVotesPerPurchase: number;
  contests: Array<{ id: string; title: string; mode: 'AWARDS' | 'ELECTION' }>;
  paymentGateways: Array<{ id: string; name: string; currency: string }>;
  onContestChange: (contestId: string) => void;
  onVoteCountChange: (value: number) => void;
  onGatewayChange: (gatewayId: string) => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  paidVotingEnabled: boolean;
};

export default function VoteSetupPanel({
  title,
  helperText,
  selectedContestId,
  voteCount,
  selectedGatewayId,
  hasContests,
  canUsePaidVoting,
  maxVotesPerPurchase,
  contests,
  paymentGateways,
  onContestChange,
  onVoteCountChange,
  onGatewayChange,
  onSubmit,
  submitDisabled,
  paidVotingEnabled,
}: VoteSetupPanelProps) {
  return (
    <section className="detail-card space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Paid voting</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-brand-900">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-surface-500">{helperText}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-surface-500">Category</span>
          <select className="input" value={selectedContestId} disabled={!hasContests} onChange={(event) => onContestChange(event.target.value)}>
            {!hasContests ? <option value="">No categories available</option> : null}
            {contests.map((contest) => (
              <option key={contest.id} value={contest.id}>
                {contest.title} ({contest.mode})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-surface-500">Vote quantity</span>
          <input
            className="input"
            type="number"
            min={1}
            max={maxVotesPerPurchase}
            value={voteCount}
            disabled={!hasContests}
            onChange={(event) => onVoteCountChange(Number(event.target.value || 1))}
          />
        </label>

        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-xs font-medium text-surface-500">Payment method</span>
          <select className="input" value={selectedGatewayId} disabled={!canUsePaidVoting} onChange={(event) => onGatewayChange(event.target.value)}>
            {!canUsePaidVoting ? (
              <option value="">
                {paidVotingEnabled ? 'No payment gateway available' : 'Paid voting is disabled'}
              </option>
            ) : null}
            {paymentGateways.map((gateway) => (
              <option key={gateway.id} value={gateway.id}>
                {gateway.name} ({gateway.currency})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 text-sm text-surface-500">
        Free voting uses the nominee cards directly. Use this section only when you want to buy extra votes.
      </div>

      <button className="btn-primary w-full sm:w-auto" onClick={onSubmit} disabled={submitDisabled}>
        Continue To Payment
      </button>
    </section>
  );
}
