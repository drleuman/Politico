/* Política Canon v0.4.0-alpha.6 — ConfirmDialog (Modal de Acciones Destructivas Accesible & Remediado) */

(function (global) {
  let activeInvoker = null;
  let isProcessing = false;

  function createDialogHTML() {
    if (document.getElementById('confirmDialogOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'confirmDialogOverlay';
    overlay.className = 'dialog-overlay';
    overlay.style.display = 'none';

    const dialog = document.createElement('div');
    dialog.className = 'dialog-box';
    dialog.tabIndex = -1;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'confirmDialogTitle');
    dialog.setAttribute('aria-describedby', 'confirmDialogDesc');

    const header = document.createElement('div');
    header.className = 'dialog-header';
    const title = document.createElement('h3');
    title.id = 'confirmDialogTitle';
    title.textContent = 'Confirmar acción';
    header.appendChild(title);

    const body = document.createElement('div');
    body.className = 'dialog-body';
    body.id = 'confirmDialogDesc';

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.id = 'confirmCancelBtn';
    cancel.className = 'btn-secondary';
    cancel.textContent = 'Cancelar';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.id = 'confirmActionBtn';
    confirm.className = 'btn-danger';
    confirm.textContent = 'Confirmar';
    actions.append(cancel, confirm);
    dialog.append(header, body, actions);
    overlay.appendChild(dialog);

    document.body.appendChild(overlay);

    // M-B07: Event listener para cerrar con Escape (inhabilitado en estado de procesamiento)
    document.addEventListener('keydown', (e) => {
      if (overlay.style.display !== 'none' && e.key === 'Escape') {
        if (isProcessing) return;
        closeConfirmDialog(false);
      }
    });

    // M-B09 & Focus Trap dentro del modal
    overlay.addEventListener('keydown', (e) => {
      if (overlay.style.display === 'none' || e.key !== 'Tab') return;

      // M-B09: Mantenimiento estricto de contención de foco durante procesamiento async
      if (isProcessing) {
        e.preventDefault();
        const dialogBox = overlay.querySelector('.dialog-box');
        if (dialogBox && typeof dialogBox.focus === 'function') {
          dialogBox.focus();
        }
        return;
      }

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

    // M-B07: Cerrar al hacer clic en fondo exterior (inhabilitado en estado de procesamiento)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (isProcessing) return;
        closeConfirmDialog(false);
      }
    });
  }

  function renderDialogBody(descEl, options) {
    descEl.textContent = ''; // H-B02: Limpieza segura sin innerHTML

    // Mensaje principal
    const pMsg = document.createElement('p');
    pMsg.style.marginBottom = '0.5rem';
    pMsg.textContent = options.message || '¿Confirma que desea proceder con esta acción destructiva?';
    descEl.appendChild(pMsg);

    // Contenedor de metadata detallada
    const metaBox = document.createElement('div');
    metaBox.style.fontSize = '0.85rem';

    // Recurso Afectado
    if (options.resource) {
      const pRes = document.createElement('p');
      pRes.style.marginBottom = '0.3rem';
      pRes.style.color = 'var(--color-text-primary)';
      const strong = document.createElement('strong');
      strong.textContent = 'Recurso Afectado: ';
      pRes.appendChild(strong);
      pRes.appendChild(document.createTextNode(options.resource));
      metaBox.appendChild(pRes);
    }

    // Consecuencia
    if (options.consequence) {
      const pCons = document.createElement('p');
      pCons.style.marginBottom = '0.3rem';
      pCons.style.color = 'var(--color-danger)';
      const strong = document.createElement('strong');
      strong.textContent = 'Consecuencia: ';
      pCons.appendChild(strong);
      pCons.appendChild(document.createTextNode(options.consequence));
      metaBox.appendChild(pCons);
    }

    // Alcance / Scope (M-B05)
    if (options.scope) {
      const pScope = document.createElement('p');
      pScope.style.marginBottom = '0.3rem';
      pScope.style.color = 'var(--color-text-secondary)';
      const strong = document.createElement('strong');
      strong.textContent = 'Alcance: ';
      pScope.appendChild(strong);
      pScope.appendChild(document.createTextNode(options.scope));
      metaBox.appendChild(pScope);
    }

    // Reversibilidad (M-B05: soporta options.reversible u options.reversibility)
    const reversibilityVal = options.reversible || options.reversibility;
    if (reversibilityVal) {
      const pRev = document.createElement('p');
      pRev.style.marginBottom = '0.3rem';
      pRev.style.color = 'var(--color-text-muted)';
      const strong = document.createElement('strong');
      strong.textContent = 'Reversibilidad: ';
      pRev.appendChild(strong);
      pRev.appendChild(document.createTextNode(reversibilityVal));
      metaBox.appendChild(pRev);
    }

    descEl.appendChild(metaBox);
  }

  function showConfirmDialog(options) {
    createDialogHTML();

    const overlay = document.getElementById('confirmDialogOverlay');
    const titleEl = document.getElementById('confirmDialogTitle');
    const descEl = document.getElementById('confirmDialogDesc');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    const actionBtn = document.getElementById('confirmActionBtn');

    isProcessing = false;
    activeInvoker = options.invokerEl || document.activeElement;

    titleEl.textContent = options.title || 'Confirmar Acción Destructiva';
    
    // H-B02 / M-B05: Renderizado seguro mediante textContent y construcción de nodos DOM
    renderDialogBody(descEl, options);

    // Limpieza de errores anteriores al abrir modal
    const errBox = document.getElementById('dialogErrorBox');
    if (errBox) {
      errBox.textContent = '';
      errBox.style.display = 'none';
    }

    // M-B08: Garantizar remoción de aria-busy al abrir
    actionBtn.removeAttribute('aria-busy');
    actionBtn.disabled = false;
    cancelBtn.disabled = false;
    actionBtn.textContent = options.confirmText || 'Confirmar';
    cancelBtn.textContent = options.cancelText || 'Cancelar';

    overlay.style.display = 'flex';

    // Foco inicial controlado en el botón seguro (Cancelar)
    cancelBtn.focus();

    cancelBtn.onclick = () => {
      if (isProcessing) return;
      closeConfirmDialog(false);
    };

    actionBtn.onclick = async () => {
      if (isProcessing) return;

      // Limpieza de mensaje de error previo al reintentar
      const staleErrBox = document.getElementById('dialogErrorBox');
      if (staleErrBox) {
        staleErrBox.textContent = '';
        staleErrBox.style.display = 'none';
      }

      if (typeof options.onConfirm === 'function') {
        isProcessing = true;
        actionBtn.disabled = true;
        cancelBtn.disabled = true;
        actionBtn.textContent = 'Procesando...';
        actionBtn.setAttribute('aria-busy', 'true');

        // M-B09: Mover foco a contenedor focusable para no perder contención mientras los botones están disabled
        const dialogBox = overlay.querySelector('.dialog-box');
        if (dialogBox && typeof dialogBox.focus === 'function') {
          dialogBox.focus();
        }

        try {
          await options.onConfirm();
          isProcessing = false;
          actionBtn.removeAttribute('aria-busy'); // M-B08: Remoción en éxito
          closeConfirmDialog(true);
        } catch (err) {
          // M-B06: Mantener diálogo abierto en fallo, restaurar botones y mostrar error accesible
          isProcessing = false;
          actionBtn.disabled = false;
          cancelBtn.disabled = false;
          actionBtn.removeAttribute('aria-busy'); // M-B08: Remoción en fallo
          actionBtn.textContent = options.confirmText || 'Confirmar';

          let errBox = document.getElementById('dialogErrorBox');
          if (!errBox) {
            errBox = document.createElement('div');
            errBox.id = 'dialogErrorBox';
            errBox.className = 'alert alert-error';
            errBox.setAttribute('role', 'alert'); // M-B10: Anuncio automático para lectores de pantalla
            errBox.style.marginTop = '0.75rem';
            descEl.appendChild(errBox);
          }
          errBox.textContent = err.message || 'Error durante la ejecución de la acción.';
          errBox.style.display = 'block';

          // M-B10: Devolver el foco a un elemento navegable (cancelBtn) para no romper el ciclo de focus trap tras fallo
          cancelBtn.focus();
        }
      } else {
        actionBtn.removeAttribute('aria-busy');
        closeConfirmDialog(true);
      }
    };
  }

  function closeConfirmDialog(wasConfirmed) {
    if (isProcessing) return;
    const overlay = document.getElementById('confirmDialogOverlay');
    if (overlay) overlay.style.display = 'none';

    // M-B08: Asegurar que aria-busy se elimine siempre al cerrar
    const actionBtn = document.getElementById('confirmActionBtn');
    if (actionBtn) actionBtn.removeAttribute('aria-busy');

    // Restauración del foco al elemento invocador
    if (activeInvoker && typeof activeInvoker.focus === 'function') {
      activeInvoker.focus();
    }
    activeInvoker = null;
  }

  global.showConfirmDialog = showConfirmDialog;
})(window);
