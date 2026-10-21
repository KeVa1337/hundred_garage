/* Shared UI helpers: formatting, icons, modal, toasts. */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Math.round(n || 0).toLocaleString('uk-UA').replace(/,/g, ' ') + ' ₴';
  const num = n => Math.round(n || 0).toLocaleString('uk-UA');
  const MONTHS = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'серп', 'вер', 'жовт', 'лист', 'груд'];
  const MONTHS_FULL = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  const WD = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const fmtDay = (s, full) => {
    const d = typeof s === 'string' && s.length === 10 ? parseDay(s) : new Date(s);
    const today = Store.dayStr(0), tmr = Store.dayStr(1), yst = Store.dayStr(-1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!full && key === today) return 'сьогодні';
    if (!full && key === tmr) return 'завтра';
    if (!full && key === yst) return 'вчора';
    return `${d.getDate()} ${(full ? MONTHS_FULL : MONTHS)[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
  };
  const fmtTime = iso => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const fmtStamp = iso => `${fmtDay(iso)}, ${fmtTime(iso)}`;
  const fmtPhone = p => {
    const d = String(p).replace(/\D/g, '');
    if (d.length !== 12) return p;
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  };
  const dur = m => m >= 60 ? `${Math.floor(m / 60)} год${m % 60 ? ' ' + (m % 60) + ' хв' : ''}` : `${m} хв`;
  const initials = name => String(name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };

  const P = {
    scan: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M7 12h3l2-4 2 8 2-4h1"/>',
    oil: '<path d="M3 11h4l2-3h6l5 3-6 6H5a2 2 0 0 1-2-2z"/><path d="M9 8V5h4"/><path d="M20 16c0 1.1-.9 2-2 2"/>',
    susp: '<path d="M12 3v3M12 18v3"/><path d="M8 6h8l-6 3 6 3-6 3 6 3H8"/>',
    brake: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M5.5 7.5a8 8 0 0 1 4-3.3"/>',
    engine: '<path d="M4 10h2V8h3V6h5v2h3l2 3h1v5h-1l-2 3H9l-2-2H4z"/>',
    bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    tire: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
    snow: '<path d="M12 2v20M4.9 6.9l14.2 10.2M19.1 6.9 4.9 17.1"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
    align: '<path d="M4 6h4v12H4zM16 6h4v12h-4z"/><path d="M8 12h8M12 4v16" stroke-dasharray="2 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    car: '<path d="M3 15v-3l2-5h14l2 5v3"/><path d="M3 15h18v3H3z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    wrench: '<path d="M15 4a5 5 0 0 0-5 6L3 17l4 4 7-7a5 5 0 0 0 6-5l-3 3-3-1-1-3z"/>',
    gift: '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0"/>',
    home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-4-6.3"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    camera: '<path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    coffee: '<path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 10h1a2 2 0 0 1 0 4h-1M8 3v3M12 3v3"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    phone: '<path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    board: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'
  };
  const icon = (name, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] || ''}</svg>`;

  const statusPill = id => { const s = Store.status(id); return `<span class="pill ${s.tone}">${esc(s.short)}</span>`; };
  const plate = p => `<span class="plate">${esc(p)}</span>`;
  const stars = r => '★★★★★'.slice(0, Math.round(r)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(r));
  const odometer = km => {
    const s = String(Math.round(km)).padStart(6, '0');
    return `<span class="odo" aria-label="${num(km)} км">${s.split('').map(c => `<i>${c}</i>`).join('')}<em>км</em></span>`;
  };
  const carName = c => c ? `${c.make} ${c.model}` : '—';

  function toast(text, kind = '') {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(() => el.remove(), 3600);
  }

  let modalClose = null;
  let returnFocus = null;
  function modal({ title, body, foot = '', wide = false, onClose = null }) {
    const root = document.getElementById('modal-root');
    // re-rendering an open dialog (after an edit) must not replay the open animation
    const still = root.innerHTML ? 'still' : '';
    if (still) { root.innerHTML = ''; modalClose = null; } else { closeModal(); returnFocus = document.activeElement; }
    document.documentElement.classList.add('modal-open');
    root.innerHTML = `<div class="modal-bg ${still}" data-act="modal-bg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-act="modal-close" aria-label="Закрити">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`;
    modalClose = onClose;
    const first = root.querySelector('input, select, textarea, button:not([data-act="modal-close"])');
    if (!still && first && !matchMedia('(max-width: 600px)').matches) first.focus();
  }
  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root && root.innerHTML) {
      root.innerHTML = '';
      document.documentElement.classList.remove('modal-open');
      const f = modalClose; modalClose = null; if (f) f();
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    }
  }
  // keep Tab inside an open dialog
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Tab') return;
    const m = document.querySelector('#modal-root .modal');
    if (!m) return;
    const f = [...m.querySelectorAll('button, [href], input, select, textarea, summary')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && (document.activeElement === last || !m.contains(document.activeElement))) { ev.preventDefault(); first.focus(); }
  });
  const modalOpen = () => !!document.getElementById('modal-root').innerHTML;

  // Inspection photo: thumbnail that opens full size
  const photoThumb = it => it.photo ? `<button class="ph-thumb" data-act="photo-view" data-src="${esc(it.photo)}" aria-label="Фото: ${esc(it.name)}"><img src="${esc(it.photo)}" alt=""></button>` : '';
  // Shrink a phone photo before storing it (max 720px, JPEG)
  function compressImage(file, max = 720) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = reject;
      r.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', .72));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  window.UI = { esc, money, num, fmtDay, fmtTime, fmtStamp, fmtPhone, dur, initials, plural, icon, statusPill, plate, stars, odometer, carName, toast, modal, closeModal, modalOpen, parseDay, WD, MONTHS, photoThumb, compressImage };
})();
