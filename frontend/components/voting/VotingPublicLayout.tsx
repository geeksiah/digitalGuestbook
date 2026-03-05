import Link from 'next/link';
import type { ReactNode } from 'react';

type VotingPublicTab = 'vote' | 'nominees' | 'results' | 'nominate';

export default function VotingPublicLayout({
  slug,
  eventName,
  activeTab,
  contestId,
  children,
  showNominateCta = true,
}: {
  slug: string;
  eventName: string;
  activeTab: VotingPublicTab;
  contestId?: string;
  children: ReactNode;
  showNominateCta?: boolean;
}) {
  const contestQuery = contestId ? `?contestId=${encodeURIComponent(contestId)}` : '';

  const tabClass = (tab: VotingPublicTab) =>
    activeTab === tab
      ? 'segmented-item segmented-item-active text-center'
      : 'segmented-item text-center hover:text-brand-900';

  return (
    <div className="min-h-screen bg-surface-50 py-5 px-3 sm:px-4">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <section className="phone-stage p-4 sm:p-6">
          <div className="phone-notch mb-3" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-red-500 font-semibold">Public Voting</p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-1 text-brand-900">{eventName}</h1>
              <p className="text-sm text-surface-600 mt-1">Vote, browse nominees, and follow results in real time.</p>
            </div>
            {showNominateCta ? (
              <Link href={`/e/${slug}/nominate${contestQuery}`} className="btn-accent w-full sm:w-auto">
                Nominate Someone
              </Link>
            ) : null}
          </div>

          <div className="mt-4 segmented w-full max-w-md">
            <Link href={`/e/${slug}/vote${contestQuery}`} className={tabClass('vote')}>
              Vote
            </Link>
            <Link href={`/e/${slug}/nominees${contestQuery}`} className={tabClass('nominees')}>
              Nominees
            </Link>
            <Link href={`/e/${slug}/leaderboard${contestQuery}`} className={tabClass('results')}>
              Results
            </Link>
          </div>
        </section>

        {children}
      </div>
    </div>
  );
}

