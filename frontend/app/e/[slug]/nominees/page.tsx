'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { votingApi } from '@/lib/api';
import PublicNomineeCard from '@/components/voting/PublicNomineeCard';
import VotingPublicLayout from '@/components/voting/VotingPublicLayout';
import { resolvePublicAssetUrl } from '@/lib/utils';

type Nominee = {
  optionId: string;
  name: string;
  description: string | null;
  imagePath: string | null;
  imageUrl?: string | null;
  totalVotes: number;
  freeVotes: number;
  paidVotes: number;
  voteSharePercent: number;
  approvalStatus: 'APPROVED' | 'ADMIN_ADDED';
};

type NomineeCategory = {
  contestId: string;
  title: string;
  mode: 'AWARDS' | 'ELECTION';
  totalVotes: number;
  nominees: Nominee[];
};

type NomineesPayload = {
  event: { id: string; slug: string; name: string };
  categories: NomineeCategory[];
};

export default function NomineesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.slug || '');
  const contestQuery = String(searchParams.get('contestId') || '');

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState('');
  const [categories, setCategories] = useState<NomineeCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const visibleCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const scopedCategories = selectedCategory
      ? categories.filter((category) => category.contestId === selectedCategory)
      : categories;

    return scopedCategories
      .map((category) => {
        const nominees = query
          ? category.nominees.filter((nominee) => {
              const name = nominee.name.toLowerCase();
              const description = String(nominee.description || '').toLowerCase();
              return name.includes(query) || description.includes(query);
            })
          : category.nominees;

        return {
          ...category,
          nominees: [...nominees].sort((a, b) => Number(b.totalVotes || 0) - Number(a.totalVotes || 0)),
        };
      })
      .filter((category) => category.nominees.length > 0);
  }, [categories, selectedCategory, searchQuery]);

  const totalNominees = useMemo(
    () => categories.reduce((sum, category) => sum + category.nominees.length, 0),
    [categories]
  );
  const spotlight = useMemo(() => {
    const rankedCandidates = visibleCategories
      .flatMap((category) =>
        category.nominees.map((nominee) => ({
          category,
          nominee,
        }))
      )
      .sort((a, b) => Number(b.nominee.totalVotes || 0) - Number(a.nominee.totalVotes || 0));
    return rankedCandidates[0] || null;
  }, [visibleCategories]);

  const copyVoteLink = async (contestId: string, optionId: string) => {
    const url = `${window.location.origin}/e/${slug}/vote?contestId=${encodeURIComponent(contestId)}&optionId=${encodeURIComponent(optionId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Direct vote link copied');
    } catch {
      toast.error('Unable to copy vote link');
    }
  };

  useEffect(() => {
    if (!slug) return;
    const run = async () => {
      setLoading(true);
      try {
        const response = await votingApi.nominees(slug);
        const payload = ((response.data as any)?.data || response.data || {}) as Partial<NomineesPayload>;
        const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
        const categoriesData: NomineeCategory[] = rawCategories
          .map((category: any) => ({
            contestId: String(category?.contestId || category?.id || ''),
            title: String(category?.title || category?.name || 'Untitled category'),
            mode: (category?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
            totalVotes: Number(category?.totalVotes || 0),
            nominees: (Array.isArray(category?.nominees) ? category.nominees : [])
              .map((nominee: any) => ({
                optionId: String(nominee?.optionId || nominee?.id || ''),
                name: String(nominee?.name || 'Unnamed nominee'),
                description: nominee?.description ? String(nominee.description) : null,
                imagePath: nominee?.imagePath ? String(nominee.imagePath) : null,
                imageUrl: nominee?.imageUrl ? String(nominee.imageUrl) : null,
                totalVotes: Number(nominee?.totalVotes || 0),
                freeVotes: Number(nominee?.freeVotes || 0),
                paidVotes: Number(nominee?.paidVotes || 0),
                voteSharePercent: Number(nominee?.voteSharePercent || 0),
                approvalStatus: nominee?.approvalStatus === 'APPROVED' ? 'APPROVED' : 'ADMIN_ADDED',
              }))
              .filter((nominee: Nominee) => Boolean(nominee.optionId)),
          }))
          .filter((category) => category.contestId);

        setEventName(String(payload?.event?.name || slug));
        setCategories(categoriesData);
        const validQuery = contestQuery && categoriesData.some((category) => category.contestId === contestQuery);
        setSelectedCategory(validQuery ? contestQuery : '');
      } catch (error: any) {
        toast.error(error?.response?.data?.error || 'Failed to load nominees');
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
      void votingApi.nominees(slug, selectedCategory || undefined).then((response) => {
        const payload = ((response.data as any)?.data || response.data || {}) as Partial<NomineesPayload>;
        const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
        const categoriesData: NomineeCategory[] = rawCategories
          .map((category: any) => ({
            contestId: String(category?.contestId || category?.id || ''),
            title: String(category?.title || category?.name || 'Untitled category'),
            mode: (category?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
            totalVotes: Number(category?.totalVotes || 0),
            nominees: (Array.isArray(category?.nominees) ? category.nominees : [])
              .map((nominee: any) => ({
                optionId: String(nominee?.optionId || nominee?.id || ''),
                name: String(nominee?.name || 'Unnamed nominee'),
                description: nominee?.description ? String(nominee.description) : null,
                imagePath: nominee?.imagePath ? String(nominee.imagePath) : null,
                imageUrl: nominee?.imageUrl ? String(nominee.imageUrl) : null,
                totalVotes: Number(nominee?.totalVotes || 0),
                freeVotes: Number(nominee?.freeVotes || 0),
                paidVotes: Number(nominee?.paidVotes || 0),
                voteSharePercent: Number(nominee?.voteSharePercent || 0),
                approvalStatus: nominee?.approvalStatus === 'APPROVED' ? 'APPROVED' : 'ADMIN_ADDED',
              }))
              .filter((nominee: Nominee) => Boolean(nominee.optionId)),
          }))
          .filter((category) => category.contestId);
        setCategories(categoriesData);
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
  }, [slug, selectedCategory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <VotingPublicLayout slug={slug} eventName={eventName} activeTab="nominees" contestId={selectedCategory} step="choose">
      <div className="space-y-5">
        <section className="subtle-toolbar">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">Nominee directory</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900">Browse all nominees</h2>
            <p className="mt-1 text-sm text-surface-500">Choose a category, scan profiles, then vote.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-900 ring-1 ring-surface-200">
              {categories.length} categories
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-surface-600 ring-1 ring-surface-200">
              {totalNominees} nominees
            </span>
          </div>
        </section>

        <section className="detail-card space-y-5">
          <div className="grid gap-3 rounded-[24px] border border-surface-200 bg-surface-50/80 p-4 md:grid-cols-[minmax(0,1fr)_280px]">
            <input
              className="input"
              placeholder="Search nominees"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <select className="input" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.contestId} value={category.contestId}>
                  {category.title} ({category.mode})
                </option>
              ))}
            </select>
          </div>

          {categories.length > 0 ? (
            <div className="page-tabs overflow-x-auto scrollbar-hide">
              <button
                type="button"
                className={`page-tabs-item ${selectedCategory === '' ? 'page-tabs-item-active' : ''}`}
                onClick={() => setSelectedCategory('')}
              >
                All categories
              </button>
              {categories.map((category) => (
                <button
                  key={category.contestId}
                  type="button"
                  className={`page-tabs-item ${selectedCategory === category.contestId ? 'page-tabs-item-active' : ''}`}
                  onClick={() => setSelectedCategory(category.contestId)}
                >
                  {category.title}
                </button>
              ))}
            </div>
          ) : null}

          {spotlight ? (
            <article className="overflow-hidden rounded-[28px] border border-surface-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
              <div className="grid gap-4 p-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:p-5">
                {resolvePublicAssetUrl(spotlight.nominee.imageUrl || spotlight.nominee.imagePath) ? (
                  <img
                    src={resolvePublicAssetUrl(spotlight.nominee.imageUrl || spotlight.nominee.imagePath) || ''}
                    alt={spotlight.nominee.name}
                    className="h-40 w-full rounded-[22px] border border-surface-200 object-cover sm:h-full"
                  />
                ) : (
                  <div className="h-40 w-full rounded-[22px] border border-surface-200 bg-surface-100" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Nominee spotlight</p>
                  <Link
                    href={`/e/${slug}/nominee/${encodeURIComponent(spotlight.nominee.optionId)}?contestId=${encodeURIComponent(spotlight.category.contestId)}`}
                    className="mt-1 block text-2xl font-semibold tracking-tight text-brand-900 underline-offset-4 hover:underline"
                  >
                    {spotlight.nominee.name}
                  </Link>
                  <p className="mt-1 text-sm font-medium text-surface-500">{spotlight.category.title}</p>
                  <p className="mt-2 text-sm text-brand-900">{spotlight.nominee.totalVotes.toLocaleString()} votes</p>
                  <p
                    className="mt-2 text-sm leading-6 text-surface-500"
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 3,
                      overflow: 'hidden',
                    }}
                  >
                    {spotlight.nominee.description || 'Open this profile to review full details and vote.'}
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Link
                      href={`/e/${slug}/vote?contestId=${encodeURIComponent(spotlight.category.contestId)}&optionId=${encodeURIComponent(spotlight.nominee.optionId)}`}
                      className="btn-primary w-full justify-center sm:w-auto"
                    >
                      Vote
                    </Link>
                    <Link
                      href={`/e/${slug}/nominee/${encodeURIComponent(spotlight.nominee.optionId)}?contestId=${encodeURIComponent(spotlight.category.contestId)}`}
                      className="btn-outline w-full justify-center sm:w-auto"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ) : null}

          {!visibleCategories.length ? (
            <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-4 py-12 text-center text-sm text-surface-500">
              No nominees match your filters.
            </div>
          ) : (
            <div className="space-y-6">
              {visibleCategories.map((category) => (
                <div key={category.contestId} className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-[24px] border border-surface-200 bg-white px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-brand-900">{category.title}</h3>
                      <p className="mt-1 text-sm text-surface-500">
                        {category.mode === 'ELECTION' ? 'Election' : 'Awards'} category
                      </p>
                    </div>
                    <Link
                      href={`/e/${slug}/leaderboard?contestId=${encodeURIComponent(category.contestId)}`}
                      className="btn-outline w-full text-center sm:w-auto"
                    >
                      View leaderboard
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {category.nominees.map((nominee) => (
                      <PublicNomineeCard
                        key={nominee.optionId}
                        imageSrc={nominee.imageUrl || nominee.imagePath || ''}
                        name={nominee.name}
                        description={nominee.description || 'Support this nominee with your vote.'}
                        votesLabel={`${nominee.totalVotes.toLocaleString()} votes`}
                        badgeLabel={category.mode}
                        categoryLabel={category.title}
                        voteHref={`/e/${slug}/vote?contestId=${encodeURIComponent(category.contestId)}&optionId=${encodeURIComponent(nominee.optionId)}`}
                        profileHref={`/e/${slug}/nominee/${encodeURIComponent(nominee.optionId)}?contestId=${encodeURIComponent(category.contestId)}`}
                        onCopyVoteLink={() => copyVoteLink(category.contestId, nominee.optionId)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </VotingPublicLayout>
  );
}
