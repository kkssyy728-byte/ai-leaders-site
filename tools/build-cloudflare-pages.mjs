#!/usr/bin/env node

import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(projectRoot, 'dist');
const maxFileSize = 25 * 1024 * 1024;
const maxFileCount = 20_000;

const publicDirectories = [
  'about',
  'admin-applications',
  'admin-corporate-inquiries',
  'admin-courses',
  'admin-dashboard',
  'admin-instructor-applications',
  'admin-login',
  'admin-site-content',
  'admin-update-log',
  'application-complete',
  'assets',
  'corporate',
  'course',
  'course-corporate',
  'course-detail',
  'course-free',
  'course-paid',
  'faq',
  'images',
  'instructor',
  'instructor-apply',
  'reviews',
  'videos'
];

const publicFiles = [
  '_headers',
  'favicon.ico',
  'index.html',
  'robots.txt',
  'shared.css',
  'sitemap.xml'
];

function verifyMirrors() {
  const result = spawnSync(process.execPath, [join(projectRoot, 'tools', 'sync-static-mirrors.mjs'), '--check'], {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status || 1);
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
  verifyMirrors();
  if (dirname(outputDirectory) !== projectRoot || !outputDirectory.endsWith('dist')) {
    throw new Error('Refusing to replace an unexpected output directory.');
  }
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  for (const directory of publicDirectories) {
    await cp(join(projectRoot, directory), join(outputDirectory, directory), { recursive: true });
  }
  for (const file of publicFiles) {
    await cp(join(projectRoot, file), join(outputDirectory, file));
  }

  const fileCount = await inspectArtifact(outputDirectory);
  if (fileCount > maxFileCount) {
    throw new Error(`Cloudflare Pages 20,000 file limit exceeded: ${fileCount}`);
  }
  console.log(`[cloudflare-build] PASS (${fileCount} public files in dist)`);
}

await build();
