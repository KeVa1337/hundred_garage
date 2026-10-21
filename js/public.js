/* Public pages: home, services & prices, tracking, bonus program, contacts. */
(function () {
  const { esc, money, num, icon, fmtDay, fmtStamp, fmtTime, dur, stars, plural, toast, modal, closeModal } = UI;
  const S = () => Store.db;

  const FLOW = Store.FLOW;
  const progressOf = st => Math.max(0, FLOW.indexOf(st) - 1) / (FLOW.length - 2);
  const maskPlate = p => p.replace(/^(\S+) (\d)\d\d(\d)/, '$1 $2••$3');

  function bayBoard() {
    const today = Store.dayStr(0);
    const live = S().orders.filter(o => o.date === today && ['accepted', 'diagnostics', 'approval', 'parts', 'repair', 'qc', 'ready'].includes(o.status));
    const rows = S().bays.map(b => {
      const o = live.find(x => x.bay === b.id);
      const no = b.name.replace(/\D/g, '');
      if (!o) {
        const next = S().orders.filter(x => x.date === today && x.bay === b.id && ['new', 'confirmed'].includes(x.status)).sort((a, c) => a.time.localeCompare(c.time))[0];
        return `<div class="bay free"><div class="bay-no">Пост<b>${no}</b></div><div class="bay-car"><strong>Вільний</strong><span>${esc(b.kind)}${next ? ` · наступне авто о ${next.time}` : ''}</span></div><div class="bay-st">—</div></div>`;
      }
      const car = Store.car(o.carId);
      const pct = Math.round(progressOf(o.status) * 100);
      return `<div class="bay"><div class="bay-no">Пост<b>${no}</b></div>
        <div class="bay-car"><strong>${esc(car.make + ' ' + car.model)}</strong><span>${UI.plate(maskPlate(car.plate))} · ${esc(Store.service(o.services[0]).name)}</span>
        <div class="bar"><i style="width:${pct}%"></i></div></div>
        <div class="bay-st">${esc(Store.status(o.status).short)}<br>${pct}%</div></div>`;
    }).join('');
    const now = new Date();
    return `<div class="board" aria-label="Завантаженість постів зараз">
      <div class="board-head"><span>Цех · ${fmtDay(Store.dayStr(0), true)}</span><span class="live">наживо ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}</span></div>
      ${rows}
      <div class="board-head" style="padding-top:4px"><span>Номери приховано</span><a href="#track" style="color:#F5C430">Відстежити своє авто →</a></div>
    </div>`;
  }

  function rating() {
    const pub = S().reviews.filter(r => r.status === 'published');
    const avg = pub.reduce((s, r) => s + r.rating, 0) / (pub.length || 1);
    return { avg: Math.round(avg * 10) / 10, count: pub.length };
  }

  function reviewCard(r) {
    return `<article class="review"><div class="stars" aria-label="Оцінка ${r.rating} з 5">${stars(r.rating)}</div><p>${esc(r.text)}</p>
      <div class="who"><b>${esc(r.name)}</b><span>${esc(r.car)} · ${fmtDay(r.at)}</span></div>
      ${r.reply ? `<div class="reply"><b class="small">Hundred Garage:</b> ${esc(r.reply)}</div>` : ''}</article>`;
  }

  // ---------- HOME ----------
  App.route('home', {
    title: 'Автосервіс у Києві',
    render() {
      const st = S().settings;
      const rt = rating();
      const popular = S().services.filter(s => s.popular && s.active).slice(0, 8);
      return `
      <section class="hero"><div class="wrap hero-grid">
        <div class="hero-copy fade-in">
          <span class="eyebrow">Автосервіс · Київ · 4 пости</span>
          <h1>Ремонт, який видно <span>до гвинтика</span></h1>
          <p class="lead">Записуйтесь онлайн за хвилину, стежте за ремонтом у реальному часі та погоджуйте кожну роботу з фото й ціною — у вашому кабінеті.</p>
          <div class="row"><a class="btn primary" href="#booking">Записатися онлайн ${icon('arrow', 'width="18" height="18"')}</a><a class="btn" href="#track">Де моє авто?</a></div>
          <div class="hero-facts">
            <div class="fact"><b>${rt.avg}★</b><span>${rt.count} ${plural(rt.count, 'відгук', 'відгуки', 'відгуків')}</span></div>
            <div class="fact"><b>12 міс</b><span>гарантія на роботи</span></div>
            <div class="fact"><b>до 10%</b><span>повертаємо балами</span></div>
          </div>
        </div>
        ${bayBoard()}
      </div><div class="hazard-band" aria-hidden="true"></div></section>

      <section class="section"><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">Що турбує авто?</span><h2>Оберіть напрямок — підберемо час</h2></div><a class="btn ghost" href="#services">Усі послуги і ціни</a></div>
        <div class="cats">${Store.CATEGORIES.map(c => `<button class="cat" data-act="book-cat" data-cat="${c.id}">${icon(c.icon)}<b>${esc(c.name)}</b><span>${esc(c.hint)}</span></button>`).join('')}</div>
      </div></section>

      <section class="section" style="padding-top:0"><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">Як проходить візит</span><h2>Ви вирішуєте, що ремонтувати</h2><p class="muted">Жодна додаткова робота не починається без вашої згоди в кабінеті. Ціна в чеку дорівнює погодженій.</p></div></div>
        <div class="process">
          <div class="step"><b>Запис онлайн</b><p>Обираєте послугу й вільний час на завантаженості постів. Підтвердження — у Viber.</p></div>
          <div class="step"><b>Прийом і огляд</b><p>Майстер приймає авто, фіксує пробіг і стан на фото. Огляд 40 пунктів — безкоштовно.</p></div>
          <div class="step"><b>Погодження</b><p>Знахідки приходять у кабінет: червоне — критично, жовте — можна відкласти. Ви ставите «так» або «ні».</p></div>
          <div class="step"><b>Ремонт і контроль</b><p>Статус оновлюється наживо. Старший майстер перевіряє роботу і робить тест-драйв.</p></div>
          <div class="step"><b>Видача</b><p>Чек, фото замінених деталей, нарахування балів і запис у сервісну книжку.</p></div>
        </div>
      </div></section>

      <section class="section" style="padding-top:0"><div class="wrap grid g2" style="gap:clamp(24px,4vw,56px);align-items:start">
        <div class="stack">
          <span class="eyebrow">Популярне</span><h2>Прозорі ціни</h2>
          <p class="muted">Ціни за роботу для легкового авто. Для кросоверів, бусів і преміуму — калькулятор на сторінці послуг.</p>
          <div class="price-list">${popular.map(s => priceRow(s, 'sedan', true)).join('')}</div>
        </div>
        <div class="stack">
          <div class="bonus-card">
            <span class="eyebrow" style="color:var(--hazard)">Бонусна програма</span>
            <h2 style="color:var(--panel)">Кожна гривня повертається балами</h2>
            <p class="muted">${st.levels.map(l => `${l.name} — ${l.cashback}%`).join(' · ')}. 1 бал = 1 ₴, оплачуйте балами до ${st.maxPayPct}% чеку.</p>
            <div class="row"><a class="btn primary" href="#bonus">Як це працює</a><button class="btn" data-act="login" style="background:transparent;color:var(--panel);border-color:rgba(255,255,255,.25)">+${st.welcome} балів за реєстрацію</button></div>
          </div>
          ${S().promos.filter(p => p.active).slice(0, 2).map(promoCard).join('')}
        </div>
      </div></section>

      <section class="section" style="padding-top:0"><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">Чому нам довіряють</span><h2>Сервіс, у якому не треба стояти над майстром</h2></div></div>
        <div class="grid g3" style="gap:0 24px">
          <div class="feat">${icon('camera')}<b>Фотозвіт кожного етапу</b><p>Знімки зношених деталей і готової роботи — у кабінеті. Старі запчастини віддаємо на вимогу.</p></div>
          <div class="feat">${icon('shield')}<b>Гарантія 12 міс / 20 000 км</b><p>На роботи та запчастини, встановлені в нас. Гарантійний талон — в історії авто.</p></div>
          <div class="feat">${icon('clock')}<b>Чесний час</b><p>Нормогодини за каталогом виробника. Якщо затримуємо видачу — знижка 10% на роботу.</p></div>
          <div class="feat">${icon('wrench')}<b>Запчастини на вибір</b><p>Оригінал або перевірений аналог — показуємо обидві ціни. Можна привезти свої.</p></div>
          <div class="feat">${icon('coffee')}<b>Клієнтська зона</b><p>Кава, Wi-Fi, робоче місце і вікно в цех: видно своє авто на підйомнику.</p></div>
          <div class="feat">${icon('truck')}<b>Евакуатор і підмінне авто</b><p>Заберемо авто, що не їде. Для ремонту довше дня — підмінне авто за запитом.</p></div>
        </div>
      </div></section>

      <section class="section" style="padding-top:0"><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">Команда</span><h2>Майстри, які відповідають за результат</h2></div></div>
        <div class="grid g4 masters">${S().masters.map(m => `<div class="master"><div class="master-ph"><span class="ini">${esc(UI.initials(m.name))}</span><span class="exp">${m.exp} ${plural(m.exp, 'рік', 'роки', 'років')} досвіду</span></div>
          <div><b>${esc(m.name)}</b><p>${esc(m.role)}</p><p class="mono">${m.rating.toFixed(1)}★ · ${num(m.jobs)} робіт</p></div></div>`).join('')}</div>
      </div></section>

      <section class="section" style="padding-top:0" id="reviews"><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">Відгуки</span><div class="rating-big"><b>${rt.avg}</b><span class="stars">${stars(rt.avg)}</span><span class="muted">${rt.count} ${plural(rt.count, 'відгук', 'відгуки', 'відгуків')} після візиту</span></div></div>
          <button class="btn" data-act="review-new">Залишити відгук</button></div>
        ${(() => { const list = S().reviews.filter(r => r.status === 'published').slice(0, 6); return `<div class="grid ${list.length % 3 === 0 ? 'g3' : 'g2'}">${list.map(reviewCard).join('')}</div>`; })()}
      </div></section>

      <section class="section" style="padding-top:0" id="faq"><div class="wrap grid g2" style="gap:clamp(24px,4vw,56px);align-items:start">
        <div class="stack"><span class="eyebrow">Питання</span><h2>Коротко про важливе</h2><p class="muted">Не знайшли відповідь? Напишіть у чат — адміністратор відповідає в середньому за 4 хвилини.</p><div><button class="btn" data-act="chat-open">${icon('chat', 'width="18" height="18"')} Написати в чат</button></div></div>
        <div class="faq">
          <details><summary>Чи можна привезти свої запчастини?</summary><p>Так. Оберіть «Привезу свої» під час запису або біля будь-якої запчастини в кабінеті. Ми підкажемо точний артикул. Гарантію на роботу надаємо повністю, на саму запчастину — її продавець.</p></details>
          <details><summary>Як ви рахуєте запчастини?</summary><p>Кожна запчастина — окремим рядком: бренд, артикул, ціна і термін постачання. Часто пропонуємо два варіанти — оригінал і перевірений аналог. Ви обираєте в кабінеті, а статус замовлення видно до моменту, коли деталь приїде на склад.</p></details>
          <details><summary>Скільки коштує діагностика, якщо я потім ремонтуюсь у вас?</summary><p>Комп'ютерна діагностика зараховується у вартість ремонту, якщо ви погоджуєте роботи протягом 7 днів.</p></details>
          <details><summary>Як працює погодження додаткових робіт?</summary><p>Після огляду ви отримуєте в кабінеті перелік знахідок з фото, коментарем майстра і ціною. Кожен пункт можна погодити або відхилити. Без вашої згоди роботу не почнемо.</p></details>
          <details><summary>Як нараховуються бали?</summary><p>Після видачі авто ми повертаємо від 3% до 10% суми чеку балами — залежно від вашого рівня. Балами можна оплатити до ${st.maxPayPct}% наступного чеку.</p></details>
          <details><summary>Можна залишити авто на ніч?</summary><p>Так, територія під охороною і відеоспостереженням. Ключі приймаємо в боксі цілодобово.</p></details>
        </div>
      </div></section>`;
    }
  });

  function priceRow(s, cls, compact) {
    const inCart = App.state.cart.includes(s.id);
    const price = Store.priceFor(s.id, cls);
    return `<div class="price-row"><div class="nm"><b>${esc(s.name)}</b>${compact ? '' : `<p>${esc(s.desc)}</p>`}</div>
      <span class="dur">${dur(s.dur)}</span><span class="pr"><small>від</small> ${money(price)}</span>
      <button class="btn sm ${inCart ? 'dark' : ''}" data-act="cart-toggle" data-svc="${s.id}" aria-pressed="${inCart}">${inCart ? icon('check', 'width="16" height="16"') + ' Обрано' : 'Обрати'}</button></div>`;
  }
  function promoCard(p) {
    return `<div class="promo ${p.hz ? 'hz' : ''}"><span class="tag">${esc(p.tag)}</span><b>${esc(p.title)}</b><p class="${p.hz ? 'muted' : 'muted'}">${esc(p.text)}</p>${p.until ? `<span class="small mono ${p.hz ? '' : 'muted'}">до ${fmtDay(p.until, true)}</span>` : ''}</div>`;
  }
  App.priceRow = priceRow;
  App.reviewCard = reviewCard;

  App.on('book-cat', el => {
    const first = S().services.find(s => s.cat === el.dataset.cat && s.popular) || S().services.find(s => s.cat === el.dataset.cat);
    App.state.svcCat = el.dataset.cat;
    App.state.bk = null;
    App.state.cart = [first.id];
    App.go('booking');
  });
  App.on('cart-toggle', el => {
    const id = el.dataset.svc;
    const c = App.state.cart;
    const i = c.indexOf(id);
    if (i >= 0) c.splice(i, 1); else c.push(id);
    if (App.state.bk) App.state.bk.services = [...c];
    App.render(App.current, true);
  });
  App.on('cart-book', () => { App.state.bk = null; App.go('booking'); });

  // ---------- SERVICES ----------
  App.route('services', {
    title: 'Послуги і ціни',
    render() {
      const st = App.state;
      const cat = st.svcCat || 'all';
      const q = (st.svcQ || '').toLowerCase();
      const list = S().services.filter(s => s.active && (cat === 'all' || s.cat === cat) && (!q || (s.name + ' ' + s.desc).toLowerCase().includes(q)));
      const cart = st.cart.map(Store.service.bind(Store)).filter(Boolean);
      const sum = cart.reduce((a, s) => a + Store.priceFor(s.id, st.cls), 0);
      const time = cart.reduce((a, s) => a + s.dur, 0);
      return `<section class="section"><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">Прайс · ціни за роботу</span><h1 style="font-size:var(--step-3)">Послуги і калькулятор вартості</h1>
          <p class="muted">Оберіть тип авто — ціни перерахуються. Позначте потрібні роботи і запишіться одним кліком. Запчастини рахуються окремо після підбору.</p></div></div>
        <div class="stack" style="margin-bottom:20px">
          <div class="lbl">Тип авто</div>
          <div class="chips">${Store.CAR_CLASSES.map(c => `<button class="chip ${st.cls === c.id ? 'on' : ''}" data-act="set-cls" data-cls="${c.id}">${esc(c.name)}${c.k !== 1 ? ` <span class="mono">×${c.k}</span>` : ''}</button>`).join('')}</div>
        </div>
        <div class="toolbar">
          <div class="search">${icon('search')}<input class="input" id="svc-q" placeholder="Пошук: колодки, масло, ГРМ…" value="${esc(st.svcQ || '')}" data-input="svc-q" aria-label="Пошук послуги"></div>
        </div>
        <div class="chips" style="margin-bottom:20px">
          <button class="chip ${cat === 'all' ? 'on' : ''}" data-act="set-cat" data-cat="all">Усі</button>
          ${Store.CATEGORIES.map(c => `<button class="chip ${cat === c.id ? 'on' : ''}" data-act="set-cat" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}
        </div>
        <div class="price-list" id="svc-list">${list.length ? list.map(s => priceRow(s, st.cls)).join('') : `<div class="empty">Нічого не знайдено. Опишіть проблему в чаті — підкажемо, яка послуга потрібна.<button class="btn" data-act="chat-open">Написати в чат</button></div>`}</div>
      </div></section>
      ${cart.length ? `<div style="position:sticky;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:40;pointer-events:none"><div class="wrap"><div class="panel pad row" style="box-shadow:var(--shadow);pointer-events:auto;justify-content:space-between">
        <div><b>${cart.length} ${plural(cart.length, 'послуга', 'послуги', 'послуг')}</b> <span class="muted">· ≈ ${dur(time)}</span><div class="mono" style="font-size:1.25rem;font-weight:600">${money(sum)}</div></div>
        <div class="row"><button class="btn ghost" data-act="cart-clear">Очистити</button><button class="btn primary" data-act="cart-book">Записатися</button></div>
      </div></div></div>` : ''}`;
    }
  });
  App.on('set-cls', el => { App.state.cls = el.dataset.cls; App.render(App.current, true); });
  App.on('set-cat', el => { App.state.svcCat = el.dataset.cat; App.render(App.current, true); });
  App.on('cart-clear', () => { App.state.cart = []; App.render(App.current, true); });
  App.input('svc-q', el => {
    App.state.svcQ = el.value;
    const q = el.value.toLowerCase();
    const cat = App.state.svcCat || 'all';
    const list = S().services.filter(s => s.active && (cat === 'all' || s.cat === cat) && (!q || (s.name + ' ' + s.desc).toLowerCase().includes(q)));
    document.getElementById('svc-list').innerHTML = list.length ? list.map(s => priceRow(s, App.state.cls)).join('') : `<div class="empty">Нічого не знайдено. Опишіть проблему в чаті — підкажемо, яка послуга потрібна.<button class="btn" data-act="chat-open">Написати в чат</button></div>`;
  });

  // ---------- TRACKING ----------
  function timeline(o) {
    // «Очікуємо запчастини» is shown only for orders that actually waited for parts
    const steps = FLOW.filter(s => s !== 'new' && (s !== 'parts' || o.status === 'parts' || o.history.some(h => h.status === 'parts')));
    const curIdx = FLOW.indexOf(o.status);
    return `<div class="track">${steps.map(sid => {
      const i = FLOW.indexOf(sid);
      const h = [...o.history].reverse().find(x => x.status === sid);
      const cls = o.status === 'cancelled' ? 'todo' : i < curIdx ? 'done' : i === curIdx ? 'cur' : 'todo';
      const s = Store.status(sid);
      return `<div class="tr-step ${cls}"><span class="dot">${cls === 'done' ? icon('check') : ''}</span><div><b>${esc(s.name)}</b>${cls === 'cur' ? `<p>${esc(s.client)}</p>` : ''}</div><time>${h && cls !== 'todo' ? fmtStamp(h.at) : ''}</time></div>`;
    }).join('')}</div>`;
  }
  App.timeline = timeline;

  function trackResult(o) {
    const car = Store.car(o.carId);
    const m = Store.master(o.master);
    return `<div class="panel pad stack fade-in">
      <div class="row" style="justify-content:space-between"><div><span class="eyebrow">Замовлення ${esc(o.id)}</span><h3 style="font-size:1.4rem;margin-top:4px">${esc(car.make + ' ' + car.model)}</h3></div>${UI.statusPill(o.status)}</div>
      <dl class="kv"><dt>Запис</dt><dd>${fmtDay(o.date, true)}, ${o.time}</dd><dt>Майстер</dt><dd>${esc(m ? m.name : 'буде призначено')}</dd><dt>Роботи</dt><dd>${o.services.map(id => esc(Store.service(id).name)).join(', ')}</dd></dl>
      ${o.status === 'approval' ? `<div class="note hz">${icon('wrench', 'width="20" height="20"')}<span><b>Майстер підготував роботи і запчастини на погодження.</b> Увійдіть у кабінет, щоб переглянути ціни, обрати оригінал чи аналог і прийняти рішення.</span></div>` : ''}
      ${o.status === 'parts' ? `<div class="note">${icon('truck', 'width="20" height="20"')}<span>${(o.parts || []).filter(l => ['to_order', 'ordered', 'awaiting'].includes(l.status)).map(l => `<b>${esc(l.name)}</b> — ${esc(Store.partStatus(l.status).name.toLowerCase())}${l.eta ? ', ' + esc(Store.partOpt(l).eta || l.eta) : ''}`).join('<br>')}</span></div>` : ''}
      ${timeline(o)}
      <div class="row">${Store.session.role === 'client' && Store.session.userId === o.userId ? `<button class="btn primary" data-act="order-open" data-id="${o.id}">Відкрити в кабінеті</button>` : `<button class="btn primary" data-act="login">Увійти в кабінет</button>`}<button class="btn" data-act="chat-open">Питання майстру</button></div>
    </div>`;
  }

  App.route('track', {
    title: 'Де моє авто?',
    render() {
      const me = Store.me();
      const mine = me ? Store.ordersOf(me.id).filter(o => !['done', 'cancelled'].includes(o.status)) : [];
      const found = App.state.trackId ? Store.order(App.state.trackId) : null;
      return `<section class="section"><div class="wrap grid g2" style="gap:clamp(24px,4vw,56px);align-items:start">
        <div class="stack">
          <span class="eyebrow">Відстеження ремонту</span>
          <h1 style="font-size:var(--step-3)">Де моє авто?</h1>
          <p class="muted">Введіть номер замовлення з SMS і останні 4 цифри телефону. Статус оновлюється, щойно майстер змінює етап.</p>
          <form class="panel pad stack" data-form="track">
            <div class="field"><label for="tr-id">Номер замовлення</label><input class="input mono" id="tr-id" name="id" placeholder="HG-24117" value="${esc(App.state.trackQ || '')}" required></div>
            <div class="field"><label for="tr-ph">Останні 4 цифри телефону</label><input class="input mono" id="tr-ph" name="ph" inputmode="numeric" maxlength="4" placeholder="4567" required></div>
            <button class="btn primary" type="submit">Перевірити статус</button>
            <p class="small muted">Демо: замовлення <b class="mono">HG-24117</b>, цифри <b class="mono">4567</b>.</p>
          </form>
          ${mine.length ? `<div class="stack"><span class="lbl">Ваші активні замовлення</span>${mine.map(o => `<button class="svc-opt" data-act="track-mine" data-id="${o.id}" style="grid-template-columns:minmax(0,1fr) auto;text-align:left"><span><b>${esc(o.id)}</b> · ${esc(UI.carName(Store.car(o.carId)))}<br><small>${fmtDay(o.date)}, ${o.time}</small></span>${UI.statusPill(o.status)}</button>`).join('')}</div>` : ''}
        </div>
        <div>${found ? trackResult(found) : `<div class="panel pad empty" style="min-height:320px;align-content:center">${icon('car', 'width="40" height="40"')}<b>Тут з'явиться шлях вашого авто</b><span>Від прийому до видачі — кожен етап з часом.</span></div>`}</div>
      </div></section>`;
    }
  });
  App.form('track', (f, d) => {
    const o = Store.order(d.id.trim().toUpperCase());
    App.state.trackQ = d.id;
    if (!o) { toast('Замовлення з таким номером не знайдено. Перевірте номер у SMS.'); return; }
    const u = Store.user(o.userId);
    if (!u || !u.phone.endsWith(d.ph.trim())) { toast('Цифри телефону не збігаються із замовленням'); return; }
    App.state.trackId = o.id;
    App.render('track', true);
  });
  App.on('track-mine', el => { App.state.trackId = el.dataset.id; App.render('track', true); });

  // ---------- BONUS ----------
  App.route('bonus', {
    title: 'Бонусна програма',
    render() {
      const st = S().settings;
      const me = Store.me();
      const lv = me ? Store.level(me.spent) : null;
      const yearly = App.state.calcYear ?? 18000;
      const l = Store.level(yearly).cur;
      return `<section class="section"><div class="wrap stack" style="gap:40px">
        <div class="section-head" style="margin:0"><div><span class="eyebrow">Hundred Club</span><h1 style="font-size:var(--step-4)">Бали, які справді витрачаєш</h1>
          <p class="muted">1 бал = 1 гривня. Повертаємо від ${st.levels[0].cashback}% до ${st.levels[st.levels.length - 1].cashback}% кожного чеку. Рівень росте разом із сумою ваших візитів і не згорає.</p></div>
          ${me ? `<a class="btn primary" href="#cabinet-bonus">Мій баланс: ${num(me.bonus)} балів</a>` : `<button class="btn primary" data-act="login">Приєднатися · +${st.welcome} балів</button>`}</div>
        <div class="ladder">${st.levels.map((x, i) => `<div class="lvl ${i === st.levels.length - 1 ? 'top' : ''} ${lv && lv.cur.id === x.id ? 'cur' : ''}"><span class="nm">${esc(x.name)}</span><span class="pct">${x.cashback}%</span><span class="req">${x.min ? 'від ' + money(x.min) + ' за весь час' : 'з першого візиту'}</span>${lv && lv.cur.id === x.id ? '<span class="pill hz">ваш рівень</span>' : ''}</div>`).join('')}</div>
        <div class="grid g2" style="gap:24px;align-items:start">
          <div class="panel pad stack">
            <h3>Скільки балів ви отримаєте</h3>
            <div class="field"><label for="calc-y">Витрати на сервіс за рік: <b class="mono" id="calc-v">${money(yearly)}</b></label>
              <input id="calc-y" type="range" min="2000" max="120000" step="1000" value="${yearly}" data-input="calc-y" style="width:100%;accent-color:var(--ink)"></div>
            <div class="row" style="justify-content:space-between;align-items:end"><div><span class="lbl">Рівень</span><div style="font:700 1.4rem var(--f-display)" id="calc-l">${esc(l.name)} · ${l.cashback}%</div></div>
              <div style="text-align:right"><span class="lbl">Повернеться балами</span><div class="mono" style="font-size:1.75rem;font-weight:600;color:var(--accent-text)" id="calc-r">${num(yearly * l.cashback / 100)}</div></div></div>
            <p class="small muted">Розрахунок спрощений: кешбек нараховується з кожного чеку за рівнем на момент оплати.</p>
          </div>
          <div class="stack">
            <h3>Інші способи отримати бали</h3>
            <div class="tx"><div><b>Реєстрація в кабінеті</b><br><small>Одразу після першого входу</small></div><span class="amt plus">+${st.welcome}</span></div>
            <div class="tx"><div><b>Приведіть друга</b><br><small>Ваш код запрошення — у кабінеті. Друг теж отримує бали</small></div><span class="amt plus">+${st.referral}</span></div>
            <div class="tx"><div><b>Відгук після візиту</b><br><small>За чесний відгук будь-якого тону</small></div><span class="amt plus">+${st.review}</span></div>
            <div class="tx"><div><b>День народження</b><br><small>Діють 14 днів</small></div><span class="amt plus">+${st.birthday}</span></div>
            <div class="note">${icon('gift', 'width="20" height="20"')}<span>Балами можна оплатити до <b>${st.maxPayPct}%</b> чеку — і за роботу, і за запчастини.</span></div>
          </div>
        </div>
      </div></section>`;
    }
  });
  App.input('calc-y', el => {
    const v = +el.value;
    App.state.calcYear = v;
    const l = Store.level(v).cur;
    document.getElementById('calc-v').textContent = money(v);
    document.getElementById('calc-l').textContent = `${l.name} · ${l.cashback}%`;
    document.getElementById('calc-r').textContent = num(v * l.cashback / 100);
  });

  // ---------- CONTACTS ----------
  App.route('contacts', {
    title: 'Контакти',
    render() {
      const st = S().settings;
      const maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(st.address);
      return `<section class="section"><div class="wrap grid g2" style="gap:clamp(24px,4vw,56px);align-items:start">
        <div class="stack" style="gap:24px">
          <div class="stack"><span class="eyebrow">Контакти</span><h1 style="font-size:var(--step-3)">${esc(st.address)}</h1><p class="muted">Заїзд з боку вулиці, біля шлагбаума — жовта розмітка до прийомки. Паркування для клієнтів безкоштовне.</p></div>
          <div class="stack"><span class="lbl">Телефон</span><div class="copy-field"><input class="input" id="ct-phone" value="${esc(st.phone)}" readonly aria-label="Телефон"><button class="btn" data-act="copy" data-target="ct-phone">Копіювати</button></div></div>
          <dl class="hours">${st.hours.map(h => `<dt>${h[0]}</dt><dd>${h[1]}</dd>`).join('')}</dl>
          <div class="row"><a class="btn" href="${maps}" target="_blank" rel="noopener">${icon('pin', 'width="18" height="18"')} Маршрут у Google Maps</a><button class="btn" data-act="chat-open">${icon('chat', 'width="18" height="18"')} Чат</button></div>
          <form class="panel pad stack" data-form="callback">
            <h3>Передзвонимо за 10 хвилин</h3>
            <div class="grid g2"><div class="field"><label for="cb-name">Ім'я</label><input class="input" id="cb-name" name="name" required></div>
            <div class="field"><label for="cb-phone">Телефон</label><input class="input" id="cb-phone" name="phone" type="tel" required placeholder="+380"></div></div>
            <div class="field"><label for="cb-q">Питання (необов'язково)</label><textarea class="input" id="cb-q" name="q" placeholder="Наприклад: стукає підвіска на нерівностях"></textarea></div>
            <button class="btn primary" type="submit">Замовити дзвінок</button>
          </form>
        </div>
        <div class="map" role="img" aria-label="Схема проїзду">
          <span class="road" style="left:0;right:0;top:58%;height:28px"></span>
          <span class="road" style="top:0;bottom:0;left:30%;width:24px"></span>
          <span class="road" style="top:0;bottom:42%;left:72%;width:18px"></span>
          <div class="pin"><b>Hundred Garage</b><i></i></div>
          <span class="mono small muted" style="position:absolute;left:12px;bottom:10px">вул. Автозаводська</span>
        </div>
      </div></section>`;
    }
  });
  App.form('callback', (f, d) => {
    const c = Store.chatFor(Store.session.userId || Store.session.guestId, `${d.name} · ${d.phone}`, Store.session.userId);
    c.messages.push({ from: 'client', text: `Замовлення дзвінка: ${d.phone}${d.q ? '\n' + d.q : ''}`, at: new Date().toISOString() });
    c.unreadAdmin++;
    Store.save();
    f.reset();
    toast('Заявку прийнято. Адміністратор передзвонить протягом 10 хвилин', 'ok');
  });
  App.on('copy', el => {
    const input = document.getElementById(el.dataset.target);
    const done = () => toast('Скопійовано', 'ok');
    try {
      navigator.clipboard.writeText(input.value).then(done, () => { input.select(); toast('Виділено — скопіюйте вручну'); });
    } catch (e) { input.select(); toast('Виділено — скопіюйте вручну'); }
  });

  // ---------- Reviews (public form) ----------
  App.on('review-new', () => {
    const me = Store.me();
    modal({
      title: 'Ваш відгук',
      body: `<form class="stack" data-form="review" id="review-form">
        <div class="field"><span class="lbl">Оцінка</span><div class="chips" id="rv-stars">${[5, 4, 3, 2, 1].map(n => `<label class="chip"><input type="radio" name="rating" value="${n}" ${n === 5 ? 'checked' : ''} style="accent-color:var(--ink)"> ${n}★</label>`).join('')}</div></div>
        <div class="field"><label for="rv-name">Ім'я</label><input class="input" id="rv-name" name="name" value="${esc(me ? me.name.split(' ')[0] + ' ' + me.name.split(' ')[1][0] + '.' : '')}" required></div>
        <div class="field"><label for="rv-car">Авто</label><input class="input" id="rv-car" name="car" value="${esc(me ? UI.carName(Store.carsOf(me.id)[0]) : '')}"></div>
        <div class="field"><label for="rv-text">Враження від візиту</label><textarea class="input" id="rv-text" name="text" required></textarea></div>
        ${me ? `<p class="small muted">Після модерації нарахуємо +${S().settings.review} балів.</p>` : ''}
      </form>`,
      foot: '<button class="btn" data-act="modal-close">Скасувати</button><button class="btn primary" type="submit" form="review-form">Надіслати</button>'
    });
  });
  App.form('review', (f, d) => {
    const me = Store.me();
    S().reviews.unshift({ id: 'r' + Store.next('review'), name: d.name, car: d.car, rating: +d.rating, text: d.text, at: new Date().toISOString(), status: 'pending', reply: '', userId: me?.id || null, orderId: App.state.reviewOrder || null });
    App.state.reviewOrder = null;
    Store.save();
    closeModal();
    toast('Дякуємо! Відгук з\'явиться після модерації', 'ok');
  });
})();
