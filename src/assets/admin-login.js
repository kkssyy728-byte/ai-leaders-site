(function (global) {
  'use strict';

  var api = global.AiLeadersSupabase;
  var form = document.getElementById('staffLoginForm');
  var emailInput = document.getElementById('staffEmail');
  var passwordInput = document.getElementById('staffPassword');
  var submitButton = document.getElementById('staffLoginSubmit');
  var message = document.getElementById('staffLoginMessage');
  var SAFE_ADMIN_PATHS = {
    '/admin-dashboard/': true,
    '/admin-courses/': true,
    '/admin-site-content/': true,
    '/admin-applications/': true,
    '/admin-corporate-inquiries/': true,
    '/admin-instructor-applications/': true,
    '/admin-update-log/': true
  };
  var REASON_MESSAGES = {
    'session-required': '로그인 후 관리자 화면을 이용할 수 있습니다.',
    'not-authorized': '관리 권한이 등록되지 않았거나 중지된 계정입니다.',
    'setup-required': '관리자 보안 설정이 아직 준비되지 않았습니다. 기술 담당자에게 문의해 주세요.',
    'authorization-error': '권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    'signed-out': '안전하게 로그아웃했습니다.'
  };

  function setMessage(text, isError) {
    message.textContent = text || '';
    message.hidden = !text;
    message.classList.toggle('is-error', !!isError);
  }

  function safeNextPath() {
    var raw = new URLSearchParams(global.location.search).get('next') || '/admin-dashboard/';
    try {
      var target = new URL(raw, global.location.origin);
      var path = target.pathname.endsWith('/') ? target.pathname : target.pathname + '/';
      if (target.origin !== global.location.origin || !SAFE_ADMIN_PATHS[path]) {
        return '/admin-dashboard/';
      }
      return path + target.search + target.hash;
    } catch (_error) {
      return '/admin-dashboard/';
    }
  }

  async function loadProfile(session) {
    var rows = await api.selectRows('staff_members', {
      select: 'user_id,role,is_active',
      filters: { user_id: session.user.id }
    });
    return rows && rows.length ? rows[0] : null;
  }

  async function verifyAndContinue(session) {
    var profile = await loadProfile(session);
    if (!profile || profile.is_active !== true) {
      await api.signOut().catch(function () {});
      throw new Error('STAFF_NOT_AUTHORIZED');
    }
    global.location.replace(safeNextPath());
  }

  async function checkExistingSession() {
    if (!api || typeof api.getSession !== 'function') {
      setMessage(REASON_MESSAGES['setup-required'], true);
      submitButton.disabled = true;
      return;
    }
    var session = await api.getSession();
    if (!session) return;
    try {
      await verifyAndContinue(session);
    } catch (error) {
      if (error && error.message === 'STAFF_NOT_AUTHORIZED') {
        setMessage(REASON_MESSAGES['not-authorized'], true);
      } else {
        console.error('[AI Leaders] Existing staff session check failed.', error);
        setMessage(REASON_MESSAGES['setup-required'], true);
      }
    }
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (submitButton.disabled) return;
    submitButton.disabled = true;
    submitButton.textContent = '권한 확인 중…';
    setMessage('', false);
    try {
      var result = await api.signInWithPassword(emailInput.value, passwordInput.value);
      await verifyAndContinue(result.session);
    } catch (error) {
      if (error && error.message === 'STAFF_NOT_AUTHORIZED') {
        setMessage(REASON_MESSAGES['not-authorized'], true);
      } else if (error && /staff_members|relation|schema cache/i.test(error.message || '')) {
        console.error('[AI Leaders] Staff authorization schema is unavailable.', error);
        setMessage(REASON_MESSAGES['setup-required'], true);
      } else {
        setMessage('이메일 또는 비밀번호를 확인해 주세요.', true);
      }
      passwordInput.value = '';
      passwordInput.focus();
      submitButton.disabled = false;
      submitButton.textContent = '직원 로그인';
    }
  });

  var reason = new URLSearchParams(global.location.search).get('reason');
  if (REASON_MESSAGES[reason]) setMessage(REASON_MESSAGES[reason], reason !== 'signed-out');
  checkExistingSession().catch(function (error) {
    console.error('[AI Leaders] Login initialization failed.', error);
    setMessage('로그인 화면을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.', true);
  });
})(window);
