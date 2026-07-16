(function (global) {
  'use strict';

  var api = global.AiLeadersSupabase;
  var utils = global.AiLeadersUtils || api || {};
  var clone = utils.clone;
  var formatSubmittedAt = utils.formatSubmittedAt;
  var escapeHtml = utils.escapeHtml;
  var cache = [];
  var loaded = false;
  var lastError = null;
  var readyPromise = null;
  var listeners = [];
  var addQueue = Promise.resolve();
  var DUPLICATE_SOURCE_SUFFIX = '::duplicate';

  function notify() {
    utils.notifyListeners(listeners);
  }

  function setError(error) {
    lastError = utils.normalizeError(error, api && api.defaultErrorMessage);
  }

  function makeId() {
    return api && typeof api.createId === 'function'
      ? api.createId('app')
      : 'app-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function sourceInfo(value) {
    var source = String(value || '').trim();
    var isDuplicate = source.slice(-DUPLICATE_SOURCE_SUFFIX.length) === DUPLICATE_SOURCE_SUFFIX;
    return {
      source: isDuplicate ? source.slice(0, -DUPLICATE_SOURCE_SUFFIX.length) : source,
      isDuplicate: isDuplicate
    };
  }

  function normalizedIdentity(value) {
    var text = String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ko-KR');
    try { return text.normalize('NFKC'); } catch (error) { return text; }
  }

  function normalizedPhone(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function duplicateKey(application) {
    var courseTitle = normalizedIdentity(application && application.courseTitle);
    var name = normalizedIdentity(application && application.name);
    var phone = normalizedPhone(application && application.phone);
    return courseTitle && name && phone ? [courseTitle, name, phone].join('\u001f') : '';
  }

  function annotateDuplicates(applications) {
    var items = (applications || []).map(normalizeApplication).sort(function (a, b) {
      var timeDiff = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      return timeDiff || a.id.localeCompare(b.id);
    });
    var seen = new Set();
    items.forEach(function (item) {
      var key = duplicateKey(item);
      item.isDuplicate = item.isDuplicate === true || (!!key && seen.has(key));
      if (key) seen.add(key);
    });
    return items.sort(function (a, b) {
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  }

  function hasDuplicate(application) {
    var key = duplicateKey(application);
    return !!key && cache.some(function (item) { return duplicateKey(item) === key; });
  }

  function normalizeApplication(application) {
    var item = Object.assign({}, application || {});
    var parsedSource = sourceInfo(item.source);
    item.id = String(item.id || makeId()).trim();
    item.courseId = String(item.courseId || '').trim();
    item.courseTitle = String(item.courseTitle || '').trim();
    item.courseType = item.courseType === 'paid' ? 'paid' : 'free';
    item.name = String(item.name || '').trim();
    item.phone = String(item.phone || '').trim();
    item.email = String(item.email || '').trim();
    item.age = String(item.age || '').trim();
    item.paymentMethod = String(item.paymentMethod || '').trim();
    item.paymentBank = String(item.paymentBank || '').trim();
    item.paymentAccount = String(item.paymentAccount || '').trim();
    item.paymentHolder = String(item.paymentHolder || '').trim();
    item.paymentAccountLabel = String(item.paymentAccountLabel || '').trim();
    item.depositorName = String(item.depositorName || '').trim();
    item.cashReceiptRequested = item.cashReceiptRequested === true;
    item.message = String(item.message || '').trim();
    item.source = parsedSource.source;
    item.isDuplicate = item.isDuplicate === true || parsedSource.isDuplicate;
    item.applicantCountAdjusted = item.applicantCountAdjusted !== false;
    item.submittedAt = item.submittedAt || new Date().toISOString();
    return item;
  }

  function fromRow(row) {
    return normalizeApplication({
      id: row.id,
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseType: row.course_type,
      name: row.name,
      phone: row.phone,
      email: row.email,
      age: row.age,
      paymentMethod: row.payment_method,
      paymentBank: row.payment_bank,
      paymentAccount: row.payment_account,
      paymentHolder: row.payment_holder,
      paymentAccountLabel: row.payment_account_label,
      depositorName: row.depositor_name,
      cashReceiptRequested: row.cash_receipt_requested,
      message: row.message,
      source: row.source,
      isDuplicate: false,
      applicantCountAdjusted: row.applicant_count_adjusted,
      submittedAt: row.submitted_at
    });
  }

  function toRow(application) {
    var item = normalizeApplication(application);
    return {
      id: item.id,
      course_id: item.courseId || null,
      course_title: item.courseTitle || null,
      course_type: item.courseType,
      name: item.name || null,
      phone: item.phone || null,
      email: item.email || null,
      age: item.age || null,
      payment_method: item.paymentMethod || null,
      payment_bank: item.paymentBank || null,
      payment_account: item.paymentAccount || null,
      payment_holder: item.paymentHolder || null,
      payment_account_label: item.paymentAccountLabel || null,
      depositor_name: item.depositorName || null,
      cash_receipt_requested: item.cashReceiptRequested,
      message: item.message || null,
      source: (item.source || '') + (item.isDuplicate ? DUPLICATE_SOURCE_SUFFIX : '') || null,
      applicant_count_adjusted: item.applicantCountAdjusted,
      submitted_at: item.submittedAt
    };
  }

  function cacheFromApplications(applications) {
    cache = annotateDuplicates(applications);
    loaded = true;
    lastError = null;
    notify();
    return getApplications();
  }

  async function loadApplications() {
    if (!api || !api.hasConfig()) {
      throw new Error(api ? api.defaultErrorMessage : '데이터를 불러올 수 없습니다.');
    }
    var rows = await api.selectRows('lecture_applications', { select: '*' });
    return cacheFromApplications(rows.map(fromRow));
  }

  function ready(force) {
    if (force) readyPromise = null;
    if (!readyPromise) {
      readyPromise = loadApplications().catch(function (error) {
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

  function courseTitleText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function findCourse(application) {
    if (!global.CourseStore) return null;
    var courses = global.CourseStore.getCourses();
    if (application.courseId) {
      var byId = courses.find(function (course) {
        return course.id === application.courseId;
      });
      if (byId) return byId;
    }
    var title = courseTitleText(application.courseTitle);
    if (!title) return null;
    return courses.find(function (course) {
      return course.type === application.courseType && courseTitleText(course.title) === title;
    }) || null;
  }

  async function adjustCourseApplicantCount(application, delta) {
    try {
      if (!global.CourseStore || !delta) return false;
      var course = findCourse(application);
      if (!course) return false;
      var nextCount = Math.max(0, Number(course.applicantCount || 0) + delta);
      await api.updateRows('courses', { id: course.id }, {
        applicant_count: nextCount
      });
      await global.CourseStore.refresh();
      return true;
    } catch (error) {
      return false;
    }
  }

  function getApplications() {
    return clone(cache);
  }

  async function patchAdjustedFlag(id, adjusted) {
    await api.updateRows('lecture_applications', { id: id }, {
      applicant_count_adjusted: adjusted
    });
  }

  async function addApplicationInternal(application) {
    if (!loaded) await ready();
    if (global.CourseStore && typeof global.CourseStore.ready === 'function') {
      await global.CourseStore.ready().catch(function () {});
    }
    var item = normalizeApplication(Object.assign({}, application, {
      id: makeId(),
      submittedAt: new Date().toISOString()
    }));
    var course = findCourse(item);
    if (course) {
      if (global.CourseStore && typeof global.CourseStore.isOpenForApply === 'function'
          && !global.CourseStore.isOpenForApply(course)) {
        throw new Error('신청이 마감된 강연입니다. 다른 강연을 확인해 주세요.');
      }
      item.courseId = course.id;
      item.courseTitle = item.courseTitle || course.title;
      item.courseType = course.type === 'paid' ? 'paid' : 'free';
    }
    item.isDuplicate = hasDuplicate(item);
    if (item.isDuplicate) item.applicantCountAdjusted = false;
    var rows = await api.insertRows('lecture_applications', [toRow(item)]);
    var saved = rows.length ? fromRow(rows[0]) : item;
    saved.isDuplicate = item.isDuplicate || saved.isDuplicate;
    var adjusted = !saved.isDuplicate && saved.applicantCountAdjusted
      ? await adjustCourseApplicantCount(saved, 1)
      : false;
    if (saved.applicantCountAdjusted !== adjusted) {
      saved.applicantCountAdjusted = adjusted;
      await patchAdjustedFlag(saved.id, adjusted);
    }
    cache = annotateDuplicates([saved].concat(cache));
    loaded = true;
    lastError = null;
    notify();
    return clone(saved);
  }

  function addApplication(application) {
    var next = addQueue.then(function () { return addApplicationInternal(application); });
    addQueue = next.catch(function () {});
    return next;
  }

  async function deleteApplication(id) {
    if (!id) return getApplications();
    await api.deleteRows('lecture_applications', { id: id });
    cache = cache.filter(function (item) {
      return item.id !== id;
    });
    loaded = true;
    lastError = null;
    notify();
    return getApplications();
  }

  async function excludeApplication(id) {
    var applications = getApplications();
    var target = applications.find(function (item) {
      return item.id === id;
    });
    if (target && target.applicantCountAdjusted && !target.isDuplicate) {
      var adjusted = await adjustCourseApplicantCount(target, -1);
      if (!adjusted) {
        throw new Error('신청자 수를 되돌리지 못했습니다.');
      }
    }
    await api.deleteRows('lecture_applications', { id: id });
    cache = cache.filter(function (item) {
      return item.id !== id;
    });
    loaded = true;
    lastError = null;
    notify();
    return getApplications();
  }

  async function clearApplications() {
    await api.deleteAllRows('lecture_applications');
    cache = [];
    loaded = true;
    lastError = null;
    notify();
    return getApplications();
  }

  function subscribe(listener) {
    return utils.subscribeListener(listeners, listener);
  }

  global.ApplicationStore = {
    ready: ready,
    refresh: refresh,
    subscribe: subscribe,
    hasLoaded: function () { return loaded; },
    hasError: function () { return !!lastError; },
    getErrorMessage: function () { return lastError ? lastError.message : ''; },
    getApplications: getApplications,
    addApplication: addApplication,
    deleteApplication: deleteApplication,
    excludeApplication: excludeApplication,
    clearApplications: clearApplications,
    formatSubmittedAt: formatSubmittedAt,
    escapeHtml: escapeHtml
  };

  ready().catch(function () {});
})(window);
