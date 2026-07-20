(function (global) {
  'use strict';

  function store() {
    return global.CourseStore;
  }

  function typeLabel(type) {
    return type === 'paid' ? '유료' : '무료';
  }

  function toDate(value) {
    if (!value) return null;
    var match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function daysUntil(value) {
    var target = toDate(value);
    if (!target) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function deadlineDate(course) {
    var courseStore = store();
    if (courseStore && typeof courseStore.applicationDeadline === 'function') {
      return courseStore.applicationDeadline(course);
    }

    var date = toDate(course.eventDate);
    if (!date) return null;
    var times = String(course.eventTime || '').match(/\d{1,2}:\d{2}/g);
    if (!times || !times.length) {
      date.setHours(23, 59, 59, 999);
      return date;
    }
    var endTime = times[times.length - 1].split(':');
    date.setHours(Number(endTime[0]), Number(endTime[1]), 0, 0);
    return date;
  }

  function isPeriodExpired(course) {
    var deadline = deadlineDate(course);
    if (course.status === 'closed') return true;
    if (!deadline) return false;
    return new Date() > deadline;
  }

  function closedOverlayMarkup(course) {
    if (!isPeriodExpired(course)) return '';
    return '<img class="course-closed-overlay" src="/images/course-closed-overlay.png" alt="" aria-hidden="true"/>';
  }

  function sortByRemainingPeriod(a, b) {
    var aExpired = isPeriodExpired(a);
    var bExpired = isPeriodExpired(b);
    if (aExpired !== bExpired) return aExpired ? 1 : -1;

    var aDeadline = deadlineDate(a);
    var bDeadline = deadlineDate(b);
    if (aDeadline && bDeadline && aDeadline.getTime() !== bDeadline.getTime()) {
      if (aExpired && bExpired) return bDeadline - aDeadline;
      return aDeadline - bDeadline;
    }
    if (aDeadline && !bDeadline) return -1;
    if (!aDeadline && bDeadline) return 1;

    return String(a.title || '').localeCompare(String(b.title || ''), 'ko');
  }

  function statusText(course) {
    var dday = daysUntil(course.eventDate);
    if (course.status === 'closed') return '모집 마감';
    if (course.status === 'draft') return '준비 중';
    if (course.status === 'hidden') return '비공개';
    if (isPeriodExpired(course)) return '진행 완료';
    if (dday == null) return '모집중';
    if (dday === 0) return 'D-DAY';
    return 'D-' + dday;
  }

  function shortDate(value) {
    var date = toDate(value);
    if (!date) return '-';
    return (date.getMonth() + 1) + '월 ' + date.getDate() + '일';
  }

  function scheduleText(course) {
    var date = shortDate(course.eventDate);
    var time = String(course.eventTime || '').trim();
    if (date === '-') return time || '-';
    return time ? date + ' · ' + time : date;
  }

  function freeFilterKey(course) {
    var text = [course.category, course.title].join(' ');
    if (/클로드|Claude/i.test(text)) return 'claude';
    if (/종합|Canva|캔바|AI/i.test(text) && !/제미나이|Gemini/i.test(text)) return 'canva';
    return 'chatgpt';
  }

  function paidFilterKey(course) {
    var text = [course.category, course.title].join(' ');
    if (/마케팅|콘텐츠|광고/i.test(text)) return 'marketing';
    if (/자동화|n8n|노코드/i.test(text)) return 'auto';
    return 'basic';
  }

  function filterKey(course) {
    return course.type === 'paid' ? paidFilterKey(course) : freeFilterKey(course);
  }

  function regionKey(course) {
    var s = store();
    if (s && typeof s.inferRegion === 'function') return s.inferRegion(course);
    var raw = String(course.region || course.location || course.address || '').trim();
    if (!raw) return '';
    var map = {
      '강남': '서울',
      '서초': '서울',
      '종로': '서울',
      '송파': '서울',
      '마포': '서울',
      '영등포': '서울',
      '용산': '서울',
      '서울': '서울',
      '경기': '경기',
      '인천': '인천',
      '부산': '부산',
      '대구': '대구',
      '광주': '광주',
      '대전': '대전',
      '울산': '울산',
      '세종': '세종',
      '강원': '강원',
      '충북': '충북',
      '충남': '충남',
      '전북': '전북',
      '전남': '전남',
      '경북': '경북',
      '경남': '경남',
      '제주': '제주'
    };
    if (map[raw]) return map[raw];
    for (var key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key) && raw.indexOf(key) !== -1) {
        return map[key];
      }
    }
    return raw;
  }

  function priceMarkup(course) {
    if (course.type !== 'paid') return '';
    var price = Number(course.price || 0);
    var orig = Number(course.priceOrig || 0);
    var discount = orig > price && price > 0 ? Math.round((1 - price / orig) * 100) : 0;
    return ''
      + '<div class="c-price" style="margin-bottom:14px;">'
      + (discount ? '<span><span style="color:#ef1f1f;font-weight:700;font-size:12px;">' + discount + '%</span>&nbsp;<span class="orig">' + orig.toLocaleString('ko-KR') + '원</span></span>' : '')
      + '<span class="final" style="font-size:18px;">' + (price ? price.toLocaleString('ko-KR') + '원' : '무료') + '</span>'
      + '</div>';
  }

  function instructorMarkup(course) {
    var name = String(course.instructor || '').trim();
    if (!name) return '';
    var label = /강사$/.test(name) ? name : name + ' 강사';
    return '<p class="cc-instructor">' + store().escapeHtml(label) + '</p>';
  }

  function remainingMarkup(course, remaining) {
    return '';
  }

  function badgesMarkup(course) {
    var s = store();
    var badges = Array.isArray(course.badges) ? course.badges : [];
    var items = badges.map(function (badge) {
      return String(badge || '').trim();
    }).filter(Boolean);
    if (!items.length) return '';
    return '<div class="cc-tags">' + items.map(function (badge) {
      return '<span>' + s.escapeHtml(badge) + '</span>';
    }).join('') + '</div>';
  }

  function lowSeatsBadge(course, remaining) {
    return !isPeriodExpired(course) && remaining > 0 && remaining <= 10
      ? '<span class="cc-deadline-badge">마감 임박</span>'
      : '';
  }

  function cardMarkup(course) {
    var s = store();
    var remaining = s.remainingSeats(course);
    var status = statusText(course);
    var muted = /마감|완료|비공개/.test(status) ? ' style="color:#555;"' : '';
    var thumb = course.thumbImg || '/images/logo-ink.png';
    var fallbackCode = global.AiLeadersUtils && global.AiLeadersUtils.stablePublicCode
      ? global.AiLeadersUtils.stablePublicCode(course.id)
      : course.id;
    var href = typeof s.courseDetailUrl === 'function'
      ? s.courseDetailUrl(course)
      : '/course/?c=' + encodeURIComponent(fallbackCode);
    return ''
      + '<article class="card" data-cat="' + s.escapeHtml(filterKey(course)) + '" data-region="' + s.escapeHtml(regionKey(course)) + '" data-event-date="' + s.escapeHtml(course.eventDate || '') + '">'
      + '<a href="' + s.escapeHtml(href) + '" class="card-link">'
      + '<div class="course-thumb" style="background:#e8f1ff;">'
      + lowSeatsBadge(course, remaining)
      + '<img src="' + s.escapeHtml(thumb) + '" alt="' + s.escapeHtml(course.title || '강연 이미지') + '"/>'
      + closedOverlayMarkup(course)
      + '</div>'
      + '<div class="course-body">'
      + '<h3>' + s.escapeHtml(course.title || '강연명 미정') + '</h3>'
      + instructorMarkup(course)
      + remainingMarkup(course, remaining)
      + '<p class="cc-price"' + muted + '>' + status + '</p>'
      + priceMarkup(course)
      + badgesMarkup(course)
      + '</div>'
      + '</a>'
      + '</article>';
  }

  function loadingMarkup() {
    return '<div id="emptyMsg" style="display:block;grid-column:1/-1;text-align:center;padding:80px 0;color:#8a95a3;font-size:18px;font-weight:600;">데이터를 불러오는 중입니다.</div>';
  }

  function unavailableMarkup() {
    return '<div id="emptyMsg" style="display:block;grid-column:1/-1;text-align:center;padding:80px 0;color:#8a95a3;font-size:18px;font-weight:600;">데이터를 불러올 수 없습니다.</div>';
  }

  var pagedState = null;
  var resizeBound = false;
  var resizeTimer = null;
  var storeSubscribed = false;

  function pageSize() {
    return global.matchMedia && global.matchMedia('(max-width:540px)').matches ? 3 : 6;
  }

  function allCoursesForState() {
    if (!pagedState || !store()) return [];
    return store().getCourses()
      .filter(function (course) { return course.type === pagedState.type && course.status !== 'hidden'; })
      .sort(sortByRemainingPeriod);
  }

  function filteredCourses() {
    var currentFilter = pagedState && pagedState.filter ? pagedState.filter : 'all';
    var currentRegion = pagedState && pagedState.region ? pagedState.region : 'all';
    return allCoursesForState().filter(function (course) {
      var matchesFilter = currentFilter === 'all' || filterKey(course) === currentFilter;
      var matchesRegion = currentRegion === 'all' || regionKey(course) === currentRegion;
      return matchesFilter && matchesRegion;
    });
  }

  function ensurePager(grid) {
    var id = grid.id + 'Pager';
    var pager = document.getElementById(id);
    if (!pager) {
      pager = document.createElement('div');
      pager.id = id;
      pager.className = 'course-pager';
      grid.insertAdjacentElement('afterend', pager);
    }
    return pager;
  }

  function renderPager(grid, totalPages) {
    var pager = ensurePager(grid);
    if (totalPages <= 1) {
      pager.innerHTML = '';
      pager.style.display = 'none';
      return;
    }
    pager.style.display = '';
    pager.innerHTML = ''
      + '<button class="course-page-btn" type="button" data-course-page-prev aria-label="이전 페이지">&lsaquo;</button>'
      + '<span class="course-page-count">' + (pagedState.page + 1) + ' / ' + totalPages + '</span>'
      + '<button class="course-page-btn" type="button" data-course-page-next aria-label="다음 페이지">&rsaquo;</button>';
    var prev = pager.querySelector('[data-course-page-prev]');
    var next = pager.querySelector('[data-course-page-next]');
    prev.disabled = pagedState.page <= 0;
    next.disabled = pagedState.page >= totalPages - 1;
    prev.addEventListener('click', function () {
      if (pagedState.page <= 0) return;
      pagedState.page -= 1;
      renderCurrentPage(true);
    });
    next.addEventListener('click', function () {
      if (pagedState.page >= totalPages - 1) return;
      pagedState.page += 1;
      renderCurrentPage(true);
    });
  }

  function updateFilterButtons() {
    if (!pagedState) return;
    Array.prototype.forEach.call(document.querySelectorAll('.filter-btn'), function (button) {
      var onclick = button.getAttribute('onclick') || '';
      var active = onclick.indexOf("'" + pagedState.filter + "'") !== -1
        || onclick.indexOf('"' + pagedState.filter + '"') !== -1;
      button.classList.toggle('active', active);
    });
  }

  function updateRegionFilter() {
    if (!pagedState) return;
    var region = pagedState.region || 'all';
    var label = document.getElementById('regionDdLabel');
    if (label) label.textContent = region === 'all' ? '지역' : region;
    Array.prototype.forEach.call(document.querySelectorAll('.dd-opt'), function (button) {
      button.classList.toggle('active', button.getAttribute('data-region') === region);
    });
  }

  function scrollToFirstCard(grid) {
    var firstCard = grid.querySelector('article');
    var target = firstCard || grid;
    if (!target || !global.scrollTo) return;
    var nav = document.querySelector('.nav');
    var navHeight = nav ? nav.getBoundingClientRect().height : 0;
    var offset = Math.max(navHeight + 18, 86);
    var top = target.getBoundingClientRect().top + global.pageYOffset - offset;
    global.scrollTo({
      top: Math.max(0, top),
      behavior: 'auto'
    });
  }

  function scheduleScrollToFirstCard(grid) {
    if (global.requestAnimationFrame) {
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(function () {
          scrollToFirstCard(grid);
        });
      });
    } else {
      global.setTimeout(function () {
        scrollToFirstCard(grid);
      }, 0);
    }
    global.setTimeout(function () {
      scrollToFirstCard(grid);
    }, 120);
  }

  function renderCurrentPage(shouldScroll) {
    if (!store() || !pagedState) return;
    var grid = document.getElementById(pagedState.gridId);
    if (!grid) return;
    if (store().hasError && store().hasError()) {
      grid.innerHTML = unavailableMarkup();
      renderPager(grid, 0);
      return;
    }
    if (store().hasLoaded && !store().hasLoaded()) {
      grid.innerHTML = loadingMarkup();
      renderPager(grid, 0);
      return;
    }
    var list = filteredCourses();
    var size = pageSize();
    var totalPages = Math.max(1, Math.ceil(list.length / size));
    pagedState.page = Math.min(Math.max(pagedState.page, 0), totalPages - 1);
    var start = pagedState.page * size;
    var pageItems = list.slice(start, start + size);
    grid.innerHTML = '<div id="emptyMsg" style="display:' + (list.length ? 'none' : 'block') + ';grid-column:1/-1;text-align:center;padding:80px 0;color:#8a95a3;font-size:18px;font-weight:600;">강연 준비 중입니다</div>'
      + pageItems.map(cardMarkup).join('');
    renderPager(grid, list.length ? totalPages : 0);
    updateFilterButtons();
    updateRegionFilter();
    if (shouldScroll) scheduleScrollToFirstCard(grid);
  }

  function bindResize() {
    if (resizeBound) return;
    resizeBound = true;
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        renderCurrentPage();
      }, 120);
    });
  }

  function renderPaged(options) {
    if (!store()) return;
    var grid = document.getElementById(options.gridId || 'courseGrid');
    if (!grid) return;
    if (!storeSubscribed && typeof store().subscribe === 'function') {
      store().subscribe(function () {
        renderCurrentPage();
      });
      storeSubscribed = true;
    }
    pagedState = {
      type: options.type,
      gridId: options.gridId || 'courseGrid',
      filter: 'all',
      region: 'all',
      page: 0
    };
    bindResize();
    renderCurrentPage();
    if (typeof store().ready === 'function') {
      store().ready().catch(function () {
        renderCurrentPage();
      });
    }
  }

  function filterRegionPaged(region, button) {
    if (!pagedState) return;
    pagedState.region = region || 'all';
    pagedState.page = 0;
    if (button) {
      Array.prototype.forEach.call(document.querySelectorAll('.dd-opt'), function (btn) {
        btn.classList.remove('active');
      });
      button.classList.add('active');
    }
    var dd = document.getElementById('regionDd');
    if (dd) dd.classList.remove('open');
    renderCurrentPage();
  }

  function filterPaged(category, button) {
    if (!pagedState) return;
    pagedState.filter = category || 'all';
    pagedState.page = 0;
    if (button) {
      Array.prototype.forEach.call(document.querySelectorAll('.filter-btn'), function (btn) {
        btn.classList.remove('active');
      });
      button.classList.add('active');
    }
    renderCurrentPage();
  }

  function render(options) {
    renderPaged(options);
  }

  global.CoursePageRenderer = { render: renderPaged, filter: filterPaged, filterRegion: filterRegionPaged };
})(window);
