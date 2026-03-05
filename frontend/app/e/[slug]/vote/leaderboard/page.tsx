import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function VoteLeaderboardShortcutPage({ params }: Props) {
  const resolved = await params;
  redirect(`/e/${resolved.slug}/leaderboard`);
}
