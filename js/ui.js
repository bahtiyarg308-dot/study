// Общие кирпичики интерфейса: иконки, всплывашка, шторки, оформление. Язык дизайна — как в «Подходе».
import * as St from './store.js';
import { sfx } from './sfx.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ic = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
export const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };

const SYMBOLS = {
  today: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  radar: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r=".9" fill="currentColor"/><circle cx="4.5" cy="12" r=".9" fill="currentColor"/><circle cx="4.5" cy="17.5" r=".9" fill="currentColor"/>',
  note: '<path d="M6 3.5h9l4 4V20.5H6zM14.5 3.5v4.5H19M9 12.5h7M9 16h7"/>',
  more: '<circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/>',
  spark: '<path d="M11 3.5l1.9 5.6 5.6 1.9-5.6 1.9L11 18.5l-1.9-5.6L3.5 11l5.6-1.9z"/><path d="M19 15.5v4M17 17.5h4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  chev: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  back: '<path d="M15 5.5L8.5 12l6.5 6.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 20h14"/>',
  db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  shield: '<path d="M12 3.5l7 2.5v5.5c0 4.2-3 7.3-7 9-4-1.7-7-4.8-7-9V6z"/><path d="M9 12l2.2 2.2L15.2 10"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  copy: '<rect x="8" y="8" width="11.5" height="11.5" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
};
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${Object.entries(SYMBOLS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</defs></svg>`);

/* ───────── оформление: четыре темы + акцент ───────── */
// [на светлом, на тёмном, текст на светлом, текст на тёмном, название] — таблицы из «Подхода»
export const COLORS = {
  lime: ['#5C9A00', '#C5F23A', '#0F1A00', '#132000', 'Лайм'], green: ['#12935C', '#3EDC8F', '#FFFFFF', '#04170D', 'Зелёный'], mint: ['#0F8F6B', '#6EE7B7', '#FFFFFF', '#022C22', 'Мятный'],
  teal: ['#0B8A86', '#2ED3CC', '#FFFFFF', '#00201E', 'Бирюзовый'], sky: ['#0B7FC0', '#4CC3FF', '#FFFFFF', '#00192B', 'Голубой'], blue: ['#2450E8', '#6F8BFF', '#FFFFFF', '#050A1F', 'Синий'],
  violet: ['#6C3CE0', '#A88BFF', '#FFFFFF', '#0E0624', 'Фиолетовый'], fuchsia: ['#B21FB8', '#F07CFF', '#FFFFFF', '#2A0530', 'Фуксия'], pink: ['#D02F74', '#FF6FAE', '#FFFFFF', '#240414', 'Розовый'],
  red: ['#D42A3C', '#FF4D5E', '#FFFFFF', '#1A0306', 'Красный'], coral: ['#D4472F', '#FF8A70', '#FFFFFF', '#2A0A04', 'Коралловый'], orange: ['#D9530C', '#FF7A2E', '#FFFFFF', '#1F0B00', 'Оранжевый'],
  amber: ['#B86E00', '#FFB020', '#FFFFFF', '#241500', 'Янтарный'], yellow: ['#E9B300', '#FFD23F', '#1A1400', '#1A1400', 'Жёлтый'], sand: ['#8C6E46', '#E3C79A', '#FFFFFF', '#241A0C', 'Песочный'], mono: ['#1E1F22', '#F1F1EE', '#FFFFFF', '#0D0E10', 'Графит'],
};
export const NOIR_ACC = {
  bone: ['#1E1F22', '#E9E7E2', '#FFFFFF', '#0B0B0C', 'Кость'], blood: ['#8E2F2A', '#C4564F', '#FFFFFF', '#1A0807', 'Кровь'], brass: ['#7A6430', '#C2A86C', '#FFFFFF', '#16110A', 'Латунь'],
  steel: ['#44607F', '#8DA6C4', '#FFFFFF', '#0A1118', 'Сталь'], moss: ['#476B44', '#8DB08A', '#FFFFFF', '#0A140A', 'Мох'], violet: ['#5B4A7E', '#A593C8', '#FFFFFF', '#100C18', 'Аметист'], ash: ['#55534F', '#8C8A85', '#FFFFFF', '#0E0E0D', 'Пепел'],
};
export const THEMES = {
  mrak: { look: 'noir', mode: 'dark', name: 'Мрак', desc: 'По умолчанию' },
  noch: { look: 'color', mode: 'dark', name: 'Ночь', desc: 'Тёмная, с цветом' },
  bumaga: { look: 'noir', mode: 'light', name: 'Бумага', desc: 'Светлая, спокойная' },
  pastel: { look: 'color', mode: 'light', name: 'Пастель', desc: 'Светлая, с цветом' },
};
export const accOf = (look, s = St.settings()) => (look === 'noir' ? NOIR_ACC[s.noirAcc] || NOIR_ACC.bone : COLORS[s.accent] || COLORS.lime);
export const themeId = (s = St.settings()) => { if (s.auto) { const h = new Date().getHours(); return h >= 20 || h < 7 ? 'mrak' : 'bumaga'; } return THEMES[s.theme] ? s.theme : 'mrak'; };
export function applyAppearance() {
  const s = St.settings(), th = THEMES[themeId(s)], r = document.documentElement, c = accOf(th.look, s);
  if (r.dataset.look !== th.look) r.dataset.look = th.look;
  if (r.dataset.theme !== th.mode) r.dataset.theme = th.mode;
  r.dataset.calm = String(!!s.calm);
  const st = r.style; st.setProperty('--acc-l', c[0]); st.setProperty('--acc-d', c[1]); st.setProperty('--acc-ink-l', c[2]); st.setProperty('--acc-ink-d', c[3]);
  const bg = getComputedStyle(r).getPropertyValue('--bg').trim();
  $('meta[name=theme-color]')?.setAttribute('content', bg || '#070708');
}

/* ───────── всплывашка сверху ───────── */
let toastT = 0;
export function toast(text, action = null) {
  const root = $('#toast-root'); clearTimeout(toastT);
  root.innerHTML = `<div class="toast" role="status"><span>${esc(text)}</span>${action ? `<button class="btn btn-sm" data-act="${action.act}" data-id="${esc(action.id || '')}">${esc(action.label)}</button>` : ''}</div>`;
  toastT = setTimeout(() => { const t = root.firstElementChild; if (!t) return; t.classList.add('out'); setTimeout(() => { root.innerHTML = ''; }, 220); }, action ? 7000 : 3000);
}

/* ───────── шторки ───────── */
export function openSheet({ eyebrow = '', title = '', body = '', foot = '', cls = '', onOpen = null } = {}) {
  closeSheet(true);
  const root = $('#sheet-root');
  root.innerHTML = `<div class="scrim" data-act="close"></div><div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grab"></div>
    <div class="sheet-head"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h2>${title}</h2></div><button class="icon-btn" data-act="close" aria-label="Закрыть">${ic('close')}</button></div>
    <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div>`;
  root.classList.remove('closing'); sfx('open');
  const sh = $('.sheet', root); onOpen?.(sh); return sh;
}
export function closeSheet(instant) {
  const root = $('#sheet-root'); if (!root.firstElementChild) return;
  if (instant) { root.innerHTML = ''; root.classList.remove('closing'); return; }
  root.classList.add('closing'); sfx('close'); setTimeout(() => { if (root.classList.contains('closing')) { root.innerHTML = ''; root.classList.remove('closing'); } }, 240);
}
export const sheetEl = () => $('#sheet-root .sheet');
