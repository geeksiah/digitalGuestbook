"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-SAFE UPDATE — BackendTemplateFrame.tsx
//
// Changes from previous production version:
//   1. REMOVED HEAD preflight → single GET request (50% fewer network calls)
//   2. Reads X-Template-Asset-Base header from backend → rewrites assets to CDN
//   3. Added in-memory SWR cache (30s TTL) → instant navigations for cached pages
//   4. De-duplicates injected <style>/<script> tags by template ID
//   5. Guards against double script execution on re-render
//   6. KEPT all existing URL rewriting logic as fallback
// ═══════════════════════════════════════════════════════════════════════════════

const FRONTEND_URL = typeof window !== "undefined"
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "");

// ─── SWR Cache ─────────────────────────────────────────────────────────────────
// In-memory cache with 30s stale-while-revalidate.
// On cache hit: return stale data immediately, then revalidate in background.
const CACHE_TTL_MS = 30_000;
const templateCache = new Map<string, {
  html: string;
  assetBase: string | null;
  fetchedAt: number;
}>();

interface Props {
  slug: string;
  endpoint: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Hook: fetch backend template HTML with SWR caching.
 *
 * PERFORMANCE FIX (vs previous version):
 * - NO HEAD preflight — single GET, check Content-Type on the response
 * - If response is JSON (not HTML) → no template assigned → show default UI
 * - Reads X-Template-Asset-Base header for CDN-direct asset URLs
 */
export function useBackendTemplate(slug: string, endpoint: string) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${slug}/${endpoint}`;

    const applyResult = (
      rawHtml: string,
      assetBase: string | null,
    ) => {
      if (cancelled) return;

      // Rewrite URLs: prefer CDN asset base from header, fall back to existing rewriting
      const rewritten = assetBase
        ? rewriteWithAssetBase(rawHtml, assetBase, FRONTEND_URL)
        : rewriteTemplateHtml(rawHtml, API_BASE_URL, FRONTEND_URL);

      setHtml(rewritten);
      setAvailable(true);
      setLoading(false);
    };

    const fetchTemplate = async (isRevalidation = false) => {
      try {
        const url = `${API_BASE_URL}/api/public/event/${slug}/${endpoint}`;

        const res = await fetch(url, { cache: "no-store" });
        if (cancelled) return;

        const ct = res.headers.get("content-type") || "";

        if (!res.ok || !ct.includes("text/html")) {
          // No template assigned — backend returns JSON
          if (!isRevalidation) {
            setAvailable(false);
            setLoading(false);
          }
          templateCache.delete(cacheKey);
          return;
        }

        // Read CDN asset base from header (new feature)
        const assetBase = res.headers.get("x-template-asset-base") || null;

        const rawHtml = await res.text();
        if (cancelled) return;

        // Update cache
        templateCache.set(cacheKey, {
          html: rawHtml,
          assetBase,
          fetchedAt: Date.now(),
        });

        applyResult(rawHtml, assetBase);
      } catch {
        if (!cancelled && !isRevalidation) {
          setAvailable(false);
          setLoading(false);
        }
      }
    };

    if (!slug) {
      setLoading(false);
      return;
    }

    // Check SWR cache
    const cached = templateCache.get(cacheKey);
    if (cached) {
      // Return cached data immediately
      applyResult(cached.html, cached.assetBase);

      // If stale, revalidate in background
      if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
        fetchTemplate(/* isRevalidation */ true);
      }
    } else {
      // No cache — fetch fresh
      fetchTemplate();
    }

    return () => { cancelled = true; };
  }, [slug, endpoint]);

  return { loading, available, html };
}

/** @deprecated Use useBackendTemplate instead */
export function useBackendTemplateAvailable(slug: string, endpoint: string) {
  const { loading, available } = useBackendTemplate(slug, endpoint);
  return { loading, available };
}

// ─── HTML Parsing ──────────────────────────────────────────────────────────────
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

// ─── NEW: CDN-based asset rewriting (primary strategy) ─────────────────────────
// When the backend provides X-Template-Asset-Base, we use it to rewrite
// all asset URLs to hit Supabase CDN directly. Navigation URLs still go
// to the frontend.
function rewriteWithAssetBase(
  fullHtml: string,
  assetBase: string,
  frontendBase: string
): string {
  const cdn = assetBase.replace(/\/+$/, "") + "/";
  const fe = frontendBase.replace(/\/+$/, "");

  const isAbsolute = (url: string) => {
    const t = url.trim();
    return (
      !t || t.startsWith("http://") || t.startsWith("https://") ||
      t.startsWith("data:") || t.startsWith("blob:") || t.startsWith("#") ||
      t.startsWith("javascript:") || t.startsWith("mailto:") || t.startsWith("tel:")
    );
  };

  const isNavUrl = (url: string): boolean => {
    const t = url.trim();
    if (t.startsWith("/e/")) return true;
    if (t.startsWith("?")) return true;
    if (t.startsWith("/") && !/\.[a-z0-9]+(\?.*)?$/i.test(t)) return true;
    return false;
  };

  let html = fullHtml;

  // Rewrite <a> navigation links → frontend
  html = html.replace(
    /<a([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, pre, url, post) => {
      if (isAbsolute(url)) return match;
      if (isNavUrl(url)) return `<a${pre}href="${fe}${url.startsWith("/") ? url : "/" + url}"${post}>`;
      // Asset link (e.g. download link) — skip, will be caught by general rewriting
      return match;
    }
  );

  // Rewrite src/poster attributes → CDN
  html = html.replace(
    /\b(src|poster)=["']([^"']+)["']/gi,
    (match, attr, url) => {
      if (isAbsolute(url)) return match;
      // Strip leading ./ or ../
      const clean = url.replace(/^(?:\.\/|\.\.\/)+/, "").replace(/^assets\//, "");
      return `${attr}="${cdn}${clean}"`;
    }
  );

  // Rewrite <link> href → CDN (stylesheets, icons, etc.)
  html = html.replace(
    /<link([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, pre, url, post) => {
      if (isAbsolute(url)) return match;
      const clean = url.replace(/^(?:\.\/|\.\.\/)+/, "").replace(/^assets\//, "");
      return `<link${pre}href="${cdn}${clean}"${post}>`;
    }
  );

  // Rewrite CSS url() → CDN
  html = html.replace(/url\(\s*["']?([^)"']+)["']?\s*\)/gi, (match, url) => {
    if (isAbsolute(url)) return match;
    const clean = url.replace(/^(?:\.\/|\.\.\/)+/, "").replace(/^assets\//, "");
    return `url("${cdn}${clean}")`;
  });

  // Rewrite srcset → CDN
  html = html.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
    const rewritten = srcset
      .split(",")
      .map((entry: string) => {
        const parts = entry.trim().split(/\s+/);
        const u = parts[0];
        const desc = parts.slice(1).join(" ");
        if (isAbsolute(u)) return entry.trim();
        const clean = u.replace(/^(?:\.\/|\.\.\/)+/, "").replace(/^assets\//, "");
        const abs = `${cdn}${clean}`;
        return desc ? `${abs} ${desc}` : abs;
      })
      .join(", ");
    return `srcset="${rewritten}"`;
  });

  return html;
}

// ─── FALLBACK: Full client-side URL rewriting (kept from previous production) ──
// Used when X-Template-Asset-Base header is not present (e.g. old backend).
function rewriteTemplateHtml(fullHtml: string, apiBase: string, frontendBase: string): string {
  const api = apiBase.replace(/\/+$/, "");
  const fe = frontendBase.replace(/\/+$/, "");

  const isAbsolute = (url: string) => {
    const t = url.trim();
    return (
      !t || t.startsWith("http://") || t.startsWith("https://") ||
      t.startsWith("data:") || t.startsWith("blob:") || t.startsWith("#") ||
      t.startsWith("javascript:") || t.startsWith("mailto:") || t.startsWith("tel:")
    );
  };

  const isAssetUrl = (url: string): boolean => {
    const t = url.trim().toLowerCase();
    if (t.startsWith("/api/")) return true;
    if (t.startsWith("/uploads/")) return true;
    if (t.startsWith("/templates/")) return true;
    const assetExts = /\.(jpe?g|png|gif|webp|svg|ico|css|js|woff2?|ttf|eot|otf|mp4|webm|mp3|wav|ogg|pdf|json)(\?.*)?$/i;
    if (assetExts.test(t)) return true;
    return false;
  };

  const isNavUrl = (url: string): boolean => {
    const t = url.trim();
    if (t.startsWith("/e/")) return true;
    if (t.startsWith("/") && !isAssetUrl(t)) return true;
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
    return `${fe}/${url}`;
  };

  const rewriteUrl = (url: string, context: "href" | "src" | "action" | "poster" | "css" | "meta"): string => {
    if (isAbsolute(url)) return url;
    if (context === "href") {
      if (isAssetUrl(url)) return toAssetUrl(url);
      if (isNavUrl(url)) return toNavUrl(url);
      if (/\.[a-z0-9]+(\?.*)?$/i.test(url)) return toAssetUrl(url);
      return toNavUrl(url);
    }
    if (context === "src" || context === "poster") return toAssetUrl(url);
    if (context === "action") return toNavUrl(url);
    if (context === "css") return toAssetUrl(url);
    if (context === "meta") return toAssetUrl(url);
    return toAssetUrl(url);
  };

  let html = fullHtml;

  // 1) <link> href — always asset
  html = html.replace(
    /<link([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, pre, url, post) => {
      if (isAbsolute(url)) return match;
      return `<link${pre}href="${toAssetUrl(url)}"${post}>`;
    }
  );

  // 2) <a> href — navigation
  html = html.replace(
    /<a([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, pre, url, post) => {
      if (isAbsolute(url)) return match;
      return `<a${pre}href="${rewriteUrl(url, "href")}"${post}>`;
    }
  );

  // 3) src — always asset
  html = html.replace(
    /\bsrc=["']([^"']+)["']/gi,
    (match, url) => {
      if (isAbsolute(url)) return match;
      return `src="${toAssetUrl(url)}"`;
    }
  );

  // 4) action/poster
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

  // 6) CSS url()
  html = html.replace(/url\(\s*["']?([^)"']+)["']?\s*\)/gi, (match, url) => {
    if (isAbsolute(url)) return match;
    return `url("${toAssetUrl(url)}")`;
  });

  // 7) meta content (og:image etc)
  html = html.replace(
    /<meta([^>]+?)content=["']([^"']+)["']([^>]*?)>/gi,
    (match, pre, content, post) => {
      if (isAbsolute(content)) return match;
      if (!isAssetUrl(content)) return match;
      return `<meta${pre}content="${toAssetUrl(content)}"${post}>`;
    }
  );

  // 8) <base> fallback
  if (/<head[^>]*>/i.test(html) && !/<base\s/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${api}/" />`);
  }

  return html;
}

