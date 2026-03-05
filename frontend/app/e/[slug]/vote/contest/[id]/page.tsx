import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{
    slug: string;
    id: string;
  }>;
};

export default async function VoteContestPage({ params }: Props) {
  const resolved = await params;
  redirect(`/e/${resolved.slug}/vote?contestId=${encodeURIComponent(resolved.id)}`);
}
