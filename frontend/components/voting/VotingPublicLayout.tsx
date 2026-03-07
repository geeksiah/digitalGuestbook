import Link from 'next/link';
import type { ReactNode } from 'react';

type VotingPublicTab = 'nominees' | 'nominate' | 'leaderboard' | 'results';
type VotingStep = 'choose' | 'verify' | 'cast' | 'confirm';

const STEP_ORDER: VotingStep[] = ['choose', 'verify', 'cast', 'confirm'];

const STEP_LABELS: Record<VotingStep, string> = {
  choose: 'Choose Nominee',
  verify: 'Verify Identity',
  cast: 'Cast Vote',
  confirm: 'Confirmation',
};

const normalizeTab = (tab: VotingPublicTab) => (tab === 'results' ? 'leaderboard' : tab);

export default function VotingPublicLayout({
  slug,
  eventName,
  activeTab,
  contestId,
  children,
  showNominateCta = true,
  desktopAside,
  step = 'choose',
  subtitle,
  showStepIndicator = true,
}: {
  slug: string;
  eventName: string;
  activeTab: VotingPublicTab;
  contestId?: string;
  children: ReactNode;
  showNominateCta?: boolean;
  desktopAside?: ReactNode;
  step?: VotingStep;
  subtitle?: string;
  showStepIndicator?: boolean;
}) {
  const contestQuery = contestId ? `?contestId=${encodeURIComponent(contestId)}` : '';
  const normalizedTab = normalizeTab(activeTab);
  const activeStepIndex = STEP_ORDER.indexOf(step);

  const tabClass = (tab: Exclude<VotingPublicTab, 'results'>) =>
    normalizedTab === tab
      ? 'page-tabs-item page-tabs-item-active text-center'
      : 'page-tabs-item text-center hover:text-brand-900';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(27,212,188,0.07),transparent_32%),linear-gradient(180deg,#f8fbfa_0%,#f3f7f6_100%)] px-4 py-5 sm:px-5 sm:py-6 lg:px-6">
      <div className="mx-auto w-full max-w-[1240px] space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_20px_70px_rgba(6,57,50,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 border-b border-surface-100 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <img src="/img/logo-dark.svg" alt="EventPeepo" className="h-9 w-auto" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Public voting</p>
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-brand-900 sm:text-[2rem]">{eventName}</h1>
                  {subtitle ? <p className="mt-1 text-sm text-surface-500">{subtitle}</p> : null}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href={`/e/${slug}/leaderboard${contestQuery}`} className="btn-outline w-full justify-center sm:w-auto">
                  View Results
                </Link>
                {showNominateCta ? (
                  <Link href={`/e/${slug}/nominate${contestQuery}`} className="btn-primary w-full justify-center sm:w-auto">
                    Nominate Someone
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="page-tabs overflow-x-auto scrollbar-hide">
              <Link href={`/e/${slug}/nominees${contestQuery}`} className={tabClass('nominees')}>
                Nominees
              </Link>
              {showNominateCta ? (
                <Link href={`/e/${slug}/nominate${contestQuery}`} className={tabClass('nominate')}>
                  Nominate
                </Link>
              ) : null}
              <Link href={`/e/${slug}/leaderboard${contestQuery}`} className={tabClass('leaderboard')}>
                Leaderboard
              </Link>
            </div>
          </div>

          {showStepIndicator ? (
            <div className="border-t border-surface-100 bg-surface-50/75 px-5 py-3 sm:px-6">
              <ol className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {STEP_ORDER.map((candidate, index) => {
                  const isComplete = index < activeStepIndex;
                  const isActive = index === activeStepIndex;
                  return (
                    <li
                      key={candidate}
                      className={`flex items-center gap-2 rounded-full px-3 py-2 font-medium transition ${
                        isActive
                          ? 'bg-brand-900 text-white'
                          : isComplete
                          ? 'bg-brand-100 text-brand-900'
                          : 'bg-white text-surface-500 ring-1 ring-surface-200'
                      }`}
                    >
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : isComplete
                            ? 'bg-brand-900 text-white'
                            : 'bg-surface-100 text-surface-500'
                        }`}
                      >
                        {isComplete ? '✓' : index + 1}
                      </span>
                      <span className="truncate">{STEP_LABELS[candidate]}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </section>

        {desktopAside ? (
          <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
            <div className="space-y-5">
              <div className="hidden space-y-5 lg:block">{children}</div>
            </div>
            <div className="space-y-5">{desktopAside}</div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[920px] space-y-5">{children}</div>
        )}

        {desktopAside ? <div className="space-y-5 lg:hidden">{children}</div> : null}
      </div>
    </div>
  );
}
