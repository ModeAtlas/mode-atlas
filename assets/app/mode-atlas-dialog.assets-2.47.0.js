(function ModeAtlasDialogOwner(root){
  'use strict';
  if (root.ModeAtlasDialog) return;

  let active = null;
  const queue = [];

  function create(tag, className, text){
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function ensureShell(){
    let layer = document.querySelector('[data-ma-dialog-layer]');
    if (layer) return layer;

    layer = create('div', 'ma-dialog-layer');
    layer.dataset.maDialogLayer = '';
    layer.hidden = true;

    const backdrop = create('div', 'ma-dialog-backdrop');
    backdrop.dataset.maDialogBackdrop = '';

    const panel = create('section', 'ma-dialog');
    panel.dataset.maDialogPanel = '';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('tabindex', '-1');

    const head = create('div', 'ma-dialog__head');
    const heading = create('div', 'ma-dialog__heading');
    const kicker = create('div', 'ma-dialog__kicker', 'Mode Atlas');
    kicker.dataset.maDialogKicker = '';
    const title = create('h2', 'ma-dialog__title');
    title.id = 'maDialogTitle';
    title.dataset.maDialogTitle = '';
    heading.append(kicker, title);

    const close = create('button', 'ma-button ma-button--small ma-button--ghost ma-dialog__close', 'Close');
    close.type = 'button';
    close.dataset.maDialogCancel = '';
    close.setAttribute('aria-label', 'Close dialog');
    head.append(heading, close);

    const message = create('p', 'ma-dialog__message');
    message.id = 'maDialogMessage';
    message.dataset.maDialogMessage = '';
    const content = create('div', 'ma-dialog__content');
    content.dataset.maDialogContent = '';
    const actions = create('div', 'ma-dialog__actions');
    actions.dataset.maDialogActions = '';

    panel.setAttribute('aria-labelledby', title.id);
    panel.append(head, message, content, actions);
    layer.append(backdrop, panel);
    document.body.appendChild(layer);
    return layer;
  }

  function normalizeOptions(input, kind){
    const opts = typeof input === 'string' ? { message: input } : { ...(input || {}) };
    opts.kind = kind || opts.kind || 'alert';
    opts.title = opts.title || (opts.kind === 'confirm' ? 'Confirm action' : 'Mode Atlas');
    opts.message = opts.message || '';
    opts.kicker = opts.kicker || 'Mode Atlas';
    opts.tone = ['info', 'success', 'warning', 'error', 'danger'].includes(opts.tone) ? opts.tone : 'info';
    opts.confirmLabel = opts.confirmLabel || (opts.kind === 'confirm' ? 'Continue' : 'OK');
    opts.hideActions = opts.kind === 'feature' ? true : opts.hideActions === true;
    opts.size = ['wide', 'large'].includes(opts.size) ? opts.size : (opts.wide === true ? 'wide' : 'default');
    opts.cancelLabel = opts.cancelLabel || 'Cancel';
    opts.closeLabel = opts.closeLabel || 'Close';
    opts.closeAriaLabel = opts.closeAriaLabel || 'Close dialog';
    opts.closeIcon = opts.closeIcon === true;
    opts.dismissOnBackdrop = opts.dismissOnBackdrop !== false;
    return opts;
  }

  function focusables(panel){
    return Array.from(panel.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true' && el.getClientRects().length > 0);
  }

  function settle(value){
    if (!active) return;
    const current = active;
    active = null;
    const { layer, previousFocus, previousOverflow, onKeydown, resolve } = current;
    document.removeEventListener('keydown', onKeydown, true);
    layer.classList.remove('is-open');
    layer.hidden = true;
    document.body.style.overflow = previousOverflow;
    const content = layer.querySelector('[data-ma-dialog-content]');
    if (content) content.replaceChildren();
    try { previousFocus?.focus?.({ preventScroll: true }); } catch {}
    resolve(value);
    queueMicrotask(showNext);
  }

  function showNext(){
    if (active || !queue.length || !document.body) return;
    const request = queue.shift();
    const opts = request.options;
    const layer = ensureShell();
    const panel = layer.querySelector('[data-ma-dialog-panel]');
    const kicker = layer.querySelector('[data-ma-dialog-kicker]');
    const title = layer.querySelector('[data-ma-dialog-title]');
    const message = layer.querySelector('[data-ma-dialog-message]');
    const content = layer.querySelector('[data-ma-dialog-content]');
    const actions = layer.querySelector('[data-ma-dialog-actions]');
    const close = layer.querySelector('.ma-dialog__close');

    layer.dataset.tone = opts.tone;
    panel.classList.toggle('ma-dialog--wide', opts.size === 'wide');
    panel.classList.toggle('ma-dialog--large', opts.size === 'large');
    kicker.textContent = opts.kicker;
    title.textContent = opts.title;
    message.textContent = opts.message;
    message.hidden = !opts.message;
    if (opts.message) panel.setAttribute('aria-describedby', message.id);
    else panel.removeAttribute('aria-describedby');
    content.replaceChildren();
    content.hidden = !opts.contentNode;
    if (opts.contentNode) content.appendChild(opts.contentNode);
    actions.replaceChildren();

    const cancel = !opts.hideActions && opts.kind === 'confirm'
      ? create('button', 'ma-button ma-button--ghost', opts.cancelLabel)
      : null;
    if (cancel) {
      cancel.type = 'button';
      cancel.dataset.maDialogCancel = '';
      actions.appendChild(cancel);
    }

    let confirm = null;
    if (!opts.hideActions) {
      const confirmClass = opts.tone === 'danger' || opts.tone === 'error'
        ? 'ma-button ma-button--danger'
        : 'ma-button ma-button--primary';
      confirm = create('button', confirmClass, opts.confirmLabel);
      confirm.type = 'button';
      confirm.dataset.maDialogConfirm = '';
      actions.appendChild(confirm);
    }
    actions.hidden = opts.hideActions;

    close.textContent = opts.closeLabel;
    close.setAttribute('aria-label', opts.closeAriaLabel);
    close.classList.toggle('ma-dialog__close--icon', opts.closeIcon);
    close.hidden = opts.hideClose === true;
    layer.hidden = false;
    requestAnimationFrame(() => layer.classList.add('is-open'));

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeydown = (event) => {
      if (!active) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        settle(opts.kind === 'confirm' ? false : true);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables(panel);
      if (!items.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    active = { ...request, layer, previousFocus, previousOverflow, onKeydown };
    document.addEventListener('keydown', onKeydown, true);

    layer.onclick = (event) => {
      if (event.target.closest('[data-ma-dialog-confirm]')) {
        settle(true);
        return;
      }
      if (event.target.closest('[data-ma-dialog-cancel]')) {
        settle(opts.kind === 'confirm' ? false : true);
        return;
      }
      if (opts.dismissOnBackdrop && event.target.matches('[data-ma-dialog-backdrop]')) {
        settle(opts.kind === 'confirm' ? false : true);
      }
    };

    requestAnimationFrame(() => {
      const preferred = opts.kind === 'feature' ? close : (opts.kind === 'confirm' && opts.tone === 'danger' ? cancel : confirm);
      try { (preferred || confirm || close || panel).focus({ preventScroll: true }); } catch {}
    });
  }

  function enqueue(input, kind){
    const options = normalizeOptions(input, kind);
    return new Promise((resolve) => {
      queue.push({ options, resolve });
      showNext();
    });
  }

  root.ModeAtlasDialog = Object.freeze({
    alert(input){ return enqueue(input, 'alert'); },
    confirm(input){ return enqueue(input, 'confirm'); },
    open(input){ return enqueue(input, input?.kind || 'alert'); },
    feature(input){ return enqueue(input, 'feature'); },
    close(value = true){ if (active) settle(value); },
    isOpen(){ return !!active; }
  });
})(window);
