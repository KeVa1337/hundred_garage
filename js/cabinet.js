/* Client cabinet: overview, orders (tracking + approvals), garage & service book, bonuses, profile. */
(function () {
  const { esc, money, num, icon, fmtDay, fmtStamp, dur, plural, toast, modal, closeModal, statusPill, plate, odometer, carName, initials } = UI;
  const S = () => Store.db;

  const MAINT = [
    { svc: ['s4', 's5'], name: 'Заміна масла', km: 10000, months: 12 },
    { svc: ['s24'], name: 'Розвал-сходження', km: 15000, months: 12 },
    { svc: ['s22'], name: 'Обслуговування кондиціонера', km: null, months: 12 },
    { svc: ['s13'], name: 'Гальмівна рідина', km: null, months: 24 },
    { svc: ['s14'], name: 'Ремінь ГРМ', km: 90000, months: 60 }
  ];
  function maintPlan(car) {
    const done = S().orders.filter(o => o.carId === car.id && o.status === 'done');
    return MAINT.map(m => {
      const last = done.filter(o => o.services.some(s => m.svc.includes(s))).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!last) return { ...m, last: null, ratio: null };
      const days = (Date.now() - UI.parseDay(last.date)) / 864e5;
      const rKm = m.km && last.mileage ? (car.mileage - last.mileage) / m.km : 0;
      const rT = days / (m.months * 30.4);
      const ratio = Math.max(rKm, rT);
      const leftKm = m.km && last.mileage ? m.km - (car.mileage - last.mileage) : null;
      return { ...m, last, ratio, leftKm, leftDays: Math.round(m.months * 30.4 - days) };
    }).sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1));
  }
  function maintRows(car, limit = 3) {
    return maintPlan(car).filter(m => m.ratio !== null).slice(0, limit).map(m => {
      const pct = Math.min(100, Math.round(m.ratio * 100));
      const tone = m.ratio >= 1 ? 'bad' : m.ratio >= .8 ? 'warn' : 'ok';
      const left = m.ratio >= 1 ? 'час замінити' : m.leftKm !== null && m.leftKm < (m.leftDays * 40) ? `через ${num(m.leftKm)} км` : `через ${Math.max(1, Math.round(m.leftDays / 30))} міс`;
      return `<div class="maint-row"><span>${esc(m.name)}</span><span class="pill ${tone}">${left}</span><div class="prog light"><i style="width:${pct}%;background:var(--${tone === 'ok' ? 'ink' : tone})"></i></div></div>`;
    }).join('') || '<p class="small muted">Після першого ТО тут з\'явиться графік обслуговування.</p>';
  }

  function shell(active, content) {
    const me = Store.me();
    const lv = Store.level(me.spent);
    const chat = S().chats.find(c => c.id === me.id);
    const approvals = Store.ordersOf(me.id).filter(o => o.status === 'approval').length;
    const link = (r, ic, t, cnt) => `<a href="#${r}" class="${active === r ? 'on' : ''}">${icon(ic)}${t}${cnt ? `<span class="cnt">${cnt}</span>` : ''}</a>`;
    return `<div class="wrap shell">
      <nav class="side" aria-label="Кабінет">
        <div class="side-head"><span class="avatar" style="width:44px;height:44px;font-size:1rem">${esc(initials(me.name))}</span><b>${esc(me.name)}</b><span class="small muted">Рівень «${esc(lv.cur.name)}» · ${num(me.bonus)} балів</span></div>
        ${link('cabinet', 'home', 'Огляд')}
        ${link('cabinet-orders', 'list', 'Замовлення', approvals)}
        ${link('cabinet-garage', 'car', 'Мій гараж')}
        ${link('cabinet-bonus', 'gift', 'Бонуси')}
        ${link('cabinet-profile', 'user', 'Профіль')}
        <button class="sl" data-act="chat-open">${icon('chat')}Чат з сервісом${chat?.unreadClient ? `<span class="cnt">${chat.unreadClient}</span>` : ''}</button>
        <button class="sl" data-act="logout">${icon('logout')}Вийти</button>
      </nav>
      <div class="fade-in" style="min-width:0">${content}</div>
    </div>`;
  }

  function orderRow(o) {
    const car = Store.car(o.carId);
    return `<tr class="click" data-act="order-open" data-id="${o.id}"><td><b class="mono">${esc(o.id)}</b><span class="sub">${fmtDay(o.date)}, ${o.time}</span></td>
      <td>${esc(carName(car))}<span class="sub">${o.services.map(s => esc(Store.service(s).name)).join(', ')}</span></td>
      <td>${statusPill(o.status)}</td><td class="r mono">${money(o.total)}</td></tr>`;
  }

  // ---------- Overview ----------
  App.route('cabinet', {
    area: 'cabinet', title: 'Кабінет',
    render() {
      const me = Store.me();
      const lv = Store.level(me.spent);
      const act = Store.activeOrder(me.id);
      const cars = Store.carsOf(me.id);
      const hour = new Date().getHours();
      const hi = hour < 12 ? 'Доброго ранку' : hour < 18 ? 'Добрий день' : 'Добрий вечір';
      return shell('cabinet', `
        <div class="page-title"><div><span class="eyebrow">Особистий кабінет</span><h1>${hi}, ${esc(me.name.split(' ')[0])}</h1></div><a class="btn primary" href="#booking">Новий запис</a></div>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));align-items:start">
          ${act ? `<div class="panel pad stack">
            <div class="row" style="justify-content:space-between"><div><span class="eyebrow">Зараз · ${esc(act.id)}</span><h3 style="font-size:1.3rem;margin-top:4px">${esc(carName(Store.car(act.carId)))}</h3></div>${statusPill(act.status)}</div>
            ${act.status === 'approval' ? `<div class="note hz">${icon('wrench', 'width="20" height="20"')}<span><b>Потрібне ваше рішення.</b> Майстер підготував роботи і запчастини з цінами — оберіть, що робимо зараз, і варіант запчастин.</span></div>
              <button class="btn primary" data-act="order-open" data-id="${act.id}">Переглянути і погодити</button>` : `<p class="muted">${esc(Store.status(act.status).client)}</p>`}
            ${App.timeline(act)}
            ${act.status !== 'approval' ? `<button class="btn" data-act="order-open" data-id="${act.id}">Деталі замовлення</button>` : ''}
          </div>` : `<div class="panel pad stack"><span class="eyebrow">Активних замовлень немає</span><h3>Коли плануєте наступний візит?</h3><p class="muted">Запис займає хвилину. Вільні слоти видно одразу.</p><a class="btn primary" href="#booking">Записатися</a></div>`}
          <div class="stack">
            <div class="bonus-card">
              <div class="row" style="justify-content:space-between"><span class="eyebrow" style="color:var(--hazard)">Бонусний рахунок</span><span class="pill hz">${esc(lv.cur.name)} · ${lv.cur.cashback}%</span></div>
              <div class="bal">${num(me.bonus)} <span style="font-size:1rem">балів</span></div>
              ${lv.next ? `<div class="stack" style="gap:6px"><div class="prog"><i style="width:${Math.round(lv.progress * 100)}%"></i></div><span class="small muted">До рівня «${esc(lv.next.name)}» (${lv.next.cashback}%) — ще ${money(lv.next.min - me.spent)} візитів</span></div>` : '<span class="small muted">Максимальний рівень. Дякуємо, що ви з нами!</span>'}
              <a class="btn primary" href="#cabinet-bonus" style="justify-self:start">Історія і запрошення друзів</a>
            </div>
            ${cars.slice(0, 2).map(c => `<div class="car"><div class="car-top"><div><b>${esc(carName(c))}</b><div class="small muted">${c.year} · ${plate(c.plate)}</div></div>${odometer(c.mileage)}</div>
              <div class="maint"><span class="lbl">Наступне обслуговування</span>${maintRows(c, 2)}</div></div>`).join('')}
          </div>
        </div>`);
    }
  });

  // ---------- Orders ----------
  App.route('cabinet-orders', {
    area: 'cabinet', title: 'Мої замовлення',
    render() {
      const me = Store.me();
      const all = Store.ordersOf(me.id);
      const active = all.filter(o => !['done', 'cancelled'].includes(o.status));
      const past = all.filter(o => ['done', 'cancelled'].includes(o.status));
      const table = list => `<div class="table-wrap"><table><thead><tr><th>Замовлення</th><th>Авто і роботи</th><th>Статус</th><th class="r">Сума</th></tr></thead><tbody>${list.map(orderRow).join('')}</tbody></table></div>`;
      return shell('cabinet-orders', `
        <div class="page-title"><h1>Замовлення</h1><a class="btn primary" href="#booking">Новий запис</a></div>
        <div class="stack" style="gap:28px">
          <div class="stack"><span class="lbl">Активні</span>${active.length ? table(active) : '<div class="panel empty">Активних замовлень немає</div>'}</div>
          <div class="stack"><span class="lbl">Історія</span>${past.length ? table(past) : '<div class="panel empty">Історія порожня</div>'}</div>
        </div>`);
    }
  });

  const PART_TONE = id => Store.partStatus(id).tone;
  function partsBlock(o, draft, isApproval) {
    const lines = o.parts || [];
    if (!lines.length) {
      return `<div class="stack"><h3>Запчастини</h3><p class="small muted">${esc(Store.PARTS_PREF[o.partsPref || 'service'])}. ${o.partsPref === 'own' ? 'Майстер напише, які саме запчастини потрібні, якщо ви ще не впевнені.' : 'Після огляду тут з\'являться позиції з цінами — замовимо лише після вашої згоди.'}</p></div>`;
    }
    const awaiting = lines.filter(l => l.source === 'client' && l.status === 'awaiting');
    return `<div class="stack"><div class="row" style="justify-content:space-between"><h3>Запчастини</h3><span class="small muted">${esc(Store.PARTS_PREF[o.partsPref || 'service'])}</span></div>
      ${awaiting.length ? `<div class="note hz">${icon('wrench', 'width="20" height="20"')}<span><b>Привезіть, будь ласка:</b> ${awaiting.map(l => `${esc(l.name)}${l.code ? ` <span class="mono">(${esc(l.brand)} ${esc(l.code)})</span>` : ''}`).join(', ')}</span></div>` : ''}
      <div>${lines.map(l => {
        const opt = Store.partOpt(l);
        const quote = l.status === 'quote' && l.approved === null;
        const v = draft['p:' + l.id];
        const optBtn = (key, title, o2) => `<button class="opt ${v === key ? 'on' : ''} ${key === 'no' ? 'neg' : ''}" data-act="dec" data-order="${o.id}" data-item="p:${l.id}" data-v="${key}"><span class="small muted">${title}</span>${o2 ? `<b>${money(o2.price * (l.qty || 1))}</b><span class="small">${esc(o2.brand)} · ${o2.stock ? 'на складі' : esc(o2.eta || 'під замовлення')}</span>` : ''}</button>`;
        return `<div class="part-row">
          <div style="min-width:0"><b>${esc(l.name)}</b>${(l.qty || 1) > 1 ? ` <span class="mono">× ${l.qty}</span>` : ''}<div class="meta">${l.source === 'client' ? 'запчастина клієнта' : l.status === 'request' ? 'майстер запросив — підбираємо ціну' : `${esc(opt.brand)} ${esc(opt.code)}`}</div></div>
          <div class="pr">${l.source === 'client' ? '<span class="muted">ваша</span>' : l.status === 'request' ? '<span class="muted">—</span>' : quote && !v ? `<span class="muted">від ${money(Math.min(l.price, l.alt?.price ?? l.price) * (l.qty || 1))}</span>` : l.approved === false ? '<span class="muted">—</span>' : money(Store.partCost(l))}<br><span class="pill ${PART_TONE(l.status)}">${esc(Store.partStatus(l.status).short)}</span></div>
          ${quote && isApproval ? `<div class="opts">${optBtn('main', l.alt ? 'Оригінал / основний' : 'Замовити', { brand: l.brand, price: l.price, stock: l.stock, eta: l.eta })}${l.alt ? optBtn('alt', 'Аналог', l.alt) : ''}${optBtn('own', 'Привезу свою')}${optBtn('no', 'Не треба')}</div>` : ''}
          ${!quote && ['ordered', 'to_order'].includes(l.status) && opt.eta ? `<div class="meta" style="grid-column:1/-1">Очікуємо: ${esc(opt.eta)}</div>` : ''}
        </div>`;
      }).join('')}</div></div>`;
  }

  function costBlock(o, car) {
    const b = Store.breakdown(o);
    const partsCnt = (o.parts || []).filter(l => Store.partCost(l) > 0).length;
    return `<div class="jc-items" style="border-top:0;padding-top:0">
        ${o.services.map(s => `<div class="jc-line"><span>${esc(Store.service(s).name)}</span><span>${money(Store.priceFor(s, car.cls))}</span></div>`).join('')}
        ${b.extras ? `<div class="jc-line"><span>Погоджені додаткові роботи</span><span>${money(b.extras)}</span></div>` : ''}
        ${b.parts ? `<div class="jc-line"><span>Запчастини · ${partsCnt} ${plural(partsCnt, 'позиція', 'позиції', 'позицій')}</span><span>${money(b.parts)}</span></div>` : ''}
        ${b.discount ? `<div class="jc-line" style="color:var(--ok)"><span>Знижка ${esc(Store.discountLabel(o.discount))}</span><span>−${money(b.discount)}</span></div>` : ''}
        ${o.useBonus ? `<div class="jc-line"><span>Оплата балами</span><span>−${money(o.useBonus)}</span></div>` : ''}
      </div>
      <div class="jc-total"><span class="muted">${o.status === 'done' ? 'Сплачено' : 'До сплати'}</span><b>${money(b.total - (o.useBonus || 0))}</b></div>`;
  }

  function orderModal(id) {
    const o = Store.order(id);
    if (!o) return;
    const me = Store.me();
    const car = Store.car(o.carId);
    const m = Store.master(o.master);
    const st = S().settings;
    const isApproval = o.status === 'approval';
    const draft = App.state.decisions?.[o.id] || {};
    const pending = o.items.filter(i => i.sev !== 'green');
    const quotes = (o.parts || []).filter(l => l.status === 'quote' && l.approved === null);
    const draftSum = pending.reduce((s, i) => s + ((draft[i.id] ?? i.decision) === 'yes' ? i.price : 0), 0)
      + quotes.reduce((s, l) => { const v = draft['p:' + l.id]; return s + (v === 'main' ? l.price : v === 'alt' && l.alt ? l.alt.price : 0) * (l.qty || 1); }, 0);
    const allDecided = pending.every(i => (draft[i.id] ?? i.decision)) && quotes.every(l => draft['p:' + l.id]);
    const maxBonus = Math.min(me.bonus + (o.useBonus || 0), Math.floor(o.total * st.maxPayPct / 100));
    const canBonus = !['done', 'cancelled'].includes(o.status) && me.bonus + (o.useBonus || 0) > 0;
    const reviewed = S().reviews.some(r => r.orderId === o.id);

    const items = o.items.length ? `<div class="stack"><div class="row" style="justify-content:space-between"><h3>Результати огляду</h3>${isApproval ? '<span class="pill bad">чекає рішення</span>' : ''}</div>
      <div class="row small muted"><span><span class="pill bad">критично</span></span><span><span class="pill warn">можна відкласти</span></span><span><span class="pill ok">в нормі</span></span></div>
      <div class="insp">${o.items.map(i => {
        const dec = draft[i.id] ?? i.decision;
        return `<div class="insp-item"><span class="sev ${i.sev}"></span><div><b>${esc(i.name)}</b><p>${esc(i.note)}${i.price ? ` · <span class="mono">${money(i.price)}</span>` : ''}</p>${UI.photoThumb(i)}</div>
          <div class="act">${i.sev === 'green' ? '<span class="pill ok">OK</span>' : isApproval ? `<div class="seg" role="group" aria-label="Рішення"><button class="yes ${dec === 'yes' ? 'on' : ''}" data-act="dec" data-order="${o.id}" data-item="${i.id}" data-v="yes">Робити</button><button class="no ${dec === 'no' ? 'on' : ''}" data-act="dec" data-order="${o.id}" data-item="${i.id}" data-v="no">Пізніше</button></div>` : dec === 'yes' ? '<span class="pill ok">погоджено</span>' : dec === 'no' ? '<span class="pill">відкладено</span>' : ''}</div></div>`;
      }).join('')}</div></div>` : '';

    const decide = isApproval ? `<div class="panel pad stack" style="background:var(--panel-2)"><div class="row" style="justify-content:space-between"><span class="muted">Ви погодили додатково: <b class="mono" style="color:var(--ink)">${money(draftSum)}</b></span><button class="btn primary" data-act="dec-send" data-id="${o.id}" ${allDecided ? '' : 'disabled'}>Надіслати рішення майстру</button></div>
        <p class="small muted">${allDecided ? 'Готово до відправки.' : 'Оберіть варіант для кожної роботи і запчастини.'} Відкладене збережемо в сервісній книжці і нагадаємо перед наступним візитом.</p></div>` : '';

    modal({
      wide: true,
      title: `Замовлення ${o.id}`,
      body: `<div class="row" style="justify-content:space-between"><div><b style="font:700 1.25rem var(--f-display)">${esc(carName(car))}</b><div class="small muted">${esc(car.plate)} · ${fmtDay(o.date, true)}, ${o.time} · ${esc(m ? m.name : 'майстра буде призначено')}</div></div>${statusPill(o.status)}</div>
        ${items}
        ${partsBlock(o, draft, isApproval)}
        ${decide}
        <div class="grid g2" style="align-items:start;gap:24px">
          <div class="stack"><h3>Етапи</h3>${App.timeline(o)}</div>
          <div class="stack">
            <h3>Вартість</h3>
            <div id="cost-block" class="stack" style="gap:12px">${costBlock(o, car)}</div>
            ${o.status === 'done' ? `<div class="jc-bonus">${icon('gift', 'width="20" height="20"')}<span>Нараховано <b>+${num(o.earned)}</b> балів</span></div>` : ''}
            ${canBonus ? `<div class="panel pad stack" style="background:var(--panel-2)"><label class="lbl" for="use-bonus">Списати балами: <b class="mono" id="use-bonus-v" style="color:var(--ink)">${num(o.useBonus || 0)}</b> з ${num(maxBonus)} можливих</label>
              <input type="range" id="use-bonus" min="0" max="${maxBonus}" step="10" value="${o.useBonus || 0}" data-input="use-bonus" data-id="${o.id}" style="width:100%;accent-color:var(--ink)">
              <span class="small muted">Не більше ${st.maxPayPct}% чеку. Бали спишуться при видачі авто.</span></div>` : ''}
          </div>
        </div>
        ${o.comment ? `<div class="note"><b>Ваш коментар:</b> ${esc(o.comment)}</div>` : ''}`,
      foot: `${['new', 'confirmed'].includes(o.status) ? `<button class="btn danger" data-act="order-cancel" data-id="${o.id}">Скасувати запис</button>` : ''}
        ${o.status === 'done' && !reviewed ? `<button class="btn" data-act="order-review" data-id="${o.id}">${icon('star', 'width="18" height="18"')} Залишити відгук · +${st.review}</button>` : ''}
        ${o.status === 'done' ? `<button class="btn" data-act="order-repeat" data-id="${o.id}">Повторити запис</button>` : ''}
        <button class="btn" data-act="chat-open">Написати майстру</button>
        <button class="btn primary" data-act="modal-close">Готово</button>`
    });
  }
  App.orderModal = orderModal;

  App.on('order-open', el => {
    if (Store.session.role === 'admin') { App.adminOrder(el.dataset.id); return; }
    if (Store.session.role === 'master') { App.masterOrder(el.dataset.id); return; }
    if (Store.session.role !== 'client') { App.loginModal(); return; }
    orderModal(el.dataset.id);
  });
  App.on('dec', el => {
    const d = (App.state.decisions ||= {});
    (d[el.dataset.order] ||= {})[el.dataset.item] = el.dataset.v;
    const scroll = document.querySelector('.modal')?.scrollTop;
    orderModal(el.dataset.order);
    const md = document.querySelector('.modal');
    if (md && scroll) md.scrollTop = scroll;
  });
  App.on('dec-send', el => {
    const o = Store.order(el.dataset.id);
    const d = App.state.decisions?.[o.id] || {};
    o.items.forEach(i => { if (i.sev !== 'green' && d[i.id]) i.decision = d[i.id]; });
    (o.parts || []).forEach(l => {
      const v = d['p:' + l.id];
      if (!v || l.status !== 'quote') return;
      if (v === 'no') { l.approved = false; l.status = 'declined'; return; }
      l.approved = true;
      if (v === 'own') { l.source = 'client'; l.status = 'awaiting'; return; }
      l.choice = v;
      l.status = Store.partOpt(l).stock ? 'in_stock' : 'to_order';
    });
    Store.recalc(o);
    if (o.useBonus > Math.floor(o.total * S().settings.maxPayPct / 100)) o.useBonus = Math.floor(o.total * S().settings.maxPayPct / 100);
    const waiting = (o.parts || []).some(l => l.approved !== false && ['to_order', 'ordered', 'awaiting'].includes(l.status));
    Store.setStatus(o, waiting ? 'parts' : 'repair');
    const yes = o.items.filter(i => i.decision === 'yes').map(i => i.name.split(' — ')[0]);
    const partsYes = (o.parts || []).filter(l => d['p:' + l.id] && l.approved).map(l => `${l.name} (${l.source === 'client' ? 'привезу сам' : Store.partOpt(l).brand})`);
    const me = Store.me();
    const chat = Store.chatFor(me.id, me.name, me.id);
    chat.messages.push({ from: 'client', text: `Погоджую по ${o.id}: ${yes.join(', ') || 'без додаткових робіт'}.${partsYes.length ? '\nЗапчастини: ' + partsYes.join(', ') + '.' : ''}`, at: new Date().toISOString() });
    chat.unreadAdmin++;
    delete App.state.decisions[o.id];
    Store.save();
    toast(waiting ? 'Рішення надіслано. Замовляємо запчастини — повідомимо, коли прибудуть' : 'Рішення надіслано. Майстер уже працює', 'ok');
    orderModal(o.id);
    App.render(App.current, true);
  });
  App.input('use-bonus', el => {
    const o = Store.order(el.dataset.id);
    const v = +el.value;
    const me = Store.me();
    // Reserve bonus points on the order; they are charged at hand-over
    me.bonus += (o.useBonus || 0) - v;
    o.useBonus = v;
    document.getElementById('use-bonus-v').textContent = num(v);
    const cb = document.getElementById('cost-block');
    if (cb) cb.innerHTML = costBlock(o, Store.car(o.carId));
    Store.save();
  });
  App.on('order-cancel', el => {
    const o = Store.order(el.dataset.id);
    modal({
      title: 'Скасувати запис?',
      body: `<p>Запис ${esc(o.id)} на ${fmtDay(o.date, true)} о ${o.time} буде скасовано, час звільниться для інших клієнтів.</p>`,
      foot: `<button class="btn" data-act="order-open" data-id="${o.id}">Ні, залишити</button><button class="btn primary" data-act="order-cancel-yes" data-id="${o.id}">Так, скасувати</button>`
    });
  });
  App.on('order-cancel-yes', el => {
    const o = Store.order(el.dataset.id);
    if (o.useBonus) { Store.user(o.userId).bonus += o.useBonus; o.useBonus = 0; }
    Store.setStatus(o, 'cancelled');
    Store.save();
    closeModal();
    toast('Запис скасовано');
    App.render(App.current, true);
  });
  App.on('order-review', el => { App.state.reviewOrder = el.dataset.id; App.actions['review-new'](); });
  App.on('order-repeat', el => {
    const o = Store.order(el.dataset.id);
    closeModal();
    App.state.cart = [...o.services];
    App.state.bk = null;
    App.go('booking');
    App.state.bk.carId = o.carId;
    App.render('booking', true);
  });

  // ---------- Garage ----------
  App.route('cabinet-garage', {
    area: 'cabinet', title: 'Мій гараж',
    render() {
      const me = Store.me();
      const cars = Store.carsOf(me.id);
      return shell('cabinet-garage', `
        <div class="page-title"><h1>Мій гараж</h1><button class="btn" data-act="car-add">${icon('plus', 'width="18" height="18"')} Додати авто</button></div>
        <div class="grid g2" style="align-items:start">${cars.map(c => {
          const book = S().orders.filter(o => o.carId === c.id && o.status === 'done').length;
          return `<div class="car">
            <div class="car-top"><div><b>${esc(carName(c))}</b><div class="small muted">${c.year}${c.engine ? ' · ' + esc(c.engine) : ''}</div></div>${plate(c.plate || '—')}</div>
            <div class="row" style="justify-content:space-between">${odometer(c.mileage)}<button class="link-btn small" data-act="car-km" data-id="${c.id}">Оновити пробіг</button></div>
            ${c.vin ? `<div class="small muted mono">VIN ${esc(c.vin)}</div>` : ''}
            <div class="maint"><span class="lbl">План обслуговування</span>${maintRows(c, 5)}</div>
            <div class="row"><button class="btn sm" data-act="car-book" data-id="${c.id}">Сервісна книжка · ${book}</button><button class="btn sm primary" data-act="car-booking" data-id="${c.id}">Записати це авто</button><span class="spacer"></span><button class="btn sm ghost danger" data-act="car-del" data-id="${c.id}" aria-label="Видалити авто">${icon('trash', 'width="16" height="16"')}</button></div>
          </div>`;
        }).join('') || '<div class="panel empty">Додайте авто — і ми нагадаємо про ТО вчасно</div>'}</div>`);
    }
  });
  App.on('car-book', el => {
    const c = Store.car(el.dataset.id);
    const list = S().orders.filter(o => o.carId === c.id && o.status === 'done').sort((a, b) => b.date.localeCompare(a.date));
    const postponed = S().orders.filter(o => o.carId === c.id).flatMap(o => o.items.filter(i => i.decision === 'no').map(i => ({ ...i, date: o.date })));
    modal({
      wide: true, title: `Сервісна книжка · ${carName(c)}`,
      body: `${postponed.length ? `<div class="note hz">${icon('wrench', 'width="20" height="20"')}<span><b>Відкладено на потім:</b> ${postponed.map(p => esc(p.name.split(' — ')[0])).join(', ')}</span></div>` : ''}
        ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Дата</th><th>Пробіг</th><th>Роботи</th><th class="r">Сума</th></tr></thead><tbody>${list.map(o => `<tr class="click" data-act="order-open" data-id="${o.id}"><td class="mono">${fmtDay(o.date, true)}</td><td class="mono">${o.mileage ? num(o.mileage) + ' км' : '—'}</td><td>${o.services.map(s => esc(Store.service(s).name)).join(', ')}<span class="sub">${esc(Store.master(o.master)?.name || '')}</span></td><td class="r mono">${money(o.total)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Записів ще немає</div>'}`
    });
  });
  App.on('car-booking', el => {
    App.state.bk = null; App.state.cart = [];
    App.go('booking');
    App.state.bk.carId = el.dataset.id;
    App.render('booking', true);
  });
  App.on('car-km', el => {
    const c = Store.car(el.dataset.id);
    modal({
      title: 'Поточний пробіг',
      body: `<form class="stack" data-form="car-km" id="km-form"><input type="hidden" name="id" value="${c.id}"><div class="field"><label for="km-v">${esc(carName(c))}, км</label><input class="input mono" id="km-v" name="km" inputmode="numeric" value="${c.mileage}" required></div><p class="small muted">Пробіг потрібен, щоб вчасно нагадати про ТО.</p></form>`,
      foot: '<button class="btn" data-act="modal-close">Скасувати</button><button class="btn primary" type="submit" form="km-form">Зберегти</button>'
    });
  });
  App.form('car-km', (f, d) => {
    const c = Store.car(d.id);
    const km = parseInt(String(d.km).replace(/\D/g, ''), 10);
    if (!km || km < 0) { toast('Вкажіть пробіг числом'); return; }
    c.mileage = km;
    closeModal(); toast('Пробіг оновлено', 'ok'); App.refresh();
  });
  App.on('car-add', () => {
    modal({
      title: 'Нове авто',
      body: `<form class="stack" data-form="car-add" id="car-form"><div class="grid g2">
        <div class="field"><label for="ca-make">Марка</label><input class="input" id="ca-make" name="make" required></div>
        <div class="field"><label for="ca-model">Модель</label><input class="input" id="ca-model" name="model" required></div>
        <div class="field"><label for="ca-year">Рік</label><input class="input" id="ca-year" name="year" inputmode="numeric" maxlength="4"></div>
        <div class="field"><label for="ca-plate">Держномер</label><input class="input mono" id="ca-plate" name="plate"></div>
        <div class="field"><label for="ca-km">Пробіг, км</label><input class="input mono" id="ca-km" name="km" inputmode="numeric"></div>
        <div class="field"><label for="ca-cls">Тип</label><select class="input" id="ca-cls" name="cls">${Store.CAR_CLASSES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      </div><div class="field"><label for="ca-vin">VIN (необов'язково)</label><input class="input mono" id="ca-vin" name="vin" maxlength="17"></div></form>`,
      foot: '<button class="btn" data-act="modal-close">Скасувати</button><button class="btn primary" type="submit" form="car-form">Додати</button>'
    });
  });
  App.form('car-add', (f, d) => {
    const me = Store.me();
    S().cars.push({ id: 'c' + Store.next('car'), userId: me.id, make: d.make.trim(), model: d.model.trim(), year: +d.year || '', plate: d.plate.trim().toUpperCase(), vin: d.vin.trim().toUpperCase(), engine: '', cls: d.cls, mileage: parseInt(d.km, 10) || 0 });
    closeModal(); toast('Авто додано в гараж', 'ok'); App.refresh();
  });
  App.on('car-del', el => {
    const c = Store.car(el.dataset.id);
    modal({
      title: 'Видалити авто?',
      body: `<p>${esc(carName(c))} зникне з гаража. Історія ремонтів залишиться в сервісі.</p>`,
      foot: `<button class="btn" data-act="modal-close">Скасувати</button><button class="btn primary" data-act="car-del-yes" data-id="${c.id}">Видалити</button>`
    });
  });
  App.on('car-del-yes', el => {
    const c = Store.car(el.dataset.id);
    c.userId = null;
    closeModal(); toast('Авто видалено з гаража'); App.refresh();
  });

  // ---------- Bonuses ----------
  const TX_LABEL = { earn: 'Кешбек', spend: 'Оплата балами', welcome: 'Вітальний', referral: 'Запрошення', review: 'Відгук', manual: 'Від сервісу', birthday: 'День народження' };
  App.route('cabinet-bonus', {
    area: 'cabinet', title: 'Бонуси',
    render() {
      const me = Store.me();
      const st = S().settings;
      const lv = Store.level(me.spent);
      const tx = S().bonusTx.filter(t => t.userId === me.id).sort((a, b) => b.at.localeCompare(a.at));
      const reserved = S().orders.filter(o => o.userId === me.id && o.useBonus && !o.closed).reduce((s, o) => s + o.useBonus, 0);
      return shell('cabinet-bonus', `
        <div class="page-title"><h1>Бонуси</h1><a class="btn ghost" href="#bonus">Правила програми</a></div>
        <div class="grid g2" style="align-items:start">
          <div class="stack">
            <div class="bonus-card">
              <span class="eyebrow" style="color:var(--hazard)">Доступно</span>
              <div class="bal">${num(me.bonus)} <span style="font-size:1rem">балів</span></div>
              ${reserved ? `<span class="small muted">Ще ${num(reserved)} зарезервовано на активне замовлення</span>` : ''}
              <span class="small muted">1 бал = 1 ₴ · до ${st.maxPayPct}% чеку · бали не згорають</span>
            </div>
            <div class="panel pad stack">
              <div class="row" style="justify-content:space-between"><h3>Рівень «${esc(lv.cur.name)}»</h3><span class="pill hz">${lv.cur.cashback}% кешбеку</span></div>
              <div class="prog light"><i style="width:${Math.round(lv.progress * 100)}%"></i></div>
              <span class="small muted">${lv.next ? `Витрачено ${money(me.spent)}. До «${esc(lv.next.name)}» — ${money(lv.next.min - me.spent)}` : 'Ви на найвищому рівні'}</span>
              <div class="chips">${st.levels.map(l => `<span class="chip ${l.id === lv.cur.id ? 'on' : ''}" style="cursor:default">${esc(l.name)} · ${l.cashback}%</span>`).join('')}</div>
            </div>
            <div class="panel pad stack">
              <h3>Запросіть друга — +${st.referral} балів</h3>
              <p class="small muted">Друг вводить ваш код при першому записі й отримує ${st.referral} балів. Ви — стільки ж після його візиту.</p>
              <div class="copy-field"><input class="input" id="ref-code" value="${esc(me.ref)}" readonly aria-label="Код запрошення"><button class="btn" data-act="copy" data-target="ref-code">Копіювати</button></div>
            </div>
          </div>
          <div class="panel pad"><h3 style="margin-bottom:8px">Історія</h3>${tx.map(t => `<div class="tx"><div><b>${esc(TX_LABEL[t.type] || 'Операція')}</b><br><small>${esc(t.note)} · ${fmtDay(t.at)}</small></div><span class="amt ${t.amount >= 0 ? 'plus' : 'minus'}">${t.amount >= 0 ? '+' : '−'}${num(Math.abs(t.amount))}</span></div>`).join('') || '<div class="empty">Операцій ще немає</div>'}</div>
        </div>`);
    }
  });

  // ---------- Profile ----------
  App.route('cabinet-profile', {
    area: 'cabinet', title: 'Профіль',
    render() {
      const me = Store.me();
      const n = me.notify || {};
      return shell('cabinet-profile', `
        <div class="page-title"><h1>Профіль</h1></div>
        <form class="panel pad stack" data-form="profile" style="max-width:640px">
          <div class="grid g2">
            <div class="field"><label for="pf-name">Ім'я та прізвище</label><input class="input" id="pf-name" name="name" value="${esc(me.name)}" required></div>
            <div class="field"><label for="pf-phone">Телефон</label><input class="input mono" id="pf-phone" value="${esc(UI.fmtPhone(me.phone))}" disabled></div>
            <div class="field"><label for="pf-email">Email</label><input class="input" id="pf-email" name="email" type="email" value="${esc(me.email)}"></div>
            <div class="field"><label for="pf-bd">День народження · +${S().settings.birthday} балів</label><input class="input" id="pf-bd" name="birthday" type="date" value="${esc(me.birthday || '')}"></div>
          </div>
          <hr class="divider">
          <span class="lbl">Повідомлення про статус ремонту і нагадування</span>
          <label class="switch"><input type="checkbox" name="viber" ${n.viber ? 'checked' : ''}> Viber</label>
          <label class="switch"><input type="checkbox" name="sms" ${n.sms ? 'checked' : ''}> SMS</label>
          <label class="switch"><input type="checkbox" name="email_n" ${n.email ? 'checked' : ''}> Email</label>
          <div class="row"><button class="btn primary" type="submit">Зберегти</button><button class="btn ghost" type="button" data-act="logout">Вийти з кабінету</button></div>
        </form>`);
    }
  });
  App.form('profile', (f, d) => {
    const me = Store.me();
    me.name = d.name.trim() || me.name;
    me.email = d.email.trim();
    me.birthday = d.birthday;
    me.notify = { viber: !!d.viber, sms: !!d.sms, email: !!d.email_n };
    const c = S().chats.find(x => x.id === me.id);
    if (c) c.name = me.name;
    toast('Профіль збережено', 'ok');
    App.refresh();
  });
})();
