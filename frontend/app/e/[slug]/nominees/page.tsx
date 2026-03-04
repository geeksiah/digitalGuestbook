'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { votingApi } from '@/lib/api';
import BackendTemplateFrame, { useBackendTemplate } from '@/components/BackendTemplateFrame';

type Nominee = {
  optionId: string;
  name: string;
  description: string | null;
  imagePath: string | null;
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
  const { loading: templateLoading, available: hasTemplate } = useBackendTemplate(slug, 'nominees-page');

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState('');
  const [categories, setCategories] = useState<NomineeCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const visibleCategories = useMemo(() => {
    if (!selectedCategory) return categories;
    return categories.filter((category) => category.contestId === selectedCategory);
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (!slug || templateLoading || hasTemplate) return;
    const run = async () => {
      setLoading(true);
      try {
        const response = await votingApi.nominees(slug);
        const payload = response.data as NomineesPayload;
        const categoriesData = payload.categories || [];
        setEventName(payload.event?.name || '');
        setCategories(categoriesData);
        const validQuery = contestQuery && categoriesData.some((category) => category.contestId === contestQuery);
        setSelectedCategory(validQuery ? contestQuery : categoriesData[0]?.contestId || '');
      } catch (error: any) {
        toast.error(error?.response?.data?.error || 'Failed to load nominees');
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
    return <BackendTemplateFrame slug={slug} endpoint="nominees-page" refreshIntervalMs={15000} revalidateOnFocus forceFresh />;
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
            <select className="input max-w-[360px]" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
              {categories.map((category) => (
                <option key={category.contestId} value={category.contestId}>
                  {category.title} ({category.mode})
                </option>
              ))}
            </select>
          </div>

          {!visibleCategories.length ? (
            <p className="text-surface-600">No nominees are currently available.</p>
          ) : (
            <div className="space-y-5">
              {visibleCategories.map((category) => (
                <div key={category.contestId} className="rounded-3xl border border-surface-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-semibold text-brand-900">{category.title}</h3>
                      <p className="text-xs text-surface-600">
                        {category.mode} • {category.totalVotes.toLocaleString()} total votes
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
                      const initials = nominee.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <article key={nominee.optionId} className="focus-card">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-full border border-surface-200 bg-surface-100 flex items-center justify-center text-xs font-semibold text-brand-900">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-surface-500">Rank #{index + 1}</p>
                              <h4 className="font-semibold text-brand-900 truncate">{nominee.name}</h4>
                            </div>
                            <span className="text-[11px] px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                              {nominee.voteSharePercent.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-sm text-surface-600 mt-2 min-h-[40px]">
                            {nominee.description || 'Nominee profile'}
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
