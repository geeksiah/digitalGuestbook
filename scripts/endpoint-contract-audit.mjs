#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const indexFile = path.join(repoRoot, 'backend', 'src', 'index.ts');
const clientFiles = [
  path.join(repoRoot, 'frontend', 'lib', 'api.ts'),
  path.join(repoRoot, 'owner-mobile', 'src', 'api', 'client.ts'),
];

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const readText = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
};

const toPosix = (value) => value.replace(/\\/g, '/');

const lineNumberAt = (source, index) =>
  source.slice(0, index).split(/\r?\n/).length;

const stripQuotes = (value) => {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '\'' && last === '\'') || (first === '"' && last === '"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const splitTopLevel = (input, separator) => {
  const parts = [];
  let start = 0;
  const stack = [];

  const advanceString = (startIndex, quote) => {
    let i = startIndex + 1;
    while (i < input.length) {
      const char = input[i];
      if (char === '\\') {
        i += 2;
        continue;
      }
      if (quote === '`' && char === '$' && input[i + 1] === '{') {
        i += 2;
        let depth = 1;
        while (i < input.length && depth > 0) {
          const inner = input[i];
          if (inner === '\'' || inner === '"' || inner === '`') {
            i = advanceString(i, inner);
            continue;
          }
          if (inner === '{') depth += 1;
          if (inner === '}') depth -= 1;
          i += 1;
        }
        continue;
      }
      if (char === quote) return i + 1;
      i += 1;
    }
    return i;
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '\'' || char === '"' || char === '`') {
      i = advanceString(i, char) - 1;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
      continue;
    }
    if (char === ')' || char === ']' || char === '}') {
      stack.pop();
      continue;
    }
    if (char === separator && stack.length === 0) {
      parts.push(input.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(input.slice(start));
  return parts;
};

const parseCallArguments = (source, startIndex) => {
  const args = [];
  const stack = [];
  let cursor = startIndex;
  let argStart = startIndex;

  const advanceString = (start, quote) => {
    let i = start + 1;
    while (i < source.length) {
      const char = source[i];
      if (char === '\\') {
        i += 2;
        continue;
      }
      if (quote === '`' && char === '$' && source[i + 1] === '{') {
        i += 2;
        let depth = 1;
        while (i < source.length && depth > 0) {
          const inner = source[i];
          if (inner === '\'' || inner === '"' || inner === '`') {
            i = advanceString(i, inner);
            continue;
          }
          if (inner === '{') depth += 1;
          if (inner === '}') depth -= 1;
          i += 1;
        }
        continue;
      }
      if (char === quote) return i + 1;
      i += 1;
    }
    return i;
  };

  while (cursor < source.length) {
    const char = source[cursor];
    if (char === '\'' || char === '"' || char === '`') {
      cursor = advanceString(cursor, char);
      continue;
    }
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
      cursor += 1;
      continue;
    }
    if (char === ')' && stack.length === 0) {
      args.push(source.slice(argStart, cursor).trim());
      return { args, endIndex: cursor + 1 };
    }
    if (char === ')' || char === ']' || char === '}') {
      stack.pop();
      cursor += 1;
      continue;
    }
    if (char === ',' && stack.length === 0) {
      args.push(source.slice(argStart, cursor).trim());
      argStart = cursor + 1;
      cursor += 1;
      continue;
    }
    cursor += 1;
  }

  return { args, endIndex: cursor };
};

const stringifyTemplateLiteral = (raw) => {
  const trimmed = raw.trim();
  if (!(trimmed.startsWith('`') && trimmed.endsWith('`'))) {
    return null;
  }
  return trimmed
    .slice(1, -1)
    .replace(/\$\{[^}]+\}/g, ':param');
};

const normalizePath = (inputPath) => {
  if (!inputPath) return '';
  let value = inputPath
    .replace(/\\/g, '/')
    .replace(/https?:\/\/[^/]+/g, '')
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/\+\s*[A-Za-z0-9_.$()]+\s*\+/g, ':param')
    .replace(/\+\s*[A-Za-z0-9_.$()]+\s*/g, ':param')
    .replace(/\s*[A-Za-z0-9_.$()]+\s*\+/g, ':param')
    .replace(/\([^)]+\)/g, '')
    .replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, ':param')
    .replace(/\/+/g, '/')
    .trim();
  value = value.replace(/^:param\/api\b/, '/api');
  value = value.replace(/^\/:param\/api\b/, '/api');
  value = value.replace(/^\/:param\//, '/');
  if (!value.startsWith('/')) value = `/${value}`;
  if (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1);
  return value;
};

