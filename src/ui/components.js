import { t } from '../i18n/index.js';
import { sfx } from '../audio/sfx.js';

/**
 * Applies a style object to a CSSStyleDeclaration (or anything shaped like
 * one). Split out from `el()` so the one non-obvious part of it — that CSS
 * custom properties need `setProperty()`, since plain assignment silently
 * no-ops for them — is unit-testable without a real DOM.
 */
export function applyInlineStyle(style, props) {
  for (const [prop, value] of Object.entries(props)) {
    if (prop.startsWith('--')) style.setProperty(prop, value);
    else style[prop] = value;
  }
}

/** Tiny DOM builder: el('div.card', {onclick}, 'text', childNode) */
export function el(spec, props = {}, ...children) {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = `${node.className} ${value}`.trim();
    else if (key === 'style' && typeof value === 'object') applyInlineStyle(node.style, value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else if (key in node && key !== 'list') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }

  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function button(label, onClick, options = {}) {
  const { variant = '', silent = false, ...rest } = options;
  return el(
    `button.btn${variant ? `.${variant.split(' ').join('.')}` : ''}`,
    {
      type: 'button',
      onclick: (event) => {
        if (!silent) sfx.click();
        onClick?.(event);
      },
      ...rest,
    },
    label,
  );
}

export function stars(count, total = 3) {
  const node = el('span.stars');
  for (let i = 0; i < total; i++) {
    node.append(el('span', { class: i < count ? '' : 'off' }, '★'));
  }
  return node;
}

export function stat(label, value, options = {}) {
  return el('div.stat', { class: options.over ? 'over' : '' }, `${label}`, el('b', {}, value));
}

let toastTimer = null;
export function toast(message) {
  document.querySelector('.toast')?.remove();
  const node = el('div.toast', {}, message);
  document.body.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 2400);
}

/** Promise-based confirm rendered in-app, so it matches the game's look. */
export function confirmDialog(host, message) {
  return new Promise((resolve) => {
    const close = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(false);
      }
    };

    const overlay = el(
      'div.overlay',
      {},
      el(
        'div.panel',
        {},
        el('h2', {}, t('confirm')),
        el('p', { style: { color: 'var(--text-dim)', marginBottom: '20px' } }, message),
        el(
          'div.panel-actions',
          {},
          button(t('confirm'), () => close(true), { variant: 'primary danger' }),
          button(t('cancel'), () => close(false), { variant: 'ghost' }),
        ),
      ),
    );

    document.addEventListener('keydown', onKey, true);
    host.append(overlay);
  });
}

/** In-app text prompt; native prompt() is blocked in some embedded contexts. */
export function promptDialog(host, label, initial = '') {
  return new Promise((resolve) => {
    const input = el('input', { type: 'text', value: initial, style: { width: '100%' } });

    const close = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      resolve(value);
    };
    const submit = () => close(input.value.trim() || null);
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(null);
      } else if (event.key === 'Enter') {
        event.stopPropagation();
        submit();
      }
    };

    const overlay = el(
      'div.overlay',
      {},
      el(
        'div.panel',
        {},
        el('h2', {}, label),
        el('div', { style: { margin: '16px 0 20px' } }, input),
        el(
          'div.panel-actions',
          {},
          button(t('confirm'), submit, { variant: 'primary' }),
          button(t('cancel'), () => close(null), { variant: 'ghost' }),
        ),
      ),
    );

    document.addEventListener('keydown', onKey, true);
    host.append(overlay);
    input.focus();
    input.select();
  });
}

export function topbar(title, ...actions) {
  return el(
    'header.topbar',
    {},
    el('span.brand', {}, 'KINETIK'),
    title ? el('h2', {}, title) : null,
    el('div.spacer'),
    ...actions,
  );
}

/** Renders a single tile or entity into a small canvas, for legends and tools. */
export function tileSwatch(drawFn, size = 30) {
  const canvas = el('canvas', { width: size * 2, height: size * 2 });
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, size, size);
  drawFn(ctx, size);
  return canvas;
}
