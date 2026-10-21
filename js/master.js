/* Master workspace: today's jobs, work order with stages, timer, findings with photos,
   part requests, messages to the client, and the master's own earnings. */
(function () {
  const { esc, money, num, icon, fmtDay, fmtStamp, dur, plural, toast, modal, closeModal, statusPill, plate, carName } = UI;
  const S = () => Store.db;
  const IN_WORK = ['accepted', 'diagnostics', 'approval', 'parts', 'repair', 'qc'];
  const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

  // What the master can do next from each stage. Hand-over and payment stay with the admin.
  function nextSteps(o) {
    const hasQuestions = o.items.some(i => i.sev !== 'green' && i.decision === null) || (o.parts || []).some(l => l.status === 'quote' && l.approved === null);
    switch (o.status) {
      case 'new': case 'confirmed': return o.date > Store.dayStr(0)
        ? [{ wait: `Запис на ${fmtDay(o.date)}, ${o.time}` }]
        : [{ act: 'm-open', label: 'Прийняти авто', primary: true }];
      case 'accepted': return [{ s: 'diagnostics', label: 'Почати діагностику', primary: true }];
      case 'diagnostics': return hasQuestions
        ? [{ s: 'approval', label: 'Надіслати клієнту на погодження', primary: true }, { s: 'repair', label: 'Почати ремонт без погодження' }]
        : [{ s: 'repair', label: 'Почати ремонт', primary: true }, { act: 'm-open', label: 'Додати знахідки огляду' }];
      case 'approval': return [{ wait: 'Чекаємо рішення клієнта' }];
      case 'parts': return [{ wait: 'Чекаємо запчастини' }];
      case 'repair': return [{ s: 'qc', label: 'Передати на контроль якості', primary: true }];
      case 'qc': return [{ s: 'ready', label: 'Готово до видачі', primary: true }];
      case 'ready': return [{ wait: 'Чекає видачі клієнту' }];
      default: return [];
    }
  }
  const stepButtons = (o, big) => nextSteps(o).map(x => x.wait
    ? `<span class="pill">${esc(x.wait)}</span>`
    : `<button class="btn ${x.primary ? 'primary' : ''} ${big ? 'big block' : ''}" data-act="${x.act || 'm-step'}" data-id="${o.id}" ${x.s ? `data-s="${x.s}"` : ''}>${esc(x.label)}</button>`).join('');

  function timer(o) {
    const fact = Store.workMinutes(o), norm = Store.normMinutes(o) || 1;
    const run = !!o.work?.running;
    const canRun = ['accepted', 'diagnostics', 'repair'].includes(o.status);
    return `<div class="timer ${run ? 'run' : ''}"><span>${dur(fact) || '0 хв'}</span><div class="bar"><i class="${fact > norm ? 'over' : ''}" style="width:${Math.min(100, Math.round(fact / norm * 100))}%"></i></div><span class="small muted">норма ${dur(norm)}</span>
      ${canRun || run ? `<button class="btn sm" data-act="m-timer" data-id="${o.id}">${run ? 'Пауза' : 'Старт'}</button>` : ''}</div>`;
  }
  function earnLine(o) {
    const pay = Store.masterPay(o);
    if (!pay) return '';
    const done = o.status === 'done';
    return `<div class="earn ${done ? '' : 'pending'}"><span>${done ? 'Нараховано за роботу' : 'Ваш заробіток після видачі'}${o.pay?.note ? ` · ${esc(o.pay.note)}` : ''}</span><b>${done ? '+' : ''}${money(pay)}</b></div>`;
  }

  function jobCard(o, mode) {
    const car = Store.car(o.carId);
    const bay = Store.bay(o.bay);
    return `<article class="job ${o.work?.running ? 'live' : ''}">
      <div class="job-top"><div><b>${esc(carName(car))}</b><div class="small muted">${car.year || ''} · ${plate(car.plate || '—')}</div></div>${statusPill(o.status)}</div>
      <div class="small muted mono">${fmtDay(o.date)}, ${o.time} · ${esc(bay?.name || '')} · ${esc(o.id)}</div>
      <div class="svc">${o.services.map(id => { const sv = Store.service(id); return `<div><span>${esc(sv.name)}</span><span>${dur(sv.dur)}</span></div>`; }).join('')}</div>
      ${o.comment ? `<div class="note"><span><b>Клієнт:</b> ${esc(o.comment)}</span></div>` : ''}
      ${mode === 'now' ? timer(o) : ''}
      ${mode === 'free' ? `<button class="btn primary block" data-act="m-take" data-id="${o.id}">Взяти собі</button>` : `<div class="stack" style="gap:8px">${stepButtons(o, true)}</div>`}
      ${mode !== 'free' ? earnLine(o) : ''}
      ${mode !== 'free' ? `<button class="btn ghost block" data-act="m-open" data-id="${o.id}">Відкрити наряд</button>` : ''}
    </article>`;
  }

  function shell(active, content) {
    const me = Store.meMaster();
    const link = (r, ic, t) => `<a href="#${r}" class="${active === r ? 'on' : ''}">${icon(ic)}${t}</a>`;
    return `<div class="wrap shell">
      <nav class="side" aria-label="Кабінет майстра">
        <div class="side-head"><span class="avatar" style="width:44px;height:44px;font-size:1rem">${esc(UI.initials(me.name))}</span><b>${esc(me.name)}</b><span class="small muted">${esc(me.role)}</span></div>
        ${link('master', 'wrench', 'Мої роботи')}
        ${link('master-pay', 'gift', 'Мій заробіток')}
        <button class="sl" data-act="demo-role" data-role="guest">${icon('logout')}Вийти</button>
      </nav>
      <div class="fade-in" style="min-width:0">${content}</div>
    </div>`;
  }

  App.route('master', {
    area: 'master', title: 'Мої роботи',
    render() {
      const me = Store.meMaster();
      const today = Store.dayStr(0);
      const mine = S().orders.filter(o => o.master === me.id);
      const now = mine.filter(o => IN_WORK.includes(o.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      const next = mine.filter(o => ['new', 'confirmed'].includes(o.status) && o.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6);
      const free = S().orders.filter(o => !o.master && ['new', 'confirmed'].includes(o.status) && o.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 6);
      const ready = mine.filter(o => ['ready', 'done'].includes(o.status) && o.date === today);
      const todayAll = mine.filter(o => o.date === today && o.status !== 'cancelled');
      const normToday = todayAll.reduce((s, o) => s + Store.normMinutes(o), 0);
      const led = Store.masterLedger(me.id, monthStart());
      const hour = new Date().getHours();
      return shell('master', `
        <div class="page-title"><div><span class="eyebrow">${fmtDay(today, true)}</span><h1>${hour < 12 ? 'Доброго ранку' : hour < 18 ? 'Добрий день' : 'Добрий вечір'}, ${esc(me.name.split(' ')[0])}</h1></div></div>
        <div class="kpis" style="margin-bottom:24px">
          <div class="kpi"><span>Робіт сьогодні</span><b>${todayAll.length}</b><span class="delta">норма ${dur(normToday) || '0 хв'}</span></div>
          <div class="kpi"><span>Зараз у роботі</span><b>${now.length}</b><span class="delta">${now.filter(o => o.status === 'approval').length} чекають клієнта</span></div>
          <a class="kpi" href="#master-pay" style="text-decoration:none"><span>Заробіток за місяць</span><b>${money(led.earned)}</b><span class="delta up">до виплати ${money(led.balance)} →</span></a>
        </div>
        <div class="stack" style="gap:28px">
          <section class="stack"><h3>Зараз</h3>${now.length ? `<div class="grid g2" style="align-items:start">${now.map(o => jobCard(o, 'now')).join('')}</div>` : '<div class="panel empty">Немає авто в роботі. Візьміть наступне з розкладу.</div>'}</section>
          <section class="stack"><h3>Далі в розкладі</h3>${next.length ? `<div class="grid g2" style="align-items:start">${next.map(o => jobCard(o, 'next')).join('')}</div>` : '<div class="panel empty">Записів на вас поки немає</div>'}</section>
          ${free.length ? `<section class="stack"><h3>Вільні роботи <span class="pill info">${free.length}</span></h3><p class="small muted">Записи без майстра. Візьміть ту, що підходить вам за профілем.</p><div class="grid g2" style="align-items:start">${free.map(o => jobCard(o, 'free')).join('')}</div></section>` : ''}
          ${ready.length ? `<section class="stack"><h3>Готово сьогодні</h3><div class="grid g2" style="align-items:start">${ready.map(o => jobCard(o, 'done')).join('')}</div></section>` : ''}
        </div>`);
    }
  });

  App.route('master-pay', {
    area: 'master', title: 'Мій заробіток',
    render() {
      const me = Store.meMaster();
      const led = Store.masterLedger(me.id, monthStart());
      const todayPay = led.jobs.filter(o => o.date === Store.dayStr(0)).reduce((s, o) => s + Store.masterPay(o), 0);
      const pending = S().orders.filter(o => o.master === me.id && !['done', 'cancelled'].includes(o.status)).reduce((s, o) => s + Store.masterPay(o), 0);
      const history = [...(me.adjustments || []).map(a => ({ ...a, k: 'adj' })), ...(me.payouts || []).map(p => ({ ...p, k: 'pay' }))].sort((a, b) => b.at.localeCompare(a.at));
      return shell('master-pay', `
        <div class="page-title"><div><h1>Мій заробіток</h1><p class="small muted">Ваша ставка — ${me.payPct}% від вартості робіт. Сума за окрему роботу може бути змінена адміністратором — тоді поруч буде коментар.</p></div></div>
        <div class="kpis" style="margin-bottom:24px">
          <div class="kpi"><span>Нараховано за місяць</span><b>${money(led.earned)}</b><span class="delta">${led.jobs.length} ${plural(led.jobs.length, 'робота', 'роботи', 'робіт')}${todayPay ? ` · сьогодні ${money(todayPay)}` : ''}</span></div>
          <div class="kpi"><span>До виплати</span><b>${money(led.balance)}</b><span class="delta">виплачено всього ${money(led.paid)}</span></div>
          <div class="kpi"><span>В роботі зараз</span><b>${money(pending)}</b><span class="delta">нарахується після видачі авто</span></div>
        </div>
        <div class="grid g2" style="align-items:start;gap:24px">
          <div class="stack"><h3>Роботи за місяць</h3>
            <div class="table-wrap"><table><thead><tr><th>Робота</th><th class="r">Нормо-год</th><th class="r">Вам</th></tr></thead><tbody>
            ${led.jobs.sort((a, b) => b.date.localeCompare(a.date)).map(o => `<tr class="click" data-act="m-open" data-id="${o.id}"><td>${esc(carName(Store.car(o.carId)))} <span class="mono small muted">${esc(o.id)}</span><span class="sub">${fmtDay(o.date)} · ${o.services.map(x => esc(Store.service(x).name)).join(', ')}${o.pay?.note ? ` · <b>${esc(o.pay.note)}</b>` : ''}</span></td><td class="r mono">${(Store.normMinutes(o) / 60).toFixed(1)}</td><td class="r mono"><b>${money(Store.masterPay(o))}</b></td></tr>`).join('') || '<tr><td colspan="3"><div class="empty">Цього місяця ще немає закритих робіт</div></td></tr>'}
            </tbody></table></div></div>
          <div class="panel pad"><h3 style="margin-bottom:8px">Премії, штрафи, виплати</h3>
            ${history.map(x => `<div class="tx"><div><b>${x.k === 'pay' ? 'Виплата' : x.amount >= 0 ? 'Премія' : 'Штраф'}</b><br><small>${esc(x.note)} · ${fmtDay(x.at)}</small></div><span class="amt ${x.k === 'pay' ? '' : x.amount >= 0 ? 'plus' : 'minus'}">${x.k === 'pay' ? '' : x.amount >= 0 ? '+' : '−'}${num(Math.abs(x.amount))}</span></div>`).join('') || '<div class="empty">Поки нічого</div>'}
          </div>
        </div>`);
    }
  });

  // ---------- Work order (наряд) ----------
  function masterOrder(id) {
    const o = Store.order(id);
    if (!o) return;
    const me = Store.meMaster();
    const car = Store.car(o.carId);
    const u = Store.user(o.userId);
    const mineOrFree = !o.master || o.master === me.id;
    const accepting = ['new', 'confirmed'].includes(o.status) && o.date <= Store.dayStr(0);
    const future = ['new', 'confirmed'].includes(o.status) && !accepting;
    const scroll = document.querySelector('.modal')?.scrollTop;
    modal({
      wide: true, title: `Наряд ${o.id}`,
      body: `<div class="row" style="justify-content:space-between;align-items:start">
          <div><b style="font:700 1.3rem var(--f-display)">${esc(carName(car))}</b>
          <dl class="kv" style="margin-top:8px"><dt>Номер</dt><dd>${plate(car.plate || '—')}</dd>${car.vin ? `<dt>VIN</dt><dd class="mono">${esc(car.vin)}</dd>` : ''}${car.engine ? `<dt>Двигун</dt><dd>${esc(car.engine)}</dd>` : ''}<dt>Клієнт</dt><dd>${esc(u?.name.split(' ')[0] || '—')}</dd><dt>Пост · час</dt><dd>${esc(Store.bay(o.bay)?.name || '')} · ${fmtDay(o.date)}, ${o.time}</dd><dt>Запчастини</dt><dd>${esc(Store.PARTS_PREF[o.partsPref || 'service'])}</dd></dl></div>
          ${statusPill(o.status)}</div>
        ${o.comment ? `<div class="note"><span><b>Зі слів клієнта:</b> ${esc(o.comment)}</span></div>` : ''}
        <div class="stack"><span class="lbl">Роботи за записом</span><div class="job" style="padding:12px 14px"><div class="svc">${o.services.map(sid => { const sv = Store.service(sid); return `<div><span>${esc(sv.name)}</span><span>${dur(sv.dur)}</span></div>`; }).join('')}</div></div></div>
        ${future ? `<div class="note"><span>Авто записане на <b>${fmtDay(o.date, true)}, ${o.time}</b>. Прийняти його можна в день візиту.</span></div>` : ''}
        ${!mineOrFree ? `<div class="note">Наряд закріплено за іншим майстром: ${esc(Store.master(o.master)?.name || '')}. Ви можете лише переглядати.</div>` : accepting ? `
        <form class="panel pad stack" data-form="m-accept" style="background:var(--panel-2)"><input type="hidden" name="id" value="${o.id}">
          <h3>Прийом авто</h3>
          <div class="field"><label for="ma-km">Пробіг на одометрі, км</label><input class="input mono" id="ma-km" name="km" inputmode="numeric" value="${car.mileage || ''}" required></div>
          <label class="check"><input type="checkbox" name="photos" checked> Зовнішній огляд зроблено, пошкоджень кузова не виявлено</label>
          <button class="btn primary big" type="submit">Прийняти авто і почати</button>
        </form>` : `
        <div class="stack"><span class="lbl">Етап</span><div class="row">${stepButtons(o)}</div>${timer(o)}${earnLine(o)}</div>
        <div class="stack">
          <h3>Знахідки огляду</h3>
          ${o.items.length ? `<div class="insp">${o.items.map(i => `<div class="insp-item"><span class="sev ${i.sev}"></span><div><b>${esc(i.name)}</b><p>${esc(i.note || '')}${i.price ? ` · робота <span class="mono">${money(i.price)}</span>` : ''}</p>${UI.photoThumb(i)}</div><div class="act">${i.sev === 'green' ? '<span class="pill ok">OK</span>' : i.decision === 'yes' ? '<span class="pill ok">погоджено</span>' : i.decision === 'no' ? '<span class="pill">клієнт відклав</span>' : '<span class="pill warn">чекає клієнта</span>'}</div></div>`).join('')}</div>` : '<p class="small muted">Додайте все, що знайшли: клієнт побачить фото і погодить роботи в кабінеті.</p>'}
          ${['accepted', 'diagnostics', 'repair'].includes(o.status) ? `<form class="panel pad stack" data-form="m-item" style="background:var(--panel-2)"><input type="hidden" name="id" value="${o.id}">
            <div class="field"><label for="mi-name">Що знайшли</label><input class="input" id="mi-name" name="name" placeholder="Пильовик ШРУСа лівий — тріщина" required></div>
            <div class="grid g3">
              <div class="field"><label for="mi-sev">Важливість</label><select class="input" id="mi-sev" name="sev"><option value="red">Критично</option><option value="yellow">Можна відкласти</option><option value="green">В нормі</option></select></div>
              <div class="field"><label for="mi-price">Робота за нормою, ₴</label><input class="input mono" id="mi-price" name="price" inputmode="numeric" value="0"></div>
              <div class="field"><label for="mi-photo">Фото</label><input class="input" id="mi-photo" type="file" accept="image/*" capture="environment" data-change="m-photo"></div>
            </div>
            <div class="field"><label for="mi-note">Пояснення для клієнта</label><input class="input" id="mi-note" name="note" placeholder="Без заміни бруд потрапить у шарнір"></div>
            <div><button class="btn" type="submit">${icon('plus', 'width="18" height="18"')} Додати знахідку</button></div>
          </form>` : ''}
        </div>
        <div class="stack">
          <h3>Запчастини</h3>
          ${(o.parts || []).length ? `<div>${o.parts.map(l => `<div class="part-row"><div style="min-width:0"><b>${esc(l.name)}</b>${(l.qty || 1) > 1 ? ` <span class="mono">× ${l.qty}</span>` : ''}<div class="meta">${l.source === 'client' ? 'від клієнта' : l.status === 'request' ? 'ваш запит — адміністратор підбирає' : esc(Store.partOpt(l).brand + ' ' + Store.partOpt(l).code)}</div></div><div class="pr"><span class="pill ${Store.partStatus(l.status).tone}">${esc(Store.partStatus(l.status).short)}</span></div></div>`).join('')}</div>` : '<p class="small muted">Запчастин у наряді ще немає.</p>'}
          ${o.status !== 'ready' ? `<form class="grid" data-form="m-part" style="grid-template-columns:minmax(0,2fr) 80px minmax(0,2fr) auto;align-items:end"><input type="hidden" name="id" value="${o.id}">
            <div class="field"><label for="mp-name">Потрібна запчастина</label><input class="input" id="mp-name" name="name" placeholder="Стійка стабілізатора передня" required></div>
            <div class="field"><label for="mp-qty">К-сть</label><input class="input mono" id="mp-qty" name="qty" inputmode="numeric" value="1"></div>
            <div class="field"><label for="mp-note">Уточнення</label><input class="input" id="mp-note" name="note" placeholder="права, оригінал або Febi"></div>
            <button class="btn" type="submit">Запросити</button>
          </form>` : ''}
        </div>
        <div class="grid g2" style="align-items:start">
          <form class="stack" data-form="m-note"><input type="hidden" name="id" value="${o.id}"><label class="lbl" for="mn-note">Нотатка для адміністратора</label><textarea class="input" id="mn-note" name="note" placeholder="Що запропонувати наступного разу, нюанси">${esc(o.masterNote || '')}</textarea><div><button class="btn" type="submit">Зберегти нотатку</button></div></form>
          <form class="stack" data-form="m-msg"><input type="hidden" name="id" value="${o.id}"><label class="lbl" for="mm-text">Повідомлення клієнту</label><textarea class="input" id="mm-text" name="text" placeholder="Показати стару деталь можу при видачі" required></textarea><div><button class="btn" type="submit">${icon('send', 'width="18" height="18"')} Надіслати</button></div></form>
        </div>`}`
    });
    const md = document.querySelector('.modal');
    if (md && scroll) md.scrollTop = scroll;
  }
  App.masterOrder = masterOrder;

  const refresh = (o, msg) => {
    Store.save();
    if (msg) toast(msg, 'ok');
    if (UI.modalOpen() && document.querySelector('.modal-head h3')?.textContent.includes(o.id)) masterOrder(o.id);
    App.render(App.current, true);
  };
  const canEdit = o => { const me = Store.meMaster(); return me && (o.master === me.id || !o.master); };

  App.on('m-open', el => masterOrder(el.dataset.id));
  App.on('m-take', el => {
    const o = Store.order(el.dataset.id);
    if (o.master) { toast('Цю роботу вже взяв інший майстер'); App.render(App.current, true); return; }
    o.master = Store.meMaster().id;
    refresh(o, `${carName(Store.car(o.carId))} — тепер ваша робота`);
  });
  App.on('m-step', el => {
    const o = Store.order(el.dataset.id);
    if (!canEdit(o)) return;
    const err = App.applyStatus(o, el.dataset.s);
    if (err) { toast(err); return; }
    // start the clock automatically when hands go on the car
    if (['diagnostics', 'repair'].includes(o.status) && !o.work?.running) o.work = { spent: o.work?.spent || 0, running: new Date().toISOString() };
    refresh(o, `${Store.status(o.status).name} · клієнт бачить статус`);
  });
  App.on('m-timer', el => {
    const o = Store.order(el.dataset.id);
    if (!canEdit(o)) return;
    o.work ||= { spent: 0, running: null };
    if (o.work.running) Store.stopWork(o); else o.work.running = new Date().toISOString();
    refresh(o, o.work.running ? 'Таймер запущено' : `Пауза · ${dur(Store.workMinutes(o))}`);
  });
  App.form('m-accept', (f, d) => {
    const o = Store.order(d.id);
    const km = parseInt(String(d.km).replace(/\D/g, ''), 10);
    if (!km) { toast('Вкажіть пробіг з одометра'); return; }
    const car = Store.car(o.carId);
    o.mileage = km;
    car.mileage = Math.max(car.mileage || 0, km);
    o.master ||= Store.meMaster().id;
    App.applyStatus(o, 'accepted');
    o.work = { spent: o.work?.spent || 0, running: new Date().toISOString() };
    refresh(o, 'Авто прийнято, таймер запущено');
  });
  App.change('m-photo', async el => {
    const file = el.files && el.files[0];
    if (!file) return;
    try { App.state.mPhoto = await UI.compressImage(file); toast('Фото додано до знахідки', 'ok'); }
    catch (e) { App.state.mPhoto = null; toast('Не вдалося прочитати фото. Спробуйте інше'); }
  });
  App.form('m-item', (f, d) => {
    const o = Store.order(d.id);
    if (!canEdit(o)) return;
    o.items.push({ id: 'i' + Store.next('item'), name: d.name.trim(), sev: d.sev, price: parseInt(d.price, 10) || 0, note: d.note.trim() || (d.sev === 'green' ? 'В нормі' : 'Робота'), decision: null, photo: App.state.mPhoto || null, by: Store.meMaster().id });
    App.state.mPhoto = null;
    refresh(o, 'Знахідку додано');
  });
  App.form('m-part', (f, d) => {
    const o = Store.order(d.id);
    if (!canEdit(o)) return;
    (o.parts ||= []).push({ id: 'p' + Store.next('part'), name: d.name.trim(), brand: '', code: '', qty: Math.max(1, parseInt(d.qty, 10) || 1), price: 0, stock: false, eta: '', source: 'service', status: 'request', approved: null, alt: null, choice: 'main', note: d.note.trim(), requestedBy: Store.meMaster().id });
    refresh(o, 'Запит надіслано адміністратору');
  });
  App.form('m-note', (f, d) => { const o = Store.order(d.id); o.masterNote = d.note.trim(); refresh(o, 'Нотатку збережено'); });
  App.form('m-msg', (f, d) => {
    const o = Store.order(d.id);
    const me = Store.meMaster();
    App.notifyClient(o, d.text.trim(), `${me.name.split(' ')[0]}, майстер`);
    refresh(o, 'Повідомлення надіслано клієнту');
  });

  // Running timers on the master's screen tick forward every 30 s
  setInterval(() => {
    if (Store.session?.role !== 'master' || App.current !== 'master' || UI.modalOpen()) return;
    if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    App.render('master', true);
  }, 30000);
})();
