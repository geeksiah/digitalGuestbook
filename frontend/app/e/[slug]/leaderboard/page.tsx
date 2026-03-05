'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { votingApi } from '@/lib/api';
import BackendTemplateFrame, { useBackendTemplate } from '@/components/BackendTemplateFrame';

type RankedNominee = {
  rank: number;
  optionId: string;
  name: string;
  description?: string | null;
  imagePath?: string | null;
  imageUrl?: string | null;
  totalVotes: number;
  freeVotes: number;
  paidVotes: number;
  voteSharePercent: number;
  trendDelta: number;
};

type LeaderboardContest = {
  contestId: string;
  title: string;
  mode: 'AWARDS' | 'ELECTION';
  totals: {
    totalVotes: number;
    freeVotes: number;
    paidVotes: number;
  };
  rankings: RankedNominee[];
};

type LeaderboardPayload = {
  event: { id: string; slug: string; name: string };
  contests: LeaderboardContest[];
};

export default function LeaderboardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.slug || '');
  const contestQuery = String(searchParams.get('contestId') || '');
  const { loading: templateLoading, available: hasTemplate } = useBackendTemplate(slug, 'leaderboard-page');

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState('');
  const [contests, setContests] = useState<LeaderboardContest[]>([]);
  const [selectedContestId, setSelectedContestId] = useState('');

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.contestId === selectedContestId) || null,
    [contests, selectedContestId]
  );

  useEffect(() => {
    if (!slug || templateLoading || hasTemplate) return;
    const run = async () => {
      setLoading(true);
      try {
        const response = await votingApi.leaderboard(slug);
        const payload = response.data as LeaderboardPayload;
        const dataContests = payload.contests || [];
        setEventName(payload.event?.name || '');
        setContests(dataContests);
        const validQuery = contestQuery && dataContests.some((contest) => contest.contestId === contestQuery);
        setSelectedContestId(validQuery ? contestQuery : dataContests[0]?.contestId || '');
      } catch (error: any) {
        toast.error(error?.response?.data?.error || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [slug, contestQuery, templateLoading, hasTemplate]);

  if (templateLoading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  if (hasTemplate) {
    return <BackendTemplateFrame slug={slug} endpoint="leaderboard-page" refreshIntervalMs={10000} revalidateOnFocus forceFresh />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 py-6 px-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="phone-stage p-6">
          <div className="phone-notch mb-4" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-red-500 font-semibold">Leaderboard</p>
          <h1 className="text-3xl font-bold mt-2 text-brand-900">{eventName}</h1>
          <p className="text-sm text-surface-600 mt-1">Live rankings by category with transparent vote totals.</p>
          <div className="mt-4 segmented w-full max-w-md">
            <Link
              href={`/e/${slug}/nominees${selectedContestId ? `?contestId=${encodeURIComponent(selectedContestId)}` : ''}`}
              className="segmented-item text-center hover:text-brand-900"
            >
              Nominees
            </Link>
            <Link
              href={`/e/${slug}/vote${selectedContestId ? `?contestId=${encodeURIComponent(selectedContestId)}` : ''}`}
              className="segmented-item text-center hover:text-brand-900"
            >
              Vote
            </Link>
            <span className="segmented-item segmented-item-active text-center">Results</span>
          </div>
        </section>

        <section className="dashboard-canvas p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-brand-900">Category Rankings</h2>
            <select className="input max-w-[320px]" value={selectedContestId} onChange={(event) => setSelectedContestId(event.target.value)}>
              {contests.map((contest) => (
                <option key={contest.contestId} value={contest.contestId}>
                  {contest.title} ({contest.mode})
                </option>
              ))}
            </select>
          </div>

          {!selectedContest ? (
            <p className="text-surface-600">No leaderboard data yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="kpi-tile p-3">
                  <p className="text-xs text-surface-500">Total Votes</p>
                  <p className="text-lg font-bold text-brand-900">{selectedContest.totals.totalVotes.toLocaleString()}</p>
                </div>
                <div className="kpi-tile p-3">
                  <p className="text-xs text-surface-500">Free</p>
                  <p className="text-lg font-bold text-brand-900">{selectedContest.totals.freeVotes.toLocaleString()}</p>
                </div>
                <div className="kpi-tile p-3">
                  <p className="text-xs text-surface-500">Paid</p>
                  <p className="text-lg font-bold text-brand-900">{selectedContest.totals.paidVotes.toLocaleString()}</p>
                </div>
              </div>

              {selectedContest.rankings.map((entry) => (
                <article key={entry.optionId} className="focus-card">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {entry.imageUrl || entry.imagePath ? (
                        <img
                          src={entry.imageUrl || entry.imagePath || ''}
                          alt={entry.name}
                          className="h-10 w-10 rounded-full border border-surface-200 object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full border border-surface-200 bg-surface-100" />
                      )}
                      <div>
                        <p className="text-xs text-surface-500">Rank #{entry.rank}</p>
                        <h3 className="text-base font-semibold text-brand-900">{entry.name}</h3>
                        <p className="text-xs text-surface-600 mt-0.5">{entry.description || 'Nominee profile'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-900">{entry.totalVotes.toLocaleString()} votes</p>
                      <p className="text-xs text-surface-500">{entry.voteSharePercent.toFixed(1)}% share</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-surface-100 overflow-hidden">
                    <div className="h-2 rounded-full bg-[#ff3b30]" style={{ width: `${Math.min(100, Math.max(0, entry.voteSharePercent))}%` }} />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Link
                      href={`/e/${slug}/vote?contestId=${encodeURIComponent(selectedContest.contestId)}&optionId=${encodeURIComponent(entry.optionId)}`}
                      className="btn-accent !min-h-[38px] !py-2 !text-sm !rounded-full"
                    >
                      Vote
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
