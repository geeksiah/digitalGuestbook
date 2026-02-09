"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

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
        const res = await fetch(url, { cache: "no-store" });
        const ct = res.headers.get("content-type") || "";

        if (cancelled) return;

        if (res.ok && ct.includes("text/html")) {
          const text = await res.text();
          if (cancelled) return;

          // Rewrite + base fallback
          setHtml(rewriteTemplateHtml(text, API_BASE_URL));
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
 * Robust URL rewriting + <base> fallback.
 *
 * Fixes:
 * - src/href/action/poster
 * - srcset
 * - CSS url()
 * - meta content (og:image etc)
 * - link preload href
 *
 * Injects a <base href="API_BASE_URL/"> into <head> if missing.
 */
function rewriteTemplateHtml(fullHtml: string, apiBase: string): string {
  const base = apiBase.replace(/\/+$/, ""); // no trailing slash

  const skip = (url: string) => {
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

  const toAbs = (url: string) => {
    if (skip(url)) return url;
    if (url.startsWith("/")) return `${base}${url}`;
    return `${base}/${url}`;
  };

  let html = fullHtml;

  // 1) Attributes: src/href/action/poster
  html = html.replace(
    /(src|href|action|poster)=["']([^"']+)["']/gi,
    (match, attr, url) => {
      if (skip(url)) return match;
      return `${attr}="${toAbs(url)}"`;
    }
  );

  // 2) srcset="a.jpg 1x, b.jpg 2x"
  html = html.replace(/srcset=["']([^"']+)["']/gi, (match, srcset) => {
    const rewritten = srcset
      .split(",")
      .map((entry: string) => {
  const parts = entry.trim().split(/\s+/);
        const u = parts[0];
        const desc = parts.slice(1).join(" ");
        if (skip(u)) return entry.trim();
        const abs = toAbs(u);
        return desc ? `${abs} ${desc}` : abs;
      })
      .join(", ");
    return `srcset="${rewritten}"`;
  });

  // 3) CSS url(...)
  html = html.replace(/url\(\s*["']?([^)"']+)["']?\s*\)/gi, (match, url) => {
    if (skip(url)) return match;
    return `url("${toAbs(url)}")`;
  });

  // 4) meta content="assets/bg.jpg" for og:image etc
  html = html.replace(
    /<meta([^>]+?)content=["']([^"']+)["']([^>]*?)>/gi,
    (match, pre, content, post) => {
      if (skip(content)) return match;
      return `<meta${pre}content="${toAbs(content)}"${post}>`;
    }
  );

  // 5) Ensure <base> exists (fallback resolver)
  // Put it as the first element inside <head>.
  if (/<head[^>]*>/i.test(html) && !/<base\s/i.test(html)) {
    html = html.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${base}/" />`
    );
  }

  return html;
}

/**
 * Execute scripts inside a container (inline + external) in document context.
 * We replace each <script> node with a new one to trigger execution.
 */
function executeScripts(container: HTMLElement) {
  const scripts = Array.from(container.querySelectorAll("script"));
  scripts.forEach((oldScript) => {
    const newScript = document.createElement("script");

    // Copy attributes
    Array.from(oldScript.attributes).forEach((attr) => {
      newScript.setAttribute(attr.name, attr.value);
    });

    // Copy inline content
    if (oldScript.textContent && !newScript.src) {
      newScript.textContent = oldScript.textContent;
    }

    oldScript.parentNode?.replaceChild(newScript, oldScript);
  });
}

/**
 * Apply body attributes safely (merge only what template needs).
 * Returns cleanup function.
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
    // Remove only classes we added
    addedClasses.forEach((cls) => document.body.classList.remove(cls));
    // Remove only tpl attrs we added
    prev.tplAttrs.forEach((name) => document.body.removeAttribute(name));

    // Restore style exactly
    if (prev.style) document.body.setAttribute("style", prev.style);
    else document.body.removeAttribute("style");

    // Restore className exactly (safer than trying to diff everything)
    document.body.className = prev.className;
  };
}

/**
 * Inject head elements into document.head with cleanup.
 * Adds a marker attribute to reliably remove later.
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

  // Parse once per html change
  const parsed = useMemo(() => {
    if (!html) return null;
    return parseTemplateHtml(html);
  }, [html]);

  // Inject head + body attrs + execute scripts once the body has rendered
  useLayoutEffect(() => {
    if (!parsed || !containerRef.current) return;

    const cleanupHead = injectHead(parsed.headContent);
    const cleanupBody = applyBodyAttrs(parsed.bodyAttrs);

    // Wait 1 frame so the DOM is settled, then execute scripts
    const raf = requestAnimationFrame(() => {
      if (!containerRef.current) return;

      executeScripts(containerRef.current);

      // SPA fix: templates that bind init to window.load won't run.
      // Trigger a synthetic load so their init path runs.
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
