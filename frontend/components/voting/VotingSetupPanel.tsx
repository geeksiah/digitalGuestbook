type VoteMode = 'AWARDS' | 'ELECTION';

type VotingSetupConfig = {
  mode: VoteMode;
  isEnabled: boolean;
  allowFreeVotes: boolean;
  allowPaidVotes: boolean;
  allowPublicNominations?: boolean;
  requireOtpForElection: boolean;
  voteUnitPrice: number;
  maxVotesPerPurchase: number;
};

export default function VotingSetupPanel({
  config,
  eventCurrency,
  saving,
  containerClassName,
  onChange,
  onSave,
}: {
  config: VotingSetupConfig | null;
  eventCurrency: string;
  saving: boolean;
  containerClassName: string;
  onChange: (nextConfig: VotingSetupConfig) => void;
  onSave: () => void;
}) {
  return (
    <section className={`${containerClassName} p-5 space-y-5`}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Setup</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">Voting settings</h2>
        <p className="mt-1 text-sm leading-6 text-surface-500">Control how guests can vote, nominate, and complete purchases.</p>
      </div>
      {config ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs text-surface-600">Mode</span>
              <select
                className="input"
                value={config.mode}
                onChange={(event) => onChange({ ...config, mode: event.target.value as VoteMode })}
              >
                <option value="AWARDS">Awards</option>
                <option value="ELECTION">Election</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-surface-600">Event Currency</span>
              <div className="input flex items-center bg-surface-50 font-semibold text-brand-900">{eventCurrency}</div>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-surface-600">Unit Price</span>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={config.voteUnitPrice}
                onChange={(event) => onChange({ ...config, voteUnitPrice: Number(event.target.value || 0) })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-surface-600">Max Votes Per Purchase</span>
              <input
                className="input"
                type="number"
                min={1}
                value={config.maxVotesPerPurchase}
                onChange={(event) =>
                  onChange({ ...config, maxVotesPerPurchase: Math.max(1, Number(event.target.value || 1)) })
                }
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="inline-flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={config.isEnabled}
                onChange={(event) => onChange({ ...config, isEnabled: event.target.checked })}
              />
              Open Voting
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={config.allowFreeVotes}
                onChange={(event) => onChange({ ...config, allowFreeVotes: event.target.checked })}
              />
              Free Votes
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={config.allowPaidVotes}
                onChange={(event) => onChange({ ...config, allowPaidVotes: event.target.checked })}
              />
              Paid Votes
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900">
              <input
                type="checkbox"
                checked={config.requireOtpForElection}
                onChange={(event) => onChange({ ...config, requireOtpForElection: event.target.checked })}
              />
              OTP Verification
            </label>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-brand-900 md:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(config.allowPublicNominations)}
                onChange={(event) => onChange({ ...config, allowPublicNominations: event.target.checked })}
              />
              Allow Public Nominations
            </label>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-surface-500">Voting setup is not available for this event yet.</p>
      )}
    </section>
  );
}
