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

  function sortInstructors(items) {
    return sortByOrder(items);
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

  function imageMarkup(src, alt, className) {
    if (!src) return '';
    return '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt || '') + '"' + (className ? ' class="' + escapeHtml(className) + '"' : '') + '>';
  }

  function preferredHeroImage(banner) {
    var useMobile = global.matchMedia && global.matchMedia('(max-width: 720px)').matches;
    return useMobile
      ? (banner.mobileImage || banner.desktopImage)
      : (banner.desktopImage || banner.mobileImage);
  }

  function decodeImage(image) {
    if (!image || typeof image.decode !== 'function') return Promise.resolve();
    return image.decode().catch(function () {});
  }

  function preloadImage(src) {
    if (!src) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var image = new global.Image();
      var settled = false;

      function finish(loaded) {
        if (settled) return;
        settled = true;
        resolve(loaded);
      }

      image.decoding = 'async';
      image.onload = function () {
        decodeImage(image).then(function () { finish(true); });
      };
      image.onerror = function () { finish(false); };
      image.src = src;

      if (image.complete) {
        if (!image.naturalWidth) finish(false);
        else decodeImage(image).then(function () { finish(true); });
      }
    });
  }

  function preloadVideo(src) {
    if (!src) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var video = document.createElement('video');
      var settled = false;
      var timeout = global.setTimeout(function () { finish(false); }, 8000);

      function finish(loaded) {
        if (settled) return;
        settled = true;
        global.clearTimeout(timeout);
        video.removeAttribute('src');
        video.load();
        resolve(loaded);
      }

      video.preload = 'auto';
      video.muted = true;
      video.addEventListener('loadeddata', function () { finish(true); }, { once: true });
      video.addEventListener('error', function () { finish(false); }, { once: true });
      video.src = src;
      video.load();
    });
  }

  function preloadHeroBanner(banner) {
    if (banner.videoUrl) return preloadVideo(banner.videoUrl);
    return preloadImage(preferredHeroImage(banner));
  }

  function waitForImage(image) {
    if (!image) return Promise.resolve(true);
    if (image.complete) {
      if (!image.naturalWidth) return Promise.resolve(false);
      return decodeImage(image).then(function () { return true; });
    }
    return new Promise(function (resolve) {
      function cleanup() {
        image.removeEventListener('load', onLoad);
        image.removeEventListener('error', onError);
      }
      function onLoad() {
        cleanup();
        decodeImage(image).then(function () { resolve(true); });
      }
      function onError() {
        cleanup();
        resolve(false);
      }
      image.addEventListener('load', onLoad);
      image.addEventListener('error', onError);
    });
  }

  function ensureSlideMediaReady(slide) {
    if (!slide) return Promise.resolve(true);
    if (slide.__managedHeroMediaPromise) return slide.__managedHeroMediaPromise;

    var source = slide.querySelector('source[data-srcset]');
    var image = slide.querySelector('img');
    var video = slide.querySelector('video');

    if (source) {
      source.setAttribute('srcset', source.getAttribute('data-srcset'));
      source.removeAttribute('data-srcset');
    }
    if (image && image.hasAttribute('data-src')) {
      image.setAttribute('src', image.getAttribute('data-src'));
      image.removeAttribute('data-src');
    }
    if (video && video.hasAttribute('data-src')) {
      video.setAttribute('src', video.getAttribute('data-src'));
      video.removeAttribute('data-src');
      video.preload = 'auto';
      video.load();
    }

    if (image) {
      slide.__managedHeroMediaPromise = waitForImage(image);
    } else if (video) {
      slide.__managedHeroMediaPromise = new Promise(function (resolve) {
        if (video.readyState >= 2) {
          resolve(true);
          return;
        }
        video.addEventListener('loadeddata', function () { resolve(true); }, { once: true });
        video.addEventListener('error', function () { resolve(false); }, { once: true });
      });
    } else {
      slide.__managedHeroMediaPromise = Promise.resolve(true);
    }

    return slide.__managedHeroMediaPromise;
  }

  function scheduleIdle(task) {
    return new Promise(function (resolve) {
      function run() {
        Promise.resolve(task()).then(resolve, resolve);
      }
      if (typeof global.requestIdleCallback === 'function') {
        global.requestIdleCallback(run, { timeout: 1200 });
      } else {
        global.setTimeout(run, 120);
      }
    });
  }

  function preloadDeferredHeroSlides(slides) {
    var deferredSlides = Array.prototype.slice.call(slides.querySelectorAll('.slide'), 1);
    return deferredSlides.reduce(function (chain, slide) {
      return chain.then(function () {
        return scheduleIdle(function () { return ensureSlideMediaReady(slide); });
      });
    }, Promise.resolve());
  }

  function heroImageMarkup(src, alt, className, eager) {
    var sourceAttribute = eager ? 'src' : 'data-src';
    return '<img ' + sourceAttribute + '="' + escapeHtml(src) + '" alt="' + escapeHtml(alt || '') + '"'
      + (className ? ' class="' + escapeHtml(className) + '"' : '')
      + ' decoding="async"' + (eager ? ' fetchpriority="high"' : '') + '>';
  }

  function normalizeManagedLink(value, fallback) {
    var raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return fallback;

    if (/^(?:https?:|mailto:|tel:|#|\/\/)/i.test(raw)) return raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return fallback;

    var legacyPage = raw.match(/^\/?(?:html\/)?([a-z0-9-]+)\.html([?#].*)?$/i);
    if (!legacyPage) return raw;

    var pageName = legacyPage[1].toLowerCase();
    var suffix = legacyPage[2] || '';
    return pageName === 'index' ? '/' + suffix : '/' + pageName + '/' + suffix;
  }

  async function renderHero() {
    var hero = document.getElementById('hero');
    if (!hero) return;
    var banners = store.getBanners('home_hero');
    if (!banners.length) return;
    var title = hero.querySelector('h1');
    var subtitle = hero.querySelector('.sub');
    var links = hero.querySelectorAll('a.btn, .btn a, .hero-cta a, .hero-actions a');
    var primaryUrlFallback = links[0] ? (links[0].getAttribute('href') || '/course-free/') : '/course-free/';
    var secondaryUrlFallback = links[1] ? (links[1].getAttribute('href') || '/course-paid/') : '/course-paid/';
    var slides = document.getElementById('slides');
    var hasManagedMedia = banners.some(function (banner) {
      return banner.desktopImage || banner.mobileImage || banner.videoUrl;
    });
    var shouldRenderManagedSlides = slides && (hasManagedMedia || banners.length > 1);

    function applyBanner(index) {
      var item = banners[index] || banners[0];
      if (title && item.title) title.textContent = item.title;
      if (subtitle && item.subtitle) subtitle.textContent = item.subtitle;

      if (links[0] && item.primaryLabel) links[0].textContent = item.primaryLabel;
      if (links[0]) links[0].setAttribute('href', normalizeManagedLink(item.primaryUrl, primaryUrlFallback));
      if (links[1] && item.secondaryLabel) links[1].textContent = item.secondaryLabel;
      if (links[1]) links[1].setAttribute('href', normalizeManagedLink(item.secondaryUrl, secondaryUrlFallback));

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
      var firstMediaReady = await preloadHeroBanner(banners[0]);
      if (!firstMediaReady) return;

      slides.innerHTML = banners.map(function (banner, index) {
        var active = index === 0 ? ' active' : '';
        var fallbackClass = ' s' + ((index % 4) + 1);
        var eager = index === 0;
        if (banner.videoUrl) {
          return '<div class="slide' + fallbackClass + active + '"><video class="hero-bg-img" muted playsinline loop preload="' + (eager ? 'auto' : 'none') + '" '
            + (eager ? 'src' : 'data-src') + '="' + escapeHtml(banner.videoUrl) + '"></video></div>';
        }
        var desktop = banner.desktopImage || banner.mobileImage;
        var mobile = banner.mobileImage || banner.desktopImage;
        if (!desktop && !mobile) {
          return '<div class="slide' + fallbackClass + active + '"></div>';
        }
        return '<div class="slide' + fallbackClass + active + '"><picture>'
          + (mobile ? '<source media="(max-width: 720px)" ' + (eager ? 'srcset' : 'data-srcset') + '="' + escapeHtml(mobile) + '">' : '')
          + heroImageMarkup(desktop, banner.title || 'AI 강사 히어로 이미지', 'hero-bg-img', eager)
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

    var transitionPromise = Promise.resolve();

    function goTo(next) {
      var nextIndex = (next + banners.length) % banners.length;
      var targetSlide = shouldRenderManagedSlides
        ? slides.querySelectorAll('.slide')[nextIndex]
        : null;

      transitionPromise = transitionPromise.then(function () {
        return ensureSlideMediaReady(targetSlide).then(function (ready) {
          if (!ready) return false;
          index = nextIndex;
          applyBanner(index);
          return true;
        });
      });
      return transitionPromise;
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
    }

    applyBanner(0);
    startAuto();
    if (shouldRenderManagedSlides) preloadDeferredHeroSlides(slides);
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
        copy.innerHTML = '<div class="ctd-copy-inner">'
          + '<p class="ctd-quote">' + escapeHtml(instructorSummary(item, 'landing')) + '</p>'
          + '<p class="ctd-name">' + escapeHtml(item.name + ' 강사') + '</p>'
          + '<p class="ctd-designation">' + escapeHtml(item.role || '') + '</p>'
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
      if (instructors.length > 1) timer = setInterval(function () { goTo(idx + 1); }, 4000);
    }

    function stopAuto() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    build();
    goTo(0);
    startAuto();
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
    renderHero().catch(function () {});
    renderLandingInstructors();
    renderAboutInstructors();
    renderFormOptions();
  }

  store.ready().then(renderAll).catch(function () {});
})(window, document);
