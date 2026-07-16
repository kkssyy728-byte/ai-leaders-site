(function (global) {
  'use strict';

  var CONFIG = {
    url: 'https://wdghlbswlvwlmkywiibr.supabase.co',
    publishableKey: 'sb_publishable_J4Cc9bBwxTtmqf9qSxle-g_K_r1vdFT',
    storageBucket: 'instructor-portfolio'
  };

  var DEFAULT_ERROR_MESSAGE = '데이터를 불러올 수 없습니다.';

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function toNumber(value, fallback) {
    var num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function toBoolean(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  }

  function parseList(value, options) {
    var opts = options || {};
    if (Array.isArray(value)) {
      return value.map(text).filter(Boolean);
    }
    if (!value) return [];
    if (opts.json) {
      try {
        var parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean);
      } catch (error) {}
    }
    var separator = opts.separator === 'line' ? /\r?\n/ : (opts.separator || ',');
    return String(value).split(separator).map(text).filter(Boolean);
  }

  function formatSubmittedAt(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeAssetUrl(value, basePath) {
    var raw = text(value);
    if (!raw) return '';
    if (/^(https?:)?\/\//i.test(raw) || /^(data|blob):/i.test(raw) || raw.charAt(0) === '#') {
      return raw;
    }
    if (raw.charAt(0) === '/') return raw;

    var normalized = raw.replace(/\\/g, '/').replace(/^\.?\//, '');
    normalized = normalized.replace(/^(\.\.\/)+/, '');
    if (/^images\//i.test(normalized) || /^assets\//i.test(normalized) || /^videos\//i.test(normalized)) {
      return '/' + normalized;
    }
    if (/\.(avif|gif|jpe?g|png|svg|webp|mp4|webm)$/i.test(normalized)) {
      return '/' + (basePath || 'images') + '/' + normalized;
    }
    return raw;
  }

  function normalizePublicCode(value) {
    return text(value)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32);
  }

  function stablePublicCode(seed) {
    var value = text(seed) || createId('course');
    var hash = 2166136261;
    for (var i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return 'c' + (hash >>> 0).toString(36).slice(0, 6).padStart(5, '0');
  }

  function notifyListeners(listeners) {
    (listeners || []).slice().forEach(function (listener) {
      try {
        listener();
      } catch (error) {
        console.error(error);
      }
    });
  }

  function subscribeListener(listeners, listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    return function () {
      var index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  function normalizeError(error, fallbackMessage) {
    return error instanceof Error ? error : new Error(fallbackMessage || DEFAULT_ERROR_MESSAGE);
  }

  function hasConfig() {
    return !!(CONFIG.url && CONFIG.publishableKey);
  }

  function makeError(message, detail) {
    var error = new Error(message || DEFAULT_ERROR_MESSAGE);
    if (detail) error.detail = detail;
    return error;
  }

  function normalizeErrorPayload(payload) {
    if (!payload || typeof payload !== 'object') return '';
    return payload.message || payload.error_description || payload.error || '';
  }

  function mergeHeaders(base, extra) {
    var next = {};
    Object.keys(base || {}).forEach(function (key) {
      next[key] = base[key];
    });
    Object.keys(extra || {}).forEach(function (key) {
      next[key] = extra[key];
    });
    return next;
  }

  function buildAuthHeaders(extra) {
    var headers = {
      apikey: CONFIG.publishableKey
    };
    // Legacy anon keys are JWTs. New sb_publishable_* keys are opaque API keys
    // and must not be sent as Bearer tokens (Storage rejects them as invalid JWS).
    if (/^eyJ/.test(CONFIG.publishableKey)) {
      headers.Authorization = 'Bearer ' + CONFIG.publishableKey;
    }
    return mergeHeaders(headers, extra);
  }

  function readJson(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  async function request(path, options) {
    if (!hasConfig()) throw makeError();
    var url = CONFIG.url + path;
    var requestOptions = Object.assign({
      method: 'GET',
      headers: buildAuthHeaders()
    }, options || {});
    var response = await fetch(url, requestOptions);
    var text = await response.text();
    var data = readJson(text);
    if (!response.ok) {
      throw makeError(normalizeErrorPayload(data) || DEFAULT_ERROR_MESSAGE, data || text);
    }
    return data;
  }

  function buildFilterParams(filters) {
    var params = new URLSearchParams();
    Object.keys(filters || {}).forEach(function (key) {
      var value = filters[key];
      if (value == null || value === '') return;
      params.append(key, 'eq.' + String(value));
    });
    return params;
  }

  async function selectRows(table, options) {
    var params = new URLSearchParams();
    var select = options && options.select ? options.select : '*';
    params.set('select', select);
    if (options && options.filters) {
      buildFilterParams(options.filters).forEach(function (value, key) {
        params.append(key, value);
      });
    }
    return request('/rest/v1/' + table + '?' + params.toString(), {
      headers: buildAuthHeaders({
        Accept: 'application/json',
        'Accept-Profile': 'public'
      })
    }) || [];
  }

  async function upsertRows(table, rows, conflictKey) {
    var items = Array.isArray(rows) ? rows : [rows];
    return request('/rest/v1/' + table + '?on_conflict=' + encodeURIComponent(conflictKey || 'id'), {
      method: 'POST',
      headers: buildAuthHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
        'Content-Profile': 'public'
      }),
      body: JSON.stringify(items)
    }) || [];
  }

  async function insertRows(table, rows) {
    var items = Array.isArray(rows) ? rows : [rows];
    return request('/rest/v1/' + table, {
      method: 'POST',
      headers: buildAuthHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Content-Profile': 'public'
      }),
      body: JSON.stringify(items)
    }) || [];
  }

  async function updateRows(table, filters, payload) {
    var params = buildFilterParams(filters);
    params.set('select', '*');
    return request('/rest/v1/' + table + '?' + params.toString(), {
      method: 'PATCH',
      headers: buildAuthHeaders({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Content-Profile': 'public'
      }),
      body: JSON.stringify(payload || {})
    }) || [];
  }

  async function deleteRows(table, filters) {
    var params = buildFilterParams(filters);
    params.set('select', '*');
    return request('/rest/v1/' + table + '?' + params.toString(), {
      method: 'DELETE',
      headers: buildAuthHeaders({
        Accept: 'application/json',
        Prefer: 'return=representation',
        'Content-Profile': 'public'
      })
    }) || [];
  }

  async function deleteAllRows(table) {
    return request('/rest/v1/' + table + '?id=not.is.null&select=*', {
      method: 'DELETE',
      headers: buildAuthHeaders({
        Accept: 'application/json',
        Prefer: 'return=representation',
        'Content-Profile': 'public'
      })
    }) || [];
  }

  function encodeStoragePath(path) {
    return String(path || '')
      .split('/')
      .map(function (part) { return encodeURIComponent(part); })
      .join('/');
  }

  function storageBucket(bucketName) {
    return bucketName || CONFIG.storageBucket;
  }

  function buildPublicUrl(path, bucketName) {
    return CONFIG.url + '/storage/v1/object/public/' + encodeStoragePath(storageBucket(bucketName)) + '/' + encodeStoragePath(path);
  }

  function fileExtension(name) {
    var value = String(name || '');
    var idx = value.lastIndexOf('.');
    return idx >= 0 ? value.slice(idx) : '';
  }

  function createId(prefix) {
    return String(prefix || 'row') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function createStoragePath(prefix, fileName) {
    var date = new Date();
    var year = String(date.getFullYear());
    var month = String(date.getMonth() + 1).padStart(2, '0');
    return [prefix || 'files', year, month, createId('file') + fileExtension(fileName)].join('/');
  }

  async function uploadFile(path, file, bucketName, options) {
    if (!file) throw makeError('업로드할 파일이 없습니다.');
    await request('/storage/v1/object/' + encodeStoragePath(storageBucket(bucketName)) + '/' + encodeStoragePath(path), {
      method: 'POST',
      headers: buildAuthHeaders({
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': options && options.upsert ? 'true' : 'false'
      }),
      body: file
    });
    return {
      path: path,
      publicUrl: buildPublicUrl(path, bucketName)
    };
  }

  async function deleteFile(path, bucketName) {
    if (!path) return;
    await request('/storage/v1/object/' + encodeStoragePath(storageBucket(bucketName)) + '/' + encodeStoragePath(path), {
      method: 'DELETE',
      headers: buildAuthHeaders()
    });
  }

  global.AiLeadersUtils = {
    clone: clone,
    text: text,
    toNumber: toNumber,
    toBoolean: toBoolean,
    parseList: parseList,
    formatSubmittedAt: formatSubmittedAt,
    escapeHtml: escapeHtml,
    normalizeAssetUrl: normalizeAssetUrl,
    normalizePublicCode: normalizePublicCode,
    stablePublicCode: stablePublicCode,
    notifyListeners: notifyListeners,
    subscribeListener: subscribeListener,
    normalizeError: normalizeError
  };

  global.AiLeadersSupabase = {
    config: clone(CONFIG),
    storageBucket: CONFIG.storageBucket,
    defaultErrorMessage: DEFAULT_ERROR_MESSAGE,
    clone: clone,
    text: text,
    toNumber: toNumber,
    toBoolean: toBoolean,
    parseList: parseList,
    formatSubmittedAt: formatSubmittedAt,
    escapeHtml: escapeHtml,
    normalizeAssetUrl: normalizeAssetUrl,
    normalizePublicCode: normalizePublicCode,
    stablePublicCode: stablePublicCode,
    notifyListeners: notifyListeners,
    subscribeListener: subscribeListener,
    normalizeError: normalizeError,
    hasConfig: hasConfig,
    makeError: makeError,
    createId: createId,
    createStoragePath: createStoragePath,
    selectRows: selectRows,
    insertRows: insertRows,
    upsertRows: upsertRows,
    updateRows: updateRows,
    deleteRows: deleteRows,
    deleteAllRows: deleteAllRows,
    uploadFile: uploadFile,
    deleteFile: deleteFile,
    buildPublicUrl: buildPublicUrl
  };
})(window);
