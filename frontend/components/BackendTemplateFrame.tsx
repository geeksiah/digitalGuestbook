"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════════════════════
// FRONTEND URL — used for navigation links inside templates
// The backend (API_BASE_URL) serves template HTML and assets.
// Navigation links (href="/e/slug/guestbook") must point to the FRONTEND, not the backend.
// ═══════════════════════════════════════════════════════════════════════════════
const FRONTEND_URL = typeof window !== "undefined"
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "");

interface Props {
  slug: string;
  endpoint: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Hook: check if a backend template is available, and if so, fetch its HTML.
 *
 * PERFORMANCE FIX: Uses a HEAD request first to check availability quickly,
 * then only fetches the full HTML if available. This prevents slow page loads
 * when no template is assigned.
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

        // Step 1: Quick HEAD request to check if template exists
        // This returns instantly vs downloading the entire HTML
        const headRes = await fetch(url, { method: "HEAD", cache: "no-store" });
        const ct = headRes.headers.get("content-type") || "";

        if (cancelled) return;

        if (!headRes.ok || !ct.includes("text/html")) {
          // No template assigned — backend returns JSON, not HTML
          setAvailable(false);
          setLoading(false);
          return;
        }

        // Step 2: Template exists — fetch the full HTML
        const res = await fetch(url, { cache: "no-store" });
        if (cancelled) return;

        if (res.ok) {
          const text = await res.text();
          if (cancelled) return;

          setHtml(rewriteTemplateHtml(text, API_BASE_URL, FRONTEND_URL));
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
    return () => {
      cancelled = true;
    };
  }, [slug, endpoint]);

  return { loading, available, html };
}

/** @deprecated Use useBackendTemplate instead */
export function useBackendTemplateAvailable(slug: string, endpoint: string) {
  const { loading, available } = useBackendTemplate(slug, endpoint);
  return { loading, available };
}

/**
 * Parse full HTML into head/body pieces.
 */
function parseTemplateHtml(html: string): {
  headContent: string;
  bodyContent: string;
  bodyAttrs: string;
} {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : "";

  const bodyMatch = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  const bodyAttrs = bodyMatch ? bodyMatch[1] : "";
  const bodyContent = bodyMatch ? bodyMatch[2] : html;

  return { headContent, bodyContent, bodyAttrs };
}

/**
 * CRITICAL FIX: URL rewriting with TWO base URLs.
 *
 * - ASSET URLs (images, CSS, JS, fonts) → point to backend (apiBase)
 * - NAVIGATION URLs (/e/slug/guestbook, /e/slug/rsvp) → point to frontend (frontendBase)
 *
 * Without this distinction, clicking "Back to Invitation" or "Open Guestbook" in a
 * template navigates to the backend API server (which returns JSON, not a page).
 */
