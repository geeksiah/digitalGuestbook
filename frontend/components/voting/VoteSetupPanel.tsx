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
    <section className="dashboard-canvas space-y-3 p-4">
      <h2 className="text-base font-semibold text-brand-900">{title}</h2>
      <p className="text-xs text-surface-600">{helperText}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[1fr,130px,1fr,auto]">
        <select className="input" value={selectedContestId} disabled={!hasContests} onChange={(event) => onContestChange(event.target.value)}>
          {!hasContests ? <option value="">No categories available</option> : null}
          {contests.map((contest) => (
            <option key={contest.id} value={contest.id}>
              {contest.title} ({contest.mode})
            </option>
          ))}
        </select>
        <input
          className="input"
          type="number"
          min={1}
          max={maxVotesPerPurchase}
          value={voteCount}
          disabled={!hasContests}
          onChange={(event) => onVoteCountChange(Number(event.target.value || 1))}
        />
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
        <button className="btn-accent w-full" onClick={onSubmit} disabled={submitDisabled}>
          Pay & Vote
        </button>
      </div>
    </section>
  );
}
