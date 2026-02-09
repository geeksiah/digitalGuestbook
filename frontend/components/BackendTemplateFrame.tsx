"use client";

import React, { useEffect, useState, useRef } from 'react';
import { API_BASE_URL } from '@/lib/api';

interface Props {
  slug: string;
  endpoint: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Hook: check if a backend template is available, and if so, fetch its HTML.
 *
 * When the backend has a template assigned, it responds with Content-Type: text/html.
 * When no template is assigned, it responds with JSON { template: null, data: {...} }.
 *
 * We fetch the HTML content and store it so we can render via srcdoc — this
 * completely avoids the X-Frame-Options cross-origin iframe issue.
 */
export function useBackendTemplate(slug: string, endpoint: string) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchTemplate = async () => {
      setLoading(true);
      setAvailable(false);
      setHtml(null);

      try {
        const url = `${API_BASE_URL}/api/public/event/${slug}/${endpoint}`;
        const res = await fetch(url);
        const ct = res.headers.get('content-type') || '';

        if (cancelled) return;

        if (res.ok && ct.includes('text/html')) {
          const text = await res.text();
          if (cancelled) return;
          setHtml(rewriteAssetUrls(text, API_BASE_URL));
          setAvailable(true);
        } else {
          setAvailable(false);
        }
      } catch {
        if (!cancelled) setAvailable(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (slug) fetchTemplate();
    return () => { cancelled = true; };
  }, [slug, endpoint]);

  return { loading, available, html };
}

/** @deprecated Use useBackendTemplate instead */
export function useBackendTemplateAvailable(slug: string, endpoint: string) {
  const { loading, available } = useBackendTemplate(slug, endpoint);
  return { loading, available };
}

/**
 * Rewrite relative URLs in template HTML so assets resolve to the backend origin.
 * Injects a <base> tag as a catch-all for anything we miss.
 */
function rewriteAssetUrls(html: string, apiBase: string): string {
  const skip = (url: string) => {
    const t = url.trim();
    return !t || t.startsWith('http://') || t.startsWith('https://') ||
      t.startsWith('data:') || t.startsWith('blob:') || t.startsWith('#') ||
      t.startsWith('javascript:') || t.startsWith('mailto:');
  };

  // src, href, action, poster attributes
  let result = html.replace(
    /(src|href|action|poster)=["']([^"']+)["']/gi,
    (match, attr, url) => {
      if (skip(url)) return match;
      const abs = url.startsWith('/') ? `${apiBase}${url}` : `${apiBase}/${url}`;
      return `${attr}="${abs}"`;
    }
  );

  // CSS url() references
  result = result.replace(
    /url\(\s*["']?([^)"']+)["']?\s*\)/gi,
    (match, url) => {
      if (skip(url)) return match;
      const abs = url.startsWith('/') ? `${apiBase}${url}` : `${apiBase}/${url}`;
      return `url("${abs}")`;
    }
  );

  // srcset attributes
  result = result.replace(
    /srcset=["']([^"']+)["']/gi,
    (match, srcset) => {
      const rewritten = srcset.split(',').map((entry: string) => {
        const parts = entry.trim().split(/\s+/);
        const url = parts[0];
        const desc = parts.slice(1).join(' ');
        if (skip(url)) return entry.trim();
        const abs = url.startsWith('/') ? `${apiBase}${url}` : `${apiBase}/${url}`;
        return desc ? `${abs} ${desc}` : abs;
      }).join(', ');
      return `srcset="${rewritten}"`;
    }
  );

  // Inject <base> as catch-all
  if (result.includes('<head>')) {
    result = result.replace('<head>', `<head><base href="${apiBase}/">`);
  } else if (result.includes('<html>')) {
    result = result.replace('<html>', `<html><head><base href="${apiBase}/"></head>`);
  } else {
    result = `<head><base href="${apiBase}/"></head>${result}`;
  }

  return result;
}

/**
 * Renders backend template HTML inside a sandboxed iframe using srcdoc.
 *
 * srcdoc embeds the HTML inline — the browser treats it as same-origin,
 * completely bypassing X-Frame-Options and CSP frame-ancestors restrictions.
 */
export default function BackendTemplateFrame({ slug, endpoint, className, fallback }: Props) {
  const { loading, available, html } = useBackendTemplate(slug, endpoint);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-resize iframe to match content height
  useEffect(() => {
    if (!iframeRef.current || !html) return;
    const iframe = iframeRef.current;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc?.body) return;

        const resize = () => {
          const h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
          iframe.style.height = `${Math.max(h, 100)}px`;
        };

        const ro = new ResizeObserver(resize);
        ro.observe(doc.body);
        resize();
      } catch { /* ignore */ }
    };

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [html]);

  if (loading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!available || !html) return null;

  return (
    <div className={className || 'w-full'} style={{ minHeight: '100vh' }}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title={`event-${slug}-${endpoint}`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        style={{ width: '100%', minHeight: '100vh', border: 'none', display: 'block' }}
      />
    </div>
  );
}