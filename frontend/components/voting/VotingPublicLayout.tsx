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
  desktopAside,
}: {
  slug: string;
  eventName: string;
  activeTab: VotingPublicTab;
  contestId?: string;
  children: ReactNode;
  showNominateCta?: boolean;
  desktopAside?: ReactNode;
}) {
  const contestQuery = contestId ? `?contestId=${encodeURIComponent(contestId)}` : '';

  const tabClass = (tab: VotingPublicTab) =>
    activeTab === tab
      ? 'page-tabs-item page-tabs-item-active text-center'
      : 'page-tabs-item text-center hover:text-brand-900';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(27,212,188,0.08),transparent_28%),linear-gradient(180deg,#f9fbfa_0%,#f4f7f6_100%)] px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className={desktopAside ? 'space-y-5 lg:grid lg:grid-cols-[minmax(320px,0.42fr)_minmax(0,0.58fr)] lg:items-start lg:gap-5 lg:space-y-0' : 'space-y-5'}>
          <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_24px_80px_rgba(6,57,50,0.08)] backdrop-blur">
            <div className="border-b border-surface-100 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <img src="/img/logo-dark.svg" alt="EventPeepo" className="h-10 w-auto" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Public voting</p>
                    <p className="truncate text-sm text-surface-500">{eventName}</p>
                  </div>
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
            </div>

            <div className="app-hero rounded-none border-0 shadow-none">
              <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">Vote with clarity</p>
                    <h1 className="mt-2 text-3xl font-display font-bold tracking-tight text-brand-900 sm:text-[2.6rem]">{eventName}</h1>
                  </div>
                </div>

                <div className="page-tabs overflow-x-auto scrollbar-hide">
                  <Link href={`/e/${slug}/nominees${contestQuery}`} className={tabClass(activeTab === 'vote' ? 'vote' : 'nominees')}>
                    Nominees
                  </Link>
                  {showNominateCta ? (
                    <Link href={`/e/${slug}/nominate${contestQuery}`} className={tabClass('nominate')}>
                      Nominate
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {desktopAside ? <div className="space-y-5">{desktopAside}</div> : null}
        </div>

        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
}
