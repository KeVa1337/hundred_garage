/* Online booking wizard: services → car → date & time → contacts → confirmation. */
(function () {
  const { esc, money, num, icon, fmtDay, dur, plural, toast, WD, parseDay } = UI;
  const S = () => Store.db;

  const HOURS = { 0: [10, 15], 6: [9, 17] }; // Sun, Sat; weekdays 8–19
  const hoursFor = day => HOURS[parseDay(day).getDay()] || [8, 19];

  function bk() {
    if (!App.state.bk) {
      const me = Store.me();
      const cars = me ? Store.carsOf(me.id) : [];
      App.state.bk = {
        step: 1, services: App.state.cart.length ? [...App.state.cart] : [],
        carId: cars[0]?.id || 'new', car: { make: '', model: '', year: '', plate: '', cls: App.state.cls || 'sedan' },
        date: Store.dayStr(new Date().getHours() >= 17 ? 1 : 0), time: '', name: me?.name || '', phone: me ? UI.fmtPhone(me.phone) : '',
        comment: '', wait: false, cat: App.state.svcCat || 'all', partsPref: 'service'
      };
    }
    return App.state.bk;
  }
  const clsOf = b => b.carId !== 'new' && Store.car(b.carId) ? Store.car(b.carId).cls : b.car.cls;

  // Slot availability: real bookings + deterministic background load so the grid looks like a working week
  function slotBusy(day, h) {
    const now = new Date();
    if (day === Store.dayStr(0) && h <= now.getHours()) return true;
    const taken = S().orders.filter(o => o.date === day && +o.time.slice(0, 2) === h && o.status !== 'cancelled').length;
    let x = 0;
    for (const ch of day + h) x = (x * 31 + ch.charCodeAt(0)) % 997;
    const background = x % 10 < 3 ? 3 : x % 10 < 5 ? 2 : 0;
    return taken + background >= S().bays.length;
  }

  function summary(b) {
    const cls = clsOf(b);
    const items = b.services.map(id => Store.service(id)).filter(Boolean);
    const labor = items.reduce((s, x) => s + Store.priceFor(x.id, cls), 0);
    const time = items.reduce((s, x) => s + x.dur, 0);
    const me = Store.me();
    const disc = me && me.personalDiscount ? Math.round(labor * me.personalDiscount / 100) : 0;
    const total = labor - disc;
    const pct = me ? Store.level(me.spent).cur.cashback : S().settings.levels[0].cashback;
    const car = b.carId !== 'new' ? Store.car(b.carId) : (b.car.make ? b.car : null);
    return `<aside class="jobcard" aria-label="Попередній розрахунок">
      <div class="jobcard-head"><b>Наряд-замовлення</b><span>чернетка</span></div>
      <div class="jobcard-body">
        <div class="jc-line"><span>Авто</span><span>${car ? esc(car.make + ' ' + car.model) : '—'}</span></div>
        <div class="jc-line"><span>Тип</span><span>${esc(Store.carClass(cls).name)}</span></div>
        <div class="jc-line"><span>Дата</span><span>${b.time ? `${fmtDay(b.date)}, ${b.time}` : '—'}</span></div>
        <div class="jc-items">${items.length ? items.map(x => `<div class="jc-line"><span>${esc(x.name)}</span><span>${money(Store.priceFor(x.id, cls))}</span></div>`).join('') : '<span class="muted small">Оберіть хоча б одну послугу</span>'}</div>
        ${disc ? `<div class="jc-line"><span>Ваша знижка ${me.personalDiscount}% на роботи</span><span>−${money(disc)}</span></div>` : ''}
        <div class="jc-line"><span>Запчастини</span><span>${esc({ service: 'підбираємо ми', own: 'ваші', later: 'після огляду' }[b.partsPref])}</span></div>
        <div class="jc-line"><span>Тривалість</span><span>≈ ${time ? dur(time) : '—'}</span></div>
        <div class="jc-total"><span class="muted">Робота, від</span><b>${money(total)}</b></div>
        <div class="jc-bonus">${icon('gift', 'width="20" height="20"')}<span>Після візиту повернемо <b>+${num(total * pct / 100)}</b> балів (${pct}%)</span></div>
        <p class="small muted">${b.partsPref === 'own' ? 'Ви привозите свої запчастини — ми підкажемо артикули, якщо треба.' : 'Ціну кожної запчастини (оригінал і аналог) побачите в кабінеті і погодите до замовлення.'}</p>
      </div></aside>`;
  }

  function stepServices(b) {
    const cat = b.cat || 'all';
    const list = S().services.filter(s => s.active && (cat === 'all' || s.cat === cat));
    const cls = clsOf(b);
    return `<div class="stack">
      <div class="chips"><button class="chip ${cat === 'all' ? 'on' : ''}" data-act="bk-cat" data-cat="all">Усі</button>${Store.CATEGORIES.map(c => `<button class="chip ${cat === c.id ? 'on' : ''}" data-act="bk-cat" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}</div>
      <div class="svc-pick">${list.map(s => {
        const on = b.services.includes(s.id);
        return `<button class="svc-opt ${on ? 'on' : ''}" data-act="bk-svc" data-svc="${s.id}" aria-pressed="${on}"><span class="box">${on ? icon('check') : ''}</span>
          <span style="text-align:left"><b>${esc(s.name)}</b><br><small>${esc(s.desc)} · ${dur(s.dur)}</small></span><span class="mono">${money(Store.priceFor(s.id, cls))}</span></button>`;
      }).join('')}</div>
      <div class="stack" style="gap:8px"><span class="lbl">Запчастини</span>
        <div class="chips">${Object.entries({ service: 'Підберіть і замовте ви', own: 'Привезу свої', later: 'Вирішу після огляду' }).map(([k, t]) => `<button class="chip ${b.partsPref === k ? 'on' : ''}" data-act="bk-parts" data-v="${k}">${t}</button>`).join('')}</div>
        <span class="small muted">${b.partsPref === 'own' ? 'Привезіть запчастини в день візиту. Якщо не впевнені в артикулі — напишіть у чат, підкажемо.' : b.partsPref === 'service' ? 'Покажемо ціни оригіналу й аналога. Замовляємо тільки після вашої згоди в кабінеті.' : 'Майстер огляне авто і запропонує варіанти — тоді й вирішите.'}</span></div>
      <label class="check"><input type="checkbox" id="bk-unsure" ${b.unsure ? 'checked' : ''} data-change="bk-unsure"> <span>Не знаю, що саме потрібно — <b>запишіть на діагностику</b>, опишу симптоми в коментарі</span></label>
    </div>`;
  }

  function stepCar(b) {
    const me = Store.me();
    const cars = me ? Store.carsOf(me.id) : [];
    return `<div class="stack">
      ${cars.length ? `<div class="svc-pick">${cars.map(c => `<button class="svc-opt ${b.carId === c.id ? 'on' : ''}" data-act="bk-car" data-car="${c.id}"><span class="box">${b.carId === c.id ? icon('check') : ''}</span><span style="text-align:left"><b>${esc(c.make + ' ' + c.model)}</b>, ${c.year}<br><small>${esc(c.plate)} · ${num(c.mileage)} км</small></span><span class="pill">${esc(Store.carClass(c.cls).name)}</span></button>`).join('')}
        <button class="svc-opt ${b.carId === 'new' ? 'on' : ''}" data-act="bk-car" data-car="new"><span class="box">${b.carId === 'new' ? icon('check') : ''}</span><span style="text-align:left"><b>Інше авто</b></span><span></span></button></div>` : ''}
      ${b.carId === 'new' ? `<div class="grid g2">
        <div class="field"><label for="bk-make">Марка</label><input class="input" id="bk-make" list="makes" value="${esc(b.car.make)}" data-input="bk-car" data-k="make" placeholder="Volkswagen"></div>
        <div class="field"><label for="bk-model">Модель</label><input class="input" id="bk-model" value="${esc(b.car.model)}" data-input="bk-car" data-k="model" placeholder="Golf VII"></div>
        <div class="field"><label for="bk-year">Рік</label><input class="input" id="bk-year" inputmode="numeric" maxlength="4" value="${esc(b.car.year)}" data-input="bk-car" data-k="year" placeholder="2016"></div>
        <div class="field"><label for="bk-plate">Держномер (необов'язково)</label><input class="input mono" id="bk-plate" value="${esc(b.car.plate)}" data-input="bk-car" data-k="plate" placeholder="AA 1234 BB"></div>
      </div>
      <datalist id="makes">${['Audi', 'BMW', 'Chevrolet', 'Daewoo', 'Ford', 'Honda', 'Hyundai', 'Kia', 'Lexus', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot', 'Renault', 'Skoda', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo', 'ЗАЗ'].map(m => `<option value="${m}">`).join('')}</datalist>
      <div class="field"><span class="lbl">Тип кузова — впливає на ціну</span><div class="chips">${Store.CAR_CLASSES.map(c => `<button class="chip ${b.car.cls === c.id ? 'on' : ''}" data-act="bk-cls" data-cls="${c.id}">${esc(c.name)}</button>`).join('')}</div></div>` : ''}
    </div>`;
  }

  function stepTime(b) {
    const days = [];
    for (let i = 0; i < 14; i++) days.push(Store.dayStr(i));
    const [from, to] = hoursFor(b.date);
    const slots = [];
    for (let h = from; h < to; h++) slots.push(h);
    const freeCount = slots.filter(h => !slotBusy(b.date, h)).length;
    return `<div class="stack">
      <div class="days" role="listbox" aria-label="Дата">${days.map(d => {
        const dt = parseDay(d);
        const full = (() => { const [f, t] = hoursFor(d); for (let h = f; h < t; h++) if (!slotBusy(d, h)) return false; return true; })();
        return `<button class="day ${b.date === d ? 'on' : ''} ${full ? 'off' : ''}" data-act="bk-day" data-day="${d}" role="option" aria-selected="${b.date === d}"><small>${d === Store.dayStr(0) ? 'Сьогодні' : WD[dt.getDay()]}</small><b>${dt.getDate()}</b><small>${UI.MONTHS[dt.getMonth()]}</small></button>`;
      }).join('')}</div>
      <div class="row" style="justify-content:space-between"><span class="lbl">${fmtDay(b.date, true)} · вільно ${freeCount} ${plural(freeCount, 'слот', 'слоти', 'слотів')}</span><span class="small muted">Заштриховане — зайнято</span></div>
      <div class="slots">${slots.map(h => {
        const t = `${String(h).padStart(2, '0')}:00`;
        const busy = slotBusy(b.date, h);
        return `<button class="slot ${b.time === t ? 'on' : ''} ${busy ? 'busy' : ''}" ${busy ? 'disabled aria-disabled="true"' : ''} data-act="bk-time" data-time="${t}">${t}</button>`;
      }).join('')}</div>
      <label class="check"><input type="checkbox" id="bk-wait" ${b.wait ? 'checked' : ''} data-change="bk-wait"> <span>Чекатиму в клієнтській зоні (кава, Wi-Fi)</span></label>
    </div>`;
  }

  function stepContacts(b) {
    const me = Store.me();
    return `<div class="stack">
      <div class="grid g2">
        <div class="field"><label for="bk-name">Ім'я</label><input class="input" id="bk-name" value="${esc(b.name)}" data-input="bk-f" data-k="name" autocomplete="name" placeholder="Як до вас звертатись"></div>
        <div class="field"><label for="bk-phone">Телефон</label><input class="input mono" id="bk-phone" type="tel" value="${esc(b.phone)}" data-input="bk-f" data-k="phone" autocomplete="tel" placeholder="+380 __ ___ __ __"></div>
      </div>
      <div class="field"><label for="bk-comment">Що відбувається з авто? ${b.unsure ? '' : "(необов'язково)"}</label><textarea class="input" id="bk-comment" data-input="bk-f" data-k="comment" placeholder="Наприклад: скрипить при гальмуванні, гірше на холодну">${esc(b.comment)}</textarea></div>
      ${me ? '' : `<div class="note hz">${icon('gift', 'width="20" height="20"')}<span>Ми створимо вам кабінет за номером телефону і нарахуємо <b>${S().settings.welcome} балів</b>. Там ви побачите статус ремонту і погодите роботи.</span></div>`}
      <p class="small muted">Натискаючи «Підтвердити запис», ви погоджуєтесь на обробку персональних даних для запису та нагадувань.</p>
    </div>`;
  }

  const STEPS = [['Послуги', stepServices], ['Авто', stepCar], ['Дата і час', stepTime], ['Контакти', stepContacts]];
  function canGo(b, step) {
    if (step >= 2 && !b.services.length) return 'Оберіть хоча б одну послугу';
    if (step >= 3 && b.carId === 'new' && (!b.car.make.trim() || !b.car.model.trim())) return 'Вкажіть марку і модель авто';
    if (step >= 4 && !b.time) return 'Оберіть вільний час';
    return '';
  }

  App.route('booking', {
    title: 'Онлайн-запис',
    render() {
      const b = bk();
      if (b.done) return doneView(b.done);
      return `<section class="section"><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">Онлайн-запис · 1 хвилина</span><h1 style="font-size:var(--step-3)">Запис на сервіс</h1></div></div>
        <div class="wizard">
          <div class="panel pad" style="min-width:0">
            <nav class="steps-nav" aria-label="Кроки запису">${STEPS.map(([t], i) => `<button class="${b.step === i + 1 ? 'on' : ''} ${b.step > i + 1 ? 'done' : ''}" data-act="bk-step" data-step="${i + 1}"><i>${b.step > i + 1 ? '✓' : i + 1}</i>${t}</button>`).join('')}</nav>
            <div id="bk-body" class="fade-in">${STEPS[b.step - 1][1](b)}</div>
            <hr class="divider" style="margin:20px 0">
            <div class="row" style="justify-content:space-between">
              ${b.step > 1 ? `<button class="btn" data-act="bk-step" data-step="${b.step - 1}">Назад</button>` : '<span></span>'}
              ${b.step < 4 ? `<button class="btn primary" data-act="bk-step" data-step="${b.step + 1}">Далі ${icon('arrow', 'width="18" height="18"')}</button>` : `<button class="btn primary" data-act="bk-confirm">Підтвердити запис</button>`}
            </div>
          </div>
          <div id="bk-summary">${summary(b)}</div>
        </div>
      </div></section>`;
    }
  });

  function doneView(id) {
    const o = Store.order(id);
    const car = Store.car(o.carId);
    return `<section class="section"><div class="wrap" style="max-width:640px"><div class="panel pad stack fade-in" style="justify-items:start">
      <span class="success-mark">${icon('check')}</span>
      <span class="eyebrow">Замовлення ${esc(o.id)}</span>
      <h1 style="font-size:var(--step-3)">Записали! Чекаємо ${fmtDay(o.date)} о ${o.time}</h1>
      <p class="muted">${esc(car.make + ' ' + car.model)} · ${o.services.map(s => esc(Store.service(s).name)).join(', ')}. Адміністратор підтвердить запис у Viber протягом 15 хвилин. За день до візиту надішлемо нагадування.</p>
      <dl class="kv"><dt>Адреса</dt><dd>${esc(S().settings.address)}</dd><dt>Попередньо</dt><dd class="mono">${money(o.total)}</dd><dt>Номер для відстеження</dt><dd class="mono">${esc(o.id)}</dd></dl>
      <div class="row"><a class="btn primary" href="#cabinet">Перейти в кабінет</a><button class="btn" data-act="bk-new">Новий запис</button></div>
    </div></div></section>`;
  }

  function rerender() {
    const b = bk();
    document.getElementById('bk-summary').innerHTML = summary(b);
  }

  App.on('bk-step', el => {
    const b = bk();
    const to = +el.dataset.step;
    const err = to > b.step ? canGo(b, to) : '';
    if (err) { toast(err); return; }
    b.step = to;
    App.render('booking', true);
  });
  App.on('bk-cat', el => { bk().cat = el.dataset.cat; App.render('booking', true); });
  App.on('bk-svc', el => {
    const b = bk();
    const i = b.services.indexOf(el.dataset.svc);
    if (i >= 0) b.services.splice(i, 1); else b.services.push(el.dataset.svc);
    App.state.cart = [...b.services];
    App.render('booking', true);
  });
  App.change('bk-unsure', el => {
    const b = bk();
    b.unsure = el.checked;
    if (el.checked && !b.services.includes('s1')) b.services.push('s1');
    App.render('booking', true);
  });
  App.on('bk-parts', el => { bk().partsPref = el.dataset.v; App.render('booking', true); });
  App.on('bk-car', el => { bk().carId = el.dataset.car; App.render('booking', true); });
  App.on('bk-cls', el => { bk().car.cls = el.dataset.cls; App.render('booking', true); });
  App.input('bk-car', el => { bk().car[el.dataset.k] = el.value; rerender(); });
  App.on('bk-day', el => { const b = bk(); b.date = el.dataset.day; b.time = ''; App.render('booking', true); });
  App.on('bk-time', el => { bk().time = el.dataset.time; App.render('booking', true); });
  App.change('bk-wait', el => { bk().wait = el.checked; });
  App.input('bk-f', el => { bk()[el.dataset.k] = el.value; });
  App.on('bk-new', () => { App.state.bk = null; App.state.cart = []; App.render('booking'); });

  App.on('bk-confirm', () => {
    const b = bk();
    const err = canGo(b, 4);
    if (err) { toast(err); return; }
    if (!b.name.trim()) { toast("Вкажіть ім'я"); return; }
    if (b.phone.replace(/\D/g, '').length < 10) { toast('Вкажіть номер телефону, наприклад +380 67 123 45 67'); return; }
    if (slotBusy(b.date, +b.time.slice(0, 2))) { toast('Цей час щойно зайняли. Оберіть інший'); b.step = 3; b.time = ''; App.render('booking', true); return; }

    let u = Store.me() || Store.findUserByPhone(b.phone);
    let fresh = false;
    if (!u) { u = App.registerUser({ name: b.name.trim(), phone: b.phone }); fresh = true; }
    if (!u.name || u.name === 'Новий клієнт') u.name = b.name.trim();

    let carId = b.carId;
    if (carId === 'new' || !Store.car(carId)) {
      carId = 'c' + Store.next('car');
      S().cars.push({ id: carId, userId: u.id, make: b.car.make.trim(), model: b.car.model.trim(), year: +b.car.year || '', plate: b.car.plate.trim().toUpperCase(), vin: '', engine: '', cls: b.car.cls, mileage: 0 });
    }
    const car = Store.car(carId);
    const h = +b.time.slice(0, 2);
    const busyBays = S().orders.filter(o => o.date === b.date && +o.time.slice(0, 2) === h && o.status !== 'cancelled').map(o => o.bay);
    const catBay = { tires: 'b4', body: 'b4', susp: 'b2', brakes: 'b2', engine: 'b3' }[Store.service(b.services[0]).cat] || 'b1';
    const bay = !busyBays.includes(catBay) ? catBay : (S().bays.find(x => !busyBays.includes(x.id)) || S().bays[0]).id;
    const labor = b.services.reduce((s, id) => s + Store.priceFor(id, car.cls), 0);
    const now = new Date().toISOString();
    const o = {
      id: 'HG-' + Store.next('order'), userId: u.id, carId, services: [...b.services], date: b.date, time: b.time, bay, master: null,
      status: 'new', labor, parts: [], total: labor, items: [], useBonus: 0, earned: 0, comment: b.comment.trim(), waitOnSite: b.wait,
      mileage: car.mileage, createdAt: now, history: [{ status: 'new', at: now }], partsPref: b.partsPref, discount: Store.defaultDiscount(u)
    };
    Store.recalc(o);
    S().orders.push(o);
    const chat = Store.chatFor(u.id, u.name, u.id);
    chat.messages.push({ from: 'bot', text: `Запис ${o.id} створено: ${fmtDay(o.date, true)} о ${o.time}, ${car.make} ${car.model}. Адміністратор підтвердить найближчим часом.`, at: now });
    chat.unreadClient++;
    chat.unreadAdmin++;
    if (Store.session.role === 'guest') App.loginAs(u);
    Store.save();
    b.done = o.id;
    App.state.cart = [];
    toast(fresh ? `Запис створено. Кабінет відкрито, +${S().settings.welcome} балів` : 'Запис створено', 'ok');
    App.render('booking');
  });
})();
