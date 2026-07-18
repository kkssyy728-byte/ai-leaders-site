(function (global) {
  'use strict';

  var STYLE_HREF = '/assets/quick-links.css?v=20260719-mobile-tabs-2';
  var MOBILE_QUERY = '(max-width: 760px)';
  var HOME_REVEAL_OFFSET = 260;

  var QUICK_LINKS_HTML = ''
    + '<aside class="quick-links" aria-label="SNS 퀵 메뉴">'
    + '  <nav class="quick-links-bar" aria-label="AI리더스협회 SNS 채널">'
    + '    <a class="qitem" href="https://www.instagram.com/ai_leaders_/" target="_blank" rel="noopener" aria-label="인스타그램 새 창에서 열기">'
    + '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>'
    + '      <span class="q-label">인스타</span><span class="q-tooltip">인스타그램</span>'
    + '    </a>'
    + '    <a class="qitem" href="https://www.facebook.com/people/Ai%EB%A6%AC%EB%8D%94%EC%8A%A4%ED%98%91%ED%9A%8C/61567872351191/#" target="_blank" rel="noopener" aria-label="페이스북 새 창에서 열기">'
    + '      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z"/></svg>'
    + '      <span class="q-label">페이스북</span><span class="q-tooltip">페이스북</span>'
    + '    </a>'
    + '    <a class="qitem" href="#" target="_blank" rel="noopener" aria-label="카카오톡 채널 새 창에서 열기">'
    + '      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.48 3 2 6.54 2 10.6c0 2.62 1.86 4.92 4.66 6.22-.2.71-.73 2.66-.84 3.07-.13.5.18.49.39.36.16-.11 2.5-1.7 3.52-2.39.74.11 1.5.17 2.27.17 5.52 0 10-3.54 10-7.6S17.52 3 12 3Z"/></svg>'
    + '      <span class="q-label">카카오</span><span class="q-tooltip">카카오톡 채널</span>'
    + '    </a>'
    + '    <a class="qitem" href="https://www.youtube.com/@AI%EB%A6%AC%EB%8D%94%EC%8A%A4%ED%98%91%ED%9A%8C" target="_blank" rel="noopener" aria-label="유튜브 새 창에서 열기">'
    + '      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.77-1.77C19.27 5 12 5 12 5s-7.27 0-8.83.53A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.77 1.77C4.73 19 12 19 12 19s7.27 0 8.83-.53A2.5 2.5 0 0 0 22.6 16.7C23 15.2 23 12 23 12ZM9.8 15.3V8.7l6.2 3.3-6.2 3.3Z"/></svg>'
    + '      <span class="q-label">유튜브</span><span class="q-tooltip">유튜브</span>'
    + '    </a>'
    + '    <a class="qitem" href="https://cafe.naver.com/newaileaders" target="_blank" rel="noopener" aria-label="네이버 카페 새 창에서 열기">'
    + '      <svg class="q-naver-mark" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5.5" fill="currentColor"/><g transform="translate(6.666667 6.666667) scale(.4444444)"><path fill="#ffffff" d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845Z"/></g></svg>'
    + '      <span class="q-label">네이버 카페</span><span class="q-tooltip">네이버 카페</span>'
    + '    </a>'
    + '  </nav>'
    + '  <button class="q-top" type="button" aria-label="페이지 맨 위로 이동">'
    + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
    + '    <span>TOP</span>'
    + '  </button>'
    + '</aside>'
    + '<div class="quick-links-spacer" aria-hidden="true"></div>';

  function ensureStyles() {
    if (document.querySelector('link[data-quick-links-style]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLE_HREF;
    link.setAttribute('data-quick-links-style', 'true');
    document.head.appendChild(link);
  }

  function isHomePage() {
    var path = global.location.pathname.toLowerCase().replace(/\/+$/, '');
    return path === '' || path === '/index.html';
  }

  function isHeroVisible() {
    var hero = document.querySelector('.main-hero, .hero');
    if (!hero) return false;
    var rect = hero.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < global.innerHeight;
  }

  function render() {
    var mount = document.querySelector('[data-site-quick-links]');
    if (!mount || document.querySelector('.quick-links')) return;

    ensureStyles();
    mount.outerHTML = QUICK_LINKS_HTML;

    var root = document.querySelector('.quick-links');
    var topButton = root && root.querySelector('.q-top');
    var socialLinks = root ? Array.prototype.slice.call(root.querySelectorAll('.qitem')) : [];
    var mobile = global.matchMedia ? global.matchMedia(MOBILE_QUERY) : null;
    var home = isHomePage();

    if (!root || !topButton) return;
    root.classList.toggle('is-home', home);

    function isMobile() {
      return mobile ? mobile.matches : global.innerWidth <= 760;
    }

    function update() {
      var scrolled = global.scrollY > HOME_REVEAL_OFFSET;
      var desktopVisible = !home || (scrolled && !isHeroVisible());
      var linksVisible = isMobile() || desktopVisible;

      root.classList.toggle('is-visible', desktopVisible);
      root.classList.toggle('is-scrolled', scrolled);
      socialLinks.forEach(function (link) {
        link.tabIndex = linksVisible ? 0 : -1;
      });
      topButton.tabIndex = !isMobile() || scrolled ? 0 : -1;
      topButton.setAttribute('aria-hidden', isMobile() && !scrolled ? 'true' : 'false');
    }

    topButton.addEventListener('click', function () {
      var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      global.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    global.addEventListener('scroll', update, { passive: true });
    global.addEventListener('resize', update, { passive: true });
    if (mobile && mobile.addEventListener) mobile.addEventListener('change', update);
    else if (mobile && mobile.addListener) mobile.addListener(update);
    update();
  }

  global.AiLeadersQuickLinks = { render: render };
  render();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  }
})(window);
