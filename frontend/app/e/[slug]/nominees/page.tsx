'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { votingApi } from '@/lib/api';

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
  const [modeFilter, setModeFilter] = useState<'ALL' | 'AWARDS' | 'ELECTION'>('ALL');

  const visibleCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const scopedCategories = selectedCategory
      ? categories.filter((category) => category.contestId === selectedCategory)
      : categories;

    return scopedCategories
      .filter((category) => (modeFilter === 'ALL' ? true : category.mode === modeFilter))
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
  }, [categories, selectedCategory, modeFilter, searchQuery]);

  useEffect(() => {
    if (!slug) return;
    const run = async () => {
      setLoading(true);
      try {
        const response = await votingApi.nominees(slug);
        const payload = ((response.data as any)?.data || response.data || {}) as Partial<NomineesPayload>;
        const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
        const categoriesData: NomineeCategory[] = rawCategories.map((category: any) => ({
          contestId: String(category?.contestId || category?.id || ''),
          title: String(category?.title || category?.name || 'Untitled category'),
          mode: (category?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
          totalVotes: Number(category?.totalVotes || 0),
          nominees: (Array.isArray(category?.nominees) ? category.nominees : []).map((nominee: any) => ({
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
          })).filter((nominee: Nominee) => Boolean(nominee.optionId)),
        })).filter((category) => category.contestId);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 py-6 px-4">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="phone-stage p-6">
          <div className="phone-notch mb-4" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-red-500 font-semibold">Nominees</p>
          <h1 className="text-3xl font-bold mt-2 text-brand-900">{eventName}</h1>
          <p className="text-sm text-surface-600 mt-1">Browse approved nominees by category and jump straight into voting.</p>
          <div className="mt-4 segmented w-full max-w-md">
            <Link
              href={`/e/${slug}/nominate${selectedCategory ? `?contestId=${encodeURIComponent(selectedCategory)}` : ''}`}
              className="segmented-item text-center hover:text-brand-900"
            >
              Nominate
            </Link>
            <span className="segmented-item segmented-item-active text-center">Nominees</span>
            <Link
              href={`/e/${slug}/leaderboard${selectedCategory ? `?contestId=${encodeURIComponent(selectedCategory)}` : ''}`}
              className="segmented-item text-center hover:text-brand-900"
            >
              Results
            </Link>
          </div>
        </section>

        <section className="dashboard-canvas p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-brand-900">Category Nominees</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
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
            <select className="input" value={modeFilter} onChange={(event) => setModeFilter(event.target.value as 'ALL' | 'AWARDS' | 'ELECTION')}>
              <option value="ALL">All modes</option>
              <option value="AWARDS">Awards</option>
              <option value="ELECTION">Election</option>
            </select>
          </div>

          {!visibleCategories.length ? (
            <p className="text-surface-600">No nominees match your filters.</p>
          ) : (
            <div className="space-y-5">
              {visibleCategories.map((category) => (
                <div key={category.contestId} className="rounded-3xl border border-surface-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-semibold text-brand-900">{category.title}</h3>
                      <p className="text-xs text-surface-600">
                        {category.mode} - {category.totalVotes.toLocaleString()} total votes
                      </p>
                    </div>
                    <Link
                      href={`/e/${slug}/leaderboard?contestId=${encodeURIComponent(category.contestId)}`}
                      className="text-xs font-semibold text-red-700 hover:text-red-800"
                    >
                      Leaderboard
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {category.nominees.map((nominee, index) => {
                      return (
                        <article key={nominee.optionId} className="focus-card">
                          <div className="flex items-center gap-3">
                            {nominee.imageUrl || nominee.imagePath ? (
                              <img
                                src={nominee.imageUrl || nominee.imagePath || ''}
                                alt={nominee.name}
                                className="h-11 w-11 rounded-full border border-surface-200 object-cover"
                              />
                            ) : (
                              <div className="h-11 w-11 rounded-full border border-surface-200 bg-surface-100" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-surface-500">Rank #{index + 1}</p>
                              <h4 className="font-semibold text-brand-900 truncate">{nominee.name}</h4>
                            </div>
                            <span className="text-[11px] px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                              {nominee.voteSharePercent.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-sm text-surface-600 mt-2 min-h-[40px]">
                            {nominee.description || 'Learn more and cast your vote from this card.'}
                          </p>
                          <div className="mt-2 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                            <div className="h-1.5 rounded-full bg-[#ff3b30]" style={{ width: `${Math.min(100, Math.max(0, nominee.voteSharePercent))}%` }} />
                          </div>
                          <p className="mt-1.5 text-xs text-surface-500">
                            Total Votes: <b className="text-brand-900">{nominee.totalVotes.toLocaleString()}</b>
                          </p>
                          <div className="mt-3 flex gap-2">
                            <Link
                              href={`/e/${slug}/vote?contestId=${encodeURIComponent(category.contestId)}&optionId=${encodeURIComponent(nominee.optionId)}`}
                              className="btn-accent flex-1 !min-h-[38px] !py-2 !text-sm !rounded-full"
                            >
                              Vote
                            </Link>
                            <Link
                              href={`/e/${slug}/leaderboard?contestId=${encodeURIComponent(category.contestId)}`}
                              className="flex-1 text-center px-3 py-2 rounded-full border border-surface-300 text-surface-700 hover:bg-surface-100 text-sm font-semibold transition-colors"
                            >
                              Results
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
