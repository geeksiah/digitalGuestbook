#!/usr/bin/env node

const baseUrl = process.env.CHECK_BASE_URL || process.argv[2];
const routes = ['/admin', '/owner'];

if (!baseUrl) {
  console.error('Usage: node scripts/check-next-assets.mjs <base-url>');
  process.exit(1);
}

const normalizeBase = (value) => value.replace(/\/+$/, '');

const extractChunkUrls = (html) => {
  const urls = new Set();
  const pattern = /(?:href|src)=["']([^"']*\/_next\/static\/[^"']+)["']/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    urls.add(match[1]);
  }
  return [...urls];
};

const toAbsoluteUrl = (path, base) => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const validateContentType = (url, contentType) => {
  if (url.endsWith('.css')) return contentType.includes('text/css');
  if (url.endsWith('.js')) return contentType.includes('javascript');
  return true;
};

const run = async () => {
  const base = normalizeBase(baseUrl);
  let hasFailure = false;

  for (const route of routes) {
    const pageUrl = `${base}${route}`;
    const pageResponse = await fetch(pageUrl, { redirect: 'follow' });
    if (!pageResponse.ok) {
      hasFailure = true;
      console.error(`[FAIL] ${pageUrl} returned ${pageResponse.status}`);
      continue;
    }

    const html = await pageResponse.text();
    const chunks = extractChunkUrls(html);
    if (!chunks.length) {
      hasFailure = true;
      console.error(`[FAIL] ${pageUrl} returned no _next chunks`);
      continue;
    }

    for (const chunk of chunks) {
      const chunkUrl = toAbsoluteUrl(chunk, base);
      const chunkResponse = await fetch(chunkUrl, { redirect: 'follow' });
      const contentType = (chunkResponse.headers.get('content-type') || '').toLowerCase();
      const isValidType = validateContentType(chunkUrl, contentType);
      if (!chunkResponse.ok || !isValidType) {
        hasFailure = true;
        console.error(
          `[FAIL] ${chunkUrl} status=${chunkResponse.status} content-type="${contentType || 'missing'}"`
        );
      } else {
        console.log(`[OK]   ${chunkUrl} (${contentType})`);
      }
    }
  }

  if (hasFailure) {
    process.exit(1);
  }

  console.log('Chunk and MIME verification passed.');
};

run().catch((error) => {
  console.error('Asset check failed:', error);
  process.exit(1);
});
