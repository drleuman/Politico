/* Política Canon v0.4.0-alpha.5 — EmptyState Component (Estados Vacíos Accesibles para Tablas & Paneles) */

(function (global) {
  function renderEmptyState(targetContainer, options) {
    if (!targetContainer) return;

    targetContainer.textContent = ''; // Limpieza segura

    const opts = options || {};
    const title = opts.title || 'No hay registros disponibles';
    const description = opts.description || 'No se encontraron datos para mostrar en esta sección.';
    const icon = opts.icon || '📂';
    const colspan = opts.colspan || 5;

    const isTableBody = targetContainer.tagName.toLowerCase() === 'tbody';

    let wrapper;
    if (isTableBody) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = colspan;
      td.className = 'empty-state-cell';
      tr.appendChild(td);
      wrapper = td;
      targetContainer.appendChild(tr);
    } else {
      wrapper = targetContainer;
    }

    const box = document.createElement('div');
    box.className = 'empty-state-box';

    const iconEl = document.createElement('div');
    iconEl.className = 'empty-state-icon';
    iconEl.textContent = icon;
    iconEl.setAttribute('aria-hidden', 'true');
    box.appendChild(iconEl);

    const titleEl = document.createElement('h4');
    titleEl.className = 'empty-state-title';
    titleEl.textContent = title;
    box.appendChild(titleEl);

    const descEl = document.createElement('p');
    descEl.className = 'empty-state-desc';
    descEl.textContent = description;
    box.appendChild(descEl);

    wrapper.appendChild(box);
  }

  // M-C03: Estado de Error diferenciado (API fail ≠ empty data)
  function renderErrorState(targetContainer, options) {
    if (!targetContainer) return;

    targetContainer.textContent = ''; // Limpieza segura

    const opts = options || {};
    const title = opts.title || 'No se pudieron cargar los datos';
    const description = opts.description || 'Ocurrió un error al conectar con el servidor. Inténtalo de nuevo.';
    const icon = opts.icon || '⚠';
    const colspan = opts.colspan || 5;

    const isTableBody = targetContainer.tagName.toLowerCase() === 'tbody';

    let wrapper;
    if (isTableBody) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = colspan;
      td.className = 'empty-state-cell';
      tr.appendChild(td);
      wrapper = td;
      targetContainer.appendChild(tr);
    } else {
      wrapper = targetContainer;
    }

    const box = document.createElement('div');
    box.className = 'empty-state-box error-state-box';

    const iconEl = document.createElement('div');
    iconEl.className = 'empty-state-icon';
    iconEl.textContent = icon;
    iconEl.setAttribute('aria-hidden', 'true');
    box.appendChild(iconEl);

    const titleEl = document.createElement('h4');
    titleEl.className = 'empty-state-title';
    titleEl.textContent = title;
    box.appendChild(titleEl);

    const descEl = document.createElement('p');
    descEl.className = 'empty-state-desc';
    descEl.textContent = description;
    box.appendChild(descEl);

    wrapper.appendChild(box);
  }

  global.renderEmptyState = renderEmptyState;
  global.renderErrorState = renderErrorState;
})(window);
