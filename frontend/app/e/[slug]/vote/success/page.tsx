'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import VotePaymentReturnView from '@/components/voting/VotePaymentReturnView';

export default function VoteSuccessPage() {
  const params = useParams();
  return (
    <Suspense fallback={null}>
      <VotePaymentReturnView slugFromParams={String(params.slug || '')} />
    </Suspense>
  );
}