function rewriteTemplateHtml(fullHtml: string, apiBase: string, frontendBase: string): string {
  const api = apiBase.replace(/\/+$/, "");
  const fe = frontendBase.replace(/\/+$/, "");

  const isAbsolute = (url: string) => {
    const t = url.trim();
    return (
      !t ||
      t.startsWith("http://") ||
      t.startsWith("https://") ||
      t.startsWith("data:") ||
      t.startsWith("blob:") ||
      t.startsWith("#") ||
      t.startsWith("javascript:") ||
      t.startsWith("mailto:") ||
      t.startsWith("tel:")
    );
  };

  // Detect if a URL is an asset (images, CSS, JS, fonts, API paths)
  const isAssetUrl = (url: string): boolean => {
    const t = url.trim().toLowerCase();
    // API paths — always backend
    if (t.startsWith("/api/")) return true;
    if (t.startsWith("/uploads/")) return true;
    if (t.startsWith("/templates/")) return true;
    // File extensions that are assets
    const assetExts = /\.(jpe?g|png|gif|webp|svg|ico|css|js|woff2?|ttf|eot|otf|mp4|webm|mp3|wav|ogg|pdf|json)(\?.*)?$/i;
    if (assetExts.test(t)) return true;
    // CSS url() references are always assets
    return false;
  };

  // Detect if a URL is a navigation link (event pages)
  const isNavUrl = (url: string): boolean => {
    const t = url.trim();
    // Event pages: /e/slug/...
    if (t.startsWith("/e/")) return true;
    // Root-relative paths that aren't assets
    if (t.startsWith("/") && !isAssetUrl(t)) return true;
    // Query params like ?mode=audio — these are navigation in templates
    if (t.startsWith("?")) return true;
    return false;
  };

  const toAssetUrl = (url: string) => {
    if (isAbsolute(url)) return url;
    if (url.startsWith("/")) return `${api}${url}`;
    return `${api}/${url}`;
  };

  const toNavUrl = (url: string) => {
    if (isAbsolute(url)) return url;
    if (url.startsWith("/")) return `${fe}${url}`;
    // Relative nav URLs — shouldn't happen often but handle gracefully
    return `${fe}/${url}`;
  };

  const rewriteUrl = (url: string, context: "href" | "src" | "action" | "poster" | "css" | "meta"): string => {
    if (isAbsolute(url)) return url;

    // href is the tricky one — could be navigation OR asset
    if (context === "href") {
      // <link rel="stylesheet" href="style.css"> — asset
      // <a href="/e/slug/guestbook"> — navigation
      // <a href="?mode=audio"> — navigation
      if (isAssetUrl(url)) return toAssetUrl(url);
      if (isNavUrl(url)) return toNavUrl(url);
      // Default: if it has a file extension, treat as asset; otherwise navigation
      if (/\.[a-z0-9]+(\?.*)?$/i.test(url)) return toAssetUrl(url);
      return toNavUrl(url);
    }

    // src, poster = always assets
    if (context === "src" || context === "poster") return toAssetUrl(url);

    // action = form action, usually navigation
    if (context === "action") return toNavUrl(url);

    // css url() = always assets
    if (context === "css") return toAssetUrl(url);

    // meta content = usually assets (og:image etc)
    if (context === "meta") return toAssetUrl(url);

    return toAssetUrl(url);
  };

  let html = fullHtml;

  // 1) Rewrite <link> tags separately — href in <link> is always an asset
  html = html.replace(
    /<link([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, pre, url, post) => {
      if (isAbsolute(url)) return match;
      return `<link${pre}href="${toAssetUrl(url)}"${post}>`;
    }
  );

  // 2) Rewrite <a> tags separately — href in <a> is navigation
  html = html.replace(
    /<a([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, pre, url, post) => {
      if (isAbsolute(url)) return match;
      return `<a${pre}href="${rewriteUrl(url, "href")}"${post}>`;
    }
  );

  // 3) Rewrite src attributes — always assets
  html = html.replace(
    /\bsrc=["']([^"']+)["']/gi,
    (match, url) => {
      if (isAbsolute(url)) return match;
      return `src="${toAssetUrl(url)}"`;
    }
  );

  // 4) Rewrite action/poster — action=nav, poster=asset
  html = html.replace(
    /\b(action|poster)=["']([^"']+)["']/gi,
    (match, attr, url) => {
      if (isAbsolute(url)) return match;
      const ctx = attr.toLowerCase() as "action" | "poster";
      return `${attr}="${rewriteUrl(url, ctx)}"`;
    }
  );

  // 5) srcset
  html = html.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
    const rewritten = srcset
      .split(",")
      .map((entry: string) => {
        const parts = entry.trim().split(/\s+/);
        const u = parts[0];
        const desc = parts.slice(1).join(" ");
        if (isAbsolute(u)) return entry.trim();
        const abs = toAssetUrl(u);
        return desc ? `${abs} ${desc}` : abs;
      })
      .join(", ");
    return `srcset="${rewritten}"`;
  });

  // 6) CSS url(...)
  html = html.replace(/url\(\s*["']?([^)"']+)["']?\s*\)/gi, (match, url) => {
    if (isAbsolute(url)) return match;
    return `url("${toAssetUrl(url)}")`;
  });

  // 7) meta content for og:image etc
  html = html.replace(
    /<meta([^>]+?)content=["']([^"']+)["']([^>]*?)>/gi,
    (match, pre, content, post) => {
      if (isAbsolute(content)) return match;
      if (!isAssetUrl(content)) return match; // Don't rewrite non-asset meta
      return `<meta${pre}content="${toAssetUrl(content)}"${post}>`;
    }
  );

  // 8) Inject <base> pointing to API for any remaining unmatched relative URLs
  if (/<head[^>]*>/i.test(html) && !/<base\s/i.test(html)) {
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${api}/" />`
    );
  }

  return html;
}

