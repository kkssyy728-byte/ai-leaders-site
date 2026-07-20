const CONFIG = {
  url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  publishableKey: String(process.env.SUPABASE_PUBLISHABLE_KEY || '')
};

const PUBLIC_READ_TABLES = [
  'courses',
  'site_banners',
  'instructors',
  'form_options'
];

const PRIVATE_READ_TABLES = [
  'lecture_applications',
  'corporate_inquiries',
  'instructor_applications',
  'staff_members',
  'content_audit_log'
];
const SELECT_COLUMNS = {
  staff_members: 'user_id'
};

if (!CONFIG.url || !CONFIG.publishableKey) {
  console.error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for a development project.');
  process.exit(2);
}

async function readRows(table) {
  const url = new URL(`/rest/v1/${table}`, CONFIG.url);
  url.searchParams.set('select', SELECT_COLUMNS[table] || 'id');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: {
      apikey: CONFIG.publishableKey,
      Accept: 'application/json',
      'Accept-Profile': 'public'
    }
  });

  const payload = await response.json().catch(() => null);
  return { table, status: response.status, ok: response.ok, payload };
}

const publicResults = await Promise.all(PUBLIC_READ_TABLES.map(readRows));
const privateResults = await Promise.all(PRIVATE_READ_TABLES.map(readRows));
let failed = false;

for (const result of publicResults) {
  const passed = result.ok && Array.isArray(result.payload);
  failed ||= !passed;
  console.log(`[public read] ${result.table}: ${passed ? 'PASS' : 'FAIL'} (${result.status})`);
}

for (const result of privateResults) {
  const returnedRows = Array.isArray(result.payload) ? result.payload.length : 0;
  const passed = (!result.ok && [401, 403].includes(result.status)) || (result.ok && returnedRows === 0);
  failed ||= !passed;
  console.log(`[anonymous private read] ${result.table}: ${passed ? 'PASS' : 'FAIL'} (${result.status}, rows=${returnedRows})`);
}

if (failed) process.exitCode = 1;
