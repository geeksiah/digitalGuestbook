import VotingMetricCard from '@/components/voting/VotingMetricCard';

type VotingAnalytics = {
  totals: {
    totalVotes: number;
    uniqueVoters: number;
    freeVotes: number;
    paidVotes: number;
    paidRevenue: number;
    conversionRate: number;
    paidIntentConversionRate: number;
    nominations?: {
      total: number;
      pending: number;
    };
  };
  perContest: Array<{
    contestId: string;
    title: string;
    totalVotes: number;
    paidVotes: number;
  }>;
  leaderboard: Array<{
    optionId: string;
    name: string;
    totalVotes: number;
    growthDelta: number;
  }>;
  timeSeries: {
    byDay: Array<{
      day: string;
      votes: number;
      freeVotes: number;
      paidVotes: number;
    }>;
  };
};

export default function VotingResultsPanel({
  analytics,
  eventCurrency,
  formatMoney,
  containerClassName,
}: {
  analytics: VotingAnalytics | null;
  eventCurrency: string;
  formatMoney: (currency: string, amount: number) => string;
  containerClassName: string;
}) {
  return (
    <section className={`${containerClassName} p-4 space-y-4`}>
      <h2 className="text-lg font-semibold text-brand-900">Voting Analytics</h2>
      {analytics ? (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
            <VotingMetricCard label="Total Votes" value={String(analytics.totals.totalVotes)} />
            <VotingMetricCard label="Unique Voters" value={String(analytics.totals.uniqueVoters)} />
            <VotingMetricCard label="Free Votes" value={String(analytics.totals.freeVotes)} />
            <VotingMetricCard label="Paid Votes" value={String(analytics.totals.paidVotes)} />
            <VotingMetricCard label="Revenue" value={formatMoney(eventCurrency, analytics.totals.paidRevenue)} />
            <VotingMetricCard label="Voter Conversion" value={`${analytics.totals.conversionRate}%`} />
            <VotingMetricCard
              label="Intent Conversion"
              value={`${analytics.totals.paidIntentConversionRate}%`}
            />
            <div className="kpi-tile p-3">
              <p className="text-xs text-surface-500">Nominations</p>
              <p className="text-lg font-bold text-brand-900">{analytics.totals.nominations?.total || 0}</p>
              <p className="text-[11px] text-surface-600">
                Pending {analytics.totals.nominations?.pending || 0}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-surface-200 p-3">
              <p className="mb-2 text-sm font-semibold text-brand-900">Contest Breakdown</p>
              <div className="space-y-2">
                {analytics.perContest.map((contest) => (
                  <div key={contest.contestId} className="flex items-center justify-between text-sm">
                    <span className="text-surface-700">{contest.title}</span>
                    <span className="font-semibold text-brand-900">
                      {contest.totalVotes} ({contest.paidVotes} paid)
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-surface-200 p-3">
              <p className="mb-2 text-sm font-semibold text-brand-900">Leaderboard</p>
              <div className="space-y-2">
                {analytics.leaderboard.map((entry, index) => (
                  <div key={entry.optionId} className="flex items-center justify-between text-sm">
                    <span className="text-surface-700">
                      #{index + 1} {entry.name}
                    </span>
                    <span className="font-semibold text-brand-900">
                      {entry.totalVotes} ({entry.growthDelta >= 0 ? '+' : ''}
                      {entry.growthDelta})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-surface-200 p-3">
            <p className="mb-2 text-sm font-semibold text-brand-900">Daily Vote Trend</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {analytics.timeSeries.byDay.slice(-18).map((day) => (
                <div key={day.day} className="rounded-md bg-surface-50 p-2 text-sm">
                  <p className="text-surface-600">{day.day}</p>
                  <p className="font-semibold text-brand-900">{day.votes} votes</p>
                  <p className="text-xs text-surface-600">
                    Free {day.freeVotes} | Paid {day.paidVotes}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-surface-500">Analytics unavailable.</p>
      )}
    </section>
  );
}
