/* Política Canon v0.4.0-alpha.2 — ConfirmDialog (Modal de Acciones Destructivas Accesible) */

(function (global) {
  let activeInvoker = null;

  function createDialogHTML() {
    if (document.getElementById('confirmDialogOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'confirmDialogOverlay';
    overlay.className = 'dialog-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle" aria-describedby="confirmDialogDesc">
        <div class="dialog-header">
          <h3 id="confirmDialogTitle">Confirmar Acción</h3>
        </div>
        <div class="dialog-body" id="confirmDialogDesc">
          ¿Está seguro de realizar esta acción?
        </div>
        <div class="dialog-actions">
          <button type="button" id="confirmCancelBtn" class="btn-secondary">Cancelar</button>
          <button type="button" id="confirmActionBtn" class="btn-danger">Confirmar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listener para cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (overlay.style.display !== 'none' && e.key === 'Escape') {
        closeConfirmDialog(false);
      }
    });

    // Focus Trap dentro del modal
    overlay.addEventListener('keydown', (e) => {
      if (overlay.style.display === 'none' || e.key !== 'Tab') return;

      const focusable = overlay.querySelectorAll('button:not([disabled])');
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // Cerrar al hacer clic en fondo exterior
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeConfirmDialog(false);
      }
    });
  }

  let onConfirmCallback = null;

  function showConfirmDialog(options) {
    createDialogHTML();

    const overlay = document.getElementById('confirmDialogOverlay');
    const titleEl = document.getElementById('confirmDialogTitle');
    const descEl = document.getElementById('confirmDialogDesc');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    const actionBtn = document.getElementById('confirmActionBtn');

    activeInvoker = options.invokerEl || document.activeElement;

    titleEl.textContent = options.title || 'Confirmar Acción';
    
    // Construcción de descripción detallada (Recurso, Consecuencia, Alcance, Reversibilidad)
    descEl.innerHTML = `
      <p style="margin-bottom:0.5rem;">${options.message || '¿Confirma que desea proceder?'}</p>
      ${options.resource ? `<p style="font-size:0.85rem; color:var(--canon-text-primary); margin-bottom:0.3rem;"><strong>Recurso Afectado:</strong> ${options.resource}</p>` : ''}
      ${options.consequence ? `<p style="font-size:0.85rem; color:var(--canon-state-danger); margin-bottom:0.3rem;"><strong>Consecuencia:</strong> ${options.consequence}</p>` : ''}
      ${options.reversibility ? `<p style="font-size:0.8rem; color:var(--canon-text-muted);"><strong>Reversibilidad:</strong> ${options.reversibility}</p>` : ''}
    `;

    actionBtn.textContent = options.confirmText || 'Confirmar';
    cancelBtn.textContent = options.cancelText || 'Cancelar';

    overlay.style.display = 'flex';

    // Foco inicial controlado en el botón seguro (Cancelar)
    cancelBtn.focus();

    cancelBtn.onclick = () => closeConfirmDialog(false);

    actionBtn.onclick = async () => {
      if (typeof options.onConfirm === 'function') {
        actionBtn.disabled = true;
        cancelBtn.disabled = true;
        actionBtn.textContent = 'Procesando...';
        try {
          await options.onConfirm();
        } finally {
          actionBtn.disabled = false;
          cancelBtn.disabled = false;
          closeConfirmDialog(true);
        }
      } else {
        closeConfirmDialog(true);
      }
    };
  }

  function closeConfirmDialog(wasConfirmed) {
    const overlay = document.getElementById('confirmDialogOverlay');
    if (overlay) overlay.style.display = 'none';

    // Restauración del foco al elemento invocador
    if (activeInvoker && typeof activeInvoker.focus === 'function') {
      activeInvoker.focus();
    }
    activeInvoker = null;
  }

  global.showConfirmDialog = showConfirmDialog;
})(window);
