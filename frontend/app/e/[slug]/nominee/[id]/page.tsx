'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import NomineeProfileCategoryCard from '@/components/voting/NomineeProfileCategoryCard';
import PublicStateCard from '@/components/voting/PublicStateCard';
import { votingApi } from '@/lib/api';
import VotingPublicLayout from '@/components/voting/VotingPublicLayout';

type Nominee = {
  optionId: string;
  name: string;
  description: string | null;
  imagePath: string | null;
  imageUrl?: string | null;
  totalVotes: number;
};

type NomineeCategory = {
  contestId: string;
  title: string;
  mode: 'AWARDS' | 'ELECTION';
  nominees: Nominee[];
};

type NomineesPayload = {
  event: { id: string; slug: string; name: string };
  categories: NomineeCategory[];
};

const normalizeName = (value: string) => value.trim().toLowerCase();

export default function NomineeProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.slug || '');
  const nomineeId = String(params.id || '');
  const preferredContestId = String(searchParams.get('contestId') || '');

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState('');
  const [categories, setCategories] = useState<NomineeCategory[]>([]);

  useEffect(() => {
    if (!slug) return;
    const run = async () => {
      setLoading(true);
      try {
        const response = await votingApi.nominees(slug);
        const payload = ((response.data as any)?.data || response.data || {}) as Partial<NomineesPayload>;
        const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
        const normalizedCategories: NomineeCategory[] = rawCategories.map((category: any) => ({
          contestId: String(category?.contestId || category?.id || ''),
          title: String(category?.title || category?.name || 'Untitled category'),
          mode: (category?.mode === 'ELECTION' ? 'ELECTION' : 'AWARDS') as 'AWARDS' | 'ELECTION',
          nominees: (Array.isArray(category?.nominees) ? category.nominees : []).map((nominee: any) => ({
            optionId: String(nominee?.optionId || nominee?.id || ''),
            name: String(nominee?.name || 'Unnamed nominee'),
            description: nominee?.description ? String(nominee.description) : null,
            imagePath: nominee?.imagePath ? String(nominee.imagePath) : null,
            imageUrl: nominee?.imageUrl ? String(nominee.imageUrl) : null,
            totalVotes: Number(nominee?.totalVotes || 0),
          })).filter((nominee: Nominee) => Boolean(nominee.optionId)),
        })).filter((category) => category.contestId);

        setEventName(String(payload?.event?.name || slug));
        setCategories(normalizedCategories);
      } catch (error: any) {
        toast.error(error?.response?.data?.error || 'Failed to load nominee profile');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [slug]);

  const selectedNominee = useMemo(() => {
    for (const category of categories) {
      const nominee = category.nominees.find((entry) => entry.optionId === nomineeId);
      if (nominee) return nominee;
    }
    return null;
  }, [categories, nomineeId]);

  const nomineeCategories = useMemo(() => {
    if (!selectedNominee) return [];
    const canonicalName = normalizeName(selectedNominee.name);
    const linked = categories.flatMap((category) =>
      category.nominees
        .filter((entry) => normalizeName(entry.name) === canonicalName)
        .map((entry) => ({
          contestId: category.contestId,
          categoryTitle: category.title,
          mode: category.mode,
          optionId: entry.optionId,
          votes: entry.totalVotes,
        }))
    );

    if (!linked.length) {
      return preferredContestId
        ? [
            {
              contestId: preferredContestId,
              categoryTitle: 'Category',
              mode: 'AWARDS' as const,
              optionId: nomineeId,
              votes: selectedNominee.totalVotes,
            },
          ]
        : [];
    }
    return linked;
  }, [categories, nomineeId, preferredContestId, selectedNominee]);

  const copyVoteLink = async (contestId: string, optionId: string) => {
    const url = `${window.location.origin}/e/${slug}/vote?contestId=${encodeURIComponent(contestId)}&optionId=${encodeURIComponent(optionId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Direct vote link copied');
    } catch {
      toast.error('Unable to copy vote link');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  if (!selectedNominee) {
    return (
      <PublicStateCard
        title="Nominee Not Found"
        description="This nominee may have been removed or is no longer published."
        actionHref={`/e/${slug}/nominees`}
        actionLabel="Back to nominees"
      />
    );
  }

  return (
    <VotingPublicLayout slug={slug} eventName={eventName || slug} activeTab="nominees">
      <section className="dashboard-canvas p-5">
        <div className="grid gap-4 md:grid-cols-[120px_1fr]">
          {selectedNominee.imageUrl || selectedNominee.imagePath ? (
            <img
              src={selectedNominee.imageUrl || selectedNominee.imagePath || ''}
              alt={selectedNominee.name}
              className="h-28 w-28 rounded-2xl border border-surface-200 object-cover"
            />
          ) : (
            <div className="h-28 w-28 rounded-2xl border border-surface-200 bg-surface-100" />
          )}
          <div>
            <h2 className="text-2xl font-bold text-brand-900">{selectedNominee.name}</h2>
            <p className="text-sm text-surface-600 mt-2">
              {selectedNominee.description || 'Support this nominee by voting in one or more categories below.'}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <h3 className="text-base font-semibold text-brand-900">Categories</h3>
          {nomineeCategories.map((entry) => (
            <NomineeProfileCategoryCard
              key={`${entry.contestId}:${entry.optionId}`}
              title={entry.categoryTitle}
              mode={entry.mode}
              votesLabel={`${entry.votes.toLocaleString()} votes`}
              voteHref={`/e/${slug}/vote?contestId=${encodeURIComponent(entry.contestId)}&optionId=${encodeURIComponent(entry.optionId)}`}
              onCopyVoteLink={() => {
                void copyVoteLink(entry.contestId, entry.optionId);
              }}
            />
          ))}
        </div>
      </section>
    </VotingPublicLayout>
  );
}
