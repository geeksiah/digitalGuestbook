'use client'

import { useParams } from 'next/navigation'
import GuestbookFlow from '@/components/guestbook/GuestbookFlow'
import BoothModeWrapper from '@/components/guestbook/BoothModeWrapper'

export default function BoothPage() {
  const params = useParams()
  const slug = params.slug as string

  return (
    <BoothModeWrapper
      autoResetDelay={30000}
      onReset={() => {
        window.location.reload()
      }}
    >
      <GuestbookFlow eventSlug={slug} isBoothMode={true} />
    </BoothModeWrapper>
  )
}

