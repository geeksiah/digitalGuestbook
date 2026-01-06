import GuestbookFlow from '@/components/guestbook/GuestbookFlow'

export default function GuestbookPage({ params }: { params: { slug: string } }) {
  return <GuestbookFlow eventSlug={params.slug} />
}