/**
 * Execute scripts inside a container (inline + external) in document context.
 */
function executeScripts(container: HTMLElement) {
  const scripts = Array.from(container.querySelectorAll("script"));
  scripts.forEach((oldScript) => {
    const newScript = document.createElement("script");

    Array.from(oldScript.attributes).forEach((attr) => {
      newScript.setAttribute(attr.name, attr.value);
    });

    if (oldScript.textContent && !newScript.src) {
      newScript.textContent = oldScript.textContent;
    }

    oldScript.parentNode?.replaceChild(newScript, oldScript);
  });
}

/**
 * Apply body attributes safely.
 */
function applyBodyAttrs(bodyAttrs: string) {
  const prev = {
    className: document.body.className,
    style: document.body.getAttribute("style") || "",
    tplAttrs: [] as string[],
  };

  const addedClasses = new Set<string>();

  if (bodyAttrs.trim()) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<div ${bodyAttrs}></div>`;
    const src = wrapper.firstElementChild;

    if (src) {
      Array.from(src.attributes).forEach((attr) => {
        if (attr.name === "class") {
          attr.value.split(/\s+/).forEach((cls) => {
            if (!cls) return;
            document.body.classList.add(cls);
            addedClasses.add(cls);
          });
        } else if (attr.name === "style") {
          const existing = document.body.getAttribute("style") || "";
          document.body.setAttribute("style", `${existing}; ${attr.value}`);
        } else {
          const name = `data-tpl-${attr.name}`;
          document.body.setAttribute(name, attr.value);
          prev.tplAttrs.push(name);
        }
      });
    }
  }

  return () => {
    addedClasses.forEach((cls) => document.body.classList.remove(cls));
    prev.tplAttrs.forEach((name) => document.body.removeAttribute(name));
    if (prev.style) document.body.setAttribute("style", prev.style);
    else document.body.removeAttribute("style");
    document.body.className = prev.className;
  };
}

/**
 * Inject head elements into document.head with cleanup.
 */
function injectHead(headContent: string) {
  const temp = document.createElement("div");
  temp.innerHTML = headContent;

  const injected: HTMLElement[] = [];

  Array.from(temp.children).forEach((el) => {
    const tag = el.tagName.toLowerCase();

    // Avoid stomping Next title/charset
    if (tag === "title") return;
    if (tag === "meta" && el.getAttribute("charset")) return;

    const clone = el.cloneNode(true) as HTMLElement;
    clone.setAttribute("data-template-injected", "true");
    document.head.appendChild(clone);
    injected.push(clone);
  });

  return () => {
    injected.forEach((el) => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    });
  };
}

/**
 * Main component: render backend template by taking over the page (no iframe).
 */
export default function BackendTemplateFrame({ slug, endpoint, className, fallback }: Props) {
  const { loading, available, html } = useBackendTemplate(slug, endpoint);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => {
    if (!html) return null;
    return parseTemplateHtml(html);
  }, [html]);

  useLayoutEffect(() => {
    if (!parsed || !containerRef.current) return;

    const cleanupHead = injectHead(parsed.headContent);
    const cleanupBody = applyBodyAttrs(parsed.bodyAttrs);

    const raf = requestAnimationFrame(() => {
      if (!containerRef.current) return;

      executeScripts(containerRef.current);

      // SPA fix: templates that bind init to window.load won't run.
      window.dispatchEvent(new Event("load"));
    });

    return () => {
      cancelAnimationFrame(raf);
      cleanupHead();
      cleanupBody();
    };
  }, [parsed?.headContent, parsed?.bodyContent, parsed?.bodyAttrs]);

  if (loading) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      )
    );
  }

  if (!available || !html || !parsed) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight: "100vh" }}
      dangerouslySetInnerHTML={{ __html: parsed.bodyContent }}
    />
  );
}