(function (global, document) {
  'use strict';

  var liveStore = global.SiteContentStore;
  var utils = global.AiLeadersUtils || {};
  var escapeHtml = utils.escapeHtml;
  var PREVIEW_PREFIX = 'aiLeadersSiteContentPreview:';
  var previewState = readPreviewState();
  var store = previewState ? createPreviewStore(liveStore, previewState) : liveStore;
  if (!store) return;

  function clone(value) {
    return utils.clone(value == null ? null : value);
  }

  function compareByOrder(a, b) {
    var order = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (order !== 0) return order;
    return String(a.label || a.name || a.title || '').localeCompare(String(b.label || b.name || b.title || ''), 'ko');
  }

  function sortByOrder(items) {
    return (items || []).slice().sort(compareByOrder);
  }

  function fixedInstructorRank(item) {
    var name = String(item && item.name || '').replace(/\s+/g, '');
    var key = String(item && (item.slug || item.id) || '').toLowerCase();
    if (name === '아이온' || name === '아이온강사' || key === 'aion') return 1;
    if (name === '문건우' || name === '문건우강사' || key === 'moon') return 2;
    return 3;
  }

  function sortInstructors(items) {
    return (items || []).slice().sort(function (a, b) {
      var rank = fixedInstructorRank(a) - fixedInstructorRank(b);
      if (rank !== 0) return rank;
      return compareByOrder(a, b);
    });
  }

  function decodePreviewPayload(encoded) {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(encoded))));
    } catch (error) {
      return null;
    }
  }

  function readPreviewState() {
    var params = new URLSearchParams(global.location.search || '');
    var previewId = params.get('sitePreview');
    if (!previewId) return null;

    var payload = null;
    try {
      payload = JSON.parse(global.localStorage.getItem(PREVIEW_PREFIX + previewId) || 'null');
    } catch (error) {}

    if (!payload) {
      var hashParams = new URLSearchParams((global.location.hash || '').replace(/^#/, ''));
      payload = decodePreviewPayload(hashParams.get('sitePreviewData') || '');
    }

    if (!payload || !payload.state) return null;
    if (payload.expiresAt && payload.expiresAt < Date.now()) return null;
    return {
      banners: sortByOrder(payload.state.banners || []),
      instructors: sortInstructors(payload.state.instructors || []),
      options: sortByOrder(payload.state.options || [])
    };
  }

  function createPreviewStore(baseStore, state) {
    function active(items, includeInactive, sorter) {
      return (sorter || sortByOrder)(items).filter(function (item) {
        return includeInactive || item.isActive !== false;
      }).map(clone);
    }

    return {
      optionGroups: baseStore && baseStore.optionGroups ? clone(baseStore.optionGroups) : {},
      ready: function () { return Promise.resolve(clone(state)); },
      getBanners: function (placement) {
        return active(state.banners || []).filter(function (item) {
          return !placement || item.placement === placement;
        });
      },
      getInstructors: function (includeInactive) {
        return active(state.instructors || [], includeInactive, sortInstructors);
      },
      getOptions: function (group, includeInactive) {
        return active(state.options || [], includeInactive).filter(function (item) {
          return item.optionGroup === group;
        });
      }
    };
  }

  function setSelectOptions(select, options, placeholder) {
    if (!select || !options || !options.length) return;
    var current = select.value;
    select.innerHTML = '<option value="">' + escapeHtml(placeholder || '선택') + '</option>'
      + options.map(function (option) {
        return '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</option>';
      }).join('');
    if (current && options.some(function (option) { return option.value === current; })) {
      select.value = current;
    }
  }

  function renderCheckboxOptions(container, options, labelStyle) {
    if (!container || !options || !options.length) return;
    var checked = Array.prototype.map.call(container.querySelectorAll('input[type="checkbox"]:checked'), function (input) {
      return input.value;
    });
    container.innerHTML = options.map(function (option) {
      var isChecked = checked.indexOf(option.value) !== -1 ? ' checked' : '';
      var style = labelStyle ? ' style="' + labelStyle + '"' : '';
      return '<label' + style + '><input type="checkbox" value="' + escapeHtml(option.value) + '"' + isChecked + '/> ' + escapeHtml(option.label) + '</label>';
    }).join('');
  }

  function renderFormOptions() {
    if (document.getElementById('f-preferred-instructor')) {
      setSelectOptions(document.getElementById('f-region'), store.getOptions('corporate_region'), '선택');
      setSelectOptions(document.getElementById('f-preferred-instructor'), store.getOptions('corporate_preferred_instructor'), '선택');
      setSelectOptions(document.getElementById('f-level'), store.getOptions('corporate_level'), '선택');
    }

    if (document.getElementById('f-career')) {
      setSelectOptions(document.getElementById('f-region'), store.getOptions('instructor_region'), '선택');
      setSelectOptions(document.getElementById('f-career'), store.getOptions('instructor_career'), '선택');
      setSelectOptions(document.getElementById('f-mode'), store.getOptions('instructor_mode'), '선택');
      renderCheckboxOptions(document.querySelector('.check-row'), store.getOptions('instructor_field'), '');
    }
  }

  function hexToRgb(hex) {
    var value = String(hex || '').trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function overlayGradient(hex) {
    var rgb = hexToRgb(hex) || { r: 2, g: 22, b: 66 };
    var base = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',';
    return 'linear-gradient(180deg, ' + base + '.34) 0%, ' + base + '.14) 40%, ' + base + '.66) 100%)';
  }

  function imageMarkup(src, alt, className) {
    if (!src) return '';
    return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt || '') + '"' + (className ? ' class="' + escapeHtml(className) + '"' : '') + '>';
  }

  function renderHero() {
    var hero = document.getElementById('hero');
    if (!hero) return;
    var banners = store.getBanners('home_hero');
    if (!banners.length) return;
    var title = hero.querySelector('h1');
    var subtitle = hero.querySelector('.sub');
    var links = hero.querySelectorAll('a.btn, .btn a, .hero-cta a, .hero-actions a');
    var slides = document.getElementById('slides');
    var scrim = hero.querySelector('.hero-scrim');
    var hasManagedMedia = banners.some(function (banner) {
      return banner.desktopImage || banner.mobileImage || banner.videoUrl;
    });
    var shouldRenderManagedSlides = slides && (hasManagedMedia || banners.length > 1);

    function applyBanner(index) {
      var item = banners[index] || banners[0];
      if (scrim) scrim.style.background = overlayGradient(item.overlayColor);
      if (title && item.title) title.textContent = item.title;
      if (subtitle && item.subtitle) subtitle.textContent = item.subtitle;

      if (links[0] && item.primaryLabel) links[0].textContent = item.primaryLabel;
      if (links[0] && item.primaryUrl) links[0].setAttribute('href', item.primaryUrl);
      if (links[1] && item.secondaryLabel) links[1].textContent = item.secondaryLabel;
      if (links[1] && item.secondaryUrl) links[1].setAttribute('href', item.secondaryUrl);

      if (shouldRenderManagedSlides) {
        slides.querySelectorAll('.slide').forEach(function (slide, slideIndex) {
          slide.classList.toggle('active', slideIndex === index);
          slide.querySelectorAll('video').forEach(function (video) {
            if (slideIndex === index) {
              video.play().catch(function () {});
            } else {
              video.pause();
            }
          });
        });
      }

      hero.querySelectorAll('[data-managed-hero-dot]').forEach(function (dot, dotIndex) {
        dot.classList.toggle('on', dotIndex === index);
        dot.setAttribute('aria-current', dotIndex === index ? 'true' : 'false');
      });

      var counter = hero.querySelector('[data-managed-hero-counter]');
      if (counter) {
        counter.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(banners.length).padStart(2, '0');
      }
    }

    if (shouldRenderManagedSlides) {
      slides.innerHTML = banners.map(function (banner, index) {
        var active = index === 0 ? ' active' : '';
        var fallbackClass = ' s' + ((index % 4) + 1);
        if (banner.videoUrl) {
          return '<div class="slide' + fallbackClass + active + '"><video class="hero-bg-img" muted playsinline loop src="' + escapeHtml(banner.videoUrl) + '"></video></div>';
        }
        var desktop = banner.desktopImage || banner.mobileImage;
        var mobile = banner.mobileImage || banner.desktopImage;
        if (!desktop && !mobile) {
          return '<div class="slide' + fallbackClass + active + '"></div>';
        }
        return '<div class="slide' + fallbackClass + active + '"><picture>'
          + (mobile ? '<source media="(max-width: 720px)" srcset="' + escapeHtml(mobile) + '">' : '')
          + imageMarkup(desktop, banner.title || 'AI 강사 히어로 이미지', 'hero-bg-img')
          + '</picture></div>';
      }).join('');
    }

    if (hero.__managedHeroTimer) clearInterval(hero.__managedHeroTimer);
    hero.__managedHeroTimer = null;
    hero.querySelectorAll('[data-managed-hero-control]').forEach(function (node) {
      node.remove();
    });

    var index = 0;
    var paused = false;

    function goTo(next) {
      index = (next + banners.length) % banners.length;
      applyBanner(index);
    }

    function startAuto() {
      if (banners.length <= 1 || paused) return;
      if (hero.__managedHeroTimer) clearInterval(hero.__managedHeroTimer);
      hero.__managedHeroTimer = setInterval(function () {
        goTo(index + 1);
      }, 5500);
    }

    function stopAuto() {
      if (hero.__managedHeroTimer) clearInterval(hero.__managedHeroTimer);
      hero.__managedHeroTimer = null;
    }

    if (banners.length > 1) {
      var arrows = document.createElement('div');
      arrows.className = 'h-arrows';
      arrows.setAttribute('data-managed-hero-control', '');
      arrows.innerHTML = '<button type="button" data-managed-hero-prev aria-label="이전 배너"><svg fill="none" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
        + '<button type="button" data-managed-hero-next aria-label="다음 배너"><svg fill="none" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
      hero.appendChild(arrows);

      var bottom = document.createElement('div');
      bottom.className = 'h-bottom';
      bottom.setAttribute('data-managed-hero-control', '');
      bottom.innerHTML = '<div class="dots" aria-label="히어로 배너 선택">'
        + banners.map(function (_, dotIndex) {
          return '<button type="button" data-managed-hero-dot aria-label="' + (dotIndex + 1) + '번 배너"></button>';
        }).join('')
        + '</div><span class="counter" data-managed-hero-counter></span>'
        + '<button class="pause" type="button" data-managed-hero-pause aria-label="자동 전환 일시정지"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5" width="3" height="14"></rect><rect x="14" y="5" width="3" height="14"></rect></svg></button>';
      hero.appendChild(bottom);

      hero.querySelector('[data-managed-hero-prev]').addEventListener('click', function () {
        goTo(index - 1);
        startAuto();
      });
      hero.querySelector('[data-managed-hero-next]').addEventListener('click', function () {
        goTo(index + 1);
        startAuto();
      });
      hero.querySelectorAll('[data-managed-hero-dot]').forEach(function (dot, dotIndex) {
        dot.addEventListener('click', function () {
          goTo(dotIndex);
          startAuto();
        });
      });
      hero.querySelector('[data-managed-hero-pause]').addEventListener('click', function () {
        paused = !paused;
        this.setAttribute('aria-label', paused ? '자동 전환 다시 시작' : '자동 전환 일시정지');
        this.style.opacity = paused ? '.55' : '1';
        if (paused) stopAuto();
        else startAuto();
      });
      hero.addEventListener('mouseenter', stopAuto);
      hero.addEventListener('mouseleave', startAuto);
      hero.addEventListener('focusin', stopAuto);
      hero.addEventListener('focusout', startAuto);

      // 모바일: 손가락으로 좌우 스와이프하면 배너 전환
      var touchStartX = null;
      var touchStartY = null;
      function isMobileHeroWidth() {
        return window.matchMedia('(max-width:700px)').matches;
      }
      hero.addEventListener('touchstart', function (e) {
        if (!isMobileHeroWidth() || !e.touches || !e.touches.length) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });
      hero.addEventListener('touchend', function (e) {
        if (touchStartX === null) return;
        var touch = (e.changedTouches && e.changedTouches[0]) || null;
        var startX = touchStartX, startY = touchStartY;
        touchStartX = null;
        touchStartY = null;
        if (!touch) return;
        var dx = touch.clientX - startX;
        var dy = touch.clientY - startY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        goTo(index + (dx < 0 ? 1 : -1));
        startAuto();
      }, { passive: true });
    }

    applyBanner(0);
    startAuto();
  }

  function instructorSummary(instructor, mode) {
    var summary = mode === 'about'
      ? (instructor.aboutSummary || instructor.landingSummary || '')
      : (instructor.landingSummary || instructor.aboutSummary || '');
    if (summary) return summary;
    if (instructor.role) {
      return (instructor.name || '강사') + ' 강사는 ' + instructor.role + '로 실무 중심 AI 교육을 진행합니다.';
    }
    return (instructor.name || '강사') + '의 실무 경험을 바탕으로 AI 활용 방법을 안내합니다.';
  }

  var LANDING_INSTRUCTOR_DETAILS = {
    aion: [
      'AI 이미지·영상·숏폼 제작 실습',
      '수강생 결과물 중심의 실무형 커리큘럼',
      '기초부터 실전 활용까지 단계별 코칭',
      '현장에서 바로 쓰는 생성형 AI 활용 교육'
    ],
    moon: [
      '브랜드 마케팅 컴퍼니 탈론 대표 / 브랜드 디렉터',
      'ChatGPT·생성형 AI 기반 브랜드 메시지 및 콘텐츠 기획 교육',
      'AI 활용 SNS·유튜브 콘텐츠 전략 및 마케팅 문안 실습',
      '국내 주요 기업·브랜드 마케팅 컨설팅 및 브랜드 프로젝트 수행'
    ]
  };

  function instructorLandingDetails(instructor) {
    if (Array.isArray(instructor.landingDetails) && instructor.landingDetails.length) {
      return instructor.landingDetails;
    }
    var key = instructor.slug || instructor.id;
    return LANDING_INSTRUCTOR_DETAILS[key] || [];
  }

  function renderLandingInstructors() {
    var root = document.querySelector('[data-ctd-demo]');
    if (!root) return;
    var instructors = store.getInstructors();
    if (!instructors.length) return;
    var idx = 0;
    var timer = null;
    if (typeof global.AiLeadersStopDefaultTutorCarousel === 'function') {
      global.AiLeadersStopDefaultTutorCarousel();
    }
    if (root.parentNode) {
      var cleanRoot = root.cloneNode(false);
      root.parentNode.replaceChild(cleanRoot, root);
      root = cleanRoot;
    }

    function build() {
      var photos = instructors.map(function (item, i) {
        return '<figure class="ctd-photo" data-ctd-photo="' + i + '">' + imageMarkup(item.photo, item.name + ' 강사') + '</figure>';
      }).join('');
      root.innerHTML = '<div class="ctd-image-stage">'
        + '<div class="ctd-image-actions">'
        + '<button class="ctd-arrow" type="button" data-ctd-prev aria-label="이전 강사"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg></button>'
        + '<button class="ctd-arrow" type="button" data-ctd-next aria-label="다음 강사"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg></button>'
        + '</div>' + photos + '</div><div class="ctd-copy" aria-live="polite"></div>';
      root.querySelectorAll('[data-ctd-prev]').forEach(function (button) {
        button.addEventListener('click', function () { goTo(idx - 1); startAuto(); });
      });
      root.querySelectorAll('[data-ctd-next]').forEach(function (button) {
        button.addEventListener('click', function () { goTo(idx + 1); startAuto(); });
      });
      root.addEventListener('mouseenter', stopAuto);
      root.addEventListener('mouseleave', startAuto);
    }

    function goTo(next) {
      idx = (next + instructors.length) % instructors.length;
      var item = instructors[idx];
      root.querySelectorAll('[data-ctd-photo]').forEach(function (photo, i) {
        var offset = (i - idx + instructors.length) % instructors.length;
        var side = offset === 1 ? 'is-next' : (offset === instructors.length - 1 ? 'is-prev' : '');
        photo.className = 'ctd-photo ' + (offset === 0 ? 'is-active' : side);
      });
      var copy = root.querySelector('.ctd-copy');
      if (copy) {
        var detailItems = instructorLandingDetails(item);
        var detailsMarkup = detailItems.length
          ? '<ul class="tc-desc-list">' + detailItems.map(function (s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('') + '</ul>'
          : '';
        copy.innerHTML = '<div class="ctd-copy-inner">'
          + '<p class="ctd-quote">' + escapeHtml(instructorSummary(item, 'landing')) + '</p>'
          + '<p class="ctd-name">' + escapeHtml(item.name + ' 강사') + '</p>'
          + '<p class="ctd-designation">' + escapeHtml(item.role || '') + '</p>'
          + detailsMarkup
          + '<div class="ctd-actions">'
          + '<button class="ctd-arrow" type="button" data-ctd-prev aria-label="이전 강사"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg></button>'
          + '<button class="ctd-arrow" type="button" data-ctd-next aria-label="다음 강사"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg></button>'
          + '</div></div>';
        copy.querySelector('[data-ctd-prev]').addEventListener('click', function () { goTo(idx - 1); startAuto(); });
        copy.querySelector('[data-ctd-next]').addEventListener('click', function () { goTo(idx + 1); startAuto(); });
      }
    }

    function startAuto() {
      stopAuto();
      // 모바일(이 컴포넌트가 세로 레이아웃으로 바뀌는 900px 이하)에서는 자동 전환 끄고 수동(이전/다음 버튼)만 허용
      if (global.matchMedia && global.matchMedia('(max-width:900px)').matches) return;
      if (instructors.length > 1) timer = setInterval(function () { goTo(idx + 1); }, 4000);
    }

    function stopAuto() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    build();
    goTo(0);

    // 섹션이 화면에 처음 보일 때 항상 첫 번째 강사부터 노출되도록 리셋
    var section = root.closest('section') || root;
    var seen = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (!seen) { seen = true; goTo(0); }
          startAuto();
        } else {
          stopAuto();
        }
      });
    }, { threshold: .3 });
    io.observe(section);
  }

  function renderAboutInstructors() {
    var row = document.querySelector('.instr-row');
    var modal = document.getElementById('instructorModal');
    if (!row || !modal) return;
    var instructors = store.getInstructors();
    if (!instructors.length) return;
    var bySlug = {};
    instructors.forEach(function (item) { bySlug[item.slug || item.id] = item; });

    row.innerHTML = instructors.map(function (item) {
      var key = item.slug || item.id;
      return '<div class="instr-item">'
        + '<div class="instr-photo2" data-managed-instr="' + escapeHtml(key) + '" role="button" tabindex="0" aria-label="' + escapeHtml(item.name + ' 강사 이력 보기') + '" title="이력 보기">'
        + imageMarkup(item.photo, item.name + ' 강사')
        + '</div>'
        + '<p class="instr-cap"><strong>' + escapeHtml(item.name) + '</strong><span>강사</span></p>'
        + '</div>';
    }).join('');

    function openModal(key) {
      var item = bySlug[key];
      if (!item) return;
      var label = document.getElementById('imLabel');
      var name = document.getElementById('imName');
      var list = document.getElementById('imList');
      if (label) label.textContent = item.label || '강사';
      if (name) name.innerHTML = escapeHtml(item.name) + '<span>' + escapeHtml(item.role || '') + '</span>';
      if (list) {
        var summary = instructorSummary(item, 'about');
        var items = item.careerItems || [];
        list.innerHTML = (summary ? '<li>' + escapeHtml(summary) + '</li>' : '')
          + items.map(function (career) { return '<li>' + escapeHtml(career) + '</li>'; }).join('');
      }
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    row.querySelectorAll('[data-managed-instr]').forEach(function (button) {
      var key = button.getAttribute('data-managed-instr');
      button.addEventListener('click', function () { openModal(key); });
      button.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openModal(key);
        }
      });
    });
  }

  function renderPreviewBadge() {
    if (!previewState || document.getElementById('siteContentPreviewBadge')) return;
    var badge = document.createElement('div');
    badge.id = 'siteContentPreviewBadge';
    badge.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:99999;display:flex;gap:8px;align-items:center;border:1px solid #b8dcff;background:#eef7ff;color:#174a7c;border-radius:999px;padding:10px 13px;font:800 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;box-shadow:0 10px 24px rgba(16,24,40,.16)';
    badge.textContent = '미리보기 모드 · 저장 전 화면입니다';
    document.body.appendChild(badge);
  }

  function renderAll() {
    renderPreviewBadge();
    renderHero();
    renderLandingInstructors();
    renderAboutInstructors();
    renderFormOptions();
  }

  store.ready().then(renderAll).catch(function () {});
})(window, document);
