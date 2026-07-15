(function (global) {
  'use strict';

  function store() {
    return global.CourseStore;
  }

  function toDate(value) {
    if (!value) return null;
    var match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function shortDate(value) {
    var date = toDate(value);
    if (!date) return '-';
    return (date.getMonth() + 1) + '\uC6D4 ' + date.getDate() + '\uC77C';
  }

  function scheduleText(course) {
    var date = shortDate(course.eventDate);
    var time = String(course.eventTime || '').trim();
    if (date === '-') return time || '-';
    return time ? date + ' · ' + time : date;
  }

  function priceLabel(course) {
    if (course.type !== 'paid') return '\uBB34\uB8CC \uAC15\uC5F0';
    var price = Number(course.price || 0);
    return price ? price.toLocaleString('ko-KR') + '\uC6D0' : '\uC720\uB8CC \uAC15\uC5F0';
  }

  function instructorMarkup(course) {
    var name = String(course.instructor || '').trim();
    if (!name) return '';
    var label = /\uAC15\uC0AC$/.test(name) ? name : name + ' \uAC15\uC0AC';
    return '<p class="cc-instructor">' + store().escapeHtml(label) + '</p>';
  }

  function badgesMarkup(course) {
    var s = store();
    var badges = Array.isArray(course.badges) ? course.badges : [];
    var items = badges.map(function (badge) {
      return String(badge || '').trim();
    }).filter(Boolean);
    if (!items.length) return '';
    return '<div class="tags">' + items.map(function (badge) {
      return '<span>' + s.escapeHtml(badge) + '</span>';
    }).join('') + '</div>';
  }

  function cardMarkup(course) {
    var s = store();
    var thumb = course.thumbImg || '/images/logo-ink.png';
    var fallbackCode = global.AiLeadersUtils && global.AiLeadersUtils.stablePublicCode
      ? global.AiLeadersUtils.stablePublicCode(course.id)
      : course.id;
    var href = typeof s.courseDetailUrl === 'function'
      ? s.courseDetailUrl(course)
      : '/course/?c=' + encodeURIComponent(fallbackCode);
    return ''
      + '<a class="course-card" href="' + s.escapeHtml(href) + '">'
      + '<div class="course-thumb">'
      + '<img alt="' + s.escapeHtml(course.title || '\uAC15\uC5F0 \uC774\uBBF8\uC9C0') + '" src="' + s.escapeHtml(thumb) + '"/>'
      + '</div>'
      + '<div class="course-body">'
      + '<h3>' + s.escapeHtml(course.title || '\uAC15\uC5F0\uBA85 \uBBF8\uC815') + '</h3>'
      + instructorMarkup(course)
      + '<p class="price">' + priceLabel(course) + '</p>'
      + badgesMarkup(course)
      + '</div>'
      + '</a>';
  }

  function emptyMarkup() {
    return ''
      + '<a class="course-card" href="/course-free/">'
      + '<div class="course-thumb"><img alt="\uAC15\uC5F0 \uC900\uBE44 \uC911" src="/images/logo-ink.png"/></div>'
      + '<div class="course-body">'
      + '<h3>\uC2E0\uCCAD \uAC00\uB2A5\uD55C \uB300\uD45C \uAC15\uC5F0\uC744 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4</h3>'
      + '<p class="price">\uAC15\uC5F0 \uC900\uBE44 \uC911</p>'
      + '<div class="tags"><span>\uC804\uCCB4 \uBCF4\uAE30</span></div>'
      + '</div>'
      + '</a>';
  }

  function unavailableMarkup() {
    return ''
      + '<div class="course-card" style="display:flex;align-items:center;justify-content:center;padding:48px 24px;text-align:center;">'
      + '<div class="course-body">'
      + '<h3>데이터를 불러올 수 없습니다.</h3>'
      + '</div>'
      + '</div>';
  }

  var subscribed = false;

  function render(options) {
    var s = store();
    if (!s) return;
    var opts = options || {};
    var track = document.getElementById(opts.trackId || 'featuredCourseTrack');
    if (!track) return;
    if (!subscribed && typeof s.subscribe === 'function') {
      s.subscribe(function () {
        render(opts);
      });
      subscribed = true;
    }
    if (typeof s.ready === 'function') {
      s.ready().catch(function () {
        render(opts);
      });
    }
    if (s.hasError && s.hasError()) {
      track.innerHTML = unavailableMarkup();
      return;
    }
    if (s.hasLoaded && !s.hasLoaded()) {
      track.innerHTML = '';
      return;
    }
    var courses = s.getFeaturedCourses(s.getCourses(), opts.limit || 8);
    track.innerHTML = courses.length ? courses.map(cardMarkup).join('') : emptyMarkup();
    if (typeof global.initFeaturedCourseCarousel === 'function') {
      global.initFeaturedCourseCarousel();
    }
  }

  global.CourseHomeFeaturedRenderer = { render: render };
})(window);
