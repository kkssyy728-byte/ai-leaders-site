#!/usr/bin/env node

import { copyFile, cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(projectRoot, 'dist');
const maxFileSize = 25 * 1024 * 1024;
const maxFileCount = 20_000;

// Editable pages stay grouped by business category. Only the generated dist
// artifact uses one index.html per clean public URL.
const pageRoutes = [
  ['src/pages/index.html', ['index.html']],
  ['src/pages/company/about.html', ['about/index.html']],
  ['src/pages/company/instructor.html', ['instructor/index.html']],
  ['src/pages/company/reviews.html', ['reviews/index.html']],
  ['src/pages/company/faq.html', ['faq/index.html']],
  ['src/pages/courses/free.html', ['course-free/index.html']],
  ['src/pages/courses/paid.html', ['course-paid/index.html']],
  ['src/pages/courses/corporate.html', ['course-corporate/index.html']],
  ['src/pages/courses/detail.html', ['course-detail/index.html', 'course/index.html']],
  ['src/pages/forms/corporate.html', ['corporate/index.html']],
  ['src/pages/forms/instructor-apply.html', ['instructor-apply/index.html']],
  ['src/pages/forms/application-complete.html', ['application-complete/index.html']],
  ['src/pages/admin/login.html', ['admin-login/index.html']],
  ['src/pages/admin/dashboard.html', ['admin-dashboard/index.html']],
  ['src/pages/admin/courses.html', ['admin-courses/index.html']],
  ['src/pages/admin/site-content.html', ['admin-site-content/index.html']],
  ['src/pages/admin/applications.html', ['admin-applications/index.html']],
  ['src/pages/admin/corporate-inquiries.html', ['admin-corporate-inquiries/index.html']],
  ['src/pages/admin/instructor-applications.html', ['admin-instructor-applications/index.html']],
  ['src/pages/admin/update-log.html', ['admin-update-log/index.html']]
];

const directoryCopies = [
  ['src/assets', 'assets'],
  ['src/static/images', 'images'],
  ['src/static/videos', 'videos']
];

const fileCopies = [
  ['src/static/_headers', '_headers'],
  ['src/static/favicon.ico', 'favicon.ico'],
  ['src/static/robots.txt', 'robots.txt'],
  ['src/static/shared.css', 'shared.css'],
  ['src/static/sitemap.xml', 'sitemap.xml']
];

const retiredPublicPaths = [
  'html', 'assets', 'images', 'videos',
  'about', 'admin-applications', 'admin-corporate-inquiries', 'admin-courses',
  'admin-dashboard', 'admin-instructor-applications', 'admin-login',
  'admin-site-content', 'admin-update-log', 'application-complete', 'corporate',
  'course', 'course-corporate', 'course-detail', 'course-free', 'course-paid',
  'faq', 'instructor', 'instructor-apply', 'reviews',
  'index.html', '_headers', 'favicon.ico', 'robots.txt', 'shared.css',
  'sitemap.xml', 'CNAME', '.nojekyll'
];

function normalizePath(path) {
  return path.replaceAll('\\', '/');
}

function resolveProjectPath(path) {
  const absolutePath = resolve(projectRoot, path);
  const relativePath = relative(projectRoot, absolutePath);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`Path escapes the project root: ${path}`);
  }
  return absolutePath;
}

function resolveOutputPath(path) {
  const absolutePath = resolve(outputDirectory, path);
  const relativePath = relative(outputDirectory, absolutePath);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`Path escapes the output directory: ${path}`);
  }
  return absolutePath;
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function validateRouteManifest() {
  const pagesDirectory = resolveProjectPath('src/pages');
  const discoveredPages = (await collectFiles(pagesDirectory))
    .filter((path) => path.endsWith('.html'))
    .map((path) => normalizePath(relative(projectRoot, path)))
    .sort();
  const declaredPages = pageRoutes.map(([source]) => source).sort();
  const undeclared = discoveredPages.filter((page) => !declaredPages.includes(page));
  const missing = declaredPages.filter((page) => !discoveredPages.includes(page));

  if (undeclared.length || missing.length) {
    const details = [
      undeclared.length ? `undeclared pages: ${undeclared.join(', ')}` : '',
      missing.length ? `missing pages: ${missing.join(', ')}` : ''
    ].filter(Boolean).join('; ');
    throw new Error(`Page route manifest is incomplete (${details}).`);
  }

  const destinations = new Set();
  for (const [source, routes] of pageRoutes) {
    resolveProjectPath(source);
    for (const route of routes) {
      resolveOutputPath(route);
      if (destinations.has(route)) throw new Error(`Duplicate route destination: ${route}`);
      destinations.add(route);
    }
  }
}

async function validateSourceLayout() {
  const found = [];
  for (const path of retiredPublicPaths) {
    try {
      await stat(resolveProjectPath(path));
      found.push(path);
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error;
    }
  }
  if (found.length) {
    throw new Error(`Retired public mirrors must not be committed: ${found.join(', ')}`);
  }
}

async function inspectArtifact(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      count += await inspectArtifact(path);
      continue;
    }
    if (!entry.isFile()) continue;
    const info = await stat(path);
    if (info.size > maxFileSize) {
      throw new Error(`Cloudflare Pages 25 MiB limit exceeded: ${relative(outputDirectory, path)}`);
    }
    count += 1;
  }
  return count;
}

async function build() {
  await validateSourceLayout();
  await validateRouteManifest();
  if (dirname(outputDirectory) !== projectRoot || basename(outputDirectory) !== 'dist') {
    throw new Error('Refusing to replace an unexpected output directory.');
  }
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  for (const [source, routes] of pageRoutes) {
    for (const route of routes) {
      const destination = resolveOutputPath(route);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(resolveProjectPath(source), destination);
    }
  }

  for (const [source, destination] of directoryCopies) {
    await cp(resolveProjectPath(source), resolveOutputPath(destination), { recursive: true });
  }
  for (const [source, destination] of fileCopies) {
    await copyFile(resolveProjectPath(source), resolveOutputPath(destination));
  }

  const fileCount = await inspectArtifact(outputDirectory);
  if (fileCount > maxFileCount) {
    throw new Error(`Cloudflare Pages 20,000 file limit exceeded: ${fileCount}`);
  }
  console.log(`[cloudflare-build] PASS (${pageRoutes.length} source pages, ${fileCount} public files in dist)`);
}

await build();
