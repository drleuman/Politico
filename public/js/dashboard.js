(function () {
  'use strict';

  const endpoint = Object.freeze({
    me: '/api/v1/auth/me',
    sessions: '/api/v1/sessions',
    invitations: '/api/v1/invitations',
    users: '/api/v1/users',
    health: '/healthz',
    ready: '/readyz'
  });

  function clear(node) {
    if (node) node.textContent = '';
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  async function getJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    let body = {};
    try { body = await response.json(); } catch (_) { body = {}; }
    return { ok: response.ok, status: response.status, body };
  }

  function statusItem(label, result, readyLabel) {
    const item = el('div', `system-status-item ${result.ok ? 'status-success' : 'status-danger'}`);
    const indicator = el('span', 'system-status-indicator');
    const isOk = result.ok;
    indicator.setAttribute('aria-hidden', 'true');
    item.append(
      indicator,
      el('strong', 'system-status-label', label),
      el('span', 'system-status-value', isOk ? readyLabel : `No disponible, HTTP ${result.status || 0}`)
    );
    return item;
  }

  function metricCard(label, value, detail, state) {
    const card = el('article', 'metric-card');
    card.classList.add(`metric-card-${state || 'accent'}`);
    const labelNode = el('p', 'metric-label', label);
    const valueNode = el('p', 'metric-value', value);
    const detailNode = el('p', 'metric-detail', detail);
    card.append(labelNode, valueNode, detailNode);
    return card;
  }

  function actionButton(label, target, description) {
    const button = el('button', 'dashboard-action');
    button.type = 'button';
    const copyGroup = el('span', 'dashboard-action-copy');
    const title = el('strong', '', label);
    const copy = el('span', '', description);
    copyGroup.append(title, copy);
    button.appendChild(copyGroup);
    button.addEventListener('click', function () {
      const tabButton = document.querySelector(`.tab-btn[aria-controls="${target}"]`);
      if (typeof window.showTab === 'function') window.showTab(target, { currentTarget: tabButton });
    });
    return button;
  }

  function unavailableCount(result) {
    if (result.status === 403 && String(result.body.error || '').startsWith('MFA_REQUIRED')) {
      return { value: 'Bloqueado', detail: 'Requiere autenticación reforzada', state: 'warning' };
    }
    return { value: 'No disponible', detail: `Respuesta HTTP ${result.status || 0}`, state: 'error' };
  }

  async function loadDashboard() {
    const metrics = document.getElementById('dashboardMetrics');
    const status = document.getElementById('dashboardStatusStrip');
    const security = document.getElementById('dashboardSecurity');
    const actions = document.getElementById('dashboardActions');
    const welcome = document.getElementById('dashboardWelcome');
    const organization = document.getElementById('dashboardOrganizationId');
    const refresh = document.getElementById('dashboardRefreshBtn');
    if (!metrics || !status || !security || !actions) return;

    clear(metrics); clear(status); clear(security); clear(actions);
    metrics.append(
      metricCard('Usuarios', '...', 'Consultando directorio'),
      metricCard('Sesiones', '...', 'Consultando actividad'),
      metricCard('Invitaciones', '...', 'Consultando pendientes'),
      metricCard('Cobertura MFA', '...', 'Evaluando seguridad')
    );
    if (refresh) refresh.disabled = true;

    const [me, sessions, invitations, users, health, ready] = await Promise.all([
      getJson(endpoint.me), getJson(endpoint.sessions), getJson(endpoint.invitations),
      getJson(endpoint.users), getJson(endpoint.health), getJson(endpoint.ready)
    ]);

    clear(status);
    status.append(
      statusItem('Gateway HTTPS', health, 'Operativo'),
      statusItem('Aplicación y base de datos', ready, 'Preparada')
    );

    const user = me.body.user || {};
    const context = me.body.authContext || {};
    const roles = Array.isArray(context.roles) ? context.roles : (Array.isArray(user.roles) ? user.roles : []);
    const orgId = me.body.session?.organizationId || context.activeOrganizationId || 'Sin identificar';
    if (organization) organization.textContent = orgId;
    if (welcome) welcome.textContent = user.fullName ? `Bienvenido, ${user.fullName}. Rol efectivo: ${roles.join(', ') || 'sin rol'}.` : 'Inicia sesión para consultar el estado institucional.';

    clear(metrics);
    const usersData = users.ok ? (users.body.users || []) : [];
    const sessionsData = sessions.ok ? (sessions.body.sessions || []) : [];
    const invitationsData = invitations.ok ? (invitations.body.invitations || []) : [];
    const mfaEnabledCount = usersData.filter(function (entry) { return entry.mfaEnabled; }).length;
    const usersMetric = users.ok
      ? { value: usersData.length, detail: 'Miembros registrados', state: 'neutral' }
      : unavailableCount(users);
    const sessionsMetric = sessions.ok
      ? { value: sessionsData.length, detail: 'Sesiones activas de tu cuenta', state: 'neutral' }
      : unavailableCount(sessions);
    const invitationsMetric = invitations.ok
      ? { value: invitationsData.length, detail: 'Invitaciones pendientes', state: invitationsData.length ? 'warning' : 'neutral' }
      : unavailableCount(invitations);
    const mfaMetric = users.ok
      ? { value: `${mfaEnabledCount}/${usersData.length}`, detail: user.mfaEnabled ? 'Tu MFA está activado' : 'Tu MFA está desactivado', state: user.mfaEnabled ? 'success' : 'warning' }
      : unavailableCount(users);
    metrics.append(
      metricCard('Usuarios', usersMetric.value, usersMetric.detail, usersMetric.state),
      metricCard('Sesiones', sessionsMetric.value, sessionsMetric.detail, sessionsMetric.state),
      metricCard('Invitaciones', invitationsMetric.value, invitationsMetric.detail, invitationsMetric.state),
      metricCard('Cobertura MFA', mfaMetric.value, mfaMetric.detail, mfaMetric.state)
    );

    const securityList = el('dl', 'security-summary');
    const rows = [
      ['Rol efectivo', roles.join(', ') || 'Sin rol'],
      ['MFA', user.mfaEnabled ? 'Activado' : 'Desactivado'],
      ['Sesión', me.ok ? 'Autenticada' : 'No autenticada'],
      ['Organización', orgId]
    ];
    rows.forEach(function (row) {
      const item = el('div', 'security-row');
      item.append(el('dt', '', row[0]), el('dd', '', row[1]));
      securityList.appendChild(item);
    });
    security.appendChild(securityList);

    actions.append(
      actionButton('Mi perfil', 'profileTab', 'Identidad, rol y seguridad'),
      actionButton('Sesiones activas', 'sessionsTab', 'Revisar y revocar accesos')
    );
    if (roles.includes('ADMIN') || roles.includes('COORDINATOR')) {
      actions.append(actionButton('Invitaciones', 'invitationsTab', 'Incorporar miembros con jerarquía controlada'));
    }
    if (roles.includes('ADMIN') || roles.includes('COORDINATOR')) {
      actions.append(actionButton('Gestión de usuarios', 'usersTab', 'Consultar miembros y estados'));
    }
    if (refresh) refresh.disabled = false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const refresh = document.getElementById('dashboardRefreshBtn');
    if (refresh) refresh.addEventListener('click', loadDashboard);
  });

  window.loadDashboard = loadDashboard;
})();
