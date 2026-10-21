/* Site chat widget for guests and clients, with an instant auto-assistant for common questions.
   Messages land in the admin inbox (admin → Чат). */
(function () {
  const { esc, money, num, icon, fmtDay, fmtTime, toast } = UI;
  const S = () => Store.db;
  let open = false;
  let typing = false;

  function chatId() {
    const s = Store.session;
    return s.role === 'client' ? s.userId : s.guestId;
  }
  function current(create) {
    const id = chatId();
    let c = S().chats.find(x => x.id === id);
    if (!c && create) {
      const me = Store.me();
      c = Store.chatFor(id, me ? me.name : 'Гість сайту', me?.id);
    }
    return c;
  }

  function botAnswer(text) {
    const t = text.toLowerCase();
    const st = S().settings;
    const me = Store.me();
    const svc = id => Store.service(id);
    if (/де .*авто|статус|готов|коли забрати/.test(t)) {
      const o = me && Store.activeOrder(me.id);
      if (o) return { text: `Ваше замовлення ${o.id} (${UI.carName(Store.car(o.carId))}): «${Store.status(o.status).name}». ${Store.status(o.status).client}.`, action: ['order-open', 'Відкрити замовлення', o.id] };
      return { text: 'Статус ремонту можна перевірити за номером замовлення з SMS.', action: ['go', 'Де моє авто?', 'track'] };
    }
    if (/масл|\bто\b|фільтр|техобслуг/.test(t)) return { text: `Заміна масла з фільтром — ${money(svc('s4').price)} за роботу, комплексне ТО — ${money(svc('s5').price)} (масло, 4 фільтри, рідини, огляд 40 пунктів). Масло можна привезти своє.`, action: ['go', 'Записатися на ТО', 'booking'] };
    if (/грм|ремін/.test(t)) return { text: `Заміна комплекту ГРМ — від ${money(svc('s14').price)} за роботу, близько 4 годин. Точну ціну назве адміністратор, коли знатиме двигун.` };
    if (/колодк|гальм|диск/.test(t)) return { text: `Колодки на вісь — ${money(svc('s11').price)}, диски з колодками — ${money(svc('s12').price)}. Перевіримо товщину безкоштовно під час огляду.`, action: ['go', 'Записатися', 'booking'] };
    if (/кондиц|фреон/.test(t)) return { text: `Заправка кондиціонера — ${money(svc('s22').price)}, з антибактеріальною обробкою зараз діє акція.`, action: ['go', 'Обрати час', 'booking'] };
    if (/шин|колес|резин|шиномонт/.test(t)) return { text: `Сезонна заміна R13–R16 — ${money(svc('s19').price)}, R17–R20 — ${money(svc('s20').price)} за 4 колеса з балансуванням. Зберігання — ${money(svc('s21').price)} за сезон.`, action: ['go', 'Записатися', 'booking'] };
    if (/запис|записат|вільн|час/.test(t)) return { text: 'Онлайн-запис займає хвилину: обираєте послугу і вільний час на завантаженості постів.', action: ['go', 'Онлайн-запис', 'booking'] };
    if (/запчаст|свої|своє|деталь|оригінал|аналог/.test(t)) return { text: 'Можна і так, і так. Ми підбираємо запчастини з двома цінами — оригінал і перевірений аналог — і замовляємо тільки після вашої згоди в кабінеті. Або привезіть свої: оберіть «Привезу свої» під час запису, артикул підкажемо.', action: ['go', 'Записатися', 'booking'] };
    if (/граф|годин|працює|адрес|де ви|як доїхати/.test(t)) return { text: `${st.address}. ${st.hours.map(h => h.join(' ')).join(', ')}. Телефон ${st.phone}.`, action: ['go', 'Контакти і маршрут', 'contacts'] };
    if (/бал|бонус|кешбек/.test(t)) {
      if (me) return { text: `На вашому рахунку ${num(me.bonus)} балів, рівень «${Store.level(me.spent).cur.name}» — ${Store.level(me.spent).cur.cashback}% кешбеку.`, action: ['go', 'Мої бонуси', 'cabinet-bonus'] };
      return { text: `Повертаємо від 3% до 10% кожного чеку балами, за реєстрацію — ${st.welcome} балів.`, action: ['go', 'Про бонуси', 'bonus'] };
    }
    if (/гарант/.test(t)) return { text: 'Гарантія 12 місяців або 20 000 км на роботи і запчастини, встановлені в нас.' };
    if (/ціна|скільки|вартість|прайс/.test(t)) return { text: 'Усі ціни за роботу є в прайсі з калькулятором для вашого типу авто.', action: ['go', 'Послуги і ціни', 'services'] };
    if (/підмін|евакуат/.test(t)) return { text: 'Евакуатор організуємо по Києву. Підмінне авто — для ремонтів довше доби, за запитом. Адміністратор уточнить наявність.' };
    return null;
  }

  function msgHtml(m) {
    const mine = m.from === 'client';
    const act = m.action ? `<button class="btn sm ${mine ? '' : 'primary'}" style="margin-top:8px" data-act="${m.action[0]}" data-to="${esc(m.action[2])}" data-id="${esc(m.action[2])}">${esc(m.action[1])}</button>` : '';
    return `<div class="msg ${mine ? 'out' : m.from === 'bot' ? 'bot' : 'in'}">${m.from === 'bot' ? '<span class="by">Автовідповідь</span>' : m.from === 'admin' ? `<span class="by">${esc(m.by || 'Hundred Garage')}</span>` : ''}${esc(m.text)}${act}<time>${fmtDay(m.at)}, ${fmtTime(m.at)}</time></div>`;
  }

  function render() {
    const box = document.getElementById('chat');
    if (!box) return;
    if (Store.session.role === 'admin') { box.innerHTML = ''; return; }
    const c = current(false);
    const unread = c?.unreadClient || 0;
    if (open && c && c.unreadClient) { c.unreadClient = 0; Store.save(); }
    const me = Store.me();
    const quick = ['Де моє авто?', 'Скільки коштує ТО?', 'Записатися', 'Графік роботи', 'Мої бали'];
    box.innerHTML = `
      ${open ? `<section class="chat-panel" role="dialog" aria-label="Чат з сервісом">
        <div class="chat-head"><span class="avatar">HG</span><div class="who"><b>Hundred Garage</b><small>● адміністратор онлайн · відповідь ~4 хв</small></div><button class="icon-btn" data-act="chat-close" aria-label="Закрити чат">${icon('x')}</button></div>
        <div class="msgs" id="chat-msgs">
          <div class="msg in"><span class="by">Hundred Garage</span>Вітаємо${me ? ', ' + esc(me.name.split(' ')[0]) : ''}! Підкажемо ціну, вільний час або статус ремонту. Пишіть питання — на типові відповімо одразу.</div>
          ${(c?.messages || []).map(msgHtml).join('')}
          ${typing ? '<div class="typing" aria-label="Друкує"><i></i><i></i><i></i></div>' : ''}
        </div>
        <div class="quick">${quick.map(q => `<button class="chip" data-act="chat-quick" data-t="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <form class="chat-input" data-form="chat-send"><input class="input" id="chat-text" name="text" placeholder="Ваше питання…" autocomplete="off" value="${esc(App.state.chatDraft || '')}" data-input="chat-draft" aria-label="Повідомлення"><button class="btn primary" type="submit" aria-label="Надіслати">${icon('send', 'width="18" height="18"')}</button></form>
      </section>` : ''}
      <button class="chat-fab" data-act="${open ? 'chat-close' : 'chat-open'}" aria-label="${open ? 'Закрити чат' : 'Відкрити чат'}">${icon(open ? 'x' : 'chat')}<span class="t">${open ? 'Закрити' : 'Чат з сервісом'}</span>${!open && unread ? `<span class="badge-dot">${unread}</span>` : ''}</button>`;
    const m = document.getElementById('chat-msgs');
    if (m) m.scrollTop = m.scrollHeight;
  }

  function send(text) {
    text = text.trim();
    if (!text) return;
    const c = current(true);
    c.messages.push({ from: 'client', text, at: new Date().toISOString() });
    c.unreadAdmin++;
    App.state.chatDraft = '';
    Store.save();
    const ans = botAnswer(text);
    const recentGeneric = c.messages.some(m => m.from === 'bot' && m.generic && Date.now() - new Date(m.at) < 10 * 60 * 1000);
    if (ans || !recentGeneric) {
      typing = true;
      render();
      setTimeout(() => {
        typing = false;
        const msg = ans ? { from: 'bot', text: ans.text, at: new Date().toISOString() } : { from: 'bot', generic: true, text: 'Дякуємо! Адміністратор отримав повідомлення і відповість протягом 5 хвилин. Відповідь з\'явиться тут' + (Store.me() ? ' і в Viber.' : '.'), at: new Date().toISOString() };
        if (ans?.action) msg.action = ans.action;
        c.messages.push(msg);
        Store.save();
        render();
        document.getElementById('chat-text')?.focus();
      }, 900);
    } else render();
    document.getElementById('chat-text')?.focus();
  }

  App.on('chat-open', () => { open = true; render(); if (!matchMedia('(max-width: 600px)').matches) document.getElementById('chat-text')?.focus(); App.renderTopbar(); });
  App.on('chat-close', () => { open = false; render(); });
  App.on('chat-quick', el => send(el.dataset.t));
  App.form('chat-send', (f, d) => send(d.text));
  App.input('chat-draft', el => { App.state.chatDraft = el.value; });

  window.Chat = { render };
})();
