/* Política Canon v0.4.0-alpha.5 — Toast Component (Notificaciones Contextuales Accesibles WAI-ARIA) */

(function (global) {
  function createToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      container.setAttribute('aria-label', 'Notificaciones del sistema');
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(options) {
    const container = createToastContainer();

    const message = typeof options === 'string' ? options : (options.message || 'Notificación del sistema');
    const type = options.type || 'info'; // info, success, warning, danger

    // M-C02: Duración diferenciada por severidad
    // danger = 0 (persistente, cierre manual obligatorio)
    // warning = 8000ms (duración extendida)
    // info/success = 4000ms (auto-dismiss estándar)
    const defaultDuration =
      type === 'danger'  ? 0 :
      type === 'warning' ? 8000 :
      4000;
    const duration = options.duration !== undefined ? options.duration : defaultDuration;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Configuración ARIA según severidad
    if (type === 'danger') {
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'assertive');
    } else {
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
    }

    // Icono discreto según estado
    const iconEl = document.createElement('span');
    iconEl.className = 'toast-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    if (type === 'success') iconEl.textContent = '✓';
    else if (type === 'danger') iconEl.textContent = '⚠';
    else if (type === 'warning') iconEl.textContent = '!';
    else iconEl.textContent = 'ℹ';
    toast.appendChild(iconEl);

    // Mensaje de texto (Construcción segura libre de XSS)
    const textEl = document.createElement('span');
    textEl.className = 'toast-message';
    textEl.textContent = message;
    toast.appendChild(textEl);

    // Botón de cierre manual opcional
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close-btn';
    closeBtn.setAttribute('aria-label', 'Cerrar notificación');
    closeBtn.textContent = '×';
    closeBtn.onclick = () => {
      dismissToast(toast);
    };
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
      toast.classList.add('toast-show');
    });

    // Auto-cierre
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(toast);
      }, duration);
    }
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  }

  global.showToast = showToast;
})(window);
