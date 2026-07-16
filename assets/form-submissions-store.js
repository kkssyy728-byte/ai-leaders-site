(function (global) {
  'use strict';

  var api = global.AiLeadersSupabase;
  var utils = global.AiLeadersUtils || api || {};
  var clone = utils.clone;
  var formatSubmittedAt = utils.formatSubmittedAt;
  var escapeHtml = utils.escapeHtml;
  var MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024;

  function normalizeList(value) {
    return utils.parseList(value, { separator: ',' });
  }

  function formatFileSize(bytes) {
    var value = Number(bytes || 0);
    if (!value) return '';
    if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1) + 'MB';
    if (value >= 1024) return Math.round(value / 1024) + 'KB';
    return value + 'B';
  }

  function createStore(options) {
    var cache = [];
    var loaded = false;
    var lastError = null;
    var readyPromise = null;
    var listeners = [];

    function notify() {
      utils.notifyListeners(listeners);
    }

    function setError(error) {
      lastError = utils.normalizeError(error, api && api.defaultErrorMessage);
    }

    function normalize(item) {
      return options.normalize(Object.assign({}, item || {}));
    }

    function fromRow(row) {
      return normalize(options.fromRow(row || {}));
    }

    function toRow(item) {
      return options.toRow(normalize(item));
    }

    function cacheFromItems(items) {
      cache = (items || []).map(normalize).sort(function (a, b) {
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      });
      loaded = true;
      lastError = null;
      notify();
      return getItems();
    }

    async function loadItems() {
      if (!api || !api.hasConfig()) {
        throw new Error(api ? api.defaultErrorMessage : '데이터를 불러올 수 없습니다.');
      }
      var rows = await api.selectRows(options.table, { select: '*' });
      return cacheFromItems(rows.map(fromRow));
    }

    function ready(force) {
      if (force) readyPromise = null;
      if (!readyPromise) {
        readyPromise = loadItems().catch(function (error) {
          loaded = false;
          setError(error);
          notify();
          throw lastError;
        });
      }
      return readyPromise;
    }

    async function refresh() {
      readyPromise = null;
      return ready(true);
    }

    function getItems() {
      return clone(cache);
    }

    async function addItem(item) {
      var normalized = normalize(Object.assign({}, item, {
        id: api.createId(options.prefix),
        submittedAt: new Date().toISOString()
      }));
      var rows = await api.insertRows(options.table, [toRow(normalized)]);
      var saved = rows.length ? fromRow(rows[0]) : normalized;
      cache.unshift(saved);
      loaded = true;
      lastError = null;
      notify();
      return clone(saved);
    }

    async function deleteItem(id) {
      if (!id) return getItems();
      await api.deleteRows(options.table, { id: id });
      cache = cache.filter(function (item) {
        return item.id !== id;
      });
      loaded = true;
      lastError = null;
      notify();
      return getItems();
    }

    async function clearItems() {
      await api.deleteAllRows(options.table);
      cache = [];
      loaded = true;
      lastError = null;
      notify();
      return getItems();
    }

    function subscribe(listener) {
      return utils.subscribeListener(listeners, listener);
    }

    ready().catch(function () {});

    return {
      ready: ready,
      refresh: refresh,
      subscribe: subscribe,
      hasLoaded: function () { return loaded; },
      hasError: function () { return !!lastError; },
      getErrorMessage: function () { return lastError ? lastError.message : ''; },
      getItems: getItems,
      addItem: addItem,
      deleteItem: deleteItem,
      clearItems: clearItems,
      formatSubmittedAt: formatSubmittedAt,
      escapeHtml: escapeHtml
    };
  }

  var corporateStore = createStore({
    prefix: 'corp',
    table: 'corporate_inquiries',
    normalize: function (item) {
      item.id = String(item.id || '').trim();
      item.company = String(item.company || '').trim();
      item.name = String(item.name || '').trim();
      item.phone = String(item.phone || '').trim();
      item.email = String(item.email || '').trim();
      item.headcount = String(item.headcount || '').trim();
      item.preferredDate = String(item.preferredDate || '').trim();
      item.location = String(item.location || '').trim();
      item.region = String(item.region || '').trim();
      item.preferredInstructor = String(item.preferredInstructor || '').trim();
      item.level = String(item.level || '').trim();
      item.topics = normalizeList(item.topics);
      item.message = String(item.message || '').trim();
      item.source = String(item.source || 'corporate').trim();
      item.submittedAt = item.submittedAt || new Date().toISOString();
      return item;
    },
    fromRow: function (row) {
      return {
        id: row.id,
        company: row.company,
        name: row.name,
        phone: row.phone,
        email: row.email,
        headcount: row.headcount,
        preferredDate: row.preferred_date,
        location: row.location,
        region: row.region,
        preferredInstructor: row.preferred_instructor,
        level: row.level,
        topics: row.topics,
        message: row.message,
        source: row.source,
        submittedAt: row.submitted_at
      };
    },
    toRow: function (item) {
      return {
        id: item.id,
        company: item.company || null,
        name: item.name || null,
        phone: item.phone || null,
        email: item.email || null,
        headcount: item.headcount || null,
        preferred_date: item.preferredDate || null,
        location: item.location || null,
        region: item.region || null,
        preferred_instructor: item.preferredInstructor || null,
        level: item.level || null,
        topics: item.topics,
        message: item.message || null,
        source: item.source || null,
        submitted_at: item.submittedAt
      };
    }
  });

  var instructorStore = createStore({
    prefix: 'inst',
    table: 'instructor_applications',
    normalize: function (item) {
      item.id = String(item.id || '').trim();
      item.name = String(item.name || '').trim();
      item.phone = String(item.phone || '').trim();
      item.email = String(item.email || '').trim();
      item.region = String(item.region || '').trim();
      item.career = String(item.career || '').trim();
      item.mode = String(item.mode || '').trim();
      item.fields = normalizeList(item.fields);
      item.portfolio = String(item.portfolio || '').trim();
      item.portfolioFileId = String(item.portfolioFileId || '').trim();
      item.portfolioFileName = String(item.portfolioFileName || '').trim();
      item.portfolioFileType = String(item.portfolioFileType || '').trim();
      item.portfolioFileSize = Number(item.portfolioFileSize || 0);
      item.portfolioFileStoredAt = item.portfolioFileStoredAt || '';
      item.portfolioFileUrl = String(item.portfolioFileUrl || '').trim();
      item.intro = String(item.intro || '').trim();
      item.source = String(item.source || 'instructor-apply').trim();
      item.submittedAt = item.submittedAt || new Date().toISOString();
      return item;
    },
    fromRow: function (row) {
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        region: row.region,
        career: row.career,
        mode: row.mode,
        fields: row.fields,
        portfolio: row.portfolio,
        portfolioFileId: row.portfolio_file_path,
        portfolioFileName: row.portfolio_file_name,
        portfolioFileType: row.portfolio_file_type,
        portfolioFileSize: row.portfolio_file_size,
        portfolioFileStoredAt: row.portfolio_file_uploaded_at,
        portfolioFileUrl: row.portfolio_file_public_url,
        intro: row.intro,
        source: row.source,
        submittedAt: row.submitted_at
      };
    },
    toRow: function (item) {
      return {
        id: item.id,
        name: item.name || null,
        phone: item.phone || null,
        email: item.email || null,
        region: item.region || null,
        career: item.career || null,
        mode: item.mode || null,
        fields: item.fields,
        portfolio: item.portfolio || null,
        portfolio_file_path: item.portfolioFileId || null,
        portfolio_file_name: item.portfolioFileName || null,
        portfolio_file_type: item.portfolioFileType || null,
        portfolio_file_size: item.portfolioFileSize || 0,
        portfolio_file_uploaded_at: item.portfolioFileStoredAt || null,
        portfolio_file_public_url: item.portfolioFileUrl || null,
        intro: item.intro || null,
        source: item.source || null,
        submitted_at: item.submittedAt
      };
    }
  });

  async function saveFile(file) {
    if (!file) return null;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error('100MB를 초과하는 파일은 첨부할 수 없습니다. 링크로 제출해 주세요.');
    }
    var path = api.createStoragePath('instructor-portfolio', file.name || 'portfolio-file');
    var uploaded = await api.uploadFile(path, file);
    return {
      fileId: path,
      fileName: file.name || 'portfolio-file',
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size || 0,
      fileStoredAt: new Date().toISOString(),
      fileUrl: uploaded.publicUrl
    };
  }

  async function getFile(fileId) {
    if (!fileId) return null;
    return {
      id: fileId,
      url: api.buildPublicUrl(fileId)
    };
  }

  async function deleteFile(fileId) {
    if (!fileId) return;
    await api.deleteFile(fileId);
  }

  async function downloadFile(fileId, fileName) {
    var record = await getFile(fileId);
    if (!record || !record.url) throw new Error('저장된 파일을 찾을 수 없습니다.');
    var a = global.document.createElement('a');
    a.href = record.url;
    a.download = fileName || '';
    a.target = '_blank';
    global.document.body.appendChild(a);
    a.click();
    a.remove();
    return record;
  }

  global.CorporateInquiryStore = {
    ready: corporateStore.ready,
    refresh: corporateStore.refresh,
    subscribe: corporateStore.subscribe,
    hasLoaded: corporateStore.hasLoaded,
    hasError: corporateStore.hasError,
    getErrorMessage: corporateStore.getErrorMessage,
    getInquiries: corporateStore.getItems,
    addInquiry: corporateStore.addItem,
    deleteInquiry: corporateStore.deleteItem,
    clearInquiries: corporateStore.clearItems,
    formatSubmittedAt: corporateStore.formatSubmittedAt,
    escapeHtml: corporateStore.escapeHtml
  };

  global.InstructorApplicationStore = {
    ready: instructorStore.ready,
    refresh: instructorStore.refresh,
    subscribe: instructorStore.subscribe,
    hasLoaded: instructorStore.hasLoaded,
    hasError: instructorStore.hasError,
    getErrorMessage: instructorStore.getErrorMessage,
    getApplications: instructorStore.getItems,
    addApplication: instructorStore.addItem,
    deleteApplication: instructorStore.deleteItem,
    clearApplications: instructorStore.clearItems,
    formatSubmittedAt: instructorStore.formatSubmittedAt,
    escapeHtml: instructorStore.escapeHtml
  };

  global.FormFileStore = {
    maxAttachmentSize: MAX_ATTACHMENT_SIZE,
    saveFile: saveFile,
    getFile: getFile,
    deleteFile: deleteFile,
    downloadFile: downloadFile,
    formatFileSize: formatFileSize
  };
})(window);
