#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(projectRoot, 'src/assets/supabase-store-common.js'), 'utf8');
const requests = [];

const context = {
  console,
  URLSearchParams,
  fetch: async (url, options) => {
    requests.push({ url, options });
    const isSensitive = url.endsWith('/rest/v1/lecture_applications');
    return {
      ok: true,
      text: async () => isSensitive ? '' : JSON.stringify([{ id: 'saved-row' }])
    };
  },
  window: {}
};

vm.runInNewContext(source, context, { filename: 'supabase-store-common.js' });
const api = context.window.AiLeadersSupabase;

const minimalResult = await api.insertRows('lecture_applications', [{ id: 'application-1' }]);
assert.equal(Array.isArray(minimalResult), true, '204/minimal insert must resolve to an array');
assert.equal(minimalResult.length, 0, '204/minimal insert must resolve to an empty array');
assert.equal(requests[0].options.headers.Prefer, 'return=minimal');

const representedResult = await api.insertRows('public_content', [{ id: 'content-1' }]);
assert.equal(Array.isArray(representedResult), true, 'represented insert must resolve to an array');
assert.equal(representedResult.length, 1);
assert.equal(representedResult[0].id, 'saved-row');
assert.equal(requests[1].options.headers.Prefer, 'return=representation');

console.log('[supabase-insert-check] PASS (minimal and represented responses)');
