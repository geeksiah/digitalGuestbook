import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{
    slug: string;
    id: string;
  }>;
};

export default async function VoteOptionPage({ params }: Props) {
  const resolved = await params;
  redirect(`/e/${resolved.slug}/vote?optionId=${encodeURIComponent(resolved.id)}`);
}
