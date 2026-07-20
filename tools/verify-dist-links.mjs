#!/usr/bin/env node

import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = join(projectRoot, 'dist');
const localOrigin = 'https://cloudflare-build.local';
const failures = [];
let checkedReferences = 0;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function pageUrl(file) {
  const path = relative(distDirectory, file).replaceAll('\\', '/');
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'index.html'.length)}`;
  return `/${path}`;
}

function isDynamicReference(value) {
  return /\$\{|['"`]\s*\+|\+\s*['"`]|<%|%>/.test(value);
}

function resolvePublicFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (_error) {
    return null;
  }
  const relativePath = decoded.replace(/^\/+/, '');
  const candidates = decoded.endsWith('/')
    ? [join(distDirectory, relativePath, 'index.html')]
    : [join(distDirectory, relativePath), join(distDirectory, relativePath, 'index.html')];

  return candidates.filter((candidate) => {
    const relativeCandidate = relative(distDirectory, candidate);
    return relativeCandidate !== '..'
      && !relativeCandidate.startsWith(`..${sep}`)
      && !isAbsolute(relativeCandidate);
  });
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (_error) {
    return false;
  }
}

const files = await collectFiles(distDirectory);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const attributePattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const base = new URL(pageUrl(file), localOrigin);
  for (const match of html.matchAll(attributePattern)) {
    const value = match[1].trim();
    if (!value || /^(?:data:|blob:|mailto:|tel:|javascript:)/i.test(value) || isDynamicReference(value)) continue;

    let target;
    try {
      target = new URL(value, base);
    } catch (_error) {
      failures.push(`${pageUrl(file)} -> invalid URL: ${value}`);
      continue;
    }
    if (target.origin !== localOrigin) continue;

    const candidates = resolvePublicFile(target.pathname);
    if (!candidates) {
      failures.push(`${pageUrl(file)} -> invalid encoded path: ${value}`);
      continue;
    }
    checkedReferences += 1;
    if (!(await Promise.all(candidates.map(exists))).some(Boolean)) {
      failures.push(`${pageUrl(file)} -> missing local target: ${value}`);
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`[dist-links] ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`[dist-links] PASS (${htmlFiles.length} HTML files, ${checkedReferences} local references)`);
}
