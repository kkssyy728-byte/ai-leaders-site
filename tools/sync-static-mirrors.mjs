#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// GitHub Pages needs a physical index.html in each clean-URL directory.
// Keep the editable pages in html/ and declare every public mirror here.
const pageMirrors = [
  ['html/index.html', ['index.html']],
  ['html/about.html', ['about/index.html']],
  ['html/admin-applications.html', ['admin-applications/index.html']],
  ['html/admin-corporate-inquiries.html', ['admin-corporate-inquiries/index.html']],
  ['html/admin-courses.html', ['admin-courses/index.html']],
  ['html/admin-dashboard.html', ['admin-dashboard/index.html']],
  ['html/admin-instructor-applications.html', ['admin-instructor-applications/index.html']],
  ['html/admin-site-content.html', ['admin-site-content/index.html']],
  ['html/admin-update-log.html', ['admin-update-log/index.html']],
  ['html/application-complete.html', ['application-complete/index.html']],
  ['html/corporate.html', ['corporate/index.html']],
  ['html/course-corporate.html', ['course-corporate/index.html']],
  ['html/course-detail.html', ['course-detail/index.html', 'course/index.html']],
  ['html/course-free.html', ['course-free/index.html']],
  ['html/course-paid.html', ['course-paid/index.html']],
  ['html/faq.html', ['faq/index.html']],
  ['html/instructor-apply.html', ['instructor-apply/index.html']],
  ['html/instructor.html', ['instructor/index.html']],
  ['html/reviews.html', ['reviews/index.html']]
];

const assetMirror = {
  sourceDirectory: 'html/assets',
  destinationDirectory: 'assets'
};

function printHelp() {
  console.log(`Usage: node tools/sync-static-mirrors.mjs [--check|--sync]\n\n` +
    '  --check  Exit with an error when a public mirror differs from html/ (default).\n' +
    '  --sync   Copy changed html/ pages and assets to their public mirror paths.');
}

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

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function validatePageManifest() {
  const htmlDirectory = resolveProjectPath('html');
  const discoveredPages = (await readdir(htmlDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => `html/${entry.name}`)
    .sort();
  const declaredPages = pageMirrors.map(([source]) => source).sort();

  const undeclared = discoveredPages.filter((page) => !declaredPages.includes(page));
  const missing = declaredPages.filter((page) => !discoveredPages.includes(page));
  if (undeclared.length || missing.length) {
    const details = [
      undeclared.length ? `undeclared pages: ${undeclared.join(', ')}` : '',
      missing.length ? `missing pages: ${missing.join(', ')}` : ''
    ].filter(Boolean).join('; ');
    throw new Error(`Page mirror manifest is incomplete (${details}).`);
  }
}

async function createMirrorJobs() {
  const jobs = pageMirrors.flatMap(([source, destinations]) => destinations.map((destination) => ({
    source,
    destination
  })));

  const assetSourceDirectory = resolveProjectPath(assetMirror.sourceDirectory);
  const assetFiles = await collectFiles(assetSourceDirectory);
  for (const sourcePath of assetFiles) {
    const assetRelativePath = normalizePath(relative(assetSourceDirectory, sourcePath));
    jobs.push({
      source: `${assetMirror.sourceDirectory}/${assetRelativePath}`,
      destination: `${assetMirror.destinationDirectory}/${assetRelativePath}`
    });
  }

  const seenDestinations = new Set();
  for (const job of jobs) {
    resolveProjectPath(job.source);
    resolveProjectPath(job.destination);
    if (seenDestinations.has(job.destination)) {
      throw new Error(`Duplicate mirror destination: ${job.destination}`);
    }
    seenDestinations.add(job.destination);
  }

  return jobs;
}

async function compareMirror(job) {
  const sourcePath = resolveProjectPath(job.source);
  const destinationPath = resolveProjectPath(job.destination);
  const sourceContents = await readFile(sourcePath);

  try {
    const destinationContents = await readFile(destinationPath);
    return {
      ...job,
      status: sourceContents.equals(destinationContents) ? 'current' : 'different'
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { ...job, status: 'missing' };
    }
    throw error;
  }
}

async function syncMirror(result) {
  const sourcePath = resolveProjectPath(result.source);
  const destinationPath = resolveProjectPath(result.destination);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  return result.status === 'missing' ? 'created' : 'updated';
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.length > 1 || (args[0] && !['--check', '--sync'].includes(args[0]))) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const mode = args[0] || '--check';
  await validatePageManifest();
  const jobs = await createMirrorJobs();
  const results = [];

  for (const job of jobs) {
    results.push(await compareMirror(job));
  }

  const drifted = results.filter((result) => result.status !== 'current');
  if (!drifted.length) {
    console.log(`[static-mirrors] ${jobs.length} public mirrors are in sync.`);
    return;
  }

  if (mode === '--check') {
    for (const result of drifted) {
      console.error(`[static-mirrors] ${result.status}: ${result.destination} <- ${result.source}`);
    }
    console.error('[static-mirrors] Run `node tools/sync-static-mirrors.mjs --sync` and commit the generated mirrors.');
    process.exitCode = 1;
    return;
  }

  for (const result of drifted) {
    const action = await syncMirror(result);
    console.log(`[static-mirrors] ${action}: ${result.destination} <- ${result.source}`);
  }
  console.log(`[static-mirrors] Synchronized ${drifted.length} of ${jobs.length} public mirrors.`);
}

main().catch((error) => {
  console.error(`[static-mirrors] ${error.message}`);
  process.exitCode = 1;
});