// ─── Script Execution ──────────────────────────────────────────────────────────
// Track executed scripts to prevent double-execution on re-render
const executedScripts = new Set<string>();

function executeScripts(container: HTMLElement, templateKey: string) {
  // Guard: don't re-execute scripts for the same template
  if (executedScripts.has(templateKey)) return;
  executedScripts.add(templateKey);

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

// ─── Body Attributes ───────────────────────────────────────────────────────────
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

// ─── Head Injection ────────────────────────────────────────────────────────────
// De-duplicates by template key — won't re-inject if same template already injected
const injectedTemplateKeys = new Set<string>();

function injectHead(headContent: string, templateKey: string) {
  // Skip if already injected for this template
  if (injectedTemplateKeys.has(templateKey)) {
    return () => {}; // no-op cleanup
  }
  injectedTemplateKeys.add(templateKey);

  const temp = document.createElement("div");
  temp.innerHTML = headContent;

  const injected: HTMLElement[] = [];

  Array.from(temp.children).forEach((el) => {
    const tag = el.tagName.toLowerCase();

    // Avoid stomping Next title/charset
    if (tag === "title") return;
    if (tag === "meta" && el.getAttribute("charset")) return;

    // Skip if this exact element is already in head (by id or content)
    const id = el.getAttribute("id");
    if (id && document.head.querySelector(`#${CSS.escape(id)}`)) return;

    const clone = el.cloneNode(true) as HTMLElement;
    clone.setAttribute("data-template-injected", templateKey);
    document.head.appendChild(clone);
    injected.push(clone);
  });

  return () => {
    injected.forEach((el) => {
      try { el.remove(); } catch { /* ignore */ }
    });
    injectedTemplateKeys.delete(templateKey);
    executedScripts.delete(templateKey);
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BackendTemplateFrame({ slug, endpoint, className, fallback }: Props) {
  const { loading, available, html } = useBackendTemplate(slug, endpoint);
  const containerRef = useRef<HTMLDivElement>(null);
  const templateKey = `${slug}/${endpoint}`;

  const parsed = useMemo(() => {
    if (!html) return null;
    return parseTemplateHtml(html);
  }, [html]);

  useLayoutEffect(() => {
    if (!parsed || !containerRef.current) return;

    const cleanupHead = injectHead(parsed.headContent, templateKey);
    const cleanupBody = applyBodyAttrs(parsed.bodyAttrs);

    const raf = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      executeScripts(containerRef.current, templateKey);
      window.dispatchEvent(new Event("load"));
    });

    return () => {
      cancelAnimationFrame(raf);
      cleanupHead();
      cleanupBody();
    };
  }, [parsed?.headContent, parsed?.bodyContent, parsed?.bodyAttrs, templateKey]);

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