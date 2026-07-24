/* ============================================================
   챗봇 런처 (우측 하단 고정 버튼)
   - 모든 페이지에 공통으로 삽입되는 스크립트입니다.
   - 현재는 "버튼만" 상태이며 클릭 시 동작(링크/위젯 연결)은
     아래 CHATBOT_URL 값 또는 handleClick() 안에서 연결하면 됩니다.
   ============================================================ */
(function () {
  'use strict';

  // ▼▼▼ 나중에 챗봇 링크/위젯을 여기에 연결하세요 ▼▼▼
  // 예1) 외부 URL 연결:  var CHATBOT_URL = 'https://pf.kakao.com/....';
  // 예2) 채널톡 등 위젯:  handleClick() 안에서 위젯 open 호출
  var CHATBOT_URL = ''; // 비워두면 클릭해도 아무 동작 안 함(플레이스홀더)
  // ▲▲▲ ---------------------------------------------- ▲▲▲

  if (window.__chatbotLauncherLoaded) return;
  window.__chatbotLauncherLoaded = true;

  var CSS = [
    '.chatbot-launcher{',
    '  position:fixed; right:24px; bottom:24px; z-index:70;',
    '  width:62px; height:62px; border:none; padding:0; cursor:pointer;',
    '  border-radius:20px 20px 20px 6px;',
    '  background:linear-gradient(150deg,#4ea6ff 0%,#2d8cff 100%);',
    '  box-shadow:0 12px 28px rgba(45,140,255,.42), 0 4px 10px rgba(12,24,40,.18);',
    '  display:flex; align-items:center; justify-content:center;',
    '  transition:transform .2s ease, box-shadow .2s ease;',
    '  -webkit-tap-highlight-color:transparent;',
    '}',
    '.chatbot-launcher:hover{ transform:translateY(-3px); box-shadow:0 16px 34px rgba(45,140,255,.5), 0 6px 12px rgba(12,24,40,.2); }',
    '.chatbot-launcher:active{ transform:translateY(-1px); }',
    '.chatbot-launcher svg{ width:32px; height:32px; }',
    '.chatbot-launcher .cb-dot{ position:absolute; top:-3px; right:-3px; width:16px; height:16px; border-radius:50%; background:#ff4d6d; border:2.5px solid #fff; }',
    '@media (max-width:640px){',
    '  .chatbot-launcher{ right:16px; bottom:16px; width:46px; height:46px; border-radius:16px 16px 16px 5px; }',
    '  .chatbot-launcher svg{ width:24px; height:24px; }',
    '  .chatbot-launcher .cb-dot{ width:13px; height:13px; top:-2px; right:-2px; }',
    /* 모바일에서 우측 리모컨과 겹치지 않도록 위로 올림 */
    '  .quick-links{ bottom:88px !important; }',
    /* 하단 고정 신청바(.sticky-cta 존재 = 디테일 페이지)가 있으면 그 위로 올림 */
    '  .has-sticky-cta .chatbot-launcher{ bottom:84px; }',
    '  .has-sticky-cta .quick-links{ bottom:142px !important; }',
    /* 하단 모바일 탭바(.mobile-tabbar 존재)가 있으면 그 위로 올림 */
    '  .has-mobile-tabbar .chatbot-launcher{ bottom:calc(64px + env(safe-area-inset-bottom, 0px) + 12px) !important; }',
    '  .has-mobile-tabbar .quick-links{ bottom:calc(64px + env(safe-area-inset-bottom, 0px) + 70px) !important; }',
    '}'
  ].join('\n');

  function injectCSS() {
    var s = document.createElement('style');
    s.setAttribute('data-chatbot-launcher', '');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function handleClick() {
    if (CHATBOT_URL) {
      window.open(CHATBOT_URL, '_blank', 'noopener');
      return;
    }
    // 링크 미연결 상태 — 나중에 여기에 챗봇 위젯 open 로직 연결
    // (플레이스홀더: 현재는 아무 동작도 하지 않음)
  }

  function build() {
    injectCSS();
    // 하단 고정 신청바가 있는 페이지(디테일 페이지 등)면 챗봇/리모컨을 그 위로 올림
    if (document.querySelector('.sticky-cta')) {
      document.documentElement.classList.add('has-sticky-cta');
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chatbot-launcher';
    btn.setAttribute('aria-label', '챗봇 상담');
    btn.innerHTML =
      '<span class="cb-dot" aria-hidden="true"></span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9.5 9.5 0 0 1-3.4-.6L3 21l1.6-4.1A8.38 8.38 0 0 1 4 12.5 8.5 8.5 0 0 1 12.5 4 8.38 8.38 0 0 1 21 11.5z"/>' +
      '<circle cx="8.7" cy="12" r="1" fill="#fff" stroke="none"/>' +
      '<circle cx="12.5" cy="12" r="1" fill="#fff" stroke="none"/>' +
      '<circle cx="16.3" cy="12" r="1" fill="#fff" stroke="none"/>' +
      '</svg>';
    btn.addEventListener('click', handleClick);
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
