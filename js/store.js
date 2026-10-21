/* Hundred Garage — demo data layer.
   In the demo everything lives in the browser (localStorage, with in-memory fallback).
   In production this module is replaced by API calls; the data shapes stay the same. */
(function () {
  const KEY = 'hg_demo_v3';
  const SESSION_KEY = 'hg_demo_session_v1';

  const pad = n => String(n).padStart(2, '0');
  const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const dayStr = (offset = 0) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const isoAt = (offset, hh = 10, mm = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };
  // Deterministic random so the seeded demo looks the same for everyone
  let rs = 42;
  const rnd = () => ((rs = (rs * 16807) % 2147483647) - 1) / 2147483646;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  const STATUSES = [
    { id: 'new', name: 'Нова заявка', short: 'Нова', tone: 'info', client: 'Заявку отримано, менеджер підтвердить час' },
    { id: 'confirmed', name: 'Підтверджено', short: 'Підтверджено', tone: 'info', client: 'Чекаємо вас у призначений час' },
    { id: 'accepted', name: 'Авто прийнято', short: 'Прийнято', tone: 'warn', client: 'Майстер прийняв авто, склав акт огляду' },
    { id: 'diagnostics', name: 'Діагностика', short: 'Діагностика', tone: 'warn', client: 'Перевіряємо вузли та фотографуємо стан' },
    { id: 'approval', name: 'Погодження робіт', short: 'Погодження', tone: 'bad', client: 'Потрібне ваше рішення щодо додаткових робіт і запчастин' },
    { id: 'parts', name: 'Очікуємо запчастини', short: 'Запчастини', tone: 'warn', client: 'Запчастини замовлено — повідомимо, щойно прибудуть' },
    { id: 'repair', name: 'Ремонт', short: 'Ремонт', tone: 'warn', client: 'Виконуємо погоджені роботи' },
    { id: 'qc', name: 'Контроль якості', short: 'Контроль', tone: 'warn', client: 'Старший майстер перевіряє результат, тест-драйв' },
    { id: 'ready', name: 'Готово до видачі', short: 'Готово', tone: 'ok', client: 'Можна забирати авто' },
    { id: 'done', name: 'Видано', short: 'Видано', tone: 'ok', client: 'Дякуємо! Гарантія діє 12 місяців' },
    { id: 'cancelled', name: 'Скасовано', short: 'Скасовано', tone: '', client: 'Запис скасовано' }
  ];

  const FLOW = ['new', 'confirmed', 'accepted', 'diagnostics', 'approval', 'parts', 'repair', 'qc', 'ready', 'done'];

  // Part line statuses. Supplied by the service: request (from a master) → quote → to_order → ordered → in_stock → installed.
  // Brought by the client: awaiting → received → installed.
  const PART_STATUSES = [
    { id: 'request', name: 'Запит майстра — підбираємо ціну', short: 'Запит', tone: 'info' },
    { id: 'quote', name: 'Чекає вашого рішення', short: 'Пропозиція', tone: 'bad' },
    { id: 'to_order', name: 'Треба замовити', short: 'Замовити', tone: 'info' },
    { id: 'ordered', name: 'Замовлено, в дорозі', short: 'В дорозі', tone: 'warn' },
    { id: 'in_stock', name: 'На складі сервісу', short: 'На складі', tone: 'ok' },
    { id: 'awaiting', name: 'Чекаємо від клієнта', short: 'Від клієнта', tone: 'warn' },
    { id: 'received', name: 'Отримано від клієнта', short: 'Отримано', tone: 'ok' },
    { id: 'installed', name: 'Встановлено', short: 'Встановлено', tone: 'ok' },
    { id: 'declined', name: 'Відмова', short: 'Відмова', tone: '' }
  ];
  const PARTS_PREF = {
    service: 'Підбирає і замовляє сервіс',
    own: 'Клієнт привезе свої',
    later: 'Вирішимо після огляду'
  };

  const CATEGORIES = [
    { id: 'diag', name: 'Діагностика', hint: 'Комп\'ютерна, ходова, перед купівлею', icon: 'scan' },
    { id: 'to', name: 'ТО та мастила', hint: 'Масло, фільтри, рідини', icon: 'oil' },
    { id: 'susp', name: 'Ходова', hint: 'Амортизатори, важелі, сайлентблоки', icon: 'susp' },
    { id: 'brakes', name: 'Гальма', hint: 'Колодки, диски, рідина', icon: 'brake' },
    { id: 'engine', name: 'Двигун', hint: 'ГРМ, свічки, ремонт', icon: 'engine' },
    { id: 'elec', name: 'Автоелектрика', hint: 'АКБ, стартер, генератор', icon: 'bolt' },
    { id: 'tires', name: 'Шиномонтаж', hint: 'Сезонна заміна, балансування', icon: 'tire' },
    { id: 'ac', name: 'Кондиціонер', hint: 'Заправка, антибактеріальна обробка', icon: 'snow' },
    { id: 'body', name: 'Розвал-сходження', hint: '3D-стенд, протокол до/після', icon: 'align' }
  ];

  const CAR_CLASSES = [
    { id: 'sedan', name: 'Легковий', k: 1 },
    { id: 'suv', name: 'Кросовер / SUV', k: 1.2 },
    { id: 'van', name: 'Мінівен / бус', k: 1.35 },
    { id: 'premium', name: 'Преміум', k: 1.5 }
  ];

  function seed() {
    rs = 42;
    const services = [
      ['s1', 'diag', 'Комп\'ютерна діагностика', 650, 40, 'Зчитування помилок усіх блоків, звіт з поясненнями', true],
      ['s2', 'diag', 'Діагностика ходової', 450, 30, 'Огляд на підйомнику, люфт-детектор', true],
      ['s3', 'diag', 'Перевірка перед купівлею', 1800, 90, 'Товщиномір, ендоскоп, OBD, ходова, тест-драйв', false],
      ['s4', 'to', 'Заміна масла двигуна + фільтр', 500, 30, 'Робота. Масло можна привезти своє або взяти у нас', true],
      ['s5', 'to', 'Комплексне ТО', 1900, 120, 'Масло, 4 фільтри, рідини, огляд 40 пунктів', true],
      ['s6', 'to', 'Заміна масла в АКПП (апаратна)', 2200, 90, 'Апаратна заміна з промивкою', false],
      ['s7', 'to', 'Заміна антифризу', 700, 45, 'Злив, промивка, заправка', false],
      ['s8', 'susp', 'Заміна амортизаторів (вісь)', 1600, 90, 'Передня або задня вісь', false],
      ['s9', 'susp', 'Заміна сайлентблоків важеля', 1400, 120, 'Пресування, без заміни важеля', false],
      ['s10', 'susp', 'Заміна стійок стабілізатора', 500, 30, 'Пара', false],
      ['s11', 'brakes', 'Заміна гальмівних колодок (вісь)', 600, 40, 'Очистка супортів та напрямних', true],
      ['s12', 'brakes', 'Заміна гальмівних дисків + колодок', 1300, 70, 'Вісь, з проточкою маточини', false],
      ['s13', 'brakes', 'Заміна гальмівної рідини', 650, 40, 'Прокачка всіх контурів', false],
      ['s14', 'engine', 'Заміна ременя ГРМ (комплект)', 3800, 240, 'Ремінь, ролики, помпа за потреби', false],
      ['s15', 'engine', 'Заміна свічок запалювання', 450, 30, '4 циліндри', false],
      ['s16', 'engine', 'Чистка дросельної заслінки', 600, 40, 'З адаптацією', false],
      ['s17', 'elec', 'Перевірка АКБ та зарядної системи', 250, 20, 'Тестер навантаження, генератор', false],
      ['s18', 'elec', 'Ремонт стартера / генератора', 1500, 180, 'Зняття, ремонт, встановлення', false],
      ['s19', 'tires', 'Сезонна заміна шин R13–R16', 800, 40, '4 колеса: зняття, монтаж, балансування', true],
      ['s20', 'tires', 'Сезонна заміна шин R17–R20', 1200, 50, '4 колеса: зняття, монтаж, балансування', false],
      ['s21', 'tires', 'Зберігання шин (сезон)', 900, 10, 'Мийка, пакування, стелаж', false],
      ['s22', 'ac', 'Заправка кондиціонера', 900, 50, 'Вакуумування, перевірка герметичності, фреон R134a', true],
      ['s23', 'ac', 'Антибактеріальна обробка', 600, 30, 'Ультразвукова обробка випарника', false],
      ['s24', 'body', 'Розвал-сходження 3D', 750, 40, 'Протокол до і після в кабінет', true]
    ].map(([id, cat, name, price, dur, desc, popular]) => ({ id, cat, name, price, dur, desc, popular, active: true }));

    const masters = [
      { id: 'm1', name: 'Андрій Мельник', role: 'Старший майстер, діагност', exp: 14, rating: 4.9, jobs: 2310, login: 'andrii', payPct: 45, adjustments: [], payouts: [] },
      { id: 'm2', name: 'Тарас Бондар', role: 'Ходова та гальма', exp: 9, rating: 4.8, jobs: 1640, login: 'taras', payPct: 40, adjustments: [], payouts: [] },
      { id: 'm3', name: 'Ігор Савчук', role: 'Двигуни та ГРМ', exp: 17, rating: 5.0, jobs: 2980, login: 'ihor', payPct: 45, adjustments: [], payouts: [] },
      { id: 'm4', name: 'Марія Ткаченко', role: 'Автоелектрика, кондиціонери', exp: 7, rating: 4.9, jobs: 1120, login: 'maria', payPct: 40, adjustments: [], payouts: [] }
    ];
    const bays = [
      { id: 'b1', name: 'Пост 1', kind: 'Діагностика / ТО' },
      { id: 'b2', name: 'Пост 2', kind: 'Ходова / гальма' },
      { id: 'b3', name: 'Пост 3', kind: 'Двигун' },
      { id: 'b4', name: 'Пост 4', kind: 'Шини / розвал' }
    ];

    const users = [
      { id: 'u1', name: 'Олександр Коваль', phone: '+380671234567', email: 'o.koval@example.com', birthday: '1988-11-03', bonus: 1240, spent: 23850, ref: 'HG-OLEK7', joined: isoAt(-400), notify: { viber: true, sms: true, email: false } },
      { id: 'u2', name: 'Ірина Шевчук', phone: '+380503217788', email: 'iryna.sh@example.com', bonus: 3410, spent: 52300, ref: 'HG-IRYN2', joined: isoAt(-700), notify: { viber: true, sms: false, email: true } },
      { id: 'u3', name: 'Дмитро Литвиненко', phone: '+380937774411', email: '', bonus: 380, spent: 7600, ref: 'HG-DMYT4', joined: isoAt(-120), notify: { viber: false, sms: true, email: false } },
      { id: 'u4', name: 'Наталія Гончаренко', phone: '+380662005060', email: 'natali.g@example.com', bonus: 8900, spent: 112400, personalDiscount: 5, ref: 'HG-NATA9', joined: isoAt(-1100), notify: { viber: true, sms: true, email: true } },
      { id: 'u5', name: 'Василь Кравчук', phone: '+380979001122', email: '', bonus: 200, spent: 0, ref: 'HG-VASY1', joined: isoAt(-3), notify: { viber: true, sms: true, email: false } },
      { id: 'u6', name: 'Олена Поліщук', phone: '+380631119900', email: 'olena.p@example.com', bonus: 1960, spent: 31800, ref: 'HG-OLEN3', joined: isoAt(-520), notify: { viber: true, sms: false, email: false } }
    ];
    users.forEach(u => (u.role = 'client'));

    const cars = [
      { id: 'c1', userId: 'u1', make: 'Skoda', model: 'Octavia A7', year: 2017, plate: 'AA 4127 KX', vin: 'TMBJG7NE5H0123456', engine: '1.8 TSI', cls: 'sedan', mileage: 148200 },
      { id: 'c2', userId: 'u1', make: 'Toyota', model: 'RAV4', year: 2020, plate: 'AA 9031 MP', vin: 'JTMW1RFV0LD012345', engine: '2.0 бензин', cls: 'suv', mileage: 61400 },
      { id: 'c3', userId: 'u2', make: 'Volkswagen', model: 'Passat B8', year: 2018, plate: 'KA 2288 BE', vin: 'WVWZZZ3CZJE012345', engine: '2.0 TDI', cls: 'sedan', mileage: 189000 },
      { id: 'c4', userId: 'u3', make: 'Renault', model: 'Duster', year: 2019, plate: 'AI 5514 OO', vin: 'VF1HJD20X61234567', engine: '1.5 dCi', cls: 'suv', mileage: 97300 },
      { id: 'c5', userId: 'u4', make: 'BMW', model: 'X5 G05', year: 2021, plate: 'AA 0100 HG', vin: 'WBACR6105M9A12345', engine: '3.0d', cls: 'premium', mileage: 54800 },
      { id: 'c6', userId: 'u4', make: 'Mazda', model: 'CX-5', year: 2016, plate: 'AA 7712 TT', vin: 'JMZKE2W7600123456', engine: '2.5', cls: 'suv', mileage: 131000 },
      { id: 'c7', userId: 'u5', make: 'Hyundai', model: 'Tucson', year: 2022, plate: 'BC 3030 AK', vin: 'TMAJ381AAMJ123456', engine: '2.0', cls: 'suv', mileage: 28700 },
      { id: 'c8', userId: 'u6', make: 'Ford', model: 'Transit Custom', year: 2019, plate: 'AA 6655 XC', vin: 'WF0YXXTTGYKA12345', engine: '2.0 EcoBlue', cls: 'van', mileage: 214500 }
    ];

    const svcPrice = (ids, cls) => {
      const k = (CAR_CLASSES.find(c => c.id === cls) || CAR_CLASSES[0]).k;
      return ids.reduce((s, id) => s + Math.round(services.find(x => x.id === id).price * k / 10) * 10, 0);
    };

    const orders = [];
    let no = 23800;
    const mk = (o) => {
      const car = cars.find(c => c.id === o.carId);
      const ord = Object.assign({
        id: 'HG-' + (no++), userId: car.userId, comment: '', items: [], parts: 0, useBonus: 0, earned: 0,
        waitOnSite: false, createdAt: isoAt(o.dayOffset - 2, 18), history: [], partsPref: 'service', discount: null,
        work: { spent: 0, running: null }, masterNote: ''
      }, o);
      ord.date = dayStr(o.dayOffset);
      ord.labor = svcPrice(ord.services, car.cls);
      if (typeof ord.parts === 'number') {
        ord.parts = ord.parts ? [part({ name: 'Запчастини та матеріали за чеком', price: ord.parts, status: ord.status === 'done' ? 'installed' : 'in_stock' })] : [];
      }
      Store.recalc(ord);
      delete ord.dayOffset;
      orders.push(ord);
      return ord;
    };
    let pn = 0;
    function part(p) {
      return Object.assign({ id: 'p' + (++pn), name: '', brand: '', code: '', qty: 1, price: 0, stock: true, source: 'service', status: 'in_stock', alt: null, choice: 'main', approved: true }, p);
    }
    const histTo = (st, dayOffset, startH) => {
      const flow = FLOW.filter(x => x !== 'parts' || st === 'parts');
      const out = [];
      const end = flow.indexOf(st);
      for (let i = 0; i <= end; i++) {
        const day = i < 2 ? dayOffset - 2 + i : dayOffset;
        const h = i < 2 ? 18 : startH + (i - 2) * 0.6;
        out.push({ status: flow[i], at: isoAt(day, Math.floor(h), Math.round((h % 1) * 60)) });
      }
      return out;
    };

    // History: completed orders over the last 45 days (feeds the admin revenue chart and service books)
    const histSets = [['s5'], ['s4'], ['s11', 's13'], ['s19'], ['s24'], ['s1', 's2'], ['s22', 's23'], ['s8'], ['s12'], ['s14'], ['s5', 's24'], ['s20'], ['s9', 's10'], ['s15', 's16']];
    for (let d = -60; d <= -1; d++) {
      const n = 1 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const car = pick(cars.filter(c => c.id !== 'c7'));
        const set = pick(histSets);
        const h = 9 + Math.floor(rnd() * 8);
        const o = mk({
          carId: car.id, services: set, dayOffset: d, time: `${pad(h)}:00`, bay: pick(bays).id, master: pick(masters).id,
          status: 'done', parts: Math.round(rnd() * 40) * 100, mileage: car.mileage - Math.abs(d) * 45
        });
        o.history = histTo('done', d, h);
        o.earned = Math.round(o.total * 0.05);
      }
    }
    // Make the demo client's service book tell a clear story
    const bookC1 = [
      mk({ carId: 'c1', services: ['s5'], dayOffset: -190, time: '10:00', bay: 'b1', master: 'm1', status: 'done', parts: 2650, mileage: 139900 }),
      mk({ carId: 'c1', services: ['s19'], dayOffset: -170, time: '15:00', bay: 'b4', master: 'm2', status: 'done', parts: 0, mileage: 140800 }),
      mk({ carId: 'c1', services: ['s12'], dayOffset: -96, time: '11:00', bay: 'b2', master: 'm2', status: 'done', parts: 5400, mileage: 144300 }),
      mk({ carId: 'c2', services: ['s5', 's24'], dayOffset: -60, time: '09:00', bay: 'b1', master: 'm1', status: 'done', parts: 3900, mileage: 58200 }),
      mk({ carId: 'c2', services: ['s22'], dayOffset: -30, time: '13:00', bay: 'b1', master: 'm4', status: 'done', parts: 600, mileage: 60100 })
    ];
    [-190, -170, -96, -60, -30].forEach((d, i) => { bookC1[i].history = histTo('done', d, 10); bookC1[i].earned = Math.round(bookC1[i].total * 0.05); });

    // Today — the live workshop board
    const today = [
      { carId: 'c1', services: ['s5', 's2'], time: '09:00', bay: 'b2', master: 'm2', status: 'approval', mileage: 148200, work: { spent: 45, running: null },
        masterNote: 'Пильовик лівого ШРУСа почав тріскатися — запропонувати на наступному ТО',
        comment: 'Стукіт спереду справа на нерівностях',
        parts: [
          part({ name: 'Масло моторне 5W-30, 4,5 л', brand: 'Castrol EDGE', code: '15669E', price: 1650 }),
          part({ name: 'Фільтр масляний', brand: 'MANN', code: 'W 712/95', price: 380 }),
          part({ name: 'Фільтр повітряний', brand: 'MANN', code: 'C 27 009', price: 620 }),
          part({ name: 'Колодки гальмівні передні', brand: 'TRW', code: 'GDB1550', price: 1250, stock: false, eta: 'сьогодні до 14:00', status: 'quote', approved: null,
            alt: { brand: 'Bosch', code: '0 986 494 524', price: 890, stock: true, eta: 'на складі' } }),
          part({ name: 'Стійка стабілізатора передня права', brand: 'Lemförder', code: '36771 01', price: 760, stock: false, eta: 'завтра до 10:00', status: 'quote', approved: null,
            alt: { brand: 'Febi', code: '37305', price: 420, stock: true, eta: 'на складі' } }),
          part({ name: 'Фільтр салону вугільний', brand: 'MANN', code: 'CUK 26 009', price: 540, status: 'quote', approved: null })
        ],
        items: [
          { id: 'i1', name: 'Передні гальмівні колодки — залишок 2 мм', sev: 'red', price: 600, note: 'Робота. Нижче 3 мм — небезпечно. Колодки — в розділі «Запчастини»', decision: null },
          { id: 'i2', name: 'Стійка стабілізатора передня права — люфт', sev: 'red', price: 450, note: 'Робота. Ймовірна причина стукоту', decision: null },
          { id: 'i3', name: 'Фільтр салону — сильно забруднений', sev: 'yellow', price: 150, note: 'Робота. Можна замінити зараз або на наступному ТО', decision: null },
          { id: 'i4', name: 'Щітки склоочисника — сліди на склі', sev: 'yellow', price: 560, note: 'Щітки Bosch Aerotwin з установкою', decision: null },
          { id: 'i5', name: 'Шини, тиск, освітлення', sev: 'green', price: 0, note: 'В нормі', decision: null }
        ] },
      { carId: 'c3', services: ['s14'], time: '09:00', bay: 'b3', master: 'm3', status: 'repair', mileage: 189000, work: { spent: 70, running: isoAt(0, 10, 30) },
        parts: [part({ name: 'Комплект ГРМ з помпою', brand: 'ContiTech', code: 'CT1139WP2', price: 6900, status: 'installed' }), part({ name: 'Антифриз G13, 5 л', brand: 'VAG', code: 'G013A8JM1', price: 900 })] },
      { carId: 'c5', services: ['s12'], time: '15:00', bay: 'b2', master: 'm2', status: 'parts', mileage: 54800, comment: 'Биття керма при гальмуванні',
        parts: [
          part({ name: 'Диски гальмівні передні (пара)', brand: 'Brembo', code: '09.C394.13', price: 9800, stock: false, status: 'ordered', eta: 'завтра до 11:00' }),
          part({ name: 'Колодки гальмівні передні', brand: 'Brembo', code: 'P 06 099', price: 3400, stock: false, status: 'ordered', eta: 'завтра до 11:00' }),
          part({ name: 'Датчик зносу колодок', brand: 'BMW', code: '34356890791', price: 0, source: 'client', status: 'received', stock: false })
        ] },
      { carId: 'c8', services: ['s1'], time: '10:00', bay: 'b1', master: 'm1', status: 'diagnostics', mileage: 214500, comment: 'Горить check engine', work: { spent: 25, running: null },
        items: [{ id: 'i6', name: 'Помилка P2200 — датчик NOx, обрив ланцюга', sev: 'red', price: 900, note: 'Робота з заміни датчика', decision: null }],
        parts: [part({ name: 'Датчик NOx', qty: 1, price: 0, stock: false, status: 'request', approved: null, note: 'Ford Transit Custom 2.0 EcoBlue 2019, VIN у картці', requestedBy: 'm1' })] },
      { carId: 'c6', services: ['s24', 's19'], time: '11:00', bay: 'b4', master: 'm2', status: 'qc', parts: 0, mileage: 131000, work: { spent: 55, running: null } },
      { carId: 'c4', services: ['s22'], time: '14:00', bay: 'b1', master: 'm4', status: 'confirmed', parts: 0, mileage: 97300 },
      { carId: 'c7', services: ['s4'], time: '16:00', bay: 'b1', master: null, status: 'new', parts: 0, mileage: 28700 }
    ];
    today.forEach((t, i) => {
      const o = mk(Object.assign({ dayOffset: 0 }, t));
      if (i === 0) o.id = 'HG-24117';
      o.history = histTo(t.status, 0, +t.time.slice(0, 2));
    });
    // Upcoming
    [
      { carId: 'c2', services: ['s19'], dayOffset: 3, time: '12:00', bay: 'b4', master: 'm2', status: 'confirmed', mileage: 61400 },
      { carId: 'c5', services: ['s5'], dayOffset: 1, time: '10:00', bay: 'b1', master: 'm1', status: 'confirmed', mileage: 54800 },
      { carId: 'c3', services: ['s24'], dayOffset: 1, time: '15:00', bay: 'b4', master: null, status: 'new', mileage: 189000 },
      { carId: 'c4', services: ['s8'], dayOffset: 2, time: '09:00', bay: 'b2', master: 'm2', status: 'confirmed', mileage: 97300, partsPref: 'own',
        comment: 'Амортизатори куплю сам', parts: [part({ name: 'Амортизатори передні (пара)', brand: 'KYB Excel-G', code: '339289', price: 0, source: 'client', status: 'awaiting', stock: false })] }
    ].forEach(t => { const o = mk(Object.assign({ parts: 0 }, t)); o.history = histTo(t.status, t.dayOffset, 9); });
    // Payroll history: each master was paid out up to 15 days ago
    masters.forEach(m => {
      const amt = orders.filter(o => o.master === m.id && o.status === 'done' && o.date < dayStr(-15))
        .reduce((s, o) => s + Math.round((o.labor + o.items.filter(i => i.decision === 'yes').reduce((a, i) => a + i.price, 0)) * m.payPct / 100), 0);
      m.payouts.push({ at: isoAt(-15, 18), amount: amt, note: 'Виплата за попередній період' });
    });
    masters[1].adjustments.push({ at: isoAt(-4, 18), amount: 500, note: 'Премія: 5 відгуків з оцінкою 5★' });
    masters[1].adjustments.push({ at: isoAt(-2, 18), amount: -200, note: 'Повторний заїзд: не затягнуто хомут' });
    // Personal discount for the top-level client is applied to every new order
    orders.filter(o => o.userId === 'u4' && o.status !== 'done').forEach(o => { o.discount = { type: 'pct', value: 5, target: 'labor', reason: 'Персональна знижка клієнта' }; Store.recalc(o); });

    const bonusTx = [
      { userId: 'u1', amount: 200, type: 'welcome', note: 'Вітальний бонус за реєстрацію', at: isoAt(-400) },
      { userId: 'u1', amount: 228, type: 'earn', note: 'Кешбек 5% · комплексне ТО', at: isoAt(-190, 13) },
      { userId: 'u1', amount: 40, type: 'earn', note: 'Кешбек 5% · шиномонтаж', at: isoAt(-170, 16) },
      { userId: 'u1', amount: 50, type: 'review', note: 'Бонус за відгук', at: isoAt(-169, 9) },
      { userId: 'u1', amount: -300, type: 'spend', note: 'Оплата балами · гальма', at: isoAt(-96, 14) },
      { userId: 'u1', amount: 335, type: 'earn', note: 'Кешбек 5% · диски та колодки', at: isoAt(-96, 14) },
      { userId: 'u1', amount: 300, type: 'referral', note: 'Друг Дмитро Л. зробив перше замовлення', at: isoAt(-80, 11) },
      { userId: 'u1', amount: 317, type: 'earn', note: 'Кешбек 5% · ТО RAV4', at: isoAt(-60, 12) },
      { userId: 'u1', amount: 70, type: 'earn', note: 'Кешбек 5% · кондиціонер', at: isoAt(-30, 15) }
    ].map((t, i) => Object.assign({ id: 't' + (i + 1) }, t));

    const reviews = [
      { id: 'r1', name: 'Ірина Ш.', car: 'VW Passat B8', rating: 5, text: 'Подобається, що всі додаткові роботи приходять у кабінет з фото і ціною. Погодила тільки критичне, решту перенесли на наступне ТО. Без нав\'язування.', at: isoAt(-6), status: 'published', reply: 'Дякуємо, Ірино! Нагадаємо про фільтр салону перед наступним візитом.' },
      { id: 'r2', name: 'Наталія Г.', car: 'BMW X5', rating: 5, text: 'Віддала авто зранку, о 16:00 вже прийшло повідомлення «Готово». Чек збігся з попереднім розрахунком до гривні.', at: isoAt(-12), status: 'published', reply: '' },
      { id: 'r3', name: 'Олена П.', car: 'Ford Transit', rating: 4, text: 'Робочий бус, тому важлива швидкість. Зробили діагностику за годину, ремонт — того ж дня. Мінус — хотілося б працювати в неділю.', at: isoAt(-20), status: 'published', reply: 'Олено, з листопада працюємо в неділю до 16:00 — записуйтесь!' },
      { id: 'r4', name: 'Дмитро Л.', car: 'Renault Duster', rating: 5, text: 'Друг дав код запрошення — отримав 300 балів на перше замовлення. Майстер Тарас все показав на підйомнику.', at: isoAt(-34), status: 'published', reply: '' },
      { id: 'r5', name: 'Сергій М.', car: 'Kia Sportage', rating: 5, text: 'Розвал-сходження з протоколом до/після, все видно в кабінеті. Кава в клієнтській зоні — топ.', at: isoAt(-2), status: 'pending', reply: '' }
    ];

    const promos = [
      { id: 'p1', tag: '−20%', title: 'Заправка кондиціонера', text: 'До кінця місяця при записі онлайн. Антибактеріальна обробка в подарунок.', until: dayStr(10), hz: true, active: true },
      { id: 'p2', tag: '×2', title: 'Подвійний кешбек у будні', text: 'Пн–Чт з 9:00 до 12:00 — нараховуємо вдвічі більше балів.', until: dayStr(30), hz: false, active: true },
      { id: 'p3', tag: '0 ₴', title: 'Огляд 40 пунктів', text: 'Безкоштовно до будь-якого ТО. Результат з фото у вашому кабінеті.', until: '', hz: false, active: true }
    ];

    const chats = [
      { id: 'u1', name: 'Олександр Коваль', userId: 'u1', unreadAdmin: 0, unreadClient: 1, messages: [
        { from: 'client', text: 'Добрий день! Сьогодні о 9:00 у мене запис на Octavia, можна трохи раніше під\'їхати?', at: isoAt(0, 7, 42) },
        { from: 'admin', text: 'Доброго ранку, Олександре! Так, пост вільний з 8:30, чекаємо.', at: isoAt(0, 7, 50), by: 'Андрій, адміністратор' },
        { from: 'admin', text: 'Майстер Тарас завершив діагностику — в кабінеті з\'явився перелік робіт на погодження. Подивіться, будь ласка, коли буде зручно.', at: isoAt(0, 10, 15), by: 'Андрій, адміністратор' }
      ] },
      { id: 'u6', name: 'Олена Поліщук', userId: 'u6', unreadAdmin: 1, unreadClient: 0, messages: [
        { from: 'client', text: 'Чи є у вас підмінне авто на час ремонту бусa?', at: isoAt(0, 9, 5) }
      ] },
      { id: 'g-demo', name: 'Гість · +380 95 *** 12 40', userId: null, unreadAdmin: 2, unreadClient: 0, messages: [
        { from: 'client', text: 'Скільки коштує заміна ременя ГРМ на Lanos?', at: isoAt(0, 8, 20) },
        { from: 'bot', text: 'Заміна комплекту ГРМ — від 3 800 ₴ за роботу. Точна ціна залежить від двигуна. Адміністратор уточнить протягом 5 хвилин.', at: isoAt(0, 8, 20) },
        { from: 'client', text: 'Двигун 1.5, 2008 рік', at: isoAt(0, 8, 22) }
      ] }
    ];

    return {
      version: 3,
      settings: {
        levels: [
          { id: 'start', name: 'Старт', min: 0, cashback: 3 },
          { id: 'drive', name: 'Драйв', min: 15000, cashback: 5 },
          { id: 'turbo', name: 'Турбо', min: 40000, cashback: 7 },
          { id: 'hundred', name: 'Сотка', min: 100000, cashback: 10 }
        ],
        maxPayPct: 30, welcome: 200, referral: 300, review: 50, birthday: 500,
        phone: '+380 44 100 10 00', address: 'Київ, вул. Автозаводська, 100', hours: [['Пн–Пт', '08:00–20:00'], ['Сб', '09:00–18:00'], ['Нд', '10:00–16:00']]
      },
      services, masters, bays, users, cars, orders, bonusTx, reviews, promos, chats,
      seededOn: dayStr(0),
      seq: { order: Math.max(no, 24117) + 80, tx: 100, user: 100, car: 100, svc: 100, review: 100, item: 100, promo: 10, part: pn + 100 }
    };
  }

  const mem = {};
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] ?? null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  };

  const Store = {
    KEY, SESSION_KEY, STATUSES, FLOW, PART_STATUSES, PARTS_PREF, CATEGORIES, CAR_CLASSES, dayStr, isoAt,
    db: null,
    session: { role: 'guest', userId: null, guestId: null },
    load() {
      try { const raw = ls.get(KEY); if (raw) this.db = JSON.parse(raw); } catch (e) { this.db = null; }
      if (!this.db || this.db.version !== 3) { this.db = seed(); this.save(); }
      try { const s = ls.get(SESSION_KEY); if (s) this.session = JSON.parse(s); } catch (e) { /* default guest */ }
      if (!this.session.guestId) this.session.guestId = 'g-' + Math.random().toString(36).slice(2, 8);
      this.freshen();
      this.checkSession();
    },
    save() { ls.set(KEY, JSON.stringify(this.db)); },
    saveSession() { ls.set(SESSION_KEY, JSON.stringify(this.session)); },
    reset() { this.db = seed(); this.save(); this.checkSession(); },
    // A session can point to a client or master that no longer exists (after a demo reset) — fall back to guest
    checkSession() {
      const s = this.session;
      const ok = s.role === 'guest' || s.role === 'admin' || (s.role === 'client' && this.user(s.userId)) || (s.role === 'master' && this.master(s.masterId));
      if (!ok) { s.role = 'guest'; s.userId = null; s.masterId = null; this.saveSession(); }
    },
    // Demo data is relative to the day it was created. On a later day, shift every date forward
    // so "today" on the workshop board stays today — the viewer's own changes are kept.
    freshen() {
      const today = dayStr(0);
      const from = this.db.seededOn || today;
      const days = Math.round((parseDay(today) - parseDay(from)) / 864e5);
      this.db.seededOn = today;
      if (days > 0) {
        const shiftDay = v => { const d = parseDay(v); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
        const walk = (o, key) => {
          if (Array.isArray(o)) return o.forEach(x => walk(x));
          if (!o || typeof o !== 'object') return;
          for (const k of Object.keys(o)) {
            const v = o[k];
            if (k === 'birthday' || k === 'seededOn') continue;
            if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) o[k] = new Date(new Date(v).getTime() + days * 864e5).toISOString();
            else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) o[k] = shiftDay(v);
            else if (v && typeof v === 'object') walk(v);
          }
        };
        walk(this.db);
      }
      this.save();
    },
    next(kind) { return ++this.db.seq[kind]; },

    // ---- lookups ----
    user(id) { return this.db.users.find(u => u.id === id); },
    me() { return this.session.role === 'client' ? this.user(this.session.userId) : null; },
    meMaster() { return this.session.role === 'master' ? this.master(this.session.masterId) : null; },
    car(id) { return this.db.cars.find(c => c.id === id); },
    carsOf(uid) { return this.db.cars.filter(c => c.userId === uid); },
    order(id) { return this.db.orders.find(o => o.id === id); },
    ordersOf(uid) { return this.db.orders.filter(o => o.userId === uid).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)); },
    service(id) { return this.db.services.find(s => s.id === id); },
    master(id) { return this.db.masters.find(m => m.id === id); },
    bay(id) { return this.db.bays.find(b => b.id === id); },
    status(id) { return STATUSES.find(s => s.id === id) || STATUSES[0]; },
    carClass(id) { return CAR_CLASSES.find(c => c.id === id) || CAR_CLASSES[0]; },
    level(spent) {
      const lv = this.db.settings.levels;
      let cur = lv[0];
      lv.forEach(l => { if (spent >= l.min) cur = l; });
      const next = lv[lv.indexOf(cur) + 1] || null;
      return { cur, next, progress: next ? (spent - cur.min) / (next.min - cur.min) : 1 };
    },
    priceFor(svcId, cls) { return Math.round(this.service(svcId).price * this.carClass(cls).k / 10) * 10; },
    activeOrder(uid) {
      return this.ordersOf(uid).find(o => !['done', 'cancelled', 'new', 'confirmed'].includes(o.status))
        || this.ordersOf(uid).filter(o => ['new', 'confirmed'].includes(o.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    },
    partStatus(id) { return PART_STATUSES.find(s => s.id === id) || PART_STATUSES[0]; },
    // Price of a part line with the option the client chose (main offer or the alternative)
    partOpt(l) { return l.choice === 'alt' && l.alt ? l.alt : { brand: l.brand, code: l.code, price: l.price, stock: l.stock, eta: l.eta }; },
    // Only parts the client has agreed to (or that need no approval) are counted in the bill
    partCost(l) { return l.source === 'service' && l.approved === true ? this.partOpt(l).price * (l.qty || 1) : 0; },
    workMinutes(o) {
      const w = o.work || { spent: 0, running: null };
      return Math.round(w.spent + (w.running ? (Date.now() - new Date(w.running)) / 60000 : 0));
    },
    normMinutes(o) { return o.services.reduce((s, id) => s + (this.service(id)?.dur || 0), 0); },
    // Master pay for a job: admin override, otherwise the master's % of the works (labor + approved extra works)
    masterPay(o) {
      if (!o.master) return 0;
      if (o.pay && o.pay.amount !== null && o.pay.amount !== undefined) return o.pay.amount;
      const m = this.master(o.master);
      return Math.round(this.breakdown(o).works * (m?.payPct || 0) / 100);
    },
    // Earned = closed jobs + bonuses/penalties; balance = earned − payouts
    masterLedger(mid, from) {
      const m = this.master(mid);
      const jobs = this.db.orders.filter(o => o.master === mid && o.status === 'done' && (!from || o.date >= from));
      const adj = (m.adjustments || []).filter(a => !from || a.at.slice(0, 10) >= from);
      const earned = jobs.reduce((s, o) => s + this.masterPay(o), 0) + adj.reduce((s, a) => s + a.amount, 0);
      const allJobs = this.db.orders.filter(o => o.master === mid && o.status === 'done').reduce((s, o) => s + this.masterPay(o), 0)
        + (m.adjustments || []).reduce((s, a) => s + a.amount, 0);
      const paid = (m.payouts || []).reduce((s, p) => s + p.amount, 0);
      return { jobs, adj, earned, balance: allJobs - paid, paid };
    },
    stopWork(o) {
      if (o.work?.running) { o.work.spent = this.workMinutes(o); o.work.running = null; }
    },
    // Full cost breakdown: works by price list + approved extra works + parts − discount
    breakdown(o) {
      const extras = (o.items || []).filter(i => i.decision === 'yes').reduce((s, i) => s + i.price, 0);
      const parts = (o.parts || []).reduce((s, l) => s + this.partCost(l), 0);
      const works = o.labor + extras;
      let discount = 0;
      const d = o.discount;
      if (d && d.value > 0) {
        const base = d.target === 'labor' ? works : d.target === 'parts' ? parts : works + parts;
        discount = Math.min(base, d.type === 'pct' ? Math.round(base * d.value / 100) : d.value);
      }
      return { labor: o.labor, extras, works, parts, discount, total: works + parts - discount };
    },
    discountLabel(d) {
      if (!d) return '';
      const t = { labor: 'на роботи', parts: 'на запчастини', all: 'на весь чек' }[d.target];
      return `${d.type === 'pct' ? d.value + '%' : d.value + ' ₴'} ${t}${d.reason ? ' · ' + d.reason : ''}`;
    },
    recalc(o) {
      o.total = this.breakdown(o).total;
      return o.total;
    },
    defaultDiscount(u) {
      return u && u.personalDiscount ? { type: 'pct', value: u.personalDiscount, target: 'labor', reason: 'Персональна знижка клієнта' } : null;
    },
    findUserByPhone(phone) {
      const d = String(phone).replace(/\D/g, '').slice(-9);
      return this.db.users.find(u => u.phone.replace(/\D/g, '').slice(-9) === d);
    },
    addTx(userId, amount, type, note, applyToBalance = true) {
      const u = this.user(userId);
      if (!u) return;
      if (applyToBalance) u.bonus += amount;
      this.db.bonusTx.push({ id: 't' + this.next('tx'), userId, amount, type, note, at: new Date().toISOString() });
    },
    setStatus(o, status) {
      if (o.status === status) return;
      o.status = status;
      // the work timer runs only while the car is actually being worked on
      if (['approval', 'parts', 'qc', 'ready', 'done', 'cancelled'].includes(status)) this.stopWork(o);
      o.history.push({ status, at: new Date().toISOString() });
      if (status === 'done' && !o.closed) {
        o.closed = true;
        const u = this.user(o.userId);
        if (u) {
          // the bill may have shrunk since points were reserved (declined parts, a discount): return the excess
          const cap = Math.min(o.total, Math.floor(o.total * this.db.settings.maxPayPct / 100));
          if (o.useBonus > cap) { u.bonus += o.useBonus - cap; o.useBonus = cap; }
          // points were reserved (taken off the balance) when the client chose to use them
          if (o.useBonus) this.addTx(u.id, -o.useBonus, 'spend', `Оплата балами · ${o.id}`, false);
          const pay = o.total - (o.useBonus || 0);
          const pct = this.level(u.spent).cur.cashback;
          o.earned = Math.round(pay * pct / 100);
          this.addTx(u.id, o.earned, 'earn', `Кешбек ${pct}% · ${o.id}`);
          u.spent += pay;
          const car = this.car(o.carId);
          if (car && o.mileage) car.mileage = Math.max(car.mileage, o.mileage);
        }
      }
    },
    chatFor(id, name, userId) {
      let c = this.db.chats.find(x => x.id === id);
      if (!c) { c = { id, name, userId: userId || null, unreadAdmin: 0, unreadClient: 0, messages: [] }; this.db.chats.unshift(c); }
      return c;
    }
  };

  window.Store = Store;
})();
