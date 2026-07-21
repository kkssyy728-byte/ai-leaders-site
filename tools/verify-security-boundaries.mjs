#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

async function text(path) {
  return (await readFile(resolve(projectRoot, path), 'utf8')).replace(/\r\n/g, '\n');
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const adminPages = [
  'src/pages/admin/dashboard.html',
  'src/pages/admin/courses.html',
  'src/pages/admin/site-content.html',
  'src/pages/admin/applications.html',
  'src/pages/admin/corporate-inquiries.html',
  'src/pages/admin/instructor-applications.html',
  'src/pages/admin/update-log.html'
];

for (const path of adminPages) {
  const page = await text(path);
  expect(page.includes('/assets/admin-auth-bootstrap.js'), `${path}: missing pre-render auth gate`);
  expect(page.includes('/assets/admin-auth.js'), `${path}: missing staff authorization script`);
  expect(page.includes('@supabase/supabase-js@2.110.7'), `${path}: Supabase SDK version is not pinned`);
  expect(page.includes('integrity="sha384-'), `${path}: Supabase SDK is missing SRI`);
}

const adminAuth = await text('src/assets/admin-auth.js');
expect(adminAuth.includes('Boolean(allowedRoles'), 'unknown admin routes are allowed by default');
expect(adminAuth.includes('[data-tab="option"], [data-section="option"]'), 'design staff can still see the restricted form-option editor');

const siteLayout = await text('src/assets/site-layout.js');
expect(!siteLayout.includes('ADMIN_ACCESS_PASSWORD'), 'site-layout.js still contains a shared admin password');
expect(!siteLayout.includes('adminAccessPassword'), 'site-layout.js still contains the retired shared-password dialog');
expect(siteLayout.includes("ADMIN_ACCESS_PATH = '/admin-dashboard/'"), 'site-layout.js does not route the admin link through the protected dashboard');
expect(siteLayout.includes('data-admin-access>관리자 페이지</a>'), 'site-layout.js does not label the public admin link correctly');
expect(!siteLayout.includes('/admin-login/?next=%2Fadmin-dashboard%2F'), 'site-layout.js still flashes the login page for an active admin session');

const commonStore = await text('src/assets/supabase-store-common.js');
expect(commonStore.includes("Prefer: SENSITIVE_INSERT_TABLES[table] ? 'return=minimal'"), 'sensitive public inserts may return private records');
expect(commonStore.includes('activeSession.access_token'), 'authenticated requests do not use the staff access token');

const formStore = await text('src/assets/form-submissions-store.js');
expect(formStore.includes('10 * 1024 * 1024'), 'portfolio upload limit is not 10 MiB');
expect(formStore.includes("createSignedUrl(fileId, 'instructor-portfolio', 300)"), 'private portfolio download does not use a short-lived signed URL');
expect(!formStore.includes('api.buildPublicUrl(fileId)'), 'private portfolio file still builds a public URL');

const migration = await text('supabase/20260719_secure_staff_access.sql');
expect(migration.includes("'instructor-portfolio',\n  'instructor-portfolio',\n  false"), 'portfolio bucket is not private');
expect(migration.includes('lecture_applications_select_staff'), 'lecture applications are missing staff-only read policy');
expect(!migration.includes('lecture_applications_select_public'), 'lecture applications still declare a public read policy');
expect(migration.includes('private.has_staff_role'), 'role checks are missing from the security migration');
expect(migration.includes('content_audit_log'), 'content audit log is missing from the security migration');
expect(migration.includes('lecture_applications_insert_public'), 'public lecture applications cannot be submitted');
expect(!migration.includes('grant select, insert, update, delete on table public.lecture_applications to anon'), 'anonymous users retain broad application-table privileges');
expect(migration.includes('portfolio_file_public_url is null'), 'anonymous submissions can persist a public portfolio URL');
expect(migration.trim().startsWith('-- Secure staff access') && migration.trim().endsWith('commit;'), 'security migration is not wrapped in its expected transaction');

const headers = await text('src/static/_headers');
expect(headers.includes('Content-Security-Policy:'), 'Cloudflare security headers are missing CSP');
expect(headers.includes('X-Frame-Options: DENY'), 'Cloudflare headers do not prevent framing');
expect(headers.includes('/admin-*'), 'admin cache and indexing rules are missing');
const cspLine = headers.split(/\r?\n/).find((line) => line.includes('Content-Security-Policy:')) || '';
expect(cspLine.length < 2000, 'Cloudflare CSP header exceeds the per-header rule limit');

if (failures.length) {
  for (const failure of failures) console.error(`[security-check] ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`[security-check] PASS (${adminPages.length} protected admin pages)`);
}
