(function (global) {
  'use strict';

  var STYLE_HREF = '/assets/mobile-tabbar.css?v=20260723-4';
  var MOBILE_QUERY = '(max-width: 760px)';

  var TABBAR_HTML = ''
    + '<nav class="mobile-tabbar" aria-label="모바일 하단 메뉴">'
    + '  <a class="mt-item" data-mt="apply" href="/course-free/">'
    + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 2v4M16 2v4"/><path d="M9 15.5l1.8 1.8L15 13.5"/></svg>'
    + '    <span>강연신청</span>'
    + '  </a>'
    + '  <a class="mt-item" data-mt="reviews" href="/reviews/">'
    + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z"/></svg>'
    + '    <span>후기</span>'
    + '  </a>'
    + '  <a class="mt-item" data-mt="home" href="/">'
    + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.8 12 4l8.5 6.8"/><path d="M5.5 9.5V20h5v-6h3v6h5V9.5"/></svg>'
    + '    <span>홈</span>'
    + '  </a>'
    + '  <a class="mt-item" data-mt="faq" href="/faq/">'
    + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 9a3.5 3.5 0 1 1 5.4 2.9c-1.1.7-1.9 1.3-1.9 2.6v.3"/><circle cx="12" cy="18.5" r=".35" fill="currentColor" stroke="none"/></svg>'
    + '    <span>문의</span>'
    + '  </a>'
    + '  <button class="mt-item" type="button" data-mt="category" aria-haspopup="true" aria-expanded="false">'
    + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
    + '    <span>메뉴</span>'
    + '  </button>'
    + '</nav>'
    + '<div class="mt-drawer-overlay"></div>'
    + '<aside class="mt-drawer" role="dialog" aria-modal="true" aria-label="메뉴">'
    + '  <div class="mt-drawer-head">'
    + '    <span>메뉴</span>'
    + '    <button class="mt-drawer-close" type="button" aria-label="메뉴 닫기">'
    + '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
    + '    </button>'
    + '  </div>'
    + '  <nav class="mt-drawer-nav">'
    + '    <a class="mt-drawer-link" href="/about/">소개</a>'
    + '    <div class="mt-drawer-group">'
    + '      <button class="mt-drawer-toggle" type="button" data-group="courses" aria-expanded="false">'
    + '        <span>전체 강연</span>'
    + '        <svg class="mt-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
    + '      </button>'
    + '      <div class="mt-drawer-sub" data-group-panel="courses">'
    + '        <a href="/course-free/">무료 강연</a>'
    + '        <a href="/course-paid/">유료 강연</a>'
    + '        <a href="/course-corporate/">기업 강연</a>'
    + '      </div>'
    + '    </div>'
    + '    <a class="mt-drawer-link" href="/reviews/">강연 후기</a>'
    + '    <a class="mt-drawer-link" href="/faq/">FAQ</a>'
    + '    <div class="mt-drawer-group">'
    + '      <button class="mt-drawer-toggle" type="button" data-group="contact" aria-expanded="false">'
    + '        <span>문의·지원</span>'
    + '        <svg class="mt-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
    + '      </button>'
    + '      <div class="mt-drawer-sub" data-group-panel="contact">'
    + '        <a href="/corporate/">출강 문의</a>'
    + '        <a href="/instructor-apply/">강사 지원</a>'
    + '      </div>'
    + '    </div>'
    + '  </nav>'
    + '</aside>';

  var BACK_BUTTON_HTML = ''
    + '<button class="nav-back-mobile" type="button" aria-label="이전 화면으로 돌아가기">'
    + '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 19l-7-7 7-7"/></svg>'
    + '</button>';

  var BACK_BUTTON_PATH_PREFIXES = ['/course-detail', '/corporate', '/instructor-apply'];

  function ensureStyles() {
    if (document.querySelector('link[data-mobile-tabbar-style]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLE_HREF;
    link.setAttribute('data-mobile-tabbar-style', 'true');
    document.head.appendChild(link);
  }

  function currentPath() {
    return global.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  }

  function currentPathKey() {
    var path = currentPath();
    if (path === '' || path === '/') return 'home';
    if (path.indexOf('/course-free') === 0) return 'apply';
    if (path.indexOf('/reviews') === 0) return 'reviews';
    if (path.indexOf('/faq') === 0) return 'faq';
    return '';
  }

  function isBackButtonPage() {
    var path = currentPath();
    return BACK_BUTTON_PATH_PREFIXES.some(function (prefix) {
      return path.indexOf(prefix) === 0;
    });
  }

  function renderBackButton() {
    var nav = document.getElementById('nav');
    if (!nav || nav.querySelector('.nav-back-mobile')) return;
    var container = nav.querySelector('.container') || nav;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = BACK_BUTTON_HTML;
    var backButton = wrapper.firstElementChild;
    container.insertBefore(backButton, container.firstChild);
    document.documentElement.classList.add('has-nav-back');
    backButton.addEventListener('click', function () {
      if (global.history.length > 1) global.history.back();
      else global.location.href = '/';
    });
  }

  function renderTabbar() {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = TABBAR_HTML;
    var bar = wrapper.querySelector('.mobile-tabbar');
    var overlay = wrapper.querySelector('.mt-drawer-overlay');
    var drawer = wrapper.querySelector('.mt-drawer');
    document.body.appendChild(bar);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    var spacer = document.createElement('div');
    spacer.className = 'mobile-tabbar-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(spacer);

    document.documentElement.classList.add('has-mobile-tabbar');

    var activeKey = currentPathKey();
    if (activeKey) {
      var activeItem = bar.querySelector('[data-mt="' + activeKey + '"]');
      if (activeItem) activeItem.classList.add('is-active');
    }

    var menuButton = bar.querySelector('[data-mt="category"]');
    var closeButton = drawer.querySelector('.mt-drawer-close');

    function setOpen(open) {
      drawer.classList.toggle('is-open', open);
      overlay.classList.toggle('is-open', open);
      document.body.classList.toggle('mt-drawer-lock', open);
      if (menuButton) menuButton.setAttribute('aria-expanded', String(open));
    }

    if (menuButton) {
      menuButton.addEventListener('click', function (event) {
        event.stopPropagation();
        setOpen(!drawer.classList.contains('is-open'));
      });
    }
    if (closeButton) {
      closeButton.addEventListener('click', function () { setOpen(false); });
    }
    overlay.addEventListener('click', function () { setOpen(false); });

    Array.prototype.slice.call(drawer.querySelectorAll('.mt-drawer-toggle')).forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        var group = toggle.getAttribute('data-group');
        var panel = drawer.querySelector('[data-group-panel="' + group + '"]');
        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        if (panel) panel.classList.toggle('is-open', !expanded);
      });
    });
  }

  function render() {
    if (document.querySelector('.mobile-tabbar') || document.querySelector('.nav-back-mobile')) return;

    ensureStyles();
    document.documentElement.classList.add('has-mobile-nav-cleanup');

    if (isBackButtonPage()) {
      renderBackButton();
    }

    // 신청 상세페이지(하단 고정 신청바가 있는 페이지)에는 별도 하단바를 만들지 않음
    if (document.querySelector('.sticky-cta')) return;

    renderTabbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})(window);
