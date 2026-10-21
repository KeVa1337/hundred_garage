/* Admin panel: dashboard & bay schedule, orders, clients & bonuses, services, chat inbox, reviews, loyalty settings. */
(function () {
  const { esc, money, num, icon, fmtDay, fmtStamp, fmtTime, dur, plural, toast, modal, closeModal, statusPill, plate, carName, initials, WD, parseDay } = UI;
  const S = () => Store.db;
  const FLOW = Store.FLOW;
  const IN_WORK = ['accepted', 'diagnostics', 'approval', 'parts', 'repair', 'qc'];

  const orderDur = o => o.services.reduce((s, id) => s + (Store.service(id)?.dur || 30), 0);

  const partsTodo = () => S().orders.filter(o => !['done', 'cancelled'].includes(o.status)).reduce((n, o) => n + (o.parts || []).filter(l => ['request', 'to_order'].includes(l.status)).length, 0);
  function shell(active, content) {
    const newCnt = S().orders.filter(o => o.status === 'new').length;
    const unread = S().chats.reduce((s, c) => s + (c.unreadAdmin || 0), 0);
    const pend = S().reviews.filter(r => r.status === 'pending').length;
    const link = (r, ic, t, cnt) => `<a href="#${r}" class="${active === r ? 'on' : ''}">${icon(ic)}${t}${cnt ? `<span class="cnt">${cnt}</span>` : ''}</a>`;
    return `<div class="wrap shell" style="--maxw:1400px">
      <nav class="side" aria-label="Адмін-панель">
        <div class="side-head"><span class="eyebrow">Hundred Garage</span><b>Адмін-панель</b><span class="small muted">Андрій · адміністратор</span></div>
        ${link('admin', 'board', 'Панель')}
        ${link('admin-orders', 'list', 'Замовлення', newCnt)}
        ${link('admin-parts', 'truck', 'Запчастини', partsTodo())}
        ${link('admin-staff', 'wrench', 'Майстри')}
        ${link('admin-clients', 'users', 'Клієнти')}
        ${link('admin-services', 'wrench', 'Послуги і ціни')}
        ${link('admin-chat', 'chat', 'Чат', unread)}
        ${link('admin-reviews', 'star', 'Відгуки', pend)}
        ${link('admin-loyalty', 'gift', 'Бонуси і акції')}
        <button class="sl" data-act="demo-role" data-role="guest">${icon('logout')}Вийти</button>
      </nav>
      <div class="fade-in" style="min-width:0">${content}</div>
    </div>`;
  }

  // ---------- Revenue chart (single series, hover tooltip) ----------
  function revenueSeries(days) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = Store.dayStr(-i);
      out.push({ d, v: S().orders.filter(o => o.status === 'done' && o.date === d).reduce((s, o) => s + o.total, 0) });
    }
    return out;
  }
  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function revenueChart(series) {
    const W = 640, H = 220, L = 52, R = 8, T = 12, B = 28;
    const max = niceMax(Math.max(...series.map(s => s.v)) * 1.05);
    const band = (W - L - R) / series.length;
    const bw = Math.max(6, band - 2 - band * .3);
    const y = v => T + (H - T - B) * (1 - v / max);
    const ticks = [0, max / 2, max];
    const grid = ticks.map(t => `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis-t" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t >= 1000 ? Math.round(t / 1000) + 'k' : t}</text>`).join('');
    const bars = series.map((s, i) => {
      const x = L + i * band + (band - bw) / 2;
      const top = y(s.v), base = y(0), r = Math.min(4, (base - top) / 2);
      const path = s.v > 0 ? `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z` : '';
      const dt = parseDay(s.d);
      const lbl = i % 2 === (series.length - 1) % 2 ? `<text class="axis-t" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${dt.getDate()}</text>` : '';
      return `<g><rect class="hit" x="${L + i * band}" y="${T}" width="${band}" height="${H - T - B}" data-tip="${WD[dt.getDay()]}, ${fmtDay(s.d, true)} · ${money(s.v)}"/>${path ? `<path class="bar-m ${i === series.length - 1 ? 'last' : ''}" d="${path}"/>` : ''}${lbl}</g>`;
    }).join('');
    return `<div class="chart" id="rev-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Виручка по днях за ${series.length} днів">${grid}${bars}<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--steel)"/></svg><div class="tip" hidden></div></div>`;
  }
  function mountChart() {
    const box = document.getElementById('rev-chart');
    if (!box) return;
    const tip = box.querySelector('.tip');
    box.addEventListener('mousemove', ev => {
      const t = ev.target.closest('[data-tip]');
      if (!t) { tip.hidden = true; return; }
      const r = box.getBoundingClientRect(), tr = t.getBoundingClientRect();
      tip.hidden = false;
      tip.textContent = t.dataset.tip;
      tip.style.left = Math.min(Math.max(tr.left - r.left + tr.width / 2, 90), r.width - 90) + 'px';
      tip.style.top = (ev.clientY - r.top) + 'px';
    });
    box.addEventListener('mouseleave', () => { tip.hidden = true; });
  }

  // ---------- Bay schedule ----------
  function schedule(day) {
    const orders = S().orders.filter(o => o.date === day && o.status !== 'cancelled');
    const H0 = 9, H1 = 19;
    const hours = [];
    for (let h = H0; h < H1; h++) hours.push(h);
    return `<div class="sched"><div class="sched-grid">
      <div class="h" style="border-left:0">Пост</div>${hours.map(h => `<div class="h">${String(h).padStart(2, '0')}:00</div>`).join('')}
      ${S().bays.map(b => {
        const list = orders.filter(o => o.bay === b.id);
        const load = Math.min(100, Math.round(list.reduce((s, o) => s + orderDur(o), 0) / ((H1 - H0) * 60) * 100));
        return `<div class="bayl">${esc(b.name)}<small>${esc(b.kind)} · ${load}%</small></div>
        <div class="sched-row">${list.map(o => {
          const [hh, mm] = o.time.split(':').map(Number);
          const start = Math.max(1, (hh - H0) * 2 + (mm >= 30 ? 1 : 0) + 1);
          const span = Math.max(2, Math.min(21 - start, Math.ceil(orderDur(o) / 30)));
          const car = Store.car(o.carId);
          return `<button class="blk st-${o.status}" style="grid-column:${start} / span ${span}" data-act="adm-order" data-id="${o.id}" title="${esc(o.id)} · ${esc(Store.status(o.status).name)}"><b>${esc(carName(car))}</b><span>${o.time} · ${esc(Store.status(o.status).short)}</span></button>`;
        }).join('')}</div>`;
      }).join('')}
    </div></div>`;
  }

  App.route('admin', {
    area: 'admin', title: 'Панель',
    render() {
      const day = App.state.admDay || Store.dayStr(0);
      const today = Store.dayStr(0);
      const todays = S().orders.filter(o => o.date === today && o.status !== 'cancelled');
      const inWork = S().orders.filter(o => IN_WORK.includes(o.status));
      const newOnes = S().orders.filter(o => o.status === 'new').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      const done30 = S().orders.filter(o => o.status === 'done' && o.date >= Store.dayStr(-30) && o.date <= today);
      const donePrev = S().orders.filter(o => o.status === 'done' && o.date >= Store.dayStr(-60) && o.date < Store.dayStr(-30));
      const rev = done30.reduce((s, o) => s + o.total, 0);
      const revPrev = donePrev.reduce((s, o) => s + o.total, 0);
      const avg = done30.length ? rev / done30.length : 0;
      const delta = revPrev ? Math.round((rev - revPrev) / revPrev * 100) : null;
      const loadToday = Math.round(todays.reduce((s, o) => s + orderDur(o), 0) / (S().bays.length * 10 * 60) * 100);
      const ready = S().orders.filter(o => o.status === 'ready').length;
      const approval = S().orders.filter(o => o.status === 'approval').length;
      // service mix by category, last 30 days
      const mix = {};
      done30.forEach(o => o.services.forEach(id => { const s = Store.service(id); mix[s.cat] = (mix[s.cat] || 0) + Store.priceFor(id, Store.car(o.carId).cls); }));
      const mixList = Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const mixMax = mixList[0]?.[1] || 1;
      const dt = parseDay(day);
      return shell('admin', `
        <div class="page-title"><div><span class="eyebrow">${WD[new Date().getDay()]}, ${fmtDay(today, true)}</span><h1>Панель</h1></div>
          <div class="row"><button class="btn" data-act="adm-new-order">${icon('plus', 'width="18" height="18"')} Запис по телефону</button></div></div>
        <div class="kpis">
          <div class="kpi"><span>Записів сьогодні</span><b>${todays.length}</b><span class="delta">${todays.filter(o => o.status === 'done' || o.status === 'ready').length} готово</span></div>
          <div class="kpi"><span>Авто в роботі</span><b>${inWork.length}</b><span class="delta">${approval} чекають погодження</span></div>
          <div class="kpi"><span>Нові заявки</span><b>${newOnes.length}</b><span class="delta">${ready} авто готові до видачі</span></div>
          <div class="kpi"><span>Виручка · 30 днів</span><b>${money(rev)}</b>${delta !== null ? `<span class="delta ${delta >= 0 ? 'up' : ''}">${delta >= 0 ? '+' : ''}${delta}% до попередніх 30</span>` : ''}</div>
          <div class="kpi"><span>Середній чек</span><b>${money(avg)}</b><span class="delta">${done30.length} ${plural(done30.length, 'візит', 'візити', 'візитів')}</span></div>
          <div class="kpi"><span>Завантаженість постів</span><b>${loadToday}%</b><span class="delta">сьогодні, 4 пости × 10 год</span></div>
        </div>

        <div class="stack" style="margin-top:28px">
          <div class="row" style="justify-content:space-between"><h3>Розклад постів · ${day === today ? 'сьогодні' : `${WD[dt.getDay()]}, ${fmtDay(day, true)}`}</h3>
            <div class="row"><button class="btn sm" data-act="adm-day" data-d="-1" aria-label="Попередній день">←</button><button class="btn sm" data-act="adm-day" data-d="0">Сьогодні</button><button class="btn sm" data-act="adm-day" data-d="1" aria-label="Наступний день">→</button></div></div>
          ${schedule(day)}
          <div class="row small muted"><span class="pill info">записані</span><span class="pill warn">у роботі</span><span class="pill bad">чекають клієнта</span><span class="pill ok">готові</span></div>
        </div>

        <div class="grid g2" style="margin-top:28px;align-items:start;gap:24px">
          <div class="panel pad stack">
            <div class="row" style="justify-content:space-between"><h3>Нові заявки</h3><a class="link-btn small" href="#admin-orders">Усі замовлення</a></div>
            ${newOnes.length ? newOnes.slice(0, 6).map(o => { const u = Store.user(o.userId); const c = Store.car(o.carId); return `<div class="tx" style="align-items:center"><div><b>${esc(u.name)}</b> · ${esc(carName(c))}<br><small>${fmtDay(o.date)}, ${o.time} · ${o.services.map(s => esc(Store.service(s).name)).join(', ')}</small></div><div class="row" style="gap:6px"><button class="btn sm" data-act="adm-order" data-id="${o.id}">Відкрити</button><button class="btn sm primary" data-act="adm-confirm" data-id="${o.id}">Підтвердити</button></div></div>`; }).join('') : '<div class="empty">Нових заявок немає</div>'}
          </div>
          <div class="panel pad stack">
            <h3>Виручка за 14 днів</h3>
            ${revenueChart(revenueSeries(14))}
            <span class="small muted">Сума закритих замовлень по днях. Сьогоднішній день виділено жовтим.</span>
          </div>
        </div>
        <div class="panel pad stack" style="margin-top:24px">
          <h3>Структура робіт · 30 днів</h3>
          <div class="hbars">${mixList.map(([cat, v]) => `<div class="hbar"><span>${esc(Store.CATEGORIES.find(c => c.id === cat)?.name || cat)}</span><span class="mono">${money(v)}</span><div class="prog light"><i style="width:${Math.round(v / mixMax * 100)}%"></i></div></div>`).join('')}</div>
        </div>`);
    },
    mount: mountChart
  });
  App.on('adm-day', el => {
    const d = +el.dataset.d;
    if (d === 0) App.state.admDay = Store.dayStr(0);
    else {
      const cur = parseDay(App.state.admDay || Store.dayStr(0));
      cur.setDate(cur.getDate() + d);
      App.state.admDay = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    }
    App.render('admin', true);
  });
  App.on('adm-confirm', el => {
    const o = Store.order(el.dataset.id);
    Store.setStatus(o, 'confirmed');
    notifyClient(o, `Ваш запис ${o.id} підтверджено: ${fmtDay(o.date, true)} о ${o.time}. Чекаємо!`);
    toast(`${o.id} підтверджено, клієнту надіслано повідомлення`, 'ok');
    App.refresh();
  });

  function notifyClient(o, text, by = 'Hundred Garage') {
    const u = Store.user(o.userId);
    if (!u) return;
    const c = Store.chatFor(u.id, u.name, u.id);
    c.messages.push({ from: 'admin', text, at: new Date().toISOString(), by });
    c.unreadClient++;
  }
  App.notifyClient = notifyClient;
  const STATUS_MSG = {
    confirmed: o => `Запис ${o.id} підтверджено: ${fmtDay(o.date, true)} о ${o.time}.`,
    accepted: o => `Авто прийняли, майстер починає огляд. Стежте за статусом у кабінеті.`,
    approval: o => `Огляд завершено. У кабінеті — роботи і запчастини з цінами для погодження (${o.id}). Де є вибір — оберіть оригінал або аналог.`,
    parts: o => `Запчастини для ${o.id} замовлено. Напишемо, щойно вони прибудуть на склад.`,
    ready: o => `Авто готове! До сплати ${money(o.total - (o.useBonus || 0))}. Чекаємо вас до 20:00.`,
    done: o => `Дякуємо за візит! Нараховано ${num(o.earned)} балів. Будемо раді вашому відгуку.`
  };
  const SERVICE_PART_ST = ['request', 'quote', 'to_order', 'ordered', 'in_stock', 'installed', 'declined'];
  const CLIENT_PART_ST = ['awaiting', 'received', 'installed', 'declined'];
  const waitingParts = o => (o.parts || []).some(l => l.approved !== false && ['quote', 'to_order', 'ordered', 'awaiting'].includes(l.status));

  function partsEditor(o) {
    const lines = o.parts || [];
    return `<div class="stack">
      <div class="row" style="justify-content:space-between"><h3>Запчастини</h3>
        <label class="row small" style="gap:8px">Хто постачає: <select class="input" style="width:auto;min-height:34px;padding:4px 8px" data-change="adm-pref" data-id="${o.id}" aria-label="Хто постачає запчастини">${Object.entries(Store.PARTS_PREF).map(([k, t]) => `<option value="${k}" ${o.partsPref === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
      ${lines.length ? `<div>${lines.map(l => {
        if (l.status === 'request') return requestRow(o, l);
        const opt = Store.partOpt(l);
        const sts = l.source === 'client' ? CLIENT_PART_ST : SERVICE_PART_ST;
        return `<div class="part-edit">
          <div style="min-width:0"><b>${esc(l.name)}</b><div class="small muted mono" style="overflow-wrap:anywhere">${l.source === 'client' ? 'від клієнта' : `${esc(opt.brand)} ${esc(opt.code)}${l.alt ? ` · ${l.choice === 'alt' ? 'обрано аналог' : `аналог: ${esc(l.alt.brand)} ${money(l.alt.price)}`}` : ''}${opt.stock ? ' · на складі' : opt.eta ? ' · ' + esc(opt.eta) : ''}`}</div></div>
          <input class="input mono hide-narrow" value="${l.qty || 1}" inputmode="numeric" data-change="adm-part-field" data-id="${o.id}" data-p="${l.id}" data-k="qty" aria-label="Кількість">
          <input class="input mono hide-narrow" value="${l.source === 'client' ? '' : l.choice === 'alt' && l.alt ? l.alt.price : l.price}" ${l.source === 'client' ? 'disabled placeholder="—"' : ''} inputmode="numeric" data-change="adm-part-field" data-id="${o.id}" data-p="${l.id}" data-k="price" aria-label="Ціна за одиницю, ₴">
          <select class="input hide-narrow" data-change="adm-part-status" data-id="${o.id}" data-p="${l.id}" aria-label="Статус запчастини">${sts.map(x => `<option value="${x}" ${l.status === x ? 'selected' : ''}>${esc(Store.partStatus(x).name)}</option>`).join('')}</select>
          <button class="icon-btn" style="width:34px;height:34px" data-act="adm-part-del" data-id="${o.id}" data-p="${l.id}" aria-label="Видалити запчастину">${icon('trash', 'width="16" height="16"')}</button>
        </div>`;
      }).join('')}</div>` : `<p class="small muted">${o.partsPref === 'own' ? 'Клієнт привезе свої. Додайте позиції з джерелом «клієнт», щоб він бачив, що саме привезти.' : 'Позицій ще немає. Додайте запчастини з цінами — клієнт побачить їх у кабінеті.'}</p>`}
      <details class="panel pad" style="background:var(--panel-2)"><summary style="cursor:pointer;font-weight:500">+ Додати запчастину</summary>
        <form class="stack" data-form="adm-part" style="margin-top:14px"><input type="hidden" name="id" value="${o.id}">
          <div class="grid g3">
            <div class="field" style="grid-column:span 2"><label for="ap-name">Назва</label><input class="input" id="ap-name" name="name" placeholder="Колодки гальмівні передні" required></div>
            <div class="field"><label for="ap-src">Постачає</label><select class="input" id="ap-src" name="source"><option value="service">Сервіс</option><option value="client" ${o.partsPref === 'own' ? 'selected' : ''}>Клієнт привезе</option></select></div>
            <div class="field"><label for="ap-brand">Бренд</label><input class="input" id="ap-brand" name="brand" placeholder="TRW"></div>
            <div class="field"><label for="ap-code">Артикул</label><input class="input mono" id="ap-code" name="code" placeholder="GDB1550"></div>
            <div class="field"><label for="ap-qty">Кількість</label><input class="input mono" id="ap-qty" name="qty" inputmode="numeric" value="1"></div>
            <div class="field"><label for="ap-price">Ціна клієнту за од., ₴</label><input class="input mono" id="ap-price" name="price" inputmode="numeric" value="0"></div>
            <div class="field"><label for="ap-eta">Термін, якщо під замовлення</label><input class="input" id="ap-eta" name="eta" placeholder="завтра до 12:00"></div>
            <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="stock" checked> Є на складі</label>
          </div>
          <span class="lbl">Альтернатива для вибору клієнтом (необов'язково)</span>
          <div class="grid g4">
            <div class="field"><label for="ap-abrand">Бренд аналога</label><input class="input" id="ap-abrand" name="altBrand" placeholder="Bosch"></div>
            <div class="field"><label for="ap-acode">Артикул</label><input class="input mono" id="ap-acode" name="altCode"></div>
            <div class="field"><label for="ap-aprice">Ціна, ₴</label><input class="input mono" id="ap-aprice" name="altPrice" inputmode="numeric"></div>
            <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="altStock" checked> На складі</label>
          </div>
          <label class="check"><input type="checkbox" name="quote" checked> Потребує погодження клієнтом (замовимо після згоди)</label>
          <div><button class="btn primary" type="submit">Додати позицію</button></div>
        </form>
      </details>
    </div>`;
  }

  // A master asked for a part: the admin finds it, prices it (optionally with an analog) and it becomes a quote for the client
  function requestRow(o, l) {
    const m = Store.master(l.requestedBy);
    return `<div class="part-edit" style="grid-template-columns:minmax(0,1fr) auto">
      <div style="min-width:0"><b>${esc(l.name)}</b>${(l.qty || 1) > 1 ? ` <span class="mono">× ${l.qty}</span>` : ''} <span class="pill info">запит${m ? ' · ' + esc(m.name.split(' ')[0]) : ''}</span>${l.note ? `<div class="small muted">${esc(l.note)}</div>` : ''}</div>
      <button class="icon-btn" style="width:34px;height:34px" data-act="adm-part-del" data-id="${o.id}" data-p="${l.id}" aria-label="Видалити запит">${icon('trash', 'width="16" height="16"')}</button>
      <form class="grid" data-form="adm-price-req" style="grid-column:1/-1;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));align-items:end;gap:8px"><input type="hidden" name="id" value="${o.id}"><input type="hidden" name="p" value="${l.id}">
        <div class="field"><label>Бренд</label><input class="input" name="brand" required placeholder="Bosch"></div>
        <div class="field"><label>Артикул</label><input class="input mono" name="code"></div>
        <div class="field"><label>Ціна, ₴</label><input class="input mono" name="price" inputmode="numeric" required></div>
        <div class="field"><label>Термін</label><input class="input" name="eta" placeholder="на складі"></div>
        <div class="field"><label>Аналог: бренд</label><input class="input" name="altBrand"></div>
        <div class="field"><label>Аналог: ціна</label><input class="input mono" name="altPrice" inputmode="numeric"></div>
        <button class="btn sm primary" type="submit">Оцінити → клієнту</button>
      </form></div>`;
  }
  App.form('adm-price-req', (f, d) => {
    const o = Store.order(d.id);
    const l = o.parts.find(x => x.id === d.p);
    const price = parseInt(d.price, 10);
    if (!price) { toast('Вкажіть ціну запчастини'); return; }
    const eta = d.eta.trim();
    Object.assign(l, {
      brand: d.brand.trim(), code: d.code.trim(), price, stock: !eta || /склад/i.test(eta), eta: eta || 'на складі', status: 'quote', approved: null,
      alt: d.altBrand.trim() && parseInt(d.altPrice, 10) ? { brand: d.altBrand.trim(), code: '', price: parseInt(d.altPrice, 10), stock: true, eta: 'на складі' } : null
    });
    afterChange(o, 'Ціну додано — тепер позицію можна надіслати клієнту на погодження');
  });

  function discountEditor(o) {
    const d = o.discount;
    const u = Store.user(o.userId);
    return `<div class="stack">
      <div class="row" style="justify-content:space-between"><h3>Знижка</h3>${d ? `<span class="pill ok">${esc(Store.discountLabel(d))}</span>` : u?.personalDiscount ? `<span class="small muted">У клієнта персональна знижка ${u.personalDiscount}%</span>` : ''}</div>
      <div class="chips">${[['pct', 5, 'labor', '5% на роботи'], ['pct', 10, 'labor', '10% на роботи'], ['pct', 5, 'parts', '5% на запчастини'], ['pct', 10, 'all', '10% на весь чек'], ['fixed', 500, 'all', '−500 ₴']].map(([t, v, tg, l]) => `<button class="chip" data-act="adm-disc-preset" data-id="${o.id}" data-t="${t}" data-v="${v}" data-tg="${tg}">${l}</button>`).join('')}</div>
      <form class="grid" data-form="adm-discount" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));align-items:end"><input type="hidden" name="id" value="${o.id}">
        <div class="field"><label for="ad-type">Тип</label><select class="input" id="ad-type" name="type"><option value="pct" ${d?.type !== 'fixed' ? 'selected' : ''}>Відсоток, %</option><option value="fixed" ${d?.type === 'fixed' ? 'selected' : ''}>Сума, ₴</option></select></div>
        <div class="field"><label for="ad-val">Розмір</label><input class="input mono" id="ad-val" name="value" inputmode="numeric" value="${d?.value || ''}" placeholder="10"></div>
        <div class="field"><label for="ad-tg">На що</label><select class="input" id="ad-tg" name="target">${[['labor', 'Роботи'], ['parts', 'Запчастини'], ['all', 'Весь чек']].map(([k, t]) => `<option value="${k}" ${d?.target === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field" style="grid-column:span 2"><label for="ad-reason">Причина (бачить клієнт)</label><input class="input" id="ad-reason" name="reason" value="${esc(d?.reason || '')}" placeholder="Компенсація за затримку"></div>
        <div class="row" style="gap:6px"><button class="btn" type="submit">Застосувати</button>${d ? `<button class="btn ghost" type="button" data-act="adm-disc-clear" data-id="${o.id}">Прибрати</button>` : ''}</div>
      </form>
    </div>`;
  }

  // Master pay for this job: automatic % of works or a manual amount
  function payEditor(o) {
    const m = Store.master(o.master);
    if (!m) return `<div class="stack"><h3>Оплата майстру</h3><p class="small muted">Призначте майстра — і тут з'явиться його оплата за цю роботу.</p></div>`;
    const manual = o.pay && o.pay.amount !== null && o.pay.amount !== undefined;
    const auto = Math.round(Store.breakdown(o).works * m.payPct / 100);
    return `<div class="stack">
      <div class="row" style="justify-content:space-between"><h3>Оплата майстру</h3><span class="pill ${manual ? 'warn' : ''}">${manual ? 'вручну' : `авто · ${m.payPct}% від робіт`}</span></div>
      <div class="row" style="justify-content:space-between"><span>${esc(m.name)}${o.status === 'done' ? '' : ' <span class="small muted">· нарахується після видачі авто</span>'}</span><b class="mono" style="font-size:1.25rem">${money(Store.masterPay(o))}</b></div>
      <form class="grid" data-form="adm-pay" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));align-items:end"><input type="hidden" name="id" value="${o.id}">
        <div class="field"><label for="pay-amt">Сума майстру, ₴</label><input class="input mono" id="pay-amt" name="amount" inputmode="numeric" value="${manual ? o.pay.amount : ''}" placeholder="${auto} (авто)"></div>
        <div class="field" style="grid-column:span 2"><label for="pay-note">Коментар (бачить майстер)</label><input class="input" id="pay-note" name="note" value="${esc(o.pay?.note || '')}" placeholder="Складна робота: закисли болти"></div>
        <div class="row" style="gap:6px"><button class="btn" type="submit">Зберегти</button>${manual ? `<button class="btn ghost" type="button" data-act="adm-pay-auto" data-id="${o.id}">Авто</button>` : ''}</div>
      </form></div>`;
  }
  App.form('adm-pay', (f, d) => {
    const o = Store.order(d.id);
    const raw = String(d.amount).trim();
    const v = raw === '' ? null : parseInt(raw.replace(/\D/g, ''), 10);
    if (raw !== '' && isNaN(v)) { toast('Вкажіть суму числом'); return; }
    o.pay = { amount: v, note: d.note.trim() };
    afterChange(o, v === null ? 'Оплата рахується автоматично' : `Майстру: ${money(v)}`);
  });
  App.on('adm-pay-auto', el => { const o = Store.order(el.dataset.id); o.pay = { amount: null, note: o.pay?.note || '' }; afterChange(o, 'Оплата рахується автоматично'); });

  // ---------- Order editor ----------
  function adminOrder(id) {
    const o = Store.order(id);
    if (!o) return;
    const u = Store.user(o.userId);
    const car = Store.car(o.carId);
    const idx = FLOW.indexOf(o.status);
    const next = o.status !== 'cancelled' && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
    const bd = Store.breakdown(o);
    const needsApproval = o.items.some(i => i.decision === null && i.sev !== 'green') || (o.parts || []).some(l => l.status === 'quote' && l.approved === null);
    const scroll = document.querySelector('.modal')?.scrollTop;
    modal({
      wide: true, title: `${o.id} · ${carName(car)}`,
      body: `<div class="row" style="justify-content:space-between;align-items:start">
          <dl class="kv"><dt>Клієнт</dt><dd><b>${esc(u?.name || '—')}</b> · <span class="mono">${esc(UI.fmtPhone(u?.phone || ''))}</span></dd><dt>Авто</dt><dd>${esc(carName(car))}, ${car.year || ''} · ${plate(car.plate || '—')}</dd><dt>Запчастини</dt><dd>${esc(Store.PARTS_PREF[o.partsPref || 'service'])}</dd><dt>Час роботи</dt><dd class="mono">${UI.dur(Store.workMinutes(o) || 0)} з ${UI.dur(Store.normMinutes(o))} за нормою${o.work?.running ? ' · ▶ йде' : ''}</dd>${o.masterNote ? `<dt>Нотатка майстра</dt><dd>${esc(o.masterNote)}</dd>` : ''}${o.comment ? `<dt>Коментар</dt><dd>${esc(o.comment)}</dd>` : ''}${o.waitOnSite ? '<dt>Клієнт</dt><dd>чекає в клієнтській зоні</dd>' : ''}</dl>
          ${statusPill(o.status)}</div>
        <div class="stack"><span class="lbl">Статус — клієнт бачить зміни одразу</span>
          <div class="chips">${FLOW.map(s => `<button class="chip ${o.status === s ? 'on' : ''}" data-act="adm-status" data-id="${o.id}" data-s="${s}">${esc(Store.status(s).short)}</button>`).join('')}<button class="chip ${o.status === 'cancelled' ? 'on' : ''}" data-act="adm-status" data-id="${o.id}" data-s="cancelled">Скасовано</button></div>
          ${next ? `<button class="btn primary" style="justify-self:start" data-act="adm-status" data-id="${o.id}" data-s="${next}">Далі: ${esc(Store.status(next).name)} ${icon('arrow', 'width="18" height="18"')}</button>` : ''}
        </div>
        <form class="grid g3" data-form="adm-order" id="adm-order-form">
          <input type="hidden" name="id" value="${o.id}">
          <div class="field"><label for="ao-date">Дата</label><input class="input" type="date" id="ao-date" name="date" value="${o.date}"></div>
          <div class="field"><label for="ao-time">Час</label><input class="input" type="time" id="ao-time" name="time" step="1800" value="${o.time}"></div>
          <div class="field"><label for="ao-bay">Пост</label><select class="input" id="ao-bay" name="bay">${S().bays.map(b => `<option value="${b.id}" ${o.bay === b.id ? 'selected' : ''}>${esc(b.name)} · ${esc(b.kind)}</option>`).join('')}</select></div>
          <div class="field"><label for="ao-master">Майстер</label><select class="input" id="ao-master" name="master"><option value="">— не призначено —</option>${S().masters.map(m => `<option value="${m.id}" ${o.master === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
          <div class="field"><label for="ao-km">Пробіг при прийомі, км</label><input class="input mono" id="ao-km" name="mileage" inputmode="numeric" value="${o.mileage || ''}"></div>
          <div style="align-self:end"><button class="btn" type="submit">Зберегти</button></div>
        </form>
        <div class="stack">
          <div class="row" style="justify-content:space-between"><h3>Огляд і додаткові роботи</h3><span class="small muted">Клієнт погоджує кожен пункт у кабінеті</span></div>
          ${o.items.length ? `<div class="insp">${o.items.map(i => `<div class="insp-item"><span class="sev ${i.sev}"></span><div><b>${esc(i.name)}</b><p>${esc(i.note || '')}${i.price ? ` · <span class="mono">${money(i.price)}</span>` : ''}</p>${UI.photoThumb(i)}</div><div class="act">${i.sev === 'green' ? '' : i.decision === 'yes' ? '<span class="pill ok">погоджено</span>' : i.decision === 'no' ? '<span class="pill">відкладено</span>' : '<span class="pill warn">чекає</span>'}<button class="icon-btn" style="width:34px;height:34px" data-act="adm-item-del" data-id="${o.id}" data-item="${i.id}" aria-label="Видалити пункт">${icon('trash', 'width="16" height="16"')}</button></div></div>`).join('')}</div>` : '<p class="small muted">Пунктів ще немає. Додайте знахідки після діагностики.</p>'}
          <form class="grid" data-form="adm-item" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));align-items:end">
            <input type="hidden" name="id" value="${o.id}">
            <div class="field" style="grid-column:span 2"><label for="ai-name">Знахідка / робота</label><input class="input" id="ai-name" name="name" placeholder="Напр.: пильовик ШРУСа — тріщина" required></div>
            <div class="field"><label for="ai-sev">Важливість</label><select class="input" id="ai-sev" name="sev"><option value="red">Критично</option><option value="yellow">Можна відкласти</option><option value="green">В нормі</option></select></div>
            <div class="field"><label for="ai-price">Робота, ₴</label><input class="input mono" id="ai-price" name="price" inputmode="numeric" value="0"></div>
            <button class="btn" type="submit">${icon('plus', 'width="18" height="18"')} Додати</button>
          </form>
        </div>
        ${partsEditor(o)}
        ${needsApproval && o.status !== 'approval' ? `<div class="note hz">${icon('wrench', 'width="20" height="20"')}<span>Є роботи або запчастини без рішення клієнта. <button class="link-btn" data-act="adm-status" data-id="${o.id}" data-s="approval">Надіслати клієнту на погодження</button></span></div>` : ''}
        ${discountEditor(o)}
        ${payEditor(o)}
        <div class="jc-items"><div class="jc-line"><span>Роботи за прайсом</span><span>${money(bd.labor)}</span></div><div class="jc-line"><span>Погоджені додаткові роботи</span><span>${money(bd.extras)}</span></div><div class="jc-line"><span>Запчастини сервісу</span><span>${money(bd.parts)}</span></div>${bd.discount ? `<div class="jc-line" style="color:var(--ok)"><span>Знижка ${esc(Store.discountLabel(o.discount))}</span><span>−${money(bd.discount)}</span></div>` : ''}${o.useBonus ? `<div class="jc-line"><span>Клієнт оплачує балами</span><span>−${money(o.useBonus)}</span></div>` : ''}</div>
        <div class="jc-total"><span class="muted">До сплати</span><b>${money(bd.total - (o.useBonus || 0))}</b></div>`,
      foot: `${u ? `<button class="btn" data-act="adm-chat-with" data-id="${u.id}">${icon('chat', 'width="18" height="18"')} Написати клієнту</button><button class="btn" data-act="adm-client" data-id="${u.id}">Картка клієнта</button>` : ''}<button class="btn primary" data-act="modal-close">Закрити</button>`
    });
    const md = document.querySelector('.modal');
    if (md && scroll) md.scrollTop = scroll;
  }
  App.adminOrder = adminOrder;
  App.on('adm-order', el => adminOrder(el.dataset.id));
  function afterChange(o, msg) {
    Store.recalc(o);
    Store.save();
    if (msg) toast(msg, 'ok');
    if (UI.modalOpen() && document.querySelector('.modal-head h3')?.textContent.startsWith(o.id)) adminOrder(o.id);
    App.render(App.current, true);
  }
  // One status change routine for admin and masters: checks, side effects, client notification
  App.applyStatus = (o, s) => {
    const hasQuestions = o.items.some(i => i.sev !== 'green' && i.decision === null) || (o.parts || []).some(l => l.status === 'quote' && l.approved === null);
    if (s === 'approval' && !hasQuestions) return 'Спочатку додайте знахідки огляду або оцінені запчастини, які потрібно погодити';
    if (s === 'cancelled' && o.useBonus && !o.closed) { Store.user(o.userId).bonus += o.useBonus; o.useBonus = 0; }
    if (s === 'done') (o.parts || []).forEach(l => { if (l.approved !== false && ['in_stock', 'received'].includes(l.status)) l.status = 'installed'; });
    Store.setStatus(o, s);
    if (STATUS_MSG[s]) notifyClient(o, STATUS_MSG[s](o));
    return null;
  };
  App.on('adm-status', el => {
    const o = Store.order(el.dataset.id);
    const s = el.dataset.s;
    const err = App.applyStatus(o, s);
    if (err) { toast(err); return; }
    afterChange(o, `${o.id}: ${Store.status(s).name}${STATUS_MSG[s] ? ' · клієнта повідомлено' : ''}`);
  });
  App.form('adm-order', (f, d) => {
    const o = Store.order(d.id);
    o.date = d.date || o.date;
    o.time = d.time || o.time;
    o.bay = d.bay;
    o.master = d.master || null;
    o.mileage = parseInt(d.mileage, 10) || o.mileage;
    afterChange(o, 'Збережено');
  });

  // ---------- Parts ----------
  App.change('adm-pref', el => { const o = Store.order(el.dataset.id); o.partsPref = el.value; afterChange(o, 'Збережено'); });
  App.form('adm-part', (f, d) => {
    const o = Store.order(d.id);
    const client = d.source === 'client';
    const quote = !client && !!d.quote;
    const stock = !!d.stock;
    const line = {
      id: 'p' + Store.next('part'), name: d.name.trim(), brand: d.brand.trim(), code: d.code.trim(), qty: Math.max(1, parseInt(d.qty, 10) || 1),
      price: client ? 0 : parseInt(d.price, 10) || 0, stock, eta: stock ? 'на складі' : d.eta.trim(), source: d.source, choice: 'main',
      alt: !client && d.altBrand.trim() && parseInt(d.altPrice, 10) ? { brand: d.altBrand.trim(), code: d.altCode.trim(), price: parseInt(d.altPrice, 10), stock: !!d.altStock, eta: d.altStock ? 'на складі' : '' } : null,
      approved: quote ? null : true,
      status: client ? 'awaiting' : quote ? 'quote' : stock ? 'in_stock' : 'to_order'
    };
    (o.parts ||= []).push(line);
    afterChange(o, 'Запчастину додано');
  });
  App.change('adm-part-field', el => {
    const o = Store.order(el.dataset.id);
    const l = o.parts.find(x => x.id === el.dataset.p);
    const v = parseInt(el.value.replace(/\D/g, ''), 10);
    if (isNaN(v)) { toast('Вкажіть число'); return; }
    if (el.dataset.k === 'qty') l.qty = Math.max(1, v);
    else if (l.choice === 'alt' && l.alt) l.alt.price = v; else l.price = v;
    afterChange(o, 'Збережено');
  });
  App.change('adm-part-status', el => {
    const o = Store.order(el.dataset.id);
    const l = o.parts.find(x => x.id === el.dataset.p);
    l.status = el.value;
    if (l.status === 'declined') l.approved = false;
    else if (l.status === 'quote') l.approved = null;
    else l.approved = true;
    if (l.status === 'ordered') notifyClient(o, `Замовили «${l.name}» (${Store.partOpt(l).brand}). ${l.eta || Store.partOpt(l).eta ? 'Очікуємо: ' + (Store.partOpt(l).eta || l.eta) + '.' : ''}`);
    if (l.status === 'received') notifyClient(o, `Отримали ваші запчастини: «${l.name}». Дякуємо!`);
    // Everything arrived → the car goes back on the lift automatically
    if (o.status === 'parts' && !waitingParts(o)) {
      Store.setStatus(o, 'repair');
      notifyClient(o, `Усі запчастини на місці — почали ремонт ${carName(Store.car(o.carId))}.`);
      afterChange(o, 'Усі запчастини прибули — замовлення перейшло в «Ремонт»');
      return;
    }
    afterChange(o, `«${l.name}»: ${Store.partStatus(l.status).name.toLowerCase()}`);
  });
  App.on('adm-part-del', el => {
    const o = Store.order(el.dataset.id);
    o.parts = o.parts.filter(x => x.id !== el.dataset.p);
    afterChange(o, 'Позицію видалено');
  });

  // ---------- Discounts ----------
  App.form('adm-discount', (f, d) => {
    const o = Store.order(d.id);
    const v = parseFloat(String(d.value).replace(',', '.'));
    if (!v || v < 0 || (d.type === 'pct' && v > 100)) { toast('Вкажіть розмір знижки: від 1 до 100% або суму в гривнях'); return; }
    o.discount = { type: d.type, value: v, target: d.target, reason: d.reason.trim() };
    if (o.useBonus > Math.floor(Store.breakdown(o).total * S().settings.maxPayPct / 100)) { Store.user(o.userId).bonus += o.useBonus; o.useBonus = 0; }
    afterChange(o, 'Знижку застосовано — клієнт бачить її в кабінеті');
  });
  App.on('adm-disc-preset', el => {
    const o = Store.order(el.dataset.id);
    o.discount = { type: el.dataset.t, value: +el.dataset.v, target: el.dataset.tg, reason: o.discount?.reason || '' };
    afterChange(o, 'Знижку застосовано');
  });
  App.on('adm-disc-clear', el => { const o = Store.order(el.dataset.id); o.discount = null; afterChange(o, 'Знижку прибрано'); });
  App.form('adm-item', (f, d) => {
    const o = Store.order(d.id);
    o.items.push({ id: 'i' + Store.next('item'), name: d.name.trim(), sev: d.sev, price: parseInt(d.price, 10) || 0, note: d.sev === 'green' ? 'В нормі' : 'Робота', decision: null });
    afterChange(o, 'Пункт додано');
  });
  App.on('adm-item-del', el => {
    const o = Store.order(el.dataset.id);
    o.items = o.items.filter(i => i.id !== el.dataset.item);
    Store.recalc(o);
    Store.save();
    adminOrder(o.id);
  });
  App.on('adm-new-order', () => {
    modal({
      title: 'Запис по телефону',
      body: `<form class="stack" data-form="adm-new" id="adm-new-form">
        <div class="grid g2"><div class="field"><label for="an-name">Ім'я клієнта</label><input class="input" id="an-name" name="name" required></div>
        <div class="field"><label for="an-phone">Телефон</label><input class="input mono" id="an-phone" name="phone" required placeholder="+380"></div>
        <div class="field"><label for="an-make">Марка і модель</label><input class="input" id="an-make" name="car" required placeholder="Skoda Fabia"></div>
        <div class="field"><label for="an-svc">Послуга</label><select class="input" id="an-svc" name="svc">${S().services.filter(s => s.active).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="an-date">Дата</label><input class="input" type="date" id="an-date" name="date" value="${Store.dayStr(1)}" required></div>
        <div class="field"><label for="an-time">Час</label><input class="input" type="time" id="an-time" name="time" value="10:00" step="1800" required></div>
        <div class="field" style="grid-column:1/-1"><label for="an-pref">Запчастини</label><select class="input" id="an-pref" name="pref">${Object.entries(Store.PARTS_PREF).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select></div></div>
        <p class="small muted">Якщо номер новий — створимо клієнту кабінет і надішлемо посилання в SMS.</p>
      </form>`,
      foot: '<button class="btn" data-act="modal-close">Скасувати</button><button class="btn primary" type="submit" form="adm-new-form">Створити запис</button>'
    });
  });
  App.form('adm-new', (f, d) => {
    let u = Store.findUserByPhone(d.phone);
    if (!u) {
      if (d.phone.replace(/\D/g, '').length < 10) { toast('Перевірте номер телефону'); return; }
      u = App.registerUser({ name: d.name.trim(), phone: d.phone });
    }
    const [make, ...rest] = d.car.trim().split(' ');
    let car = Store.carsOf(u.id).find(c => (c.make + ' ' + c.model).toLowerCase() === d.car.trim().toLowerCase());
    if (!car) { car = { id: 'c' + Store.next('car'), userId: u.id, make, model: rest.join(' '), year: '', plate: '', vin: '', engine: '', cls: 'sedan', mileage: 0 }; S().cars.push(car); }
    const labor = Store.priceFor(d.svc, car.cls);
    const now = new Date().toISOString();
    const o = { id: 'HG-' + Store.next('order'), userId: u.id, carId: car.id, services: [d.svc], date: d.date, time: d.time, bay: 'b1', master: null, status: 'confirmed', labor, parts: [], total: labor, items: [], useBonus: 0, earned: 0, comment: 'Запис по телефону', mileage: car.mileage, createdAt: now, history: [{ status: 'new', at: now }, { status: 'confirmed', at: now }], partsPref: d.pref, discount: Store.defaultDiscount(u) };
    Store.recalc(o);
    S().orders.push(o);
    notifyClient(o, STATUS_MSG.confirmed(o));
    Store.save();
    closeModal();
    toast(`Створено ${o.id}`, 'ok');
    App.state.admDay = o.date;
    App.render(App.current, true);
  });

  // ---------- Orders list ----------
  const GROUPS = [
    ['all', 'Усі', () => true], ['new', 'Нові', o => o.status === 'new'], ['planned', 'Заплановані', o => o.status === 'confirmed'],
    ['work', 'В роботі', o => IN_WORK.includes(o.status)], ['ready', 'Готові', o => o.status === 'ready'],
    ['done', 'Видані', o => o.status === 'done'], ['cancelled', 'Скасовані', o => o.status === 'cancelled']
  ];
  App.route('admin-orders', {
    area: 'admin', title: 'Замовлення',
    render() {
      const g = App.state.ordGroup || 'work';
      const q = (App.state.ordQ || '').toLowerCase();
      const fn = GROUPS.find(x => x[0] === g)[2];
      const list = S().orders.filter(fn).filter(o => {
        if (!q) return true;
        const u = Store.user(o.userId), c = Store.car(o.carId);
        return (o.id + ' ' + (u?.name || '') + ' ' + (u?.phone || '') + ' ' + carName(c) + ' ' + (c?.plate || '')).toLowerCase().includes(q);
      }).sort((a, b) => g === 'done' || g === 'all' ? (b.date + b.time).localeCompare(a.date + a.time) : (a.date + a.time).localeCompare(b.date + b.time));
      return shell('admin-orders', `
        <div class="page-title"><h1>Замовлення</h1><button class="btn primary" data-act="adm-new-order">${icon('plus', 'width="18" height="18"')} Новий запис</button></div>
        <div class="toolbar"><div class="search">${icon('search')}<input class="input" id="ord-q" placeholder="Номер, клієнт, телефон, авто, держномер" value="${esc(App.state.ordQ || '')}" data-change="ord-q" aria-label="Пошук замовлень"></div></div>
        <div class="chips" style="margin-bottom:16px">${GROUPS.map(([id, t, f]) => `<button class="chip ${g === id ? 'on' : ''}" data-act="ord-group" data-g="${id}">${t} <span class="mono">${S().orders.filter(f).length}</span></button>`).join('')}</div>
        <div class="table-wrap"><table><thead><tr><th>Замовлення</th><th>Клієнт</th><th>Авто і роботи</th><th>Пост · майстер</th><th>Статус</th><th class="r">Сума</th></tr></thead><tbody>
        ${list.slice(0, 80).map(o => { const u = Store.user(o.userId), c = Store.car(o.carId); return `<tr class="click" data-act="adm-order" data-id="${o.id}"><td><b class="mono">${esc(o.id)}</b><span class="sub">${fmtDay(o.date)}, ${o.time}</span></td><td>${esc(u?.name || '—')}<span class="sub mono">${esc(UI.fmtPhone(u?.phone || ''))}</span></td><td>${esc(carName(c))}<span class="sub">${o.services.map(s => esc(Store.service(s).name)).join(', ')}</span></td><td>${esc(Store.bay(o.bay)?.name || '—')}<span class="sub">${esc(Store.master(o.master)?.name || 'не призначено')}</span></td><td>${statusPill(o.status)}</td><td class="r mono">${money(o.total)}</td></tr>`; }).join('') || '<tr><td colspan="6"><div class="empty">Нічого не знайдено</div></td></tr>'}
        </tbody></table></div>
        ${list.length > 80 ? `<p class="small muted" style="margin-top:8px">Показано 80 з ${list.length}. Уточніть пошук.</p>` : ''}`);
    }
  });
  App.on('ord-group', el => { App.state.ordGroup = el.dataset.g; App.render('admin-orders', true); });
  App.change('ord-q', el => { App.state.ordQ = el.value; App.render('admin-orders', true); });

  // ---------- Staff & payroll ----------
  const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
  App.route('admin-staff', {
    area: 'admin', title: 'Майстри',
    render() {
      const ms = monthStart();
      return shell('admin-staff', `
        <div class="page-title"><div><h1>Майстри</h1><p class="small muted">Ставка — відсоток від робіт у замовленні (без запчастин). У кожному замовленні суму можна змінити вручну.</p></div></div>
        <div class="table-wrap"><table><thead><tr><th>Майстер</th><th class="r">Ставка</th><th class="r">У роботі</th><th class="r">Закрито за місяць</th><th class="r">Нормо / факт, год</th><th class="r">Нараховано за місяць</th><th class="r">До виплати</th></tr></thead><tbody>
        ${S().masters.map(m => {
          const led = Store.masterLedger(m.id, ms);
          const active = S().orders.filter(o => o.master === m.id && !['done', 'cancelled', 'new', 'confirmed'].includes(o.status)).length;
          const norm = led.jobs.reduce((s, o) => s + Store.normMinutes(o), 0) / 60;
          const fact = led.jobs.reduce((s, o) => s + (o.work?.spent || Store.normMinutes(o)), 0) / 60;
          return `<tr class="click" data-act="adm-staff" data-id="${m.id}"><td><b>${esc(m.name)}</b><span class="sub">${esc(m.role)} · логін <span class="mono">${esc(m.login)}</span></span></td><td class="r mono">${m.payPct}%</td><td class="r mono">${active}</td><td class="r mono">${led.jobs.length}</td><td class="r mono">${norm.toFixed(1)} / ${fact.toFixed(1)}</td><td class="r mono">${money(led.earned)}</td><td class="r mono"><b>${money(led.balance)}</b></td></tr>`;
        }).join('')}
        </tbody></table></div>`);
    }
  });
  function staffModal(id) {
    const m = Store.master(id);
    const ms = monthStart();
    const led = Store.masterLedger(id, ms);
    const scroll = document.querySelector('.modal')?.scrollTop;
    modal({
      wide: true, title: m.name,
      body: `<div class="kpis">
          <div class="kpi"><span>Нараховано за місяць</span><b>${money(led.earned)}</b><span class="delta">${led.jobs.length} ${plural(led.jobs.length, 'робота', 'роботи', 'робіт')}</span></div>
          <div class="kpi"><span>До виплати</span><b>${money(led.balance)}</b><span class="delta">виплачено всього ${money(led.paid)}</span></div>
          <div class="kpi"><span>Ставка</span><b>${m.payPct}%</b><span class="delta">від робіт</span></div>
        </div>
        <div class="grid g2" style="align-items:start;gap:24px">
          <div class="stack">
            <form class="row" data-form="adm-staff-pct" style="align-items:end"><input type="hidden" name="id" value="${m.id}"><div class="field" style="flex:1 1 140px"><label for="sp-pct">Ставка, % від робіт</label><input class="input mono" id="sp-pct" name="pct" inputmode="numeric" value="${m.payPct}"></div><button class="btn" type="submit">Зберегти</button></form>
            <form class="stack" data-form="adm-staff-adj"><input type="hidden" name="id" value="${m.id}"><span class="lbl">Премія або штраф</span>
              <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:8px"><input class="input mono" name="amount" placeholder="+500 / −200" aria-label="Сума" required><input class="input" name="note" placeholder="Причина (бачить майстер)" aria-label="Причина" required></div>
              <div><button class="btn" type="submit">Додати</button></div></form>
            ${led.balance > 0 ? `<button class="btn primary" style="justify-self:start" data-act="adm-payout" data-id="${m.id}">Виплатити ${money(led.balance)}</button>` : '<span class="small muted">Заборгованості немає</span>'}
            <span class="lbl">Премії, штрафи, виплати</span>
            ${[...(m.adjustments || []).map(a => ({ ...a, k: 'adj' })), ...(m.payouts || []).map(p => ({ ...p, k: 'pay' }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10).map(x => `<div class="tx"><div><b>${x.k === 'pay' ? 'Виплата' : x.amount >= 0 ? 'Премія' : 'Штраф'}</b><br><small>${esc(x.note)} · ${fmtDay(x.at)}</small></div><span class="amt ${x.k === 'pay' ? '' : x.amount >= 0 ? 'plus' : 'minus'}">${x.k === 'pay' ? '' : x.amount >= 0 ? '+' : '−'}${num(Math.abs(x.amount))}</span></div>`).join('') || '<p class="small muted">Поки нічого</p>'}
          </div>
          <div class="stack"><span class="lbl">Роботи за місяць</span>
            <div class="table-wrap"><table><tbody>${led.jobs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map(o => `<tr class="click" data-act="adm-order" data-id="${o.id}"><td class="mono">${esc(o.id)}<span class="sub">${fmtDay(o.date)}</span></td><td>${esc(carName(Store.car(o.carId)))}<span class="sub">${o.services.map(x => esc(Store.service(x).name)).join(', ')}</span></td><td class="r mono">${money(Store.masterPay(o))}${o.pay?.amount != null ? '<span class="sub">вручну</span>' : ''}</td></tr>`).join('') || '<tr><td><div class="empty">Закритих робіт ще немає</div></td></tr>'}</tbody></table></div>
          </div>
        </div>`
    });
    const md = document.querySelector('.modal');
    if (md && scroll) md.scrollTop = scroll;
  }
  App.on('adm-staff', el => staffModal(el.dataset.id));
  App.form('adm-staff-pct', (f, d) => {
    const v = parseInt(d.pct, 10);
    if (isNaN(v) || v < 0 || v > 100) { toast('Ставка — від 0 до 100%'); return; }
    Store.master(d.id).payPct = v; Store.save(); toast('Ставку збережено', 'ok'); staffModal(d.id); App.render(App.current, true);
  });
  App.form('adm-staff-adj', (f, d) => {
    const v = parseInt(String(d.amount).replace(/−/g, '-').replace(/[^\d-]/g, ''), 10);
    if (!v) { toast('Вкажіть суму, наприклад 500 або -200'); return; }
    Store.master(d.id).adjustments.push({ at: new Date().toISOString(), amount: v, note: d.note.trim() });
    Store.save(); toast(v > 0 ? 'Премію додано' : 'Штраф додано', 'ok'); staffModal(d.id); App.render(App.current, true);
  });
  App.on('adm-payout', el => {
    const m = Store.master(el.dataset.id);
    const bal = Store.masterLedger(m.id).balance;
    m.payouts.push({ at: new Date().toISOString(), amount: bal, note: 'Виплата' });
    Store.save(); toast(`Виплачено ${money(bal)}`, 'ok'); staffModal(m.id); App.render(App.current, true);
  });

  // ---------- Parts supply ----------
  const PART_GROUPS = [['request', 'Запити майстрів'], ['to_order', 'Треба замовити'], ['ordered', 'В дорозі'], ['awaiting', 'Чекаємо від клієнтів'], ['quote', 'Чекають рішення клієнта'], ['in_stock', 'На складі']];
  App.route('admin-parts', {
    area: 'admin', title: 'Запчастини',
    render() {
      const g = App.state.partGroup || (S().orders.some(o => !['done', 'cancelled'].includes(o.status) && (o.parts || []).some(l => l.status === 'request')) ? 'request' : 'to_order');
      const rows = [];
      S().orders.filter(o => !['done', 'cancelled'].includes(o.status)).forEach(o => (o.parts || []).forEach(l => rows.push({ o, l })));
      const cnt = id => rows.filter(r => r.l.status === id).length;
      const sum = id => rows.filter(r => r.l.status === id).reduce((s, r) => s + Store.partOpt(r.l).price * (r.l.qty || 1), 0);
      const list = rows.filter(r => r.l.status === g).sort((a, b) => (a.o.date + a.o.time).localeCompare(b.o.date + b.o.time));
      const sts = g === 'awaiting' ? CLIENT_PART_ST : SERVICE_PART_ST;
      return shell('admin-parts', `
        <div class="page-title"><div><h1>Запчастини</h1><p class="small muted">Усі позиції з активних замовлень. Зміна статусу одразу видна клієнту, а коли прибуде останнє — замовлення само перейде в «Ремонт».</p></div></div>
        <div class="kpis" style="margin-bottom:20px">
          <div class="kpi"><span>Запити майстрів</span><b>${cnt('request')}</b><span class="delta">треба підібрати й оцінити</span></div>
          <div class="kpi"><span>Треба замовити</span><b>${cnt('to_order')}</b><span class="delta">${money(sum('to_order'))}</span></div>
          <div class="kpi"><span>В дорозі</span><b>${cnt('ordered')}</b><span class="delta">${money(sum('ordered'))}</span></div>
          <div class="kpi"><span>Чекаємо від клієнтів</span><b>${cnt('awaiting')}</b><span class="delta">клієнти привозять свої</span></div>
        </div>
        <div class="chips" style="margin-bottom:16px">${PART_GROUPS.map(([id, t]) => `<button class="chip ${g === id ? 'on' : ''}" data-act="part-group" data-g="${id}">${t} <span class="mono">${cnt(id)}</span></button>`).join('')}</div>
        <div class="table-wrap"><table><thead><tr><th>Запчастина</th><th>Бренд · артикул</th><th class="r">К-сть</th><th class="r">Ціна</th><th>Замовлення</th><th>Статус</th></tr></thead><tbody>
        ${list.map(({ o, l }) => { const opt = Store.partOpt(l); return `<tr><td><b>${esc(l.name)}</b>${l.status === 'request' ? `<span class="sub">${esc(Store.master(l.requestedBy)?.name || 'майстер')}: ${esc(l.note || 'без коментаря')}</span>` : opt.eta && !opt.stock ? `<span class="sub">${esc(opt.eta)}</span>` : ''}</td><td class="mono small">${l.source === 'client' ? 'від клієнта' : esc(opt.brand + ' ' + opt.code)}${l.alt && l.status === 'quote' ? `<span class="sub">або ${esc(l.alt.brand)} · ${money(l.alt.price)}</span>` : ''}</td><td class="r mono">${l.qty || 1}</td><td class="r mono">${l.source === 'client' || l.status === 'request' ? '—' : money(opt.price * (l.qty || 1))}</td>
          <td><button class="link-btn" data-act="adm-order" data-id="${o.id}">${esc(o.id)}</button><span class="sub">${esc(carName(Store.car(o.carId)))} · ${fmtDay(o.date)}</span></td>
          <td>${l.status === 'request' ? `<button class="btn sm primary" data-act="adm-order" data-id="${o.id}">Оцінити</button>` : ''}<select class="input" style="min-height:36px;padding:4px 8px;${l.status === 'request' ? 'display:none' : ''}" data-change="adm-part-status" data-id="${o.id}" data-p="${l.id}" aria-label="Статус">${sts.map(x => `<option value="${x}" ${l.status === x ? 'selected' : ''}>${esc(Store.partStatus(x).name)}</option>`).join('')}</select></td></tr>`; }).join('') || '<tr><td colspan="6"><div class="empty">У цій групі порожньо</div></td></tr>'}
        </tbody></table></div>`);
    }
  });
  App.on('part-group', el => { App.state.partGroup = el.dataset.g; App.render('admin-parts', true); });

  // ---------- Clients ----------
  App.route('admin-clients', {
    area: 'admin', title: 'Клієнти',
    render() {
      const q = (App.state.cliQ || '').toLowerCase();
      const list = S().users.filter(u => !q || (u.name + ' ' + u.phone + ' ' + Store.carsOf(u.id).map(c => carName(c) + ' ' + c.plate).join(' ')).toLowerCase().includes(q)).sort((a, b) => b.spent - a.spent);
      return shell('admin-clients', `
        <div class="page-title"><h1>Клієнти</h1><span class="muted">${list.length} ${plural(list.length, 'клієнт', 'клієнти', 'клієнтів')}</span></div>
        <div class="toolbar"><div class="search">${icon('search')}<input class="input" id="cli-q" placeholder="Ім'я, телефон, авто" value="${esc(App.state.cliQ || '')}" data-change="cli-q" aria-label="Пошук клієнтів"></div></div>
        <div class="table-wrap"><table><thead><tr><th>Клієнт</th><th>Авто</th><th class="r">Візитів</th><th class="r">Витрачено</th><th>Рівень</th><th class="r">Знижка</th><th class="r">Бали</th></tr></thead><tbody>
        ${list.map(u => { const lv = Store.level(u.spent).cur; const visits = S().orders.filter(o => o.userId === u.id && o.status === 'done').length; return `<tr class="click" data-act="adm-client" data-id="${u.id}"><td><b>${esc(u.name)}</b><span class="sub mono">${esc(UI.fmtPhone(u.phone))}</span></td><td>${Store.carsOf(u.id).map(c => esc(carName(c))).join('<br>') || '—'}</td><td class="r mono">${visits}</td><td class="r mono">${money(u.spent)}</td><td><span class="pill ${lv.id === 'hundred' ? 'hz' : ''}">${esc(lv.name)} · ${lv.cashback}%</span></td><td class="r mono">${u.personalDiscount ? u.personalDiscount + '%' : '—'}</td><td class="r mono">${num(u.bonus)}</td></tr>`; }).join('')}
        </tbody></table></div>`);
    }
  });
  App.change('cli-q', el => { App.state.cliQ = el.value; App.render('admin-clients', true); });
  function clientModal(id) {
    const u = Store.user(id);
    const lv = Store.level(u.spent);
    const orders = S().orders.filter(o => o.userId === u.id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const tx = S().bonusTx.filter(t => t.userId === u.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
    modal({
      wide: true, title: u.name,
      body: `<div class="grid g2" style="align-items:start;gap:24px">
        <div class="stack">
          <dl class="kv"><dt>Телефон</dt><dd class="mono">${esc(UI.fmtPhone(u.phone))}</dd><dt>Email</dt><dd>${esc(u.email || '—')}</dd><dt>Клієнт з</dt><dd>${fmtDay(u.joined, true)}</dd><dt>Рівень</dt><dd>${esc(lv.cur.name)} · ${lv.cur.cashback}% · витрачено ${money(u.spent)}</dd><dt>Код запрошення</dt><dd class="mono">${esc(u.ref)}</dd><dt>Персональна знижка</dt><dd>${u.personalDiscount ? u.personalDiscount + '% на роботи' : 'немає'}</dd><dt>Повідомлення</dt><dd>${Object.entries(u.notify || {}).filter(e => e[1]).map(e => ({ viber: 'Viber', sms: 'SMS', email: 'Email' }[e[0]])).join(', ') || 'вимкнено'}</dd></dl>
          <form class="row" data-form="adm-pdisc" style="align-items:end"><input type="hidden" name="id" value="${u.id}">
            <div class="field" style="flex:1 1 160px"><label for="pd-v">Персональна знижка на роботи, %</label><input class="input mono" id="pd-v" name="v" inputmode="numeric" value="${u.personalDiscount || 0}"></div>
            <button class="btn" type="submit">Зберегти</button></form>
          <span class="small muted">Підставляється в кожне нове замовлення клієнта. У будь-якому замовленні її можна змінити.</span>
          <span class="lbl">Авто</span>${Store.carsOf(u.id).map(c => `<div class="tx"><div><b>${esc(carName(c))}</b> ${c.year || ''}<br><small class="mono">${esc(c.plate || '')} ${c.vin ? '· ' + esc(c.vin) : ''}</small></div><span class="mono small">${num(c.mileage)} км</span></div>`).join('') || '<p class="muted small">Немає</p>'}
        </div>
        <div class="stack">
          <div class="bonus-card" style="padding:18px"><span class="eyebrow" style="color:var(--hazard)">Бонусний рахунок</span><div class="bal" style="font-size:2rem">${num(u.bonus)}</div></div>
          <form class="grid" data-form="adm-bonus" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr) auto;align-items:end"><input type="hidden" name="id" value="${u.id}">
            <div class="field"><label for="ab-amt">± балів</label><input class="input mono" id="ab-amt" name="amount" inputmode="numeric" placeholder="+200" required></div>
            <div class="field"><label for="ab-note">Причина</label><input class="input" id="ab-note" name="note" placeholder="Компенсація за затримку" required></div>
            <button class="btn" type="submit">OK</button></form>
          ${tx.map(t => `<div class="tx"><div><b>${esc(t.note)}</b><br><small>${fmtDay(t.at)}</small></div><span class="amt ${t.amount >= 0 ? 'plus' : 'minus'}">${t.amount >= 0 ? '+' : '−'}${num(Math.abs(t.amount))}</span></div>`).join('')}
        </div></div>
        <span class="lbl">Замовлення</span>
        <div class="table-wrap"><table><tbody>${orders.slice(0, 10).map(o => `<tr class="click" data-act="adm-order" data-id="${o.id}"><td class="mono">${esc(o.id)}</td><td>${fmtDay(o.date)}</td><td>${esc(carName(Store.car(o.carId)))}</td><td>${statusPill(o.status)}</td><td class="r mono">${money(o.total)}</td></tr>`).join('') || '<tr><td><div class="empty">Замовлень ще немає</div></td></tr>'}</tbody></table></div>`,
      foot: `<button class="btn" data-act="adm-chat-with" data-id="${u.id}">${icon('chat', 'width="18" height="18"')} Чат</button><button class="btn primary" data-act="modal-close">Закрити</button>`
    });
  }
  App.on('adm-client', el => clientModal(el.dataset.id));
  App.form('adm-pdisc', (f, d) => {
    const u = Store.user(d.id);
    const v = parseInt(d.v, 10) || 0;
    if (v < 0 || v > 50) { toast('Персональна знижка — від 0 до 50%'); return; }
    u.personalDiscount = v;
    // apply to the client's orders that are not in work yet
    S().orders.filter(o => o.userId === u.id && ['new', 'confirmed'].includes(o.status) && (!o.discount || o.discount.reason === 'Персональна знижка клієнта')).forEach(o => { o.discount = Store.defaultDiscount(u); Store.recalc(o); });
    Store.save();
    toast(v ? `Персональна знижка ${v}% збережена` : 'Персональну знижку прибрано', 'ok');
    clientModal(u.id);
    App.render(App.current, true);
  });
  App.form('adm-bonus', (f, d) => {
    const amt = parseInt(String(d.amount).replace(/[^\d-]/g, ''), 10);
    if (!amt) { toast('Вкажіть кількість балів, наприклад 200 або -100'); return; }
    const u = Store.user(d.id);
    if (u.bonus + amt < 0) { toast('На рахунку недостатньо балів'); return; }
    Store.addTx(u.id, amt, 'manual', d.note.trim());
    const c = Store.chatFor(u.id, u.name, u.id);
    c.messages.push({ from: 'admin', text: `${amt > 0 ? 'Нараховано' : 'Списано'} ${num(Math.abs(amt))} балів: ${d.note.trim()}`, at: new Date().toISOString(), by: 'Hundred Garage' });
    c.unreadClient++;
    Store.save();
    toast('Баланс оновлено', 'ok');
    clientModal(u.id);
    App.render(App.current, true);
  });

  // ---------- Services ----------
  App.route('admin-services', {
    area: 'admin', title: 'Послуги і ціни',
    render() {
      return shell('admin-services', `
        <div class="page-title"><div><h1>Послуги і ціни</h1><p class="muted small">Зміни одразу з'являються на сайті і в онлайн-записі. Ціна — для легкового авто, для інших типів множиться на коефіцієнт.</p></div><button class="btn primary" data-act="svc-add">${icon('plus', 'width="18" height="18"')} Послуга</button></div>
        <div class="chips" style="margin-bottom:16px">${Store.CAR_CLASSES.map(c => `<span class="chip" style="cursor:default">${esc(c.name)} <span class="mono">×${c.k}</span></span>`).join('')}</div>
        <div class="table-wrap"><table><thead><tr><th>Послуга</th><th>Категорія</th><th class="r">Ціна, ₴</th><th class="r">Хв</th><th>Популярна</th><th>На сайті</th><th></th></tr></thead><tbody>
        ${S().services.map(s => `<tr><td><b>${esc(s.name)}</b><span class="sub">${esc(s.desc)}</span></td><td class="small">${esc(Store.CATEGORIES.find(c => c.id === s.cat)?.name)}</td>
          <td class="r"><input class="input mono" style="width:96px;text-align:right;min-height:36px" value="${s.price}" inputmode="numeric" data-change="svc-field" data-id="${s.id}" data-k="price" aria-label="Ціна: ${esc(s.name)}"></td>
          <td class="r"><input class="input mono" style="width:70px;text-align:right;min-height:36px" value="${s.dur}" inputmode="numeric" data-change="svc-field" data-id="${s.id}" data-k="dur" aria-label="Тривалість: ${esc(s.name)}"></td>
          <td><label class="switch"><input type="checkbox" ${s.popular ? 'checked' : ''} data-change="svc-flag" data-id="${s.id}" data-k="popular" aria-label="Популярна"></label></td>
          <td><label class="switch"><input type="checkbox" ${s.active ? 'checked' : ''} data-change="svc-flag" data-id="${s.id}" data-k="active" aria-label="Показувати на сайті"></label></td>
          <td><button class="icon-btn" style="width:34px;height:34px" data-act="svc-del" data-id="${s.id}" aria-label="Видалити">${icon('trash', 'width="16" height="16"')}</button></td></tr>`).join('')}
        </tbody></table></div>`);
    }
  });
  App.change('svc-field', el => {
    const s = Store.service(el.dataset.id);
    const v = parseInt(el.value.replace(/\D/g, ''), 10);
    if (!v) { toast('Вкажіть число'); el.value = s[el.dataset.k]; return; }
    s[el.dataset.k] = v;
    Store.save();
    toast(`«${s.name}»: збережено`, 'ok');
  });
  App.change('svc-flag', el => { Store.service(el.dataset.id)[el.dataset.k] = el.checked; Store.save(); });
  App.on('svc-del', el => {
    const s = Store.service(el.dataset.id);
    modal({ title: 'Видалити послугу?', body: `<p>«${esc(s.name)}» зникне з прайсу і онлайн-запису. Щоб тимчасово сховати, краще вимкніть «На сайті».</p>`, foot: `<button class="btn" data-act="modal-close">Скасувати</button><button class="btn primary" data-act="svc-del-yes" data-id="${s.id}">Видалити</button>` });
  });
  App.on('svc-del-yes', el => {
    const used = S().orders.some(o => o.services.includes(el.dataset.id));
    if (used) { Store.service(el.dataset.id).active = false; toast('Послуга є в замовленнях — приховали її з сайту'); }
    else { S().services = S().services.filter(s => s.id !== el.dataset.id); toast('Видалено'); }
    closeModal(); App.refresh();
  });
  App.on('svc-add', () => {
    modal({
      title: 'Нова послуга',
      body: `<form class="stack" data-form="svc-add" id="svc-form"><div class="field"><label for="sa-name">Назва</label><input class="input" id="sa-name" name="name" required></div>
        <div class="field"><label for="sa-desc">Опис для клієнта</label><input class="input" id="sa-desc" name="desc"></div>
        <div class="grid g3"><div class="field"><label for="sa-cat">Категорія</label><select class="input" id="sa-cat" name="cat">${Store.CATEGORIES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="sa-price">Ціна, ₴</label><input class="input mono" id="sa-price" name="price" inputmode="numeric" required></div>
        <div class="field"><label for="sa-dur">Тривалість, хв</label><input class="input mono" id="sa-dur" name="dur" inputmode="numeric" value="60" required></div></div></form>`,
      foot: '<button class="btn" data-act="modal-close">Скасувати</button><button class="btn primary" type="submit" form="svc-form">Додати</button>'
    });
  });
  App.form('svc-add', (f, d) => {
    S().services.push({ id: 's' + Store.next('svc'), cat: d.cat, name: d.name.trim(), desc: d.desc.trim(), price: parseInt(d.price, 10) || 0, dur: parseInt(d.dur, 10) || 60, popular: false, active: true });
    closeModal(); toast('Послугу додано', 'ok'); App.refresh();
  });

  // ---------- Chat inbox ----------
  const lastAt = c => c.messages.length ? c.messages[c.messages.length - 1].at : '';
  App.route('admin-chat', {
    area: 'admin', title: 'Чат',
    render() {
      const chats = [...S().chats].sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
      const sel = S().chats.find(c => c.id === App.state.admChat) || chats[0];
      if (sel && sel.unreadAdmin) { sel.unreadAdmin = 0; Store.save(); }
      const u = sel?.userId ? Store.user(sel.userId) : null;
      const act = u ? Store.activeOrder(u.id) : null;
      return shell('admin-chat', `
        <div class="page-title"><h1>Чат з клієнтами</h1><span class="small muted">Повідомлення з сайту і кабінету. Автовідповідач відповідає на типові питання миттєво.</span></div>
        <div class="inbox">
          <div class="inbox-list">${chats.map(c => { const last = c.messages[c.messages.length - 1]; return `<button class="inbox-item ${sel && c.id === sel.id ? 'on' : ''}" data-act="adm-chat-sel" data-id="${c.id}"><span class="avatar">${esc(initials(c.name))}</span><span style="min-width:0"><b>${esc(c.name)}</b><p>${last ? esc((last.from === 'client' ? '' : 'Ви: ') + last.text) : 'Немає повідомлень'}</p></span><span style="display:grid;justify-items:end;gap:4px"><time>${last ? fmtTime(last.at) : ''}</time>${c.unreadAdmin ? `<span class="side-cnt badge-dot" style="position:static">${c.unreadAdmin}</span>` : ''}</span></button>`; }).join('')}</div>
          ${sel ? `<div class="inbox-conv">
            <div class="conv-head"><b>${esc(sel.name)}</b>${u ? `<span class="mono small muted">${esc(UI.fmtPhone(u.phone))}</span><button class="btn sm" data-act="adm-client" data-id="${u.id}">Картка</button>` : '<span class="pill">гість сайту</span>'}${act ? `<button class="btn sm" data-act="adm-order" data-id="${act.id}">${esc(act.id)} · ${esc(Store.status(act.status).short)}</button>` : ''}</div>
            <div class="msgs" id="adm-msgs">${sel.messages.map(m => `<div class="msg ${m.from === 'client' ? 'in' : m.from === 'bot' ? 'bot' : 'out'}">${m.from === 'bot' ? '<span class="by">Автовідповідач</span>' : ''}${esc(m.text)}<time>${fmtStamp(m.at)}</time></div>`).join('')}</div>
            <div>
              <div class="quick">${['Підтверджую запис, чекаємо!', 'Авто готове, можна забирати', 'Надішлю розрахунок у кабінет', 'Уточню у майстра і повернусь за 10 хв'].map(t => `<button class="chip" data-act="adm-quick" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
              <form class="chat-input" data-form="adm-reply"><input type="hidden" name="id" value="${esc(sel.id)}"><input class="input" id="adm-reply-text" name="text" placeholder="Відповідь клієнту…" autocomplete="off" aria-label="Відповідь"><button class="btn primary" type="submit" aria-label="Надіслати">${icon('send', 'width="18" height="18"')}</button></form>
            </div>
          </div>` : '<div class="empty">Повідомлень ще немає</div>'}
        </div>`);
    },
    mount() { const m = document.getElementById('adm-msgs'); if (m) m.scrollTop = m.scrollHeight; }
  });
  App.on('adm-chat-sel', el => { App.state.admChat = el.dataset.id; App.render('admin-chat', true); });
  App.on('adm-chat-with', el => { const u = Store.user(el.dataset.id); Store.chatFor(u.id, u.name, u.id); App.state.admChat = u.id; closeModal(); App.go('admin-chat'); });
  App.on('adm-quick', el => { const i = document.getElementById('adm-reply-text'); i.value = el.dataset.t; i.focus(); });
  App.form('adm-reply', (f, d) => {
    const text = d.text.trim();
    if (!text) return;
    const c = S().chats.find(x => x.id === d.id);
    c.messages.push({ from: 'admin', text, at: new Date().toISOString(), by: 'Андрій, адміністратор' });
    c.unreadClient++;
    App.state.admChat = c.id;
    Store.save();
    App.render('admin-chat', true);
    document.getElementById('adm-reply-text')?.focus();
  });

  // ---------- Reviews ----------
  App.route('admin-reviews', {
    area: 'admin', title: 'Відгуки',
    render() {
      const list = [...S().reviews].sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || b.at.localeCompare(a.at));
      return shell('admin-reviews', `
        <div class="page-title"><h1>Відгуки</h1><span class="small muted">Опублікуйте відгук — і клієнт з кабінетом отримає +${S().settings.review} балів.</span></div>
        <div class="stack">${list.map(r => `<div class="panel pad stack">
          <div class="row" style="justify-content:space-between"><div><b>${esc(r.name)}</b> <span class="muted small">· ${esc(r.car)} · ${fmtDay(r.at)}</span></div><div class="row"><span class="stars">${UI.stars(r.rating)}</span><span class="pill ${r.status === 'published' ? 'ok' : r.status === 'pending' ? 'warn' : ''}">${r.status === 'published' ? 'опубліковано' : r.status === 'pending' ? 'на модерації' : 'приховано'}</span></div></div>
          <p>${esc(r.text)}</p>
          <form class="row" data-form="rv-reply"><input type="hidden" name="id" value="${r.id}"><input class="input" style="flex:1 1 260px" name="reply" value="${esc(r.reply)}" placeholder="Відповідь від сервісу" aria-label="Відповідь на відгук"><button class="btn sm" type="submit">Зберегти відповідь</button>
            ${r.status !== 'published' ? `<button class="btn sm primary" type="button" data-act="rv-pub" data-id="${r.id}">Опублікувати</button>` : `<button class="btn sm" type="button" data-act="rv-hide" data-id="${r.id}">Приховати</button>`}</form>
        </div>`).join('')}</div>`);
    }
  });
  App.on('rv-pub', el => {
    const r = S().reviews.find(x => x.id === el.dataset.id);
    const first = !r.rewarded;
    r.status = 'published';
    if (first && r.userId) { Store.addTx(r.userId, S().settings.review, 'review', 'Бонус за відгук'); r.rewarded = true; }
    Store.save(); toast(first && r.userId ? `Опубліковано, клієнту +${S().settings.review} балів` : 'Опубліковано', 'ok'); App.refresh();
  });
  App.on('rv-hide', el => { S().reviews.find(x => x.id === el.dataset.id).status = 'hidden'; Store.save(); App.refresh(); });
  App.form('rv-reply', (f, d) => { S().reviews.find(x => x.id === d.id).reply = d.reply.trim(); Store.save(); toast('Відповідь збережено', 'ok'); App.refresh(); });

  // ---------- Loyalty & promos ----------
  App.route('admin-loyalty', {
    area: 'admin', title: 'Бонуси і акції',
    render() {
      const st = S().settings;
      const totalBonus = S().users.reduce((s, u) => s + u.bonus, 0);
      const byLevel = st.levels.map(l => ({ l, n: S().users.filter(u => Store.level(u.spent).cur.id === l.id).length }));
      return shell('admin-loyalty', `
        <div class="page-title"><h1>Бонуси і акції</h1></div>
        <div class="kpis" style="margin-bottom:24px">
          <div class="kpi"><span>Балів на рахунках клієнтів</span><b>${num(totalBonus)}</b><span class="delta">зобов'язання сервісу, ₴</span></div>
          ${byLevel.map(x => `<div class="kpi"><span>Рівень «${esc(x.l.name)}»</span><b>${x.n}</b><span class="delta">${plural(x.n, 'клієнт', 'клієнти', 'клієнтів')}</span></div>`).join('')}
        </div>
        <form class="panel pad stack" data-form="loyalty">
          <h3>Рівні та кешбек</h3>
          <div class="table-wrap" style="background:none"><table><thead><tr><th>Рівень</th><th class="r">Від суми, ₴</th><th class="r">Кешбек, %</th></tr></thead><tbody>
          ${st.levels.map((l, i) => `<tr><td><input class="input" name="name${i}" value="${esc(l.name)}" style="min-height:36px" aria-label="Назва рівня ${i + 1}"></td><td class="r"><input class="input mono" name="min${i}" value="${l.min}" ${i === 0 ? 'readonly' : ''} style="width:120px;text-align:right;min-height:36px" aria-label="Поріг рівня ${i + 1}"></td><td class="r"><input class="input mono" name="cb${i}" value="${l.cashback}" style="width:80px;text-align:right;min-height:36px" aria-label="Кешбек рівня ${i + 1}"></td></tr>`).join('')}
          </tbody></table></div>
          <div class="grid g4">
            <div class="field"><label for="ly-max">Макс. оплата балами, % чеку</label><input class="input mono" id="ly-max" name="maxPayPct" value="${st.maxPayPct}"></div>
            <div class="field"><label for="ly-wel">Вітальні бали</label><input class="input mono" id="ly-wel" name="welcome" value="${st.welcome}"></div>
            <div class="field"><label for="ly-ref">За друга</label><input class="input mono" id="ly-ref" name="referral" value="${st.referral}"></div>
            <div class="field"><label for="ly-rev">За відгук</label><input class="input mono" id="ly-rev" name="review" value="${st.review}"></div>
            <div class="field"><label for="ly-bd">На день народження</label><input class="input mono" id="ly-bd" name="birthday" value="${st.birthday}"></div>
          </div>
          <div><button class="btn primary" type="submit">Зберегти правила</button></div>
        </form>
        <div class="stack" style="margin-top:24px">
          <div class="row" style="justify-content:space-between"><h3>Акції на сайті</h3><button class="btn" data-act="promo-add">${icon('plus', 'width="18" height="18"')} Акція</button></div>
          <div class="grid g3">${S().promos.map(p => `<div class="promo ${p.hz ? 'hz' : ''}" style="${p.active ? '' : 'opacity:.55'}"><span class="tag">${esc(p.tag)}</span><b>${esc(p.title)}</b><p class="muted">${esc(p.text)}</p>
            <div class="row"><label class="switch"><input type="checkbox" ${p.active ? 'checked' : ''} data-change="promo-active" data-id="${p.id}"> Показувати</label><span class="spacer"></span><button class="btn sm" data-act="promo-del" data-id="${p.id}" style="background:transparent">Видалити</button></div></div>`).join('')}</div>
        </div>`);
    }
  });
  App.form('loyalty', (f, d) => {
    const st = S().settings;
    st.levels.forEach((l, i) => { l.name = d['name' + i].trim() || l.name; l.min = i === 0 ? 0 : parseInt(d['min' + i], 10) || l.min; l.cashback = parseFloat(d['cb' + i]) || l.cashback; });
    ['maxPayPct', 'welcome', 'referral', 'review', 'birthday'].forEach(k => { const v = parseInt(d[k], 10); if (!isNaN(v)) st[k] = v; });
    Store.save(); toast('Правила програми оновлено', 'ok'); App.refresh();
  });
  App.change('promo-active', el => { S().promos.find(p => p.id === el.dataset.id).active = el.checked; App.refresh(); });
  App.on('promo-del', el => { S().promos = S().promos.filter(p => p.id !== el.dataset.id); App.refresh(); });
  App.on('promo-add', () => {
    modal({
      title: 'Нова акція',
      body: `<form class="stack" data-form="promo-add" id="promo-form"><div class="grid g2"><div class="field"><label for="pa-tag">Великий напис</label><input class="input" id="pa-tag" name="tag" placeholder="−15%" required></div><div class="field"><label for="pa-until">Діє до</label><input class="input" type="date" id="pa-until" name="until"></div></div>
        <div class="field"><label for="pa-title">Заголовок</label><input class="input" id="pa-title" name="title" required></div>
        <div class="field"><label for="pa-text">Умови</label><textarea class="input" id="pa-text" name="text" required></textarea></div>
        <label class="check"><input type="checkbox" name="hz"> Виділити жовтим</label></form>`,
      foot: '<button class="btn" data-act="modal-close">Скасувати</button><button class="btn primary" type="submit" form="promo-form">Додати</button>'
    });
  });
  App.form('promo-add', (f, d) => {
    S().promos.unshift({ id: 'p' + Store.next('promo'), tag: d.tag.trim(), title: d.title.trim(), text: d.text.trim(), until: d.until, hz: !!d.hz, active: true });
    closeModal(); toast('Акцію додано на сайт', 'ok'); App.refresh();
  });
})();