const normalizeClientPath = (rawPath, caller) => {
  let value = rawPath || '';

  value = value
    .replace(/\$\{API_BASE_URL\}/g, '')
    .replace(/\$?\{?baseURL\}?/g, '')
    .replace(/\+?\s*API_BASE_URL\s*\+?/g, '')
    .replace(/['"`]/g, '')
    .replace(/\s+/g, '');

  value = normalizePath(value);
  if (!value) return value;

  if (caller === 'api' && !value.startsWith('/api/')) {
    value = normalizePath(`/api${value}`);
  }
  if (caller === 'axios' && value.startsWith('/owner-')) {
    value = normalizePath(`/api${value}`);
  }
  return value;
};

const evalPathExpression = (expr) => {
  const trimmed = expr.trim();
  if (!trimmed) return '';

  const template = stringifyTemplateLiteral(trimmed);
  if (template !== null) return template;

  if (
    (trimmed.startsWith('\'') && trimmed.endsWith('\'')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return stripQuotes(trimmed);
  }

  const parts = splitTopLevel(trimmed, '+').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return '';

  return parts
    .map((part) => {
      const partTemplate = stringifyTemplateLiteral(part);
      if (partTemplate !== null) return partTemplate;
      if (
        (part.startsWith('\'') && part.endsWith('\'')) ||
        (part.startsWith('"') && part.endsWith('"'))
      ) {
        return stripQuotes(part);
      }
      if (
        /API_BASE_URL|baseURL|import\.meta\.env|encodeURIComponent|window\.location/.test(part)
      ) {
        return '';
      }
      return ':param';
    })
    .join('');
};

const detectAuthHints = (snippet) => {
  const matches = snippet.match(/\b(authenticate[A-Za-z0-9_]*|require[A-Za-z0-9_]*)\b/g) || [];
  return Array.from(new Set(matches)).sort();
};

const parseBackendMounts = () => {
  const source = readText(indexFile);
  if (!source) {
    throw new Error(`Cannot read backend index: ${toPosix(path.relative(repoRoot, indexFile))}`);
  }

  const importMap = new Map();
  const importRegex = /import\s+([A-Za-z0-9_]+)\s+from\s+['"](.\/routes\/[^'"]+)\.js['"];/g;
  let importMatch;
  while ((importMatch = importRegex.exec(source)) !== null) {
    const alias = importMatch[1];
    const relativeTs = importMatch[2].replace('./', 'backend/src/') + '.ts';
    importMap.set(alias, path.join(repoRoot, relativeTs));
  }

  const mounts = [];
  const mountRegex = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
  let mountMatch;
  while ((mountMatch = mountRegex.exec(source)) !== null) {
    const mountPath = mountMatch[1];
    const alias = mountMatch[2];
    const filePath = importMap.get(alias);
    if (!filePath) continue;
    mounts.push({ mountPath: normalizePath(mountPath), alias, filePath });
  }
  return mounts;
};

const parseBackendEndpoints = () => {
  const mounts = parseBackendMounts();
  const endpoints = [];

  for (const mount of mounts) {
    const source = readText(mount.filePath);
    if (!source) continue;

    const routeRegex = /router\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g;
    let routeMatch;
    while ((routeMatch = routeRegex.exec(source)) !== null) {
      const method = routeMatch[1].toUpperCase();
      const localPath = routeMatch[3];
      const absolutePath = normalizePath(`${mount.mountPath}/${localPath}`);
      const line = lineNumberAt(source, routeMatch.index);
      const snippet = source.slice(routeMatch.index, routeMatch.index + 900);
      const schemaMatch = snippet.match(/\b([A-Za-z0-9_]*Schema)\.parse\(/);

      endpoints.push({
        method,
        path: absolutePath,
        pathKey: `${method} ${absolutePath.replace(/:[a-zA-Z0-9_]+/g, ':param')}`,
        file: toPosix(path.relative(repoRoot, mount.filePath)),
        line,
        auth: detectAuthHints(snippet),
        schema: schemaMatch ? schemaMatch[1] : null,
      });
    }
  }

  return endpoints;
};

const guessApiSection = (source, index) => {
  const sectionRegex = /export const\s+([A-Za-z0-9_]+)\s*=\s*{/g;
  let best = null;
  let match;
  while ((match = sectionRegex.exec(source)) !== null) {
    if (match.index > index) break;
    best = match[1];
  }
  return best || 'unknown';
};

const parseClientEndpoints = () => {
  const endpoints = [];

  for (const filePath of clientFiles) {
    const source = readText(filePath);
    if (!source) continue;

    const callRegex = /\b(axios|api)\.(get|post|put|patch|delete)\s*\(/g;
    let callMatch;
    while ((callMatch = callRegex.exec(source)) !== null) {
      const caller = callMatch[1];
      const method = callMatch[2].toUpperCase();
      const argsStart = callRegex.lastIndex;
      const parsed = parseCallArguments(source, argsStart);
      const args = parsed.args;
      if (!args.length) continue;

      const rawPathExpr = args[0];
      const evaluatedPath = evalPathExpression(rawPathExpr);
      const normalizedPath = normalizeClientPath(evaluatedPath, caller);

      if (!normalizedPath || normalizedPath === '/api') continue;

      const line = lineNumberAt(source, callMatch.index);
      const section = guessApiSection(source, callMatch.index);
      endpoints.push({
        method,
        path: normalizedPath.replace(/:[a-zA-Z0-9_]+/g, ':param'),
        pathKey: `${method} ${normalizedPath.replace(/:[a-zA-Z0-9_]+/g, ':param')}`,
        sourceFile: toPosix(path.relative(repoRoot, filePath)),
        line,
        caller,
        section,
        rawPathExpr: rawPathExpr.trim(),
      });
    }
  }

  return endpoints;
};

const uniqueByPathKey = (records) => {
  const seen = new Set();
  return records.filter((record) => {
    const dedupeKey = `${record.pathKey}::${record.sourceFile || record.file || ''}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
};

const audit = () => {
  const backendEndpoints = uniqueByPathKey(parseBackendEndpoints());
  const clientEndpoints = uniqueByPathKey(parseClientEndpoints());

  const backendByKey = new Map();
  const backendByPathOnly = new Map();
  for (const endpoint of backendEndpoints) {
    backendByKey.set(endpoint.pathKey, endpoint);
    const list = backendByPathOnly.get(endpoint.path) || [];
    list.push(endpoint);
    backendByPathOnly.set(endpoint.path, list);
  }

  const missingInBackend = [];
  const methodMismatch = [];

  for (const clientEndpoint of clientEndpoints) {
    const exact = backendByKey.get(clientEndpoint.pathKey);
    if (exact) continue;

    const samePath = backendByPathOnly.get(clientEndpoint.path) || [];
    if (samePath.length) {
      methodMismatch.push({
        client: clientEndpoint,
        backendMethods: samePath.map((item) => item.method).sort(),
      });
    } else {
      missingInBackend.push(clientEndpoint);
    }
  }

  const usedBackendKeys = new Set(
    clientEndpoints
      .map((clientEndpoint) => clientEndpoint.pathKey)
      .filter((key) => backendByKey.has(key))
  );
  const backendNotUsedByClients = backendEndpoints.filter(
    (endpoint) => !usedBackendKeys.has(endpoint.pathKey)
  );

  return {
    stats: {
      backendEndpoints: backendEndpoints.length,
      clientEndpoints: clientEndpoints.length,
      missingInBackend: missingInBackend.length,
      methodMismatch: methodMismatch.length,
      backendNotUsedByClients: backendNotUsedByClients.length,
    },
    missingInBackend,
    methodMismatch,
    backendNotUsedByClients,
  };
};

const printReport = (result) => {
  console.log('Endpoint Contract Audit');
  console.log('=======================');
  console.log(
    [
      `Backend endpoints: ${result.stats.backendEndpoints}`,
      `Client endpoints: ${result.stats.clientEndpoints}`,
      `Missing in backend: ${result.stats.missingInBackend}`,
      `Method mismatches: ${result.stats.methodMismatch}`,
      `Backend-only endpoints: ${result.stats.backendNotUsedByClients}`,
    ].join(' | ')
  );
  console.log('');

  if (result.missingInBackend.length) {
    console.log('Client -> Backend Missing');
    console.log('-------------------------');
    for (const endpoint of result.missingInBackend) {
      console.log(
        `${endpoint.method} ${endpoint.path}  (${endpoint.sourceFile}:${endpoint.line}, ${endpoint.section})`
      );
      console.log(`  raw: ${endpoint.rawPathExpr}`);
    }
    console.log('');
  }

  if (result.methodMismatch.length) {
    console.log('Method Mismatch');
    console.log('---------------');
    for (const mismatch of result.methodMismatch) {
      const { client, backendMethods } = mismatch;
      console.log(
        `${client.method} ${client.path}  (${client.sourceFile}:${client.line}, ${client.section})`
      );
      console.log(`  backend methods: ${backendMethods.join(', ')}`);
    }
    console.log('');
  }

  if (result.backendNotUsedByClients.length) {
    console.log('Backend Endpoints Not Referenced By Web/Mobile Clients');
    console.log('-------------------------------------------------------');
    for (const endpoint of result.backendNotUsedByClients) {
      console.log(`${endpoint.method} ${endpoint.path}  (${endpoint.file}:${endpoint.line})`);
    }
    console.log('');
  }
};

try {
  const result = audit();
  printReport(result);
  const hasHardFailures = result.stats.missingInBackend > 0 || result.stats.methodMismatch > 0;
  process.exit(hasHardFailures ? 1 : 0);
} catch (error) {
  console.error('[contract-audit] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
