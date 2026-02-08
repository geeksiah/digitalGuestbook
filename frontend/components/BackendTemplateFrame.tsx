"use client";

import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';

interface Props {
  slug: string;
  endpoint: string; // e.g. 'invitation', 'guestbook', 'rsvp', 'booth', 'thanks', 'guestbook/video'
  className?: string;
}

export function useBackendTemplateAvailable(slug: string, endpoint: string) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      setLoading(true);
      try {
        const url = `${API_BASE_URL}/api/public/event/${slug}/${endpoint}`;
        const res = await fetch(url, { method: 'GET' });
        const ct = res.headers.get('content-type') || '';
        if (cancelled) return;
        if (res.ok && ct.includes('text/html')) {
          setAvailable(true);
        } else {
          setAvailable(false);
        }
      } catch (err) {
        setAvailable(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (slug) check();

    return () => { cancelled = true; };
  }, [slug, endpoint]);

  return { loading, available };
}

export default function BackendTemplateFrame({ slug, endpoint, className }: Props) {
  const { loading, available } = useBackendTemplateAvailable(slug, endpoint);

  if (loading) return null;
  if (!available) return null;

  const src = `${API_BASE_URL}/api/public/event/${slug}/${endpoint}`;

  return (
    <div className={className || 'w-full h-full'} style={{ minHeight: '100vh' }}>
      <iframe
        src={src}
        title={`event-${slug}-${endpoint}`}
        style={{ width: '100%', height: '100vh', border: 'none' }}
      />
    </div>
  );
}
