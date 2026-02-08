"use client";

import BackendTemplateFrame from '@/components/BackendTemplateFrame';
import { useParams } from 'next/navigation';

export default function InvitationPage() {
  const params = useParams();
  const slug = params.slug as string;

  return <BackendTemplateFrame slug={slug} endpoint="invitation" />;
}
