/* App core: routing, event delegation, top bar, footer, auth, demo role switcher. */
(function () {
  const { esc, icon, toast, modal, closeModal, fmtPhone, initials } = UI;

  const App = {
    routes: {}, actions: {}, forms: {}, changes: {}, inputs: {}, state: { cart: [], cls: 'sedan' },
    current: 'home',
    route(name, def) { this.routes[name] = def; },
    on(name, fn) { this.actions[name] = fn; },
    form(name, fn) { this.forms[name] = fn; },
    change(name, fn) { this.changes[name] = fn; },
    input(name, fn) { this.inputs[name] = fn; },

    go(name) {
      if (location.hash.slice(1) !== name) {
        try { location.hash = name; } catch (e) { /* frame may refuse; render anyway */ }
      }
      this.render(name);
    },
    render(name = this.current, keepScroll = false) {
      if (!this.routes[name]) name = 'home';
      const prev = this.current;
      this.current = name;
      const r = this.routes[name];
      const s = Store.session;
      let html;
      if (r.area === 'cabinet' && s.role !== 'client') html = App.authGate();
      else if (r.area === 'admin' && s.role !== 'admin') html = App.adminGate();
      else html = r.render();
      const app = document.getElementById('app');
      app.innerHTML = html;
      document.title = (r.title ? r.title + ' · ' : '') + 'Hundred Garage';
      this.renderTopbar();
      this.renderFooter();
      this.renderDemoBar();
      if (window.Chat) Chat.render();
      if (r.mount && ((r.area !== 'cabinet' || s.role === 'client') && (r.area !== 'admin' || s.role === 'admin'))) r.mount();
      if (!keepScroll && prev !== name) window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    },
    refresh() { Store.save(); this.render(this.current, true); },

    navLinks() {
      const s = Store.session;
      if (s.role === 'admin' && this.routes[this.current]?.area === 'admin') return [['home', 'Сайт'], ['admin', 'Панель'], ['admin-orders', 'Замовлення'], ['admin-chat', 'Чат']];
      return [['services', 'Послуги і ціни'], ['booking', 'Онлайн-запис'], ['track', 'Де моє авто?'], ['bonus', 'Бонуси'], ['contacts', 'Контакти']];
    },
    renderTopbar() {
      const s = Store.session;
      const me = Store.me();
      const unread = me ? (Store.db.chats.find(c => c.id === me.id)?.unreadClient || 0) : 0;
      const theme = document.documentElement.dataset.theme;
      const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      let acc;
      if (s.role === 'client' && me) {
        acc = `<a class="btn" href="#cabinet"><span class="avatar">${esc(initials(me.name))}</span><span class="hide-sm">${esc(me.name.split(' ')[0])}</span>${unread ? `<span class="badge-dot">${unread}</span>` : ''}</a>`;
      } else if (s.role === 'admin') {
        acc = `<a class="btn dark" href="#admin">${icon('board', 'width="18" height="18"')}<span class="hide-sm">Адмін-панель</span></a>`;
      } else {
        acc = `<button class="btn" data-act="login">${icon('user', 'width="18" height="18"')}<span class="hide-sm">Кабінет</span></button>`;
      }
      document.getElementById('topbar').innerHTML = `<div class="wrap">
        <a class="logo" href="#home" aria-label="Hundred Garage — на головну"><span class="logo-mark">100</span><span class="logo-text">Hundred Garage<small>АВТОСЕРВІС · КИЇВ</small></span></a>
        <nav class="nav" id="nav" aria-label="Головне меню">${this.navLinks().map(([r, t]) => `<a href="#${r}" class="${this.current === r ? 'on' : ''}">${t}</a>`).join('')}</nav>
        <div class="topbar-actions">
          <button class="icon-btn" data-act="theme" aria-label="${dark ? 'Світла тема' : 'Темна тема'}">${icon(dark ? 'sun' : 'moon')}</button>
          ${s.role !== 'admin' ? `<a class="btn primary hide-sm" href="#booking">Записатися</a>` : ''}
          ${acc}
          <button class="icon-btn burger" data-act="burger" aria-label="Меню">${icon('menu')}</button>
        </div></div>`;
    },
    renderFooter() {
      const st = Store.db.settings;
      const area = this.routes[this.current]?.area;
      const f = document.getElementById('footer');
      if (area === 'admin') { f.hidden = true; return; }
      f.hidden = false;
      f.innerHTML = `<div class="wrap">
        <div class="stack"><span class="logo"><span class="logo-mark">100</span><span class="logo-text">Hundred Garage</span></span>
          <p>Сервіс, де кожну роботу видно: фото, ціна і ваше рішення — до того, як майстер візьме ключ.</p>
          <p class="mono">${esc(st.phone)}</p></div>
        <div><b>Клієнтам</b><a href="#services">Послуги і ціни</a><a href="#booking">Онлайн-запис</a><a href="#track">Де моє авто?</a><a href="#bonus">Бонусна програма</a></div>
        <div><b>Сервіс</b><a href="#home">Про нас</a><a href="#contacts">Контакти</a><button data-act="chat-open">Написати в чат</button></div>
        <div><b>Графік</b>${st.hours.map(h => `<span class="mono" style="display:block;padding:3px 0">${h[0]} · ${h[1]}</span>`).join('')}</div>
      </div>`;
    },
    renderDemoBar() {
      const r = Store.session.role;
      document.getElementById('demo-bar').innerHTML = `<div class="demo-bar" role="group" aria-label="Демо: перемикання ролей">
        <span class="tag">ДЕМО</span>
        <button class="r ${r === 'guest' ? 'on' : ''}" data-act="demo-role" data-role="guest">Гість</button>
        <button class="r ${r === 'client' ? 'on' : ''}" data-act="demo-role" data-role="client">Клієнт</button>
        <button class="r ${r === 'admin' ? 'on' : ''}" data-act="demo-role" data-role="admin">Адмін</button>
        <button class="r" data-act="demo-reset" title="Повернути демо-дані до початкового стану">↺</button>
      </div>`;
    },

    authGate() {
      return `<section class="wrap auth-wrap fade-in"><div class="panel pad stack">
        <span class="eyebrow">Особистий кабінет</span>
        <h2>Ваше авто — під контролем</h2>
        <p class="muted">Статус ремонту онлайн, погодження робіт з фото, сервісна книжка, бонуси і чат з майстром. Вхід — за номером телефону, без паролів.</p>
        <button class="btn primary block" data-act="login">Увійти за номером телефону</button>
        <button class="btn block" data-act="demo-role" data-role="client">Переглянути демо-кабінет</button>
      </div></section>`;
    },
    adminGate() {
      return `<section class="wrap auth-wrap fade-in"><form class="panel pad stack" data-form="admin-login">
        <span class="eyebrow">Hundred Garage · персонал</span>
        <h2>Вхід в адмін-панель</h2>
        <div class="field"><label for="al-login">Логін</label><input class="input" id="al-login" name="login" value="admin" autocomplete="username"></div>
        <div class="field"><label for="al-pass">Пароль</label><input class="input" id="al-pass" name="pass" type="password" value="demo" autocomplete="current-password"></div>
        <div class="note">Демо-доступ: <b>admin</b> / <b>demo</b></div>
        <button class="btn primary block" type="submit">Увійти</button>
      </form></section>`;
    },

    loginModal(step = 'phone') {
      const st = App.state;
      if (step === 'phone') {
        modal({
          title: 'Вхід до кабінету',
          body: `<form class="stack" data-form="login-phone" id="login-form">
            <p class="muted">Надішлемо код у SMS або Viber. Якщо ви в нас уперше — створимо кабінет і нарахуємо ${Store.db.settings.welcome} вітальних балів.</p>
            <div class="field"><label for="lg-phone">Номер телефону</label><input class="input mono" id="lg-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(st.loginPhone || '+380 67 123 45 67')}" required></div>
            <button class="btn primary block" type="submit">Отримати код</button>
            <p class="small muted">Демо: номер +380 67 123 45 67 належить демо-клієнту. Будь-який інший номер створить новий кабінет.</p>
          </form>`
        });
      } else {
        modal({
          title: 'Код підтвердження',
          body: `<form class="stack" data-form="login-code">
            <p class="muted">Код надіслано на <b class="mono">${esc(fmtPhone(st.loginPhone))}</b></p>
            <div class="field"><label for="lg-code">4 цифри з повідомлення</label><input class="input code" id="lg-code" name="code" inputmode="numeric" maxlength="4" autocomplete="one-time-code" value="1111" required></div>
            <button class="btn primary block" type="submit">Увійти</button>
            <button class="link-btn" type="button" data-act="login">Змінити номер</button>
            <p class="small muted">Демо: підійде будь-який код з 4 цифр.</p>
          </form>`
        });
      }
    },
    loginAs(user) {
      Store.session.role = 'client';
      Store.session.userId = user.id;
      Store.saveSession();
    },
    registerUser({ name, phone }) {
      const id = 'u' + Store.next('user');
      const u = {
        id, role: 'client', name: name || 'Новий клієнт', phone: '+' + String(phone).replace(/\D/g, '').replace(/^0/, '380'),
        email: '', bonus: 0, spent: 0, ref: 'HG-' + (name || 'NEW').replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ]/g, '').slice(0, 4).toUpperCase() + Math.floor(Math.random() * 9 + 1),
        joined: new Date().toISOString(), notify: { viber: true, sms: true, email: false }
      };
      Store.db.users.push(u);
      Store.addTx(id, Store.db.settings.welcome, 'welcome', 'Вітальний бонус за реєстрацію');
      return u;
    }
  };
  window.App = App;

  // ---------- global actions ----------
  App.on('theme', () => {
    const root = document.documentElement;
    const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    root.dataset.theme = cur === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('hg_theme', root.dataset.theme); } catch (e) { /* optional */ }
    App.renderTopbar();
  });
  App.on('burger', () => document.getElementById('nav').classList.toggle('open'));
  App.on('go', el => App.go(el.dataset.to));
  App.on('modal-close', () => closeModal());
  App.on('modal-bg', (el, ev) => { if (ev.target === el) closeModal(); });
  App.on('login', () => App.loginModal('phone'));
  App.on('logout', () => {
    Store.session.role = 'guest'; Store.session.userId = null; Store.saveSession();
    toast('Ви вийшли з кабінету'); App.go('home');
  });
  App.on('demo-role', el => {
    const role = el.dataset.role;
    Store.session.role = role;
    Store.session.userId = role === 'client' ? 'u1' : null;
    Store.saveSession();
    closeModal();
    const area = App.routes[App.current]?.area;
    if (role === 'admin') App.go('admin');
    else if (role === 'client') App.go(area === 'cabinet' ? App.current : 'cabinet');
    else App.go(area ? 'home' : App.current);
    toast(role === 'admin' ? 'Ви в ролі адміністратора' : role === 'client' ? 'Ви в ролі клієнта: Олександр Коваль' : 'Ви в ролі гостя сайту');
  });
  App.on('demo-reset', () => {
    modal({
      title: 'Скинути демо-дані?',
      body: '<p>Усі зміни в демо (записи, статуси, бали, повідомлення) повернуться до початкового стану. Дані зберігаються лише у вашому браузері.</p>',
      foot: '<button class="btn" data-act="modal-close">Скасувати</button><button class="btn primary" data-act="demo-reset-yes">Скинути</button>'
    });
  });
  App.on('demo-reset-yes', () => {
    Store.reset(); App.state = { cart: [], cls: 'sedan' }; closeModal(); toast('Демо-дані оновлено', 'ok'); App.render(App.current);
  });

  App.form('login-phone', (f, d) => {
    const digits = d.phone.replace(/\D/g, '');
    if (digits.length < 10) { toast('Введіть номер повністю, наприклад +380 67 123 45 67'); return; }
    App.state.loginPhone = d.phone;
    App.loginModal('code');
  });
  App.form('login-code', (f, d) => {
    if (!/^\d{4}$/.test(d.code)) { toast('Код складається з 4 цифр'); return; }
    let u = Store.findUserByPhone(App.state.loginPhone);
    let fresh = false;
    if (!u) { u = App.registerUser({ phone: App.state.loginPhone }); fresh = true; }
    App.loginAs(u);
    Store.save();
    closeModal();
    toast(fresh ? `Кабінет створено. +${Store.db.settings.welcome} балів на рахунку` : `Вітаємо, ${u.name.split(' ')[0]}!`, 'ok');
    App.go(App.routes[App.current]?.area === 'cabinet' ? App.current : 'cabinet');
  });
  App.form('admin-login', (f, d) => {
    if (d.login.trim() !== 'admin' || d.pass !== 'demo') { toast('Невірний логін або пароль. Демо: admin / demo'); return; }
    Store.session.role = 'admin'; Store.session.userId = null; Store.saveSession();
    App.render('admin');
  });

  // ---------- event delegation ----------
  document.addEventListener('click', ev => {
    let el = ev.target.closest('[data-act]');
    // the modal backdrop only reacts to clicks on itself, not on anything inside the dialog
    if (el && el.dataset.act === 'modal-bg' && ev.target !== el) el = null;
    if (el && App.actions[el.dataset.act]) {
      ev.preventDefault();
      App.actions[el.dataset.act](el, ev);
      return;
    }
    const a = ev.target.closest('a[href^="#"]');
    if (a) {
      const name = a.getAttribute('href').slice(1);
      document.getElementById('nav')?.classList.remove('open');
      if (App.routes[name]) {
        ev.preventDefault();
        closeModal();
        App.go(name);
      }
    }
  });
  document.addEventListener('submit', ev => {
    const f = ev.target.closest('form[data-form]');
    if (!f) return;
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(f).entries());
    App.forms[f.dataset.form]?.(f, d, ev);
  });
  document.addEventListener('change', ev => {
    const el = ev.target.closest('[data-change]');
    if (el) App.changes[el.dataset.change]?.(el, ev);
  });
  document.addEventListener('input', ev => {
    const el = ev.target.closest('[data-input]');
    if (el) App.inputs[el.dataset.input]?.(el, ev);
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && UI.modalOpen()) closeModal(); });
  window.addEventListener('hashchange', () => {
    const name = location.hash.slice(1);
    if (App.routes[name] && name !== App.current) { closeModal(); App.render(name); }
  });
  // Cross-tab sync: open the admin in one tab and the site in another — chat and statuses update live
  window.addEventListener('storage', ev => {
    if (ev.key !== Store.KEY || !ev.newValue) return;
    try { Store.db = JSON.parse(ev.newValue); } catch (e) { return; }
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!typing && !UI.modalOpen()) App.render(App.current, true);
    else if (window.Chat) Chat.render();
  });

  document.addEventListener('DOMContentLoaded', () => {
    try { const t = localStorage.getItem('hg_theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* default theme */ }
    Store.load();
    const start = location.hash.slice(1);
    App.render(App.routes[start] ? start : 'home');
  });
})();
