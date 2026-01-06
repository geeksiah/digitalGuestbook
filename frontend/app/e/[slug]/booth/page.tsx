import GuestbookFlow from '@/components/guestbook/GuestbookFlow'

export default function BoothPage({ params }: { params: { slug: string } }) {
  return <GuestbookFlow eventSlug={params.slug} isBoothMode={true} />
}

