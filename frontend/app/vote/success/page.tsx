'use client';

import { Suspense } from 'react';
import VotePaymentReturnView from '@/components/voting/VotePaymentReturnView';

export default function GlobalVoteSuccessPage() {
  return (
    <Suspense fallback={null}>
      <VotePaymentReturnView />
    </Suspense>
  );
}
