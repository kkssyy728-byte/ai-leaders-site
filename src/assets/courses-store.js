(function (global) {
  'use strict';

  var api = global.AiLeadersSupabase;
  var utils = global.AiLeadersUtils || api || {};
  var clone = utils.clone;
  var toNumber = utils.toNumber;
  var escapeHtml = utils.escapeHtml;
  var normalizeAssetUrl = utils.normalizeAssetUrl || function (value) { return String(value || '').trim(); };
  var normalizePublicCode = utils.normalizePublicCode || function (value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  };
  var stablePublicCode = utils.stablePublicCode || function (seed) {
    return 'c' + Math.abs(String(seed || Date.now()).split('').reduce(function (sum, ch) {
      return ((sum << 5) - sum) + ch.charCodeAt(0);
    }, 0)).toString(36).slice(0, 6);
  };
  var MIN_VISIBLE_REMAINING_SEATS = 3;
  var REGION_OPTIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
  var REGION_MAP = {
    '강남': '서울',
    '서초': '서울',
    '종로': '서울',
    '송파': '서울',
    '마포': '서울',
    '영등포': '서울',
    '용산': '서울',
    '서울': '서울',
    '부산': '부산',
    '대구': '대구',
    '인천': '인천',
    '광주': '광주',
    '대전': '대전',
    '울산': '울산',
    '세종': '세종',
    '경기': '경기',
    '강원': '강원',
    '충북': '충북',
    '충남': '충남',
    '전북': '전북',
    '전남': '전남',
    '경북': '경북',
    '경남': '경남',
    '제주': '제주'
  };

  var PAYMENT_ACCOUNT_PRESETS = {
    lee: {
      label: '이이슬 강사 계좌',
      bank: '국민은행',
      account: '503202-01-218260',
      holder: '이이슬'
    },
    moon: {
      label: '문건우 강사 계좌',
      bank: '농축협',
      account: '356-1345-1984-93',
      holder: '문건우'
    }
  };

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

  function parseArray(value) {
    return utils.parseList(value, { separator: ',' });
  }

  function inferRegion(course) {
    var explicit = String(course && course.region || '').trim();
    if (REGION_OPTIONS.indexOf(explicit) !== -1) return explicit;
    var raw = String((course && (course.location || course.address)) || '').trim();
    if (!raw) return '';
    if (REGION_OPTIONS.indexOf(raw) !== -1) return raw;
    for (var key in REGION_MAP) {
      if (Object.prototype.hasOwnProperty.call(REGION_MAP, key) && raw.indexOf(key) !== -1) {
        return REGION_MAP[key];
      }
    }
    return '';
  }

  function normalizeCourse(course) {
    var normalized = Object.assign({}, course || {});
    var sourceNotice = normalized.applicationNotice && typeof normalized.applicationNotice === 'object'
      ? Object.assign({}, normalized.applicationNotice)
      : {};
    normalized.id = String(normalized.id || '').trim();
    normalized.type = normalized.type === 'paid' ? 'paid' : 'free';
    normalized.status = normalized.status || 'open';
    normalized.title = String(normalized.title || '').trim();
    normalized.category = String(normalized.category || '').trim();
    normalized.region = inferRegion(normalized);
    normalized.location = String(normalized.location || '').trim();
    normalized.address = String(normalized.address || '').trim();
    normalized.eventDate = normalized.eventDate || '';
    normalized.eventTime = String(normalized.eventTime || '').trim();
    normalized.applyStartAt = normalized.applyStartAt || '';
    normalized.applyEndAt = normalized.applyEndAt || '';
    normalized.instructor = String(normalized.instructor || '').trim();
    normalized.thumbImg = normalizeAssetUrl(normalized.thumbImg, 'images');
    normalized.detailImg = normalizeAssetUrl(normalized.detailImg, 'images');
    normalized.applicantCount = Math.max(0, toNumber(normalized.applicantCount, 0));
    normalized.price = Math.max(0, toNumber(normalized.price, 0));
    normalized.priceOrig = Math.max(0, toNumber(normalized.priceOrig, 0));
    var rawMealBreakMinutes = normalized.mealBreakMinutes;
    if (rawMealBreakMinutes == null || rawMealBreakMinutes === '') {
      rawMealBreakMinutes = sourceNotice.mealBreakMinutes != null
        ? sourceNotice.mealBreakMinutes
        : sourceNotice.meal_break_minutes;
    }
    normalized.mealBreakMinutes = Math.max(0, Math.min(480, Math.round(toNumber(rawMealBreakMinutes, 0))));
    normalized.paymentAccountPreset = normalized.type === 'paid' ? String(normalized.paymentAccountPreset || '').trim() : '';
    normalized.paymentBank = normalized.type === 'paid' ? String(normalized.paymentBank || '').trim() : '';
    normalized.paymentAccount = normalized.type === 'paid' ? String(normalized.paymentAccount || '').trim() : '';
    normalized.paymentHolder = normalized.type === 'paid' ? String(normalized.paymentHolder || '').trim() : '';
    normalized.badges = parseArray(normalized.badges).map(function (badge) {
      return String(badge || '').trim();
    }).filter(Boolean);
    normalized.summary = String(normalized.summary || '').trim();
    normalized.applicationNotice = sourceNotice;
    var rawFeaturedOrder = normalized.featuredOrder;
    if (rawFeaturedOrder == null || rawFeaturedOrder === '') {
      rawFeaturedOrder = sourceNotice.featuredOrder != null
        ? sourceNotice.featuredOrder
        : sourceNotice.featured_order;
    }
    var featuredOrder = Number(rawFeaturedOrder);
    normalized.featuredOrder = Number.isFinite(featuredOrder) && featuredOrder > 0
      ? Math.round(featuredOrder)
      : null;
    normalized.publicCode = normalizePublicCode(
      normalized.publicCode
      || normalized.public_code
      || sourceNotice.publicCode
      || sourceNotice.public_code
      || stablePublicCode(normalized.id || normalized.title || Date.now())
    );
    normalized.applicationNotice.publicCode = normalized.publicCode;
    normalized.applicationNotice.featuredOrder = normalized.featuredOrder;
    normalized.applicationNotice.mealBreakMinutes = normalized.mealBreakMinutes;
    return normalized;
  }

  function fromRow(row) {
    return normalizeCourse({
      id: row.id,
      type: row.type,
      status: row.status,
      title: row.title,
      category: row.category,
      region: row.region,
      location: row.location,
      address: row.address,
      eventDate: row.event_date,
      eventTime: row.event_time,
      applyStartAt: row.apply_start_at,
      applyEndAt: row.apply_end_at,
      instructor: row.instructor,
      thumbImg: row.thumb_img,
      detailImg: row.detail_img,
      applicantCount: row.applicant_count,
      price: row.price,
      priceOrig: row.price_orig,
      paymentAccountPreset: row.payment_account_preset,
      paymentBank: row.payment_bank,
      paymentAccount: row.payment_account,
      paymentHolder: row.payment_holder,
      badges: row.badges,
      summary: row.summary,
      applicationNotice: row.application_notice
    });
  }

  function toRow(course) {
    var normalized = normalizeCourse(course);
    var applicationNotice = Object.assign({}, normalized.applicationNotice || {}, {
      publicCode: normalized.publicCode,
      featuredOrder: normalized.featuredOrder
    });
    return {
      id: normalized.id,
      type: normalized.type,
      status: normalized.status,
      title: normalized.title,
      category: normalized.category,
      region: normalized.region,
      location: normalized.location,
      address: normalized.address,
      event_date: normalized.eventDate || null,
      event_time: normalized.eventTime || null,
      apply_start_at: normalized.applyStartAt || null,
      apply_end_at: normalized.applyEndAt || null,
      instructor: normalized.instructor || null,
      thumb_img: normalized.thumbImg || null,
      detail_img: normalized.detailImg || null,
      applicant_count: Math.max(0, toNumber(normalized.applicantCount, 0)),
      price: Math.max(0, toNumber(normalized.price, 0)),
      price_orig: Math.max(0, toNumber(normalized.priceOrig, 0)),
      payment_account_preset: normalized.paymentAccountPreset || null,
      payment_bank: normalized.paymentBank || null,
      payment_account: normalized.paymentAccount || null,
      payment_holder: normalized.paymentHolder || null,
      badges: normalized.badges,
      summary: normalized.summary || null,
      application_notice: applicationNotice
    };
  }

  function cacheFromCourses(courses) {
    var used = {};
    cache = (courses || []).map(function (course, index) {
      var item = normalizeCourse(course);
      item.publicCode = uniquePublicCode(item.publicCode || stablePublicCode(item.id || item.title || index), used);
      item.applicationNotice = Object.assign({}, item.applicationNotice || {}, { publicCode: item.publicCode });
      used[item.publicCode] = true;
      return item;
    });
    loaded = true;
    lastError = null;
    notify();
    return getCourses();
  }

  function uniquePublicCode(code, used) {
    var base = normalizePublicCode(code) || stablePublicCode(Date.now() + Math.random());
    var candidate = base;
    var index = 2;
    while (used[candidate]) {
      candidate = normalizePublicCode(base + '-' + index);
      index += 1;
    }
    return candidate;
  }

  function parseDate(value, endOfDay) {
    if (!value) return null;
    var match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      var fallback = new Date(value);
      return Number.isNaN(fallback.getTime()) ? null : fallback;
    }
    var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (endOfDay) date.setHours(23, 59, 59, 999);
    return date;
  }

  function applicationDeadline(course) {
    var date = parseDate(course && course.eventDate, false);
    if (!date) return null;

    var times = String(course && (course.eventTime || course.time) || '').match(/\d{1,2}:\d{2}/g);
    if (!times || !times.length) {
      date.setHours(23, 59, 59, 999);
      return date;
    }

    var endTime = times[times.length - 1].split(':');
    date.setHours(Number(endTime[0]), Number(endTime[1]), 0, 0);
    return date;
  }

  function remainingSeats() {
    return 0;
  }

  function isOpenForApply(course, now) {
    var current = now || new Date();
    var end = applicationDeadline(course);
    if (course.status !== 'open') return false;
    if (end && current > end) return false;
    return true;
  }

  function compareFeatured(a, b) {
    var applicants = toNumber(b.applicantCount, 0) - toNumber(a.applicantCount, 0);
    if (applicants !== 0) return applicants;

    var aEvent = applicationDeadline(a);
    var bEvent = applicationDeadline(b);
    if (aEvent && bEvent && aEvent.getTime() !== bEvent.getTime()) return aEvent - bEvent;

    return String(a.title || '').localeCompare(String(b.title || ''), 'ko');
  }

  function getFeaturedCourses(courses, limit, now) {
    var available = (courses || []).filter(function (course) {
      return isOpenForApply(course, now);
    });
    var manual = available.filter(function (course) {
      return Number(course.featuredOrder) > 0;
    }).sort(function (a, b) {
      var order = Number(a.featuredOrder) - Number(b.featuredOrder);
      return order || compareFeatured(a, b);
    });
    var manualIds = {};
    manual.forEach(function (course) { manualIds[course.id] = true; });
    var automatic = available.filter(function (course) {
      return !manualIds[course.id];
    }).sort(compareFeatured);
    return manual.concat(automatic).slice(0, limit || 8);
  }

  function hasPaymentAccount(course) {
    return !!(course && course.type === 'paid'
      && String(course.paymentBank || '').trim()
      && String(course.paymentAccount || '').trim()
      && String(course.paymentHolder || '').trim());
  }

  function paymentAccountLabel(course) {
    if (!hasPaymentAccount(course)) return '';
    return [course.paymentBank, course.paymentAccount, course.paymentHolder].join(' ');
  }

  function validatePaidPaymentAccount(course) {
    if (!course || course.type !== 'paid') return;
    if (!hasPaymentAccount(course)) {
      throw new Error('유료 강연은 결제 계좌의 은행명, 계좌번호, 예금주를 모두 입력해야 저장할 수 있습니다.');
    }
  }

  async function loadCourses() {
    if (!api || !api.hasConfig()) {
      throw new Error(api ? api.defaultErrorMessage : '데이터를 불러올 수 없습니다.');
    }
    var rows = await api.selectRows('courses', { select: '*' });
    return cacheFromCourses(rows.map(fromRow));
  }

  function ready(force) {
    if (force) readyPromise = null;
    if (!readyPromise) {
      readyPromise = loadCourses().catch(function (error) {
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

  function getCourses() {
    return clone(cache);
  }

  async function saveCourses(courses) {
    var rows = await api.upsertRows('courses', (courses || []).map(toRow), 'id');
    return cacheFromCourses(rows.map(fromRow));
  }

  async function saveFeaturedOrder(courseIds) {
    var ids = (courseIds || []).map(function (id) { return String(id || '').trim(); }).filter(Boolean);
    var orderById = {};
    ids.forEach(function (id, index) { orderById[id] = index + 1; });
    var updates = cache.filter(function (course) {
      var nextOrder = orderById[course.id] || null;
      return (course.featuredOrder || null) !== nextOrder;
    }).map(function (course) {
      var nextOrder = orderById[course.id] || null;
      var applicationNotice = Object.assign({}, course.applicationNotice || {}, {
        publicCode: course.publicCode,
        featuredOrder: nextOrder
      });
      return api.updateRows('courses', { id: course.id }, { application_notice: applicationNotice });
    });
    if (!updates.length) return getCourses();
    await Promise.all(updates);
    return refresh();
  }

  async function upsertCourse(_, course) {
    var normalized = normalizeCourse(course);
    validatePaidPaymentAccount(normalized);
    await api.upsertRows('courses', [toRow(normalized)], 'id');
    return refresh();
  }

  async function deleteCourse(_, id) {
    if (!id) return getCourses();
    await api.deleteRows('courses', { id: id });
    cache = cache.filter(function (item) { return item.id !== id; });
    loaded = true;
    lastError = null;
    notify();
    return getCourses();
  }

  async function resetCourses() {
    await api.deleteAllRows('courses');
    cache = [];
    loaded = true;
    lastError = null;
    notify();
    return getCourses();
  }

  function createCourseId(type) {
    return (type === 'paid' ? 'paid' : 'free') + '-' + Date.now().toString(36);
  }

  function createPublicCode(seed, existingCodes) {
    var used = {};
    (existingCodes || []).forEach(function (code) {
      var normalized = normalizePublicCode(code);
      if (normalized) used[normalized] = true;
    });
    for (var i = 0; i < 8; i += 1) {
      var randomCode = 'c' + Math.random().toString(36).slice(2, 8);
      if (!used[randomCode]) return randomCode;
    }
    return uniquePublicCode(stablePublicCode(seed || Date.now()), used);
  }

  function getCoursePublicCode(course) {
    if (!course) return '';
    return normalizePublicCode(course.publicCode
      || (course.applicationNotice && (course.applicationNotice.publicCode || course.applicationNotice.public_code))
      || stablePublicCode(course.id || course.title || 'course'));
  }

  function findCourseByPublicCode(code, courses) {
    var normalized = normalizePublicCode(code);
    if (!normalized) return null;
    return (courses || cache || []).find(function (course) {
      return getCoursePublicCode(course) === normalized;
    }) || null;
  }

  function courseDetailUrl(course) {
    var code = getCoursePublicCode(course);
    return code ? '/course/?c=' + encodeURIComponent(code) : '/course/';
  }

  function formatMoney(value) {
    var num = toNumber(value, 0);
    return num ? num.toLocaleString('ko-KR') + '원' : '무료';
  }

  function formatDateKo(value) {
    var date = parseDate(value, false);
    if (!date) return '-';
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  }

  function subscribe(listener) {
    return utils.subscribeListener(listeners, listener);
  }

  global.CourseStore = {
    minimumVisibleRemainingSeats: MIN_VISIBLE_REMAINING_SEATS,
    regionOptions: REGION_OPTIONS.slice(),
    paymentAccountPresets: clone(PAYMENT_ACCOUNT_PRESETS),
    defaults: [],
    inferRegion: inferRegion,
    hasPaymentAccount: hasPaymentAccount,
    paymentAccountLabel: paymentAccountLabel,
    ready: ready,
    refresh: refresh,
    subscribe: subscribe,
    hasLoaded: function () { return loaded; },
    hasError: function () { return !!lastError; },
    getErrorMessage: function () { return lastError ? lastError.message : ''; },
    getCourses: getCourses,
    saveCourses: saveCourses,
    resetCourses: resetCourses,
    upsertCourse: upsertCourse,
    deleteCourse: deleteCourse,
    createCourseId: createCourseId,
    createPublicCode: createPublicCode,
    getCoursePublicCode: getCoursePublicCode,
    findCourseByPublicCode: findCourseByPublicCode,
    courseDetailUrl: courseDetailUrl,
    normalizePublicCode: normalizePublicCode,
    stablePublicCode: stablePublicCode,
    getFeaturedCourses: getFeaturedCourses,
    saveFeaturedOrder: saveFeaturedOrder,
    applicationDeadline: applicationDeadline,
    isOpenForApply: isOpenForApply,
    remainingSeats: remainingSeats,
    formatMoney: formatMoney,
    formatDateKo: formatDateKo,
    escapeHtml: escapeHtml
  };

  ready().catch(function () {});
})(window);
