'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { votingApi } from '@/lib/api';

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
  const [modeFilter, setModeFilter] = useState<'ALL' | 'AWARDS' | 'ELECTION'>('ALL');

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.contestId === selectedContestId) || null,
    [contests, selectedContestId]
  );

  const visibleRankings = useMemo(() => {
    if (!selectedContest) return [];
    const query = searchQuery.trim().toLowerCase();
    return selectedContest.rankings.filter((entry) => {
      if (modeFilter !== 'ALL' && selectedContest.mode !== modeFilter) return false;
      if (!query) return true;
      const name = String(entry.name || '').toLowerCase();
      const description = String(entry.description || '').toLowerCase();
      return name.includes(query) || description.includes(query);
    });
  }, [selectedContest, searchQuery, modeFilter]);

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
            <div className="flex flex-wrap gap-2">
              <select className="input max-w-[320px]" value={selectedContestId} onChange={(event) => setSelectedContestId(event.target.value)}>
                {contests.map((contest) => (
                  <option key={contest.contestId} value={contest.contestId}>
                    {contest.title} ({contest.mode})
                  </option>
                ))}
              </select>
              <select className="input max-w-[150px]" value={modeFilter} onChange={(event) => setModeFilter(event.target.value as 'ALL' | 'AWARDS' | 'ELECTION')}>
                <option value="ALL">All modes</option>
                <option value="AWARDS">Awards</option>
                <option value="ELECTION">Election</option>
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
                        <p className="text-xs text-surface-600 mt-0.5">{entry.description || 'Track live standing and vote from this row.'}</p>
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
