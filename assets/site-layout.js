(function (global) {
  'use strict';

  var GOOGLE_ADS_ID = 'AW-17060350229';
  var ADMIN_ACCESS_PATH = '/admin-dashboard/';
  var ADMIN_ACCESS_PASSWORD = '123123123';

  function ensureGoogleTag() {
    if (!GOOGLE_ADS_ID) return;
    global.dataLayer = global.dataLayer || [];
    global.gtag = global.gtag || function () { global.dataLayer.push(arguments); };

    if (!document.querySelector('script[data-ai-leaders-google-tag]')) {
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GOOGLE_ADS_ID);
      script.setAttribute('data-ai-leaders-google-tag', GOOGLE_ADS_ID);
      document.head.appendChild(script);
    }

    if (!global.__aiLeadersGoogleTagConfigured) {
      global.__aiLeadersGoogleTagConfigured = true;
      global.gtag('js', new Date());
      global.gtag('config', GOOGLE_ADS_ID);
    }
  }

  var NAV_HTML = ''
    + '<nav class="nav" id="nav">'
    + '  <div class="container">'
    + '    <a class="brand" href="/" aria-label="AI 리더스 협회 홈">'
    + '      <img class="logo logo-white" src="/images/logo-white.png" alt="AI 리더스 협회"/>'
    + '      <img class="logo logo-ink" src="/images/logo-ink.png" alt="AI 리더스 협회"/>'
    + '    </a>'
    + '    <div class="menu" role="navigation" aria-label="주요 메뉴">'
    + '      <a class="nav-link" data-nav-key="about" href="/about/">소개</a>'
    + '      <div class="nav-item" data-nav-key="courses">'
    + '        <a class="nav-link" href="/course-free/">전체 강연<svg class="ar" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></a>'
    + '        <div class="dropdown">'
    + '          <a href="/course-free/">무료 강연</a>'
    + '          <a href="/course-paid/">유료 강연</a>'
    + '          <a href="/course-corporate/">기업 강연</a>'
    + '        </div>'
    + '      </div>'
    + '      <a class="nav-link" data-nav-key="reviews" href="/reviews/">강연 후기</a>'
    + '      <a class="nav-link" data-nav-key="faq" href="/faq/">FAQ</a>'
    + '      <div class="nav-item" data-nav-key="contact">'
    + '        <a class="nav-link" href="/corporate/">문의·지원<svg class="ar" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></a>'
    + '        <div class="dropdown">'
    + '          <a href="/corporate/">출강 문의</a>'
    + '          <a href="/instructor-apply/">강사 지원</a>'
    + '        </div>'
    + '      </div>'
    + '    </div>'
    + '    <div class="nav-cta"><a class="btn" href="/corporate/">출강 문의</a></div>'
    + '    <button class="hamb" id="hamb" aria-label="메뉴 열기" aria-expanded="false">'
    + '      <svg fill="none" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>'
    + '    </button>'
    + '  </div>'
    + '</nav>';

  var FOOTER_HTML = ''
    + '<footer class="footer site-footer">'
    + '  <div class="container">'
    + '    <div class="ft-wrap">'
    + '      <div class="ft-left">'
    + '        <div class="ft-logo"><img class="logo" src="/images/logo-ink.png" alt="AI 리더스 협회"/></div>'
    + '        <div class="ft-social">'
    + '          <a href="#" class="sbtn" aria-label="카카오톡"><b>TALK</b></a>'
    + '          <a href="https://www.youtube.com/@AI%EB%A6%AC%EB%8D%94%EC%8A%A4%ED%98%91%ED%9A%8C" target="_blank" rel="noopener" class="sbtn" aria-label="유튜브"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.77-1.77C19.27 5 12 5 12 5s-7.27 0-8.83.53A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.77 1.77C4.73 19 12 19 12 19s7.27 0 8.83-.53A2.5 2.5 0 0 0 22.6 16.7C23 15.2 23 12 23 12zM9.8 15.3V8.7l6.2 3.3-6.2 3.3z"/></svg></a>'
    + '          <a href="https://www.instagram.com/ai_leaders_/" target="_blank" rel="noopener" class="sbtn" aria-label="인스타그램"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg></a>'
    + '        </div>'
    + '      </div>'
    + '      <div class="ft-right">'
    + '        <p class="ft-biz">AI리더스협회<span class="bar">|</span>주소 : 영등포구 선유로70 우리벤처타운2<span class="bar">|</span>대표 : 김영주<span class="bar">|</span>사업자등록번호 : 352-88-01460<span class="bar">|</span>TEL : 010-4269-0213</p>'
    + '        <p class="ft-copy">COPYRIGHT ⓒ AI리더스협회 ALL RIGHTS RESERVED</p>'
    + '        <p class="ft-links">'
    + '          <a href="/admin-dashboard/" data-admin-access>관리자 페이지</a>'
    + "          <a href=\"#privacyModal\" onclick=\"if(window.openLegal){openLegal('privacyModal');} return false;\">개인정보처리방침</a>"
    + "          <a href=\"#termsModal\" onclick=\"if(window.openLegal){openLegal('termsModal');} return false;\">이용약관</a>"
    + '        </p>'
    + '      </div>'
    + '    </div>'
    + '  </div>'
    + '</footer>';

  var ADMIN_ACCESS_DIALOG_HTML = ''
    + '<div class="admin-access-dialog__panel">'
    + '  <button class="admin-access-dialog__close" type="button" data-admin-access-close aria-label="관리자 페이지 비밀번호 창 닫기">×</button>'
    + '  <h2 id="adminAccessTitle">관리자 페이지</h2>'
    + '  <p id="adminAccessDescription">관리자 페이지로 이동하려면 임시 비밀번호를 입력해 주세요.</p>'
    + '  <form class="admin-access-dialog__form" id="adminAccessForm" novalidate>'
    + '    <label for="adminAccessPassword">비밀번호</label>'
    + '    <input id="adminAccessPassword" name="adminAccessPassword" type="password" autocomplete="off" maxlength="64" required aria-describedby="adminAccessError"/>'
    + '    <p class="admin-access-dialog__error" id="adminAccessError" role="alert" hidden>비밀번호가 올바르지 않습니다.</p>'
    + '    <div class="admin-access-dialog__actions">'
    + '      <button class="admin-access-dialog__button" type="button" data-admin-access-close>취소</button>'
    + '      <button class="admin-access-dialog__button is-primary" type="submit">확인</button>'
    + '    </div>'
    + '  </form>'
    + '</div>';

  function ensureAdminAccessStyle() {
    if (document.getElementById('adminAccessStyle')) return;
    var style = document.createElement('style');
    style.id = 'adminAccessStyle';
    style.textContent = ''
      + '.admin-access-dialog{position:fixed;inset:0;width:min(420px,calc(100% - 32px));max-height:calc(100dvh - 32px);margin:auto;border:0;border-radius:16px;padding:0;background:#fff;color:#0c1828;box-shadow:0 24px 80px rgba(12,24,40,.28);overflow:auto;}'
      + '.admin-access-dialog::backdrop{background:rgba(12,24,40,.62);}'
      + '.admin-access-dialog__panel{position:relative;padding:30px;}'
      + '.admin-access-dialog__panel h2{margin:0;font-size:22px;line-height:1.3;font-weight:800;color:#0c1828;}'
      + '.admin-access-dialog__panel>p{margin:10px 0 0;color:#667085;font-size:14px;line-height:1.6;word-break:keep-all;}'
      + '.admin-access-dialog__close{position:absolute;top:16px;right:16px;width:36px;height:36px;border:0;border-radius:50%;background:#f2f4f7;color:#667085;font-size:24px;line-height:1;cursor:pointer;}'
      + '.admin-access-dialog__close:hover{background:#e4e7ec;color:#344054;}'
      + '.admin-access-dialog__form{display:grid;gap:8px;margin-top:22px;}'
      + '.admin-access-dialog__form label{font-size:13px;font-weight:800;color:#344054;}'
      + '.admin-access-dialog__form input{width:100%;height:46px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;color:#0c1828;padding:0 12px;font-size:15px;outline:none;box-sizing:border-box;}'
      + '.admin-access-dialog__form input:focus{border-color:#0172fe;box-shadow:0 0 0 3px rgba(1,114,254,.12);}'
      + '.admin-access-dialog__form input[aria-invalid="true"]{border-color:#d92d20;box-shadow:0 0 0 3px rgba(217,45,32,.1);}'
      + '.admin-access-dialog__error{margin:0;color:#d92d20;font-size:12px;font-weight:700;}'
      + '.admin-access-dialog__actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px;}'
      + '.admin-access-dialog__button{height:44px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;color:#344054;font-size:14px;font-weight:800;cursor:pointer;}'
      + '.admin-access-dialog__button.is-primary{border-color:#0172fe;background:#0172fe;color:#fff;}'
      + '.admin-access-dialog__button:hover{filter:brightness(.97);}'
      + '.admin-access-dialog__button:focus-visible,.admin-access-dialog__close:focus-visible{outline:3px solid rgba(1,114,254,.22);outline-offset:2px;}'
      + '@media(max-width:480px){.admin-access-dialog__panel{padding:26px 20px 22px;}.admin-access-dialog__actions{grid-template-columns:1fr;}.admin-access-dialog__button.is-primary{grid-row:1;}}';
    document.head.appendChild(style);
  }

  function resetAdminAccessDialog(dialog) {
    var input = dialog && dialog.querySelector('#adminAccessPassword');
    var error = dialog && dialog.querySelector('#adminAccessError');
    if (input) {
      input.value = '';
      input.removeAttribute('aria-invalid');
    }
    if (error) error.hidden = true;
  }

  function ensureAdminAccessDialog() {
    if (!document.body) return null;
    ensureAdminAccessStyle();
    var dialog = document.getElementById('adminAccessDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'adminAccessDialog';
    dialog.className = 'admin-access-dialog';
    dialog.setAttribute('aria-labelledby', 'adminAccessTitle');
    dialog.setAttribute('aria-describedby', 'adminAccessDescription');
    dialog.innerHTML = ADMIN_ACCESS_DIALOG_HTML;
    document.body.appendChild(dialog);

    Array.prototype.forEach.call(dialog.querySelectorAll('[data-admin-access-close]'), function (button) {
      button.addEventListener('click', function () { dialog.close(); });
    });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      dialog.close();
    });
    dialog.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dialog.close();
    });
    dialog.addEventListener('close', function () {
      resetAdminAccessDialog(dialog);
    });
    dialog.querySelector('#adminAccessPassword').addEventListener('input', function () {
      this.removeAttribute('aria-invalid');
      dialog.querySelector('#adminAccessError').hidden = true;
    });
    dialog.querySelector('#adminAccessForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var input = dialog.querySelector('#adminAccessPassword');
      var error = dialog.querySelector('#adminAccessError');
      if (input.value === ADMIN_ACCESS_PASSWORD) {
        global.location.assign(ADMIN_ACCESS_PATH);
        return;
      }
      input.setAttribute('aria-invalid', 'true');
      error.hidden = false;
      input.focus();
      input.select();
    });
    return dialog;
  }

  function openAdminAccess(event) {
    if (event) event.preventDefault();
    var dialog = ensureAdminAccessDialog();
    if (!dialog) return;
    resetAdminAccessDialog(dialog);
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      global.requestAnimationFrame(function () {
        var input = dialog.querySelector('#adminAccessPassword');
        if (input) input.focus();
      });
    }
  }

  function bindAdminAccessLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-admin-access]'), function (link) {
      if (link.getAttribute('data-admin-access-bound') === 'true') return;
      link.setAttribute('data-admin-access-bound', 'true');
      link.addEventListener('click', openAdminAccess);
    });
  }

  function ensureAdminAccessUi() {
    ensureAdminAccessDialog();
    bindAdminAccessLinks();
  }

  function currentRoute() {
    var path = global.location.pathname.toLowerCase().replace(/\/+$/, '');
    var route = (path.split('/').pop() || 'index').replace(/\.html$/, '');
    return route || 'index';
  }

  function activeKey() {
    var route = currentRoute();
    if (route === 'about' || route === 'instructor') return 'about';
    if (/^course-/.test(route) || route === 'course-detail') return 'courses';
    if (route === 'reviews') return 'reviews';
    if (route === 'faq') return 'faq';
    if (route === 'corporate' || route === 'instructor-apply') return 'contact';
    return '';
  }

  function markActiveNav() {
    var nav = document.getElementById('nav');
    var key = activeKey();
    if (!nav) return;
    Array.prototype.forEach.call(nav.querySelectorAll('.nav-link.active'), function (link) {
      link.classList.remove('active');
    });
    if (!key) return;
    var target = nav.querySelector('[data-nav-key="' + key + '"]');
    if (!target) return;
    var link = target.classList.contains('nav-link') ? target : target.querySelector('.nav-link');
    if (link) link.classList.add('active');
  }

  function renderNav() {
    var mount = document.querySelector('[data-site-nav]');
    if (!mount || document.getElementById('nav')) {
      markActiveNav();
      return;
    }
    mount.outerHTML = NAV_HTML;
    markActiveNav();
  }

  function renderFooter() {
    var mount = document.querySelector('[data-site-footer]');
    if (!mount || document.querySelector('footer.site-footer')) return;
    mount.outerHTML = FOOTER_HTML;
  }

  function renderAll() {
    ensureGoogleTag();
    renderNav();
    renderFooter();
    ensureAdminAccessUi();
  }

  global.AiLeadersLayout = {
    renderNav: renderNav,
    renderFooter: renderFooter,
    ensureGoogleTag: ensureGoogleTag,
    renderAll: renderAll,
    markActiveNav: markActiveNav,
    openAdminAccess: openAdminAccess
  };

  renderAll();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  }
})(window);
