'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { votingApi } from '@/lib/api';
import VotingPublicLayout from '@/components/voting/VotingPublicLayout';

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

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState('');
  const [contests, setContests] = useState<LeaderboardContest[]>([]);
  const [selectedContestId, setSelectedContestId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.contestId === selectedContestId) || null,
    [contests, selectedContestId]
  );

  const visibleRankings = useMemo(() => {
    if (!selectedContest) return [];
    const query = searchQuery.trim().toLowerCase();
    return selectedContest.rankings.filter((entry) => {
      if (!query) return true;
      const name = String(entry.name || '').toLowerCase();
      return name.includes(query);
    });
  }, [selectedContest, searchQuery]);

  useEffect(() => {
    if (!slug) return;
    const run = async () => {
      setLoading(true);
      try {
        const response = await votingApi.leaderboard(slug);
        const payload = ((response.data as any)?.data || response.data || {}) as Partial<LeaderboardPayload>;
        const rawContests = Array.isArray(payload.contests) ? payload.contests : [];
        const dataContests: LeaderboardContest[] = rawContests.map((contest: any) => ({
          contestId: String(contest?.contestId || contest?.id || ''),
          title: String(contest?.title || contest?.name || 'Untitled category'),
          mode: (contest?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
          totals: {
            totalVotes: Number(contest?.totals?.totalVotes || 0),
            freeVotes: Number(contest?.totals?.freeVotes || 0),
            paidVotes: Number(contest?.totals?.paidVotes || 0),
          },
          rankings: (Array.isArray(contest?.rankings) ? contest.rankings : []).map((entry: any, index: number) => ({
            rank: Number(entry?.rank || index + 1),
            optionId: String(entry?.optionId || entry?.id || ''),
            name: String(entry?.name || 'Unnamed nominee'),
            description: entry?.description ? String(entry.description) : null,
            imagePath: entry?.imagePath ? String(entry.imagePath) : null,
            imageUrl: entry?.imageUrl ? String(entry.imageUrl) : null,
            totalVotes: Number(entry?.totalVotes || 0),
            freeVotes: Number(entry?.freeVotes || 0),
            paidVotes: Number(entry?.paidVotes || 0),
            voteSharePercent: Number(entry?.voteSharePercent || 0),
            trendDelta: Number(entry?.trendDelta || 0),
          })).filter((entry: RankedNominee) => Boolean(entry.optionId)),
        })).filter((contest) => contest.contestId);

        setEventName(String(payload?.event?.name || slug));
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
  }, [slug, contestQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <VotingPublicLayout
      slug={slug}
      eventName={eventName}
      activeTab="results"
      contestId={selectedContestId}
    >
      <section className="dashboard-canvas p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-brand-900">Category Rankings</h2>
            <div className="flex flex-wrap gap-2">
              <select className="input max-w-[320px]" value={selectedContestId} onChange={(event) => setSelectedContestId(event.target.value)}>
                {contests.map((contest) => (
                  <option key={contest.contestId} value={contest.contestId}>
                    {contest.title} ({contest.mode})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <input
            className="input mb-4"
            placeholder="Search nominee"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

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

              {visibleRankings.length === 0 ? (
                <div className="rounded-xl border border-surface-200 bg-white p-3 text-sm text-surface-600">
                  No nominees match your filters.
                </div>
              ) : null}
              {visibleRankings.map((entry) => (
                <article key={entry.optionId} className="focus-card">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center text-xs font-semibold text-brand-900">
                        {entry.rank}
                      </div>
                      {entry.imageUrl || entry.imagePath ? (
                        <img
                          src={entry.imageUrl || entry.imagePath || ''}
                          alt={entry.name}
                          className="h-10 w-10 rounded-full border border-surface-200 object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full border border-surface-200 bg-surface-100" />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-brand-900 truncate">{entry.name}</h3>
                        <p className="text-xs text-surface-500">Category: {selectedContest.title}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-900">{entry.totalVotes.toLocaleString()} votes</p>
                      <p className="text-xs text-surface-500">Free {entry.freeVotes} • Paid {entry.paidVotes}</p>
                    </div>
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
    </VotingPublicLayout>
  );
}
