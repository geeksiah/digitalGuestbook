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
          // Rewrite relative asset URLs to point to the backend
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

  return result;
}

/**
 * Extract content between <head>...</head> and <body>...</body> from a full HTML document.
 * Returns { headContent, bodyContent, bodyAttrs } so we can inject them properly.
 */
function parseTemplateHtml(html: string): {
  headContent: string;
  bodyContent: string;
  bodyAttrs: string;
  fullHtml: string;
} {
  // Extract <head> inner content
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  // Extract <body> inner content and attributes
  const bodyMatch = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  const bodyAttrs = bodyMatch ? bodyMatch[1] : '';
  const bodyContent = bodyMatch ? bodyMatch[2] : html;

  return { headContent, bodyContent, bodyAttrs, fullHtml: html };
}

/**
 * Renders backend template HTML by taking over the entire page.
 * 
 * APPROACH: Instead of using an iframe (which causes scrolling issues, height 
 * miscalculation, content clipping, and distortion), we:
 * 
 * 1. Parse the template HTML to extract <head> and <body> content
 * 2. Inject <head> elements (styles, meta tags, fonts) into the document head
 * 3. Render <body> content directly into the page via dangerouslySetInnerHTML
 * 4. Execute any <script> tags found in the template
 * 5. Clean up injected head elements on unmount
 * 
 * This gives the template FULL control of the page — no iframe sandbox,
 * no scrolling issues, no height problems, no distortion.
 */
export default function BackendTemplateFrame({ slug, endpoint, className, fallback }: Props) {
  const { loading, available, html } = useBackendTemplate(slug, endpoint);
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedElementsRef = useRef<HTMLElement[]>([]);

  // Inject head elements and execute scripts when HTML is available
  useEffect(() => {
    if (!html || !containerRef.current) return;

    const { headContent, bodyContent } = parseTemplateHtml(html);

    // ── 1. Inject <head> content (styles, fonts, meta) into document.head ──
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = headContent;
    const injected: HTMLElement[] = [];

    // Process each element in <head>
    Array.from(tempDiv.children).forEach((el) => {
      const tagName = el.tagName.toLowerCase();
      
      // Skip title and meta charset (keep Next.js ones)
      if (tagName === 'title') return;
      if (tagName === 'meta' && el.getAttribute('charset')) return;

      // Clone and inject into document head
      const clone = el.cloneNode(true) as HTMLElement;
      clone.setAttribute('data-template-injected', 'true');
      document.head.appendChild(clone);
      injected.push(clone);
    });

    injectedElementsRef.current = injected;

    // ── 2. Execute <script> tags in the body content ──
    // dangerouslySetInnerHTML doesn't execute scripts, so we do it manually
    const container = containerRef.current;
    const scripts = container.querySelectorAll('script');
    scripts.forEach((originalScript) => {
      const newScript = document.createElement('script');
      // Copy all attributes
      Array.from(originalScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      // Copy inline content
      if (originalScript.textContent) {
        newScript.textContent = originalScript.textContent;
      }
      originalScript.parentNode?.replaceChild(newScript, originalScript);
    });

    // ── 3. Apply body attributes (class, style, data-* etc.) ──
    const { bodyAttrs } = parseTemplateHtml(html);
    if (bodyAttrs.trim()) {
      const tempBody = document.createElement('body');
      // Parse attributes by creating a temporary element
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `<div ${bodyAttrs}></div>`;
      const attrSource = wrapper.firstElementChild;
      if (attrSource) {
        Array.from(attrSource.attributes).forEach((attr) => {
          // Add template body classes/styles to actual body
          if (attr.name === 'class') {
            attr.value.split(/\s+/).forEach(cls => {
              if (cls) document.body.classList.add(cls);
            });
          } else if (attr.name === 'style') {
            document.body.style.cssText += '; ' + attr.value;
          } else {
            document.body.setAttribute(`data-tpl-${attr.name}`, attr.value);
          }
        });
      }
    }

    // ── Cleanup on unmount ──
    return () => {
      // Remove injected head elements
      injectedElementsRef.current.forEach((el) => {
        try { el.remove(); } catch { /* ignore */ }
      });
      injectedElementsRef.current = [];

      // Remove body classes/styles we added
      document.body.removeAttribute('style');
      // Remove data-tpl-* attributes
      Array.from(document.body.attributes).forEach((attr) => {
        if (attr.name.startsWith('data-tpl-')) {
          document.body.removeAttribute(attr.name);
        }
      });
    };
  }, [html]);

  if (loading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!available || !html) return null;

  const { bodyContent } = parseTemplateHtml(html);

  // Render the template body content directly — NO iframe
  return (
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight: '100vh' }}
      dangerouslySetInnerHTML={{ __html: bodyContent }}
    />
  );
}