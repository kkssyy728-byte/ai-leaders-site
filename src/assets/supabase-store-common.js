(function (global) {
  'use strict';

  var CONFIG = {
    url: 'https://wdghlbswlvwlmkywiibr.supabase.co',
    publishableKey: 'sb_publishable_J4Cc9bBwxTtmqf9qSxle-g_K_r1vdFT',
    storageBucket: 'instructor-portfolio'
  };

  var PRIVATE_STORAGE_BUCKETS = {
    'instructor-portfolio': true
  };
  var SENSITIVE_INSERT_TABLES = {
    lecture_applications: true,
    corporate_inquiries: true,
    instructor_applications: true
  };
  var supabaseClient = null;
  var activeSession = null;
  var authReadyPromise = Promise.resolve(null);

  if (global.supabase && typeof global.supabase.createClient === 'function') {
    supabaseClient = global.supabase.createClient(CONFIG.url, CONFIG.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    authReadyPromise = supabaseClient.auth.getSession().then(function (result) {
      if (result.error) throw result.error;
      activeSession = result.data ? result.data.session : null;
      return activeSession;
    }).catch(function (error) {
      console.error('[AI Leaders] Supabase session initialization failed.', error);
      activeSession = null;
      return null;
    });
    supabaseClient.auth.onAuthStateChange(function (_event, session) {
      activeSession = session || null;
    });
  }

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
    if (activeSession && activeSession.access_token) {
      headers.Authorization = 'Bearer ' + activeSession.access_token;
    // Legacy anon keys are JWTs. New sb_publishable_* keys are opaque API keys
    // and must not be sent as Bearer tokens (Storage rejects them as invalid JWS).
    } else if (/^eyJ/.test(CONFIG.publishableKey)) {
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
    await authReadyPromise;
    var url = CONFIG.url + path;
    var suppliedOptions = options || {};
    var requestOptions = Object.assign({ method: 'GET' }, suppliedOptions);
    requestOptions.headers = buildAuthHeaders(suppliedOptions.headers || {});
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
    if (options && options.operators) {
      Object.keys(options.operators).forEach(function (key) {
        var value = options.operators[key];
        if (value == null || value === '') return;
        params.append(key, String(value));
      });
    }
    if (options && options.order) params.set('order', options.order);
    if (options && options.limit) params.set('limit', String(options.limit));
    return request('/rest/v1/' + table + '?' + params.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Profile': 'public'
      }
    }) || [];
  }

  async function upsertRows(table, rows, conflictKey) {
    var items = Array.isArray(rows) ? rows : [rows];
    return request('/rest/v1/' + table + '?on_conflict=' + encodeURIComponent(conflictKey || 'id'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
        'Content-Profile': 'public'
      },
      body: JSON.stringify(items)
    }) || [];
  }

  async function insertRows(table, rows) {
    var items = Array.isArray(rows) ? rows : [rows];
    var result = await request('/rest/v1/' + table, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: SENSITIVE_INSERT_TABLES[table] ? 'return=minimal' : 'return=representation',
        'Content-Profile': 'public'
      },
      body: JSON.stringify(items)
    });
    return Array.isArray(result) ? result : [];
  }

  async function updateRows(table, filters, payload) {
    var params = buildFilterParams(filters);
    params.set('select', '*');
    return request('/rest/v1/' + table + '?' + params.toString(), {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'Content-Profile': 'public'
      },
      body: JSON.stringify(payload || {})
    }) || [];
  }

  async function deleteRows(table, filters) {
    var params = buildFilterParams(filters);
    params.set('select', '*');
    return request('/rest/v1/' + table + '?' + params.toString(), {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Prefer: 'return=representation',
        'Content-Profile': 'public'
      }
    }) || [];
  }

  async function deleteAllRows(table) {
    return request('/rest/v1/' + table + '?id=not.is.null&select=*', {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Prefer: 'return=representation',
        'Content-Profile': 'public'
      }
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
    var uploadHeaders = {
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': options && options.upsert ? 'true' : 'false'
    };
    var cacheSeconds = Number(options && options.cacheControl);
    if (Number.isFinite(cacheSeconds) && cacheSeconds > 0) {
      uploadHeaders['cache-control'] = 'max-age=' + Math.min(Math.floor(cacheSeconds), 31536000);
    }
    await request('/storage/v1/object/' + encodeStoragePath(storageBucket(bucketName)) + '/' + encodeStoragePath(path), {
      method: 'POST',
      headers: uploadHeaders,
      body: file
    });
    return {
      path: path,
      publicUrl: PRIVATE_STORAGE_BUCKETS[storageBucket(bucketName)] ? '' : buildPublicUrl(path, bucketName)
    };
  }

  async function deleteFile(path, bucketName) {
    if (!path) return;
    await request('/storage/v1/object/' + encodeStoragePath(storageBucket(bucketName)) + '/' + encodeStoragePath(path), {
      method: 'DELETE',
      headers: {}
    });
  }

  async function getSession() {
    await authReadyPromise;
    if (!supabaseClient) return activeSession;
    var result = await supabaseClient.auth.getSession();
    if (result.error) throw result.error;
    activeSession = result.data ? result.data.session : null;
    return activeSession;
  }

  async function signInWithPassword(email, password) {
    if (!supabaseClient) throw makeError('Supabase 인증 모듈을 불러오지 못했습니다.');
    await authReadyPromise;
    var result = await supabaseClient.auth.signInWithPassword({
      email: text(email),
      password: String(password || '')
    });
    if (result.error) throw result.error;
    activeSession = result.data ? result.data.session : null;
    return result.data;
  }

  async function signOut() {
    if (!supabaseClient) {
      activeSession = null;
      return;
    }
    var result = await supabaseClient.auth.signOut();
    if (result.error) throw result.error;
    activeSession = null;
  }

  function onAuthStateChange(listener) {
    if (!supabaseClient || typeof listener !== 'function') return function () {};
    var result = supabaseClient.auth.onAuthStateChange(listener);
    return function () {
      if (result && result.data && result.data.subscription) {
        result.data.subscription.unsubscribe();
      }
    };
  }

  async function createSignedUrl(path, bucketName, expiresIn) {
    if (!path) throw makeError('파일 경로가 없습니다.');
    await authReadyPromise;
    if (!supabaseClient) throw makeError('Supabase 인증 모듈을 불러오지 못했습니다.');
    var result = await supabaseClient.storage
      .from(storageBucket(bucketName))
      .createSignedUrl(path, Math.max(60, Number(expiresIn) || 300));
    if (result.error) throw result.error;
    return result.data ? result.data.signedUrl : '';
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
    buildPublicUrl: buildPublicUrl,
    getClient: function () { return supabaseClient; },
    authReady: function () { return authReadyPromise; },
    getSession: getSession,
    signInWithPassword: signInWithPassword,
    signOut: signOut,
    onAuthStateChange: onAuthStateChange,
    createSignedUrl: createSignedUrl
  };
})(window);
