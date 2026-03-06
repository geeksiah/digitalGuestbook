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
      ? 'page-tabs-item page-tabs-item-active text-center'
      : 'page-tabs-item text-center hover:text-brand-900';

  return (
    <div className="min-h-screen bg-surface-50 px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <section className="app-hero overflow-hidden">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="mb-4 flex items-center gap-3">
                  <img src="/img/logo-dark.svg" alt="EventPeepo" className="h-9 w-auto" />
                  <span className="hidden text-sm text-surface-400 sm:inline">Public voting</span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">Vote with confidence</p>
                <h1 className="mt-1 text-3xl font-display font-bold tracking-tight text-brand-900 sm:text-[2.5rem]">{eventName}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-surface-600 sm:text-[15px]">
                  Browse nominees, cast votes, and track results in one clear flow.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href={`/e/${slug}/leaderboard${contestQuery}`} className="btn-outline w-full sm:w-auto">
                  View Results
                </Link>
                {showNominateCta ? (
                  <Link href={`/e/${slug}/nominate${contestQuery}`} className="btn-primary w-full sm:w-auto">
                    Nominate Someone
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="page-tabs overflow-x-auto scrollbar-hide">
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
          </div>
        </section>

        {children}
      </div>
    </div>
  );
}
