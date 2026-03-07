'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { votingApi } from '@/lib/api';
import PublicLeaderboardEntry from '@/components/voting/PublicLeaderboardEntry';
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
      return String(entry.name || '').toLowerCase().includes(query);
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
        const dataContests: LeaderboardContest[] = rawContests
          .map((contest: any) => ({
            contestId: String(contest?.contestId || contest?.id || ''),
            title: String(contest?.title || contest?.name || 'Untitled category'),
            mode: (contest?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
            totals: {
              totalVotes: Number(contest?.totals?.totalVotes || 0),
              freeVotes: Number(contest?.totals?.freeVotes || 0),
              paidVotes: Number(contest?.totals?.paidVotes || 0),
            },
            rankings: (Array.isArray(contest?.rankings) ? contest.rankings : [])
              .map((entry: any, index: number) => ({
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
              }))
              .filter((entry: RankedNominee) => Boolean(entry.optionId)),
          }))
          .filter((contest) => contest.contestId);

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

  useEffect(() => {
    if (!slug) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void votingApi.leaderboard(slug, selectedContestId || undefined).then((response) => {
        const payload = ((response.data as any)?.data || response.data || {}) as Partial<LeaderboardPayload>;
        const rawContests = Array.isArray(payload.contests) ? payload.contests : [];
        const dataContests: LeaderboardContest[] = rawContests
          .map((contest: any) => ({
            contestId: String(contest?.contestId || contest?.id || ''),
            title: String(contest?.title || contest?.name || 'Untitled category'),
            mode: (contest?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
            totals: {
              totalVotes: Number(contest?.totals?.totalVotes || 0),
              freeVotes: Number(contest?.totals?.freeVotes || 0),
              paidVotes: Number(contest?.totals?.paidVotes || 0),
            },
            rankings: (Array.isArray(contest?.rankings) ? contest.rankings : [])
              .map((entry: any, index: number) => ({
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
              }))
              .filter((entry: RankedNominee) => Boolean(entry.optionId)),
          }))
          .filter((contest) => contest.contestId);
        setContests(dataContests);
      }).catch(() => {});
    };
    const interval = window.setInterval(refresh, 12000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [slug, selectedContestId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <VotingPublicLayout slug={slug} eventName={eventName} activeTab="results" contestId={selectedContestId}>
      <div className="space-y-5">
        <section className="subtle-toolbar">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Leaderboard</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">Track who is leading</h2>
            <p className="mt-1 text-sm text-surface-500">Choose a category and vote for a nominee.</p>
          </div>
          {selectedContest ? (
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-900 ring-1 ring-surface-200">
              {selectedContest.title}
            </span>
          ) : null}
        </section>

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className="detail-card space-y-4">
              <div className="grid gap-3 rounded-[24px] border border-surface-200 bg-surface-50/80 p-4">
                <select className="input" value={selectedContestId} onChange={(event) => setSelectedContestId(event.target.value)}>
                  {contests.map((contest) => (
                    <option key={contest.contestId} value={contest.contestId}>
                      {contest.title} ({contest.mode})
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  placeholder="Search nominee"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
            </section>
          </aside>

          <section className="detail-card space-y-4">
            {!selectedContest ? (
              <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-4 py-12 text-center text-sm text-surface-500">
                No leaderboard data yet.
              </div>
            ) : (
              <>
                <div className="rounded-[24px] border border-surface-200 bg-white px-4 py-4">
                  <h3 className="text-xl font-semibold tracking-tight text-brand-900">{selectedContest.title}</h3>
                  <p className="mt-1 text-sm text-surface-500">{selectedContest.mode === 'ELECTION' ? 'Election' : 'Awards'} category</p>
                </div>
                {visibleRankings.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-4 py-12 text-center text-sm text-surface-500">
                    No nominees match your filters.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleRankings.map((entry) => (
                      <PublicLeaderboardEntry
                        key={entry.optionId}
                        rank={entry.rank}
                        imageSrc={entry.imageUrl || entry.imagePath || ''}
                        name={entry.name}
                        votesLabel={`${entry.totalVotes.toLocaleString()} votes`}
                        voteHref={`/e/${slug}/vote?contestId=${encodeURIComponent(selectedContest.contestId)}&optionId=${encodeURIComponent(entry.optionId)}`}
                        profileHref={`/e/${slug}/nominee/${encodeURIComponent(entry.optionId)}?contestId=${encodeURIComponent(selectedContest.contestId)}`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </VotingPublicLayout>
  );
}
