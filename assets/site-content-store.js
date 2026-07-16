(function (global) {
  'use strict';

  var api = global.AiLeadersSupabase;
  var utils = global.AiLeadersUtils || api || {};
  var clone = utils.clone;
  var text = utils.text;
  var toNumber = utils.toNumber;
  var toBoolean = utils.toBoolean;
  var normalizeAssetUrl = utils.normalizeAssetUrl || function (value) { return text(value); };
  var CONTENT_ASSETS_BUCKET = api && api.storageBucket ? api.storageBucket : 'instructor-portfolio';
  var OPTION_GROUPS = {
    corporate_region: '출강 문의 지역',
    corporate_preferred_instructor: '출강 문의 선호 강사',
    corporate_level: '출강 문의 수강생 수준',
    instructor_region: '강사 지원 활동 가능 지역',
    instructor_career: '강사 지원 강의 경력',
    instructor_mode: '강사 지원 강의 형태',
    instructor_field: '강사 지원 전문 분야'
  };

  var cache = {
    banners: [],
    instructors: [],
    options: []
  };
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
    return utils.parseList(value, { json: true, separator: 'line' });
  }

  function normalizeBanner(banner) {
    var item = Object.assign({}, banner || {});
    item.id = text(item.id);
    item.placement = text(item.placement) || 'home_hero';
    item.title = text(item.title);
    item.subtitle = text(item.subtitle);
    item.eyebrow = text(item.eyebrow);
    item.desktopImage = normalizeAssetUrl(item.desktopImage, 'images');
    item.mobileImage = normalizeAssetUrl(item.mobileImage, 'images');
    item.videoUrl = text(item.videoUrl);
    item.primaryLabel = text(item.primaryLabel);
    item.primaryUrl = text(item.primaryUrl);
    item.secondaryLabel = text(item.secondaryLabel);
    item.secondaryUrl = text(item.secondaryUrl);
    item.sortOrder = toNumber(item.sortOrder, 0);
    item.isActive = toBoolean(item.isActive, true);
    return item;
  }

  function normalizeInstructor(instructor) {
    var item = Object.assign({}, instructor || {});
    item.id = text(item.id);
    item.slug = text(item.slug) || item.id;
    item.name = text(item.name);
    item.role = text(item.role);
    item.label = text(item.label);
    item.photo = normalizeAssetUrl(item.photo, 'images');
    item.landingSummary = text(item.landingSummary);
    item.aboutSummary = text(item.aboutSummary);
    item.careerItems = parseArray(item.careerItems);
    item.sortOrder = toNumber(item.sortOrder, 0);
    item.isActive = toBoolean(item.isActive, true);
    return item;
  }

  function normalizeOption(option) {
    var item = Object.assign({}, option || {});
    item.id = text(item.id);
    item.optionGroup = text(item.optionGroup);
    item.label = text(item.label);
    item.value = text(item.value) || item.label;
    item.sortOrder = toNumber(item.sortOrder, 0);
    item.isActive = toBoolean(item.isActive, true);
    return item;
  }

  function bannerFromRow(row) {
    return normalizeBanner({
      id: row.id,
      placement: row.placement,
      title: row.title,
      subtitle: row.subtitle,
      eyebrow: row.eyebrow,
      desktopImage: row.desktop_image,
      mobileImage: row.mobile_image,
      videoUrl: row.video_url,
      primaryLabel: row.primary_label,
      primaryUrl: row.primary_url,
      secondaryLabel: row.secondary_label,
      secondaryUrl: row.secondary_url,
      sortOrder: row.sort_order,
      isActive: row.is_active
    });
  }

  function bannerToRow(banner) {
    var item = normalizeBanner(banner);
    return {
      id: item.id,
      placement: item.placement,
      title: item.title || null,
      subtitle: item.subtitle || null,
      eyebrow: item.eyebrow || null,
      desktop_image: item.desktopImage || null,
      mobile_image: item.mobileImage || null,
      video_url: item.videoUrl || null,
      primary_label: item.primaryLabel || null,
      primary_url: item.primaryUrl || null,
      secondary_label: item.secondaryLabel || null,
      secondary_url: item.secondaryUrl || null,
      sort_order: item.sortOrder,
      is_active: item.isActive
    };
  }

  function instructorFromRow(row) {
    return normalizeInstructor({
      id: row.id,
      slug: row.slug,
      name: row.name,
      role: row.role,
      label: row.label,
      photo: row.photo,
      landingSummary: row.landing_summary,
      aboutSummary: row.about_summary,
      careerItems: row.career_items,
      sortOrder: row.sort_order,
      isActive: row.is_active
    });
  }

  function instructorToRow(instructor) {
    var item = normalizeInstructor(instructor);
    return {
      id: item.id,
      slug: item.slug || item.id,
      name: item.name,
      role: item.role || null,
      label: item.label || null,
      photo: item.photo || null,
      landing_summary: item.landingSummary || null,
      about_summary: item.aboutSummary || null,
      career_items: item.careerItems,
      sort_order: item.sortOrder,
      is_active: item.isActive
    };
  }

  function optionFromRow(row) {
    return normalizeOption({
      id: row.id,
      optionGroup: row.option_group,
      label: row.label,
      value: row.value,
      sortOrder: row.sort_order,
      isActive: row.is_active
    });
  }

  function optionToRow(option) {
    var item = normalizeOption(option);
    return {
      id: item.id,
      option_group: item.optionGroup,
      label: item.label,
      value: item.value,
      sort_order: item.sortOrder,
      is_active: item.isActive
    };
  }

  function sortByOrder(a, b) {
    var order = toNumber(a.sortOrder, 0) - toNumber(b.sortOrder, 0);
    if (order !== 0) return order;
    return String(a.label || a.name || a.title || '').localeCompare(String(b.label || b.name || b.title || ''), 'ko');
  }

  function setCache(next) {
    cache.banners = (next.banners || []).map(normalizeBanner).sort(sortByOrder);
    cache.instructors = (next.instructors || []).map(normalizeInstructor).sort(sortByOrder);
    cache.options = (next.options || []).map(normalizeOption).sort(sortByOrder);
    loaded = true;
    lastError = null;
    notify();
    return getState();
  }

  async function loadContent() {
    if (!api || !api.hasConfig()) {
      throw new Error(api ? api.defaultErrorMessage : '데이터를 불러올 수 없습니다.');
    }
    var rows = await Promise.all([
      api.selectRows('site_banners', { select: '*' }),
      api.selectRows('instructors', { select: '*' }),
      api.selectRows('form_options', { select: '*' })
    ]);
    return setCache({
      banners: rows[0].map(bannerFromRow),
      instructors: rows[1].map(instructorFromRow),
      options: rows[2].map(optionFromRow)
    });
  }

  function ready(force) {
    if (force) readyPromise = null;
    if (!readyPromise) {
      readyPromise = loadContent().catch(function (error) {
        loaded = false;
        setError(error);
        notify();
        throw lastError;
      });
    }
    return readyPromise;
  }

  function refresh() {
    readyPromise = null;
    return ready(true);
  }

  function getState() {
    return clone(cache);
  }

  function getBanners(placement) {
    return cache.banners.filter(function (item) {
      return item.isActive && (!placement || item.placement === placement);
    }).map(clone);
  }

  function getInstructors(includeInactive) {
    return cache.instructors.filter(function (item) {
      return includeInactive || item.isActive;
    }).map(clone);
  }

  function getOptions(group, includeInactive) {
    return cache.options.filter(function (item) {
      return item.optionGroup === group && (includeInactive || item.isActive);
    }).map(clone);
  }

  async function saveBanner(banner) {
    var item = normalizeBanner(banner);
    if (!item.id) item.id = api.createId('banner');
    await api.upsertRows('site_banners', [bannerToRow(item)], 'id');
    return refresh();
  }

  async function deleteBanner(id) {
    if (!id) return getState();
    await api.deleteRows('site_banners', { id: id });
    return refresh();
  }

  async function saveInstructor(instructor) {
    var item = normalizeInstructor(instructor);
    if (!item.id) item.id = api.createId('instructor');
    if (!item.slug) item.slug = item.id;
    await api.upsertRows('instructors', [instructorToRow(item)], 'id');
    return refresh();
  }

  async function deleteInstructor(id) {
    if (!id) return getState();
    await api.deleteRows('instructors', { id: id });
    return refresh();
  }

  async function saveOption(option) {
    var item = normalizeOption(option);
    if (!item.id) item.id = api.createId('option');
    await api.upsertRows('form_options', [optionToRow(item)], 'id');
    return refresh();
  }

  function orderedRows(items, ids, toRow) {
    var seen = {};
    return (ids || []).map(function (id, index) {
      var key = text(id);
      if (!key || seen[key]) return null;
      seen[key] = true;
      var current = items.find(function (item) { return item.id === key; });
      if (!current) return null;
      var next = Object.assign({}, current, { sortOrder: index + 1 });
      return toRow(next);
    }).filter(Boolean);
  }

  async function saveBannerOrder(ids) {
    var rows = orderedRows(cache.banners, ids, bannerToRow);
    if (!rows.length) return getState();
    await api.upsertRows('site_banners', rows, 'id');
    return refresh();
  }

  async function saveInstructorOrder(ids) {
    var rows = orderedRows(cache.instructors, ids, instructorToRow);
    if (!rows.length) return getState();
    await api.upsertRows('instructors', rows, 'id');
    return refresh();
  }

  async function saveOptionOrder(ids) {
    var rows = orderedRows(cache.options, ids, optionToRow);
    if (!rows.length) return getState();
    await api.upsertRows('form_options', rows, 'id');
    return refresh();
  }

  async function deleteOption(id) {
    if (!id) return getState();
    await api.deleteRows('form_options', { id: id });
    return refresh();
  }

  async function uploadAsset(file, prefix) {
    if (!api || !file) throw new Error('업로드할 파일이 없습니다.');
    var path = api.createStoragePath(prefix || 'site-assets', file.name);
    return api.uploadFile(path, file, CONTENT_ASSETS_BUCKET);
  }

  function subscribe(listener) {
    return utils.subscribeListener(listeners, listener);
  }

  global.SiteContentStore = {
    optionGroups: clone(OPTION_GROUPS),
    contentAssetsBucket: CONTENT_ASSETS_BUCKET,
    ready: ready,
    refresh: refresh,
    subscribe: subscribe,
    hasLoaded: function () { return loaded; },
    hasError: function () { return !!lastError; },
    getErrorMessage: function () { return lastError ? lastError.message : ''; },
    getState: getState,
    getBanners: getBanners,
    getInstructors: getInstructors,
    getOptions: getOptions,
    saveBanner: saveBanner,
    saveBannerOrder: saveBannerOrder,
    deleteBanner: deleteBanner,
    saveInstructor: saveInstructor,
    saveInstructorOrder: saveInstructorOrder,
    deleteInstructor: deleteInstructor,
    saveOption: saveOption,
    saveOptionOrder: saveOptionOrder,
    deleteOption: deleteOption,
    uploadAsset: uploadAsset
  };

  ready().catch(function () {});
})(window);
