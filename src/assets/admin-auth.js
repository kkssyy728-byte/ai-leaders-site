(function (global) {
  'use strict';

  var api = global.AiLeadersSupabase;
  var LOGIN_PATH = '/admin-login/';
  var ROLE_LABELS = {
    owner: '총괄 관리자',
    design: '디자인팀',
    marketing: '광고·마케팅팀',
    technical: '기술팀'
  };
  var PATH_ROLES = {
    '/admin-dashboard/': ['owner', 'design', 'marketing', 'technical'],
    '/admin-courses/': ['owner', 'marketing', 'technical'],
    '/admin-site-content/': ['owner', 'design', 'marketing', 'technical'],
    '/admin-applications/': ['owner', 'marketing', 'technical'],
    '/admin-corporate-inquiries/': ['owner', 'marketing', 'technical'],
    '/admin-instructor-applications/': ['owner', 'marketing', 'technical'],
    '/admin-update-log/': ['owner', 'design', 'marketing', 'technical']
  };

  function canonicalAdminPath(path) {
    var normalized = path || '/admin-dashboard/';
    return normalized.endsWith('/') ? normalized : normalized + '/';
  }

  function currentPath() {
    return canonicalAdminPath(global.location.pathname);
  }

  function loginUrl(reason) {
    var params = new URLSearchParams();
    params.set('next', currentPath() + global.location.search);
    if (reason) params.set('reason', reason);
    return LOGIN_PATH + '?' + params.toString();
  }

  function canAccessPath(role, path) {
    var allowedRoles = PATH_ROLES[canonicalAdminPath(path)];
    return Boolean(allowedRoles && allowedRoles.indexOf(role) !== -1);
  }

  function showPage() {
    document.documentElement.classList.remove('admin-auth-pending');
    document.documentElement.classList.add('admin-auth-ready');
  }

  function redirectToLogin(reason) {
    global.location.replace(loginUrl(reason));
  }

  function applyNavigation(role) {
    Array.prototype.forEach.call(document.querySelectorAll('.admin-nav a, .admin-side-footer a'), function (link) {
      var url;
      try {
        url = new URL(link.href, global.location.origin);
      } catch (_error) {
        return;
      }
      var path = canonicalAdminPath(url.pathname);
      if (PATH_ROLES[path] && !canAccessPath(role, path)) {
        link.hidden = true;
        link.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function applyPagePermissions(role, path) {
    if (role !== 'design') return;
    if (path === '/admin-site-content/') {
      Array.prototype.forEach.call(document.querySelectorAll('[data-tab="option"], [data-section="option"]'), function (element) {
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
      });
    }
    if (path === '/admin-dashboard/') {
      Array.prototype.forEach.call(document.querySelectorAll('[data-sensitive-admin]'), function (element) {
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
      });
      var stats = document.querySelector('.stats');
      if (stats) stats.style.gridTemplateColumns = 'minmax(0, 320px)';
      var description = document.querySelector('.admin-desc');
      var notice = document.querySelector('.notice');
      if (description) description.textContent = '디자인팀에서 관리할 수 있는 공개 콘텐츠 현황입니다.';
      if (notice) notice.textContent = '신청자 개인정보는 담당 부서에만 표시됩니다. 배너·강사진 수정은 사이트 콘텐츠 메뉴를 이용해 주세요.';
    }
  }

  function renderSession(profile, session) {
    var side = document.querySelector('.admin-side');
    if (!side || side.querySelector('[data-admin-session]')) return;
    var panel = document.createElement('section');
    panel.className = 'admin-session';
    panel.setAttribute('data-admin-session', '');

    var name = document.createElement('p');
    name.className = 'admin-session__name';
    name.textContent = profile.display_name || (session.user && session.user.email) || '직원';

    var meta = document.createElement('p');
    meta.className = 'admin-session__meta';
    meta.textContent = ROLE_LABELS[profile.role] || profile.role;

    var logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'admin-session__logout';
    logout.textContent = '안전하게 로그아웃';
    logout.addEventListener('click', async function () {
      logout.disabled = true;
      try {
        await api.signOut();
      } finally {
        global.location.replace(LOGIN_PATH + '?reason=signed-out');
      }
    });

    panel.appendChild(name);
    panel.appendChild(meta);
    panel.appendChild(logout);
    var footer = side.querySelector('.admin-side-footer');
    if (footer) footer.insertBefore(panel, footer.firstChild);
    else side.appendChild(panel);
  }

  function showDeniedNotice() {
    var params = new URLSearchParams(global.location.search);
    if (params.get('denied') !== '1') return;
    var main = document.querySelector('.admin-main');
    if (!main) return;
    var notice = document.createElement('p');
    notice.className = 'admin-auth-notice';
    notice.textContent = '현재 계정에는 요청한 관리 화면의 권한이 없습니다.';
    main.insertBefore(notice, main.firstChild);
  }

  async function loadProfile(session) {
    var rows = await api.selectRows('staff_members', {
      select: 'user_id,display_name,role,is_active',
      filters: { user_id: session.user.id }
    });
    return rows && rows.length ? rows[0] : null;
  }

  async function requireStaff() {
    if (!api || typeof api.getSession !== 'function') {
      redirectToLogin('setup-required');
      return null;
    }

    var session = await api.getSession();
    if (!session || !session.user) {
      redirectToLogin('session-required');
      return null;
    }

    var profile;
    try {
      profile = await loadProfile(session);
    } catch (error) {
      console.error('[AI Leaders] Staff profile lookup failed.', error);
      redirectToLogin('setup-required');
      return null;
    }

    if (!profile || profile.is_active !== true || !ROLE_LABELS[profile.role]) {
      await api.signOut().catch(function () {});
      redirectToLogin('not-authorized');
      return null;
    }

    if (!canAccessPath(profile.role, currentPath())) {
      global.location.replace('/admin-dashboard/?denied=1');
      return null;
    }

    applyNavigation(profile.role);
    applyPagePermissions(profile.role, currentPath());
    renderSession(profile, session);
    showDeniedNotice();
    global.AiLeadersAdminAuth.current = {
      session: session,
      profile: profile
    };
    showPage();
    document.dispatchEvent(new CustomEvent('ai-leaders:admin-ready', {
      detail: global.AiLeadersAdminAuth.current
    }));
    return global.AiLeadersAdminAuth.current;
  }

  var ready = requireStaff().catch(function (error) {
    console.error('[AI Leaders] Admin authorization failed.', error);
    redirectToLogin('authorization-error');
    return null;
  });

  global.AiLeadersAdminAuth = {
    current: null,
    ready: ready,
    roleLabels: ROLE_LABELS,
    canAccessPath: canAccessPath
  };
})(window);
