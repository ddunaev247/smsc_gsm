import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import { kitScript } from "./scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 1040, HEIGHT = 460;

// ── Параметры 5 функциональных блоков на 2D-схеме (слева направо) ──
const STATIONS = {
  ingress: { x: 30,  y: 72, w: 170, h: 268, label: "1. Шлюз приёма",        sub: "SMPP · SS7 · HTTP" },
  router:  { x: 235, y: 72, w: 170, h: 268, label: "2. Маршрутизатор HLR",  sub: "Антиспам & SRI-SM" },
  buffer:  { x: 440, y: 72, w: 180, h: 268, label: "3. Хранилище очередей", sub: "Store & Forward" },
  egress:  { x: 655, y: 72, w: 170, h: 268, label: "4. Передатчик MT",      sub: "MT-FwdSM к MSC" },
  dlr:     { x: 860, y: 72, w: 170, h: 268, label: "5. Регистратор DLR",    sub: "Квитанции доставки" },
};

const OVERHEAD_Y = 36; // Высота надблочной магистрали движения конверта SMS

// ══════════════════════════════════════════════════════════════
// 1. ВКЛАДКА 1: 2.5D КОРПУС БЛОКА
// ══════════════════════════════════════════════════════════════
function render25DBlock(st, id, headerTitle, headerSub) {
  const { x, y, w, h } = st;
  const d3 = 8;

  return `
  <g class="block-25d-group" data-node="${id}" cursor="pointer" tabindex="0" role="button" aria-label="${headerTitle}">
    <!-- 3D-тень блока -->
    <rect x="${x + d3}" y="${y + d3}" width="${w}" height="${h}" rx="10" class="block-shadow" />
    
    <!-- Боковая и нижняя 3D-грань (экструзия объема) -->
    <path d="M${x + w} ${y + 10} L${x + w + d3} ${y + 10 + d3} L${x + w + d3} ${y + h + d3 - 10} Q${x + w + d3} ${y + h + d3} ${x + w + d3 - 10} ${y + h + d3} L${x + 10 + d3} ${y + h + d3} L${x + 10} ${y + h} L${x + w - 10} ${y + h} Q${x + w} ${y + h} ${x + w} ${y + h - 10} Z" class="block-3d-side" />

    <!-- Фронтальная грань блока -->
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="block-front" />
    <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="7" class="block-border" fill="none" />

    <!-- Шапка блока с шильдиком -->
    <path d="M${x} ${y + 8} Q${x} ${y} ${x + 8} ${y} L${x + w - 8} ${y} Q${x + w} ${y} ${x + w} ${y + 8} L${x + w} ${y + 40} L${x} ${y + 40} Z" class="block-header" />
    <line x1="${x}" y1="${y + 40}" x2="${x + w}" y2="${y + 40}" class="block-divider" />

    <!-- Название блока на русском -->
    <text x="${x + 12}" y="${y + 19}" class="block-title">${headerTitle}</text>
    <text x="${x + 12}" y="${y + 33}" class="block-sub">${headerSub}</text>

    <!-- Световой индикатор статуса в шапке -->
    <circle cx="${x + w - 16}" cy="${y + 21}" r="4" class="block-led" />
    <circle cx="${x + w - 16}" cy="${y + 21}" r="7" class="block-led-glow" />
  `;
}

// ══════════════════════════════════════════════════════════════
// 2. БЛОК 1: ШЛЮЗ ПРИЁМА (SMPP / SS7 / HTTP)
// ══════════════════════════════════════════════════════════════
function ingressBlock() {
  const st = STATIONS.ingress;
  const { x, y, w } = st;
  let out = render25DBlock(st, "ingress", "① ШЛЮЗ ПРИЁМА", "Входные каналы");

  const channels = [
    { name: "SMPP v3.4/5.0", desc: "Банки, OTP, шлюзы", icon: "⚡", cls: "ch-smpp", y: y + 48 },
    { name: "SS7 MAP / ОКС-7", desc: "Сотовая сеть (MO-FwdSM)", icon: "📡", cls: "ch-ss7", y: y + 96 },
    { name: "HTTP / REST API", desc: "CRM и веб-платформы", icon: "🌐", cls: "ch-http", y: y + 144 },
  ];

  for (const ch of channels) {
    out += `
      <g class="channel-card ${ch.cls}">
        <rect x="${x + 10}" y="${ch.y}" width="${w - 20}" height="42" rx="5" class="ch-bg" />
        <rect x="${x + 10}" y="${ch.y}" width="4" height="42" rx="2" class="ch-accent" />
        
        <text x="${x + 20}" y="${ch.y + 17}" class="ch-name">${ch.name}</text>
        <text x="${x + 20}" y="${ch.y + 32}" class="ch-desc">${ch.desc}</text>
        
        <circle cx="${x + w - 22}" cy="${ch.y + 21}" r="5" class="ch-port" />
        <circle cx="${x + w - 22}" cy="${ch.y + 21}" r="2" class="ch-port-core" />
      </g>
    `;
  }

  // Контроль нагрузки TPS: исключаем наложение текста на шкалу и друг на друга
  out += `
    <g class="tps-panel">
      <rect x="${x + 10}" y="${y + 196}" width="${w - 20}" height="60" rx="5" class="tps-bg" />
      <text x="${x + 16}" y="${y + 214}" class="tps-label">ЛИМИТ ПОТОКА:</text>
      <text x="${x + w - 16}" y="${y + 214}" class="tps-val" text-anchor="end">2800 TPS</text>
      
      <!-- Шкала нагрузки -->
      <rect x="${x + 16}" y="${y + 224}" width="${w - 32}" height="6" rx="3" class="tps-track" />
      <rect x="${x + 16}" y="${y + 224}" width="${(w - 32) * 0.65}" height="6" rx="3" class="tps-fill" />
      
      <text x="${x + 16}" y="${y + 246}" class="tps-subinfo">Загрузка канала: 65%</text>
    </g>
  </g>`;

  return out;
}

// ══════════════════════════════════════════════════════════════
// 3. БЛОК 2: МАРШРУТИЗАТОР И HLR (АНТИСПАМ & SRI-SM)
// ══════════════════════════════════════════════════════════════
function routerBlock() {
  const st = STATIONS.router;
  const { x, y, w } = st;
  let out = render25DBlock(st, "router", "② МАРШРУТИЗАТОР", "HLR & Антиспам");

  // Секция 1: Антиспам-фильтр
  out += `
    <g class="spam-panel">
      <rect x="${x + 10}" y="${y + 48}" width="${w - 20}" height="76" rx="5" class="submodule-bg" />
      <text x="${x + 16}" y="${y + 66}" class="submodule-title">АНТИСПАМ-ФИЛЬТР</text>
      <rect x="${x + w - 38}" y="${y + 55}" width="26" height="14" rx="3" class="badge-ok-bg" />
      <text x="${x + w - 25}" y="${y + 65}" class="badge-ok-txt" text-anchor="middle">OK</text>
      
      <text x="${x + 16}" y="${y + 84}" class="check-item">✔ Валидация Sender ID</text>
      <text x="${x + 16}" y="${y + 98}" class="check-item">✔ Анализ на фишинг</text>
      <text x="${x + 16}" y="${y + 112}" class="check-item">✔ Лимиты сообщений</text>
    </g>
  `;

  // Секция 2: Модуль HLR / HSS запросов (SRI-for-SM)
  // Радар опущен ниже, чтобы не пересекаться с заголовком и нижним текстом
  const radarCX = x + w / 2;
  const radarCY = y + 185;
  const radarR = 28;

  out += `
    <g class="hlr-panel">
      <rect x="${x + 10}" y="${y + 130}" width="${w - 20}" height="126" rx="5" class="submodule-bg" />
      <text x="${x + 16}" y="${y + 146}" class="submodule-title">HLR: ЗАПРОС SRI-SM</text>
      
      <!-- Радарная шкала поиска MSC -->
      <circle cx="${radarCX}" cy="${radarCY}" r="${radarR}" class="radar-circle" />
      <circle cx="${radarCX}" cy="${radarCY}" r="${radarR * 0.6}" class="radar-circle-inner" />
      <line x1="${radarCX - radarR}" y1="${radarCY}" x2="${radarCX + radarR}" y2="${radarCY}" class="radar-grid" />
      <line x1="${radarCX}" y1="${radarCY - radarR}" x2="${radarCX}" y2="${radarCY + radarR}" class="radar-grid" />

      <!-- Подвижная стрелка селектора направления HLR -->
      <line id="hlr-radar-line" x1="${radarCX}" y1="${radarCY}" x2="${radarCX + 18}" y2="${radarCY - 16}" class="radar-needle" />
      <circle cx="${radarCX}" cy="${radarCY}" r="3.5" class="radar-hub" />

      <!-- Результат поиска абонента (без наложения на радар!) -->
      <text x="${x + 14}" y="${y + 232}" class="hlr-res-label">MSC получателя (VLR):</text>
      <text x="${x + 14}" y="${y + 248}" class="hlr-res-val">MSC-7740 · Активен (OK)</text>
    </g>
  </g>`;

  return out;
}

// ══════════════════════════════════════════════════════════════
// 4. БЛОК 3: ХРАНИЛИЩЕ ОЧЕРЕДЕЙ (STORE & FORWARD)
// ══════════════════════════════════════════════════════════════
function bufferBlock() {
  const st = STATIONS.buffer;
  const { x, y, w } = st;
  let out = render25DBlock(st, "buffer", "③ БУФЕР ОЧЕРЕДЕЙ", "Store & Forward");

  const queues = [
    { id: "otp",    name: "1. Экспресс OTP",   desc: "Банки / 2FA · TTL 2м",   fill: 30, cls: "q-otp",   y: y + 48 },
    { id: "fifo",   name: "2. Основная FIFO",  desc: "Стандартный трафик",      fill: 22, cls: "q-fifo",  y: y + 92 },
    { id: "retry",  name: "3. Повторы Retry",  desc: "Ожидание AlertSC",        fill: 14, cls: "q-retry", y: y + 136 },
    { id: "quaran", name: "4. Карантин спама", desc: "Изолированные SMS",       fill: 8,  cls: "q-quar",  y: y + 180 },
  ];

  for (const q of queues) {
    out += `
      <g class="queue-row ${q.cls}">
        <rect x="${x + 10}" y="${q.y}" width="${w - 20}" height="38" rx="5" class="q-bg" />
        <rect x="${x + 10}" y="${q.y}" width="4" height="38" rx="2" class="q-accent" />

        <text x="${x + 20}" y="${q.y + 16}" class="q-name">${q.name}</text>
        <text x="${x + 20}" y="${q.y + 29}" class="q-desc">${q.desc}</text>

        <!-- Полоса заполненности очереди -->
        <rect x="${x + w - 46}" y="${q.y + 15}" width="34" height="6" rx="3" class="q-bar-bg" />
        <rect x="${x + w - 46}" y="${q.y + 15}" width="${q.fill}" height="6" rx="3" class="q-bar-fill" />
      </g>
    `;
  }

  // Общий статус принципа Store-and-Forward
  out += `
    <text x="${x + w / 2}" y="${y + 244}" class="s-and-f-note" text-anchor="middle">Гарантия Store &amp; Forward при недоступности</text>
  </g>`;

  return out;
}

// ══════════════════════════════════════════════════════════════
// 5. БЛОК 4: ПЕРЕДАТЧИК В СЕТЬ (MT-FwdSM К MSC)
// ══════════════════════════════════════════════════════════════
function egressBlock() {
  const st = STATIONS.egress;
  const { x, y, w } = st;
  let out = render25DBlock(st, "egress", "④ ПЕРЕДАТЧИК MT", "MT-FwdSM к MSC");

  // Секция 1: Сборка пакета MT-FwdSM
  out += `
    <g class="packet-builder-panel">
      <rect x="${x + 10}" y="${y + 48}" width="${w - 20}" height="60" rx="5" class="submodule-bg" />
      <text x="${x + 16}" y="${y + 65}" class="submodule-title">СБОРКА PDU MT-FwdSM</text>
      <text x="${x + 16}" y="${y + 81}" class="code-line">Кодировка: GSM 7-bit / UCS2</text>
      <text x="${x + 16}" y="${y + 96}" class="code-line">Упаковка: TP-UDHI · Concatenation</text>
    </g>
  `;

  // Секция 2: Модуль передачи на базовые станции (BTS/MSC)
  const towerCX = x + w / 2;
  const towerCY = y + 160;

  out += `
    <g class="cell-tower-panel">
      <rect x="${x + 10}" y="${y + 114}" width="${w - 20}" height="142" rx="5" class="submodule-bg" />
      <text x="${x + 16}" y="${y + 130}" class="submodule-title">ПЕРЕДАЧА В СОТОВУЮ СЕТЬ</text>

      <!-- Радиовышка / СВЧ передатчик -->
      <line x1="${towerCX}" y1="${towerCY - 14}" x2="${towerCX - 15}" y2="${towerCY + 34}" class="tower-leg" />
      <line x1="${towerCX}" y1="${towerCY - 14}" x2="${towerCX + 15}" y2="${towerCY + 34}" class="tower-leg" />
      <line x1="${towerCX - 8}" y1="${towerCY + 8}" x2="${towerCX + 8}" y2="${towerCY + 8}" class="tower-cross" />
      <line x1="${towerCX - 12}" y1="${towerCY + 22}" x2="${towerCX + 12}" y2="${towerCY + 22}" class="tower-cross" />

      <!-- Излучатель на вершине -->
      <circle cx="${towerCX}" cy="${towerCY - 16}" r="4.5" class="tower-top" />
      <circle cx="${towerCX}" cy="${towerCY - 16}" r="8" class="tower-wave-1" />
      <circle cx="${towerCX}" cy="${towerCY - 16}" r="14" class="tower-wave-2" />

      <!-- Статус передачи (2 строки, без наложения!) -->
      <text x="${x + 16}" y="${y + 218}" class="tower-status-lbl">Сигнальный линк связи:</text>
      <text x="${x + 16}" y="${y + 236}" class="tower-status-val">SIGTRAN M3UA · SCTP (OK)</text>
    </g>
  </g>`;

  return out;
}

// ══════════════════════════════════════════════════════════════
// 6. БЛОК 5: РЕГИСТРАТОР КВИТАНЦИЙ (DLR ENGINE)
// ══════════════════════════════════════════════════════════════
function dlrBlock() {
  const st = STATIONS.dlr;
  const { x, y, w } = st;
  let out = render25DBlock(st, "dlr", "⑤ РЕГИСТРАТОР DLR", "Отчеты о доставке");

  const gaugeCX = x + w / 2;
  const gaugeCY = y + 115;
  const gaugeR = 38;

  out += `
    <g class="dlr-gauge-panel">
      <rect x="${x + 10}" y="${y + 48}" width="${w - 20}" height="130" rx="5" class="submodule-bg" />
      <text x="${x + 16}" y="${y + 64}" class="submodule-title">СТАТУС ДОСТАВКИ (DLR)</text>
      
      <!-- Круговой циферблат статусов доставки -->
      <circle cx="${gaugeCX}" cy="${gaugeCY}" r="${gaugeR}" class="dlr-dial-bg" />
      <circle cx="${gaugeCX}" cy="${gaugeCY}" r="${gaugeR - 2}" class="dlr-dial-rim" />
      
      <!-- 4 квадранта с комфортными отступами: не наползают на стрелку -->
      <text x="${gaugeCX + 14}" y="${gaugeCY - 14}" class="dlr-q-lbl delivrd">DELIVRD</text>
      <text x="${gaugeCX + 14}" y="${gaugeCY + 22}" class="dlr-q-lbl bufferd">BUFFERD</text>
      <text x="${gaugeCX - 14}" y="${gaugeCY + 22}" class="dlr-q-lbl expired" text-anchor="end">EXPIRED</text>
      <text x="${gaugeCX - 14}" y="${gaugeCY - 14}" class="dlr-q-lbl rejectd" text-anchor="end">REJECTD</text>

      <!-- Стрелка статуса DLR -->
      <line id="dlr-needle-line" x1="${gaugeCX}" y1="${gaugeCY}" x2="${gaugeCX + 24}" y2="${gaugeCY - 16}" class="dlr-needle" />
      <circle cx="${gaugeCX}" cy="${gaugeCY}" r="4" class="dlr-hub" />

      <text x="${x + w / 2}" y="${y + 168}" class="dlr-sub-hint" text-anchor="middle">Фиксация Delivery Receipt</text>
    </g>

    <!-- Обратный возврат квитанции отправителю (разбит на 2 аккуратные строки) -->
    <g class="dlr-return-box">
      <rect x="${x + 10}" y="${y + 184}" width="${w - 20}" height="72" rx="5" class="submodule-bg" />
      <text x="${x + 16}" y="${y + 202}" class="submodule-title">ВОЗВРАТ КВИТАНЦИИ</text>
      <text x="${x + 16}" y="${y + 222}" class="dlr-ret-desc">Отправка в банк / сервис</text>
      <text x="${x + 16}" y="${y + 238}" class="dlr-ret-desc-sub">(SMPP DELIVER_SM / Ack)</text>
    </g>
  </g>`;

  return out;
}

// ══════════════════════════════════════════════════════════════
// 7. СОЕДИНИТЕЛЬНЫЕ ШИНЫ ДАННЫХ И НАДБЛОЧНАЯ ЭСТАКАДА
// ══════════════════════════════════════════════════════════════
function dataConduits() {
  const y = 205; // Внутренняя межблочная шина
  const segments = [
    { x1: STATIONS.ingress.x + STATIONS.ingress.w, x2: STATIONS.router.x },
    { x1: STATIONS.router.x + STATIONS.router.w,   x2: STATIONS.buffer.x },
    { x1: STATIONS.buffer.x + STATIONS.buffer.w,   x2: STATIONS.egress.x },
    { x1: STATIONS.egress.x + STATIONS.egress.w,   x2: STATIONS.dlr.x },
  ];

  let out = `<g class="data-highways">`;

  // НАДБЛОЧНАЯ МАГИСТРАЛЬ ДВИЖЕНИЯ ПАКЕТА (Конверт двигается сверху над блоками!)
  out += `
    <g class="overhead-gantry">
      <!-- Направляющая рельса над блоками -->
      <rect x="25" y="${OVERHEAD_Y - 5}" width="${WIDTH - 50}" height="10" rx="3" class="overhead-rail-bg" />
      <line x1="30" y1="${OVERHEAD_Y}" x2="${WIDTH - 30}" y2="${OVERHEAD_Y}" class="overhead-rail-line" />
      
      <!-- Узловые стыковочные датчики над каждым из 5 блоков -->
      ${Object.entries(STATIONS).map(([key, st]) => {
        const cx = st.x + st.w / 2;
        return `
          <g class="overhead-stop" data-stop="${key}">
            <circle cx="${cx}" cy="${OVERHEAD_Y}" r="7" class="overhead-stop-ring" />
            <circle cx="${cx}" cy="${OVERHEAD_Y}" r="3" class="overhead-stop-core" />
            <!-- Световод вниз к шапке блока -->
            <line x1="${cx}" y1="${OVERHEAD_Y + 7}" x2="${cx}" y2="${st.y}" class="overhead-drop-guide" />
          </g>
        `;
      }).join("")}

      <text x="${WIDTH / 2}" y="${OVERHEAD_Y - 12}" class="overhead-title" text-anchor="middle">
        МАГИСТРАЛЬНАЯ ШИНА МАРШРУТИЗАЦИИ И ПЕРЕДАЧИ СООБЩЕНИЙ SMS
      </text>
    </g>
  `;

  // Внутренние соединительные каналы между блоками
  for (const seg of segments) {
    out += `
      <rect x="${seg.x1}" y="${y - 6}" width="${seg.x2 - seg.x1}" height="12" rx="3" class="highway-pipe" />
      <line x1="${seg.x1}" y1="${y}" x2="${seg.x2}" y2="${y}" class="highway-flow-line" />
      <circle cx="${seg.x1}" cy="${y}" r="5" class="highway-joint" />
      <circle cx="${seg.x2}" cy="${y}" r="5" class="highway-joint" />
    `;
  }

  // Обратная сервисная линия DLR: возврат квитанции из Блока 5 назад в Блок 1
  const returnY = 385;
  out += `
    <g class="return-dlr-highway">
      <path d="M${STATIONS.dlr.x + STATIONS.dlr.w / 2} ${STATIONS.dlr.y + STATIONS.dlr.h} 
               L${STATIONS.dlr.x + STATIONS.dlr.w / 2} ${returnY} 
               L${STATIONS.ingress.x + STATIONS.ingress.w / 2} ${returnY} 
               L${STATIONS.ingress.x + STATIONS.ingress.w / 2} ${STATIONS.ingress.y + STATIONS.ingress.h}" 
            class="return-flow-line" />
      <text x="${WIDTH / 2}" y="${returnY - 6}" class="return-flow-text" text-anchor="middle">
        ◀ Обратный канал доставки квитанций DLR отправителю (SMPP DELIVER_SM / Delivery-Ack)
      </text>
    </g>
  </g>`;

  return out;
}

// ══════════════════════════════════════════════════════════════
// 8. АКТИВНЫЙ ПАКЕТ SMS — ДВИЖЕНИЕ НАД БЛОКАМИ С ЛАЗЕРНЫМ ЛУЧОМ
// ══════════════════════════════════════════════════════════════
function activePacket() {
  return `
    <g id="active-sms-packet" transform="translate(115, ${OVERHEAD_Y})" cursor="pointer">
      <!-- Световой лазерный луч-указатель, направленный вниз на активный блок -->
      <line x1="0" y1="12" x2="0" y2="34" class="packet-laser-ray" />
      <polygon points="-4,32 4,32 0,39" class="packet-laser-arrow" />
      
      <!-- Световой ореол конверта -->
      <circle cx="0" cy="0" r="18" class="packet-glow" />
      
      <!-- Корпус конверта (не загораживает текст, так как парит над блоками) -->
      <rect x="-16" y="-11" width="32" height="22" rx="4" class="packet-body" />
      <path d="M-16 -11 L0 3 L16 -11" class="packet-flap" fill="none" />
      <text x="0" y="7" class="packet-text" text-anchor="middle">SMS</text>
    </g>
  `;
}

// ══════════════════════════════════════════════════════════════
// 9. СБОРКА ИТОГОВОГО SVG ДЛЯ ВКЛАДКИ 1 (АРХИТЕКТУРА И ПРОЦЕССЫ)
// ══════════════════════════════════════════════════════════════
function renderArchitectureSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" class="iso-svg smsc-2d-svg" role="img" aria-label="2D схема СМС-центра с объемом 2.5D">
    <defs>
      <filter id="shadow-25d" x="-20%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="3" dy="8" stdDeviation="6" flood-opacity="0.28" />
      </filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- Задняя панель монтажного основания -->
    <rect x="10" y="10" width="${WIDTH - 20}" height="${HEIGHT - 20}" rx="12" class="main-rack-plate" />
    <rect x="18" y="18" width="${WIDTH - 36}" height="${HEIGHT - 36}" rx="8" class="main-rack-inner-border" />

    <!-- Межблочные шины передачи данных и надблочная направляющая -->
    ${dataConduits()}

    <!-- 5 функциональных блоков -->
    ${ingressBlock()}
    ${routerBlock()}
    ${bufferBlock()}
    ${egressBlock()}
    ${dlrBlock()}

    <!-- Активное сообщение (PDU) над блоками -->
    ${activePacket()}
  </svg>
  `;
}

// ══════════════════════════════════════════════════════════════
// 10. ВКЛАДКА 2: СХЕМЫ ПРОТОКОЛОВ SMPP, SS7, SIGTRAN
// ══════════════════════════════════════════════════════════════

// СХЕМА 1: ПРОТОКОЛ SMPP (Short Message Peer-to-Peer)
function renderSmppSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} 420" class="iso-svg proto-svg" role="img" aria-label="Схема работы протокола SMPP">
    <!-- Фон монтажной платы -->
    <rect x="10" y="10" width="${WIDTH - 20}" height="400" rx="10" class="main-rack-plate" />
    <rect x="16" y="16" width="${WIDTH - 32}" height="388" rx="8" class="main-rack-inner-border" />

    <!-- Заголовок схемы -->
    <text x="30" y="40" class="proto-svg-title">СХЕМА ПРОТОКОЛА SMPP v3.4 / v5.0 (ESME ⇄ SMSC)</text>
    <text x="30" y="56" class="proto-svg-sub">Клиент-серверный обмен сообщениями и получение отчетов о доставке DLR через порт 2775 TCP</text>

    <!-- Столбцы участников: Слева ESME (Банк / Агрегатор), Справа SMSC -->
    <!-- ESME Нода -->
    <g transform="translate(70, 72)">
      <rect x="0" y="0" width="180" height="44" rx="6" class="proto-actor-box" />
      <text x="90" y="18" class="proto-actor-title" text-anchor="middle">ESME (КЛИЕНТ)</text>
      <text x="90" y="32" class="proto-actor-sub" text-anchor="middle">Банк / Агрегатор / CRM</text>
      <line x1="90" y1="44" x2="90" y2="252" class="lifeline" />
    </g>

    <!-- SMSC Нода -->
    <g transform="translate(480, 72)">
      <rect x="0" y="0" width="180" height="44" rx="6" class="proto-actor-box smsc-actor" />
      <text x="90" y="18" class="proto-actor-title" text-anchor="middle">SMSC (СМС-ЦЕНТР)</text>
      <text x="90" y="32" class="proto-actor-sub" text-anchor="middle">Оператор сотовой связи</text>
      <line x1="90" y1="44" x2="90" y2="252" class="lifeline" />
    </g>

    <!-- Абонентская трубка MS -->
    <g transform="translate(800, 72)">
      <rect x="0" y="0" width="170" height="44" rx="6" class="proto-actor-box" />
      <text x="85" y="18" class="proto-actor-title" text-anchor="middle">АБОНЕНТ (MS)</text>
      <text x="85" y="32" class="proto-actor-sub" text-anchor="middle">Мобильный телефон</text>
      <line x1="85" y1="44" x2="85" y2="252" class="lifeline" />
    </g>

    <!-- Шаги взаимодействия со стрелками (с увеличенным вертикальным шагом) -->
    <!-- 1. BIND -->
    <g transform="translate(0, 130)">
      <line x1="160" y1="0" x2="570" y2="0" class="msg-arrow req" />
      <polygon points="568,-4 576,0 568,4" class="arrow-head req" />
      <text x="365" y="-6" class="msg-text req" text-anchor="middle">1. BIND_TRANSCEIVER (system_id, password)</text>

      <line x1="570" y1="18" x2="160" y2="18" class="msg-arrow resp" />
      <polygon points="162,14 154,18 162,22" class="arrow-head resp" />
      <text x="365" y="30" class="msg-text resp" text-anchor="middle">2. BIND_TRANSCEIVER_RESP (Status: ESME_ROK 0x00)</text>
    </g>

    <!-- 2. SUBMIT_SM -->
    <g transform="translate(0, 180)">
      <line x1="160" y1="0" x2="570" y2="0" class="msg-arrow req" />
      <polygon points="568,-4 576,0 568,4" class="arrow-head req" />
      <text x="365" y="-6" class="msg-text req" text-anchor="middle">3. SUBMIT_SM (source: "BANK", dest: "79991234567", text: "Код 4819")</text>

      <line x1="570" y1="18" x2="160" y2="18" class="msg-arrow resp" />
      <polygon points="162,14 154,18 162,22" class="arrow-head resp" />
      <text x="365" y="30" class="msg-text resp" text-anchor="middle">4. SUBMIT_SM_RESP (Status: OK, Message_ID: "04A19F8B")</text>
    </g>

    <!-- 3. Доставка на мобильный -->
    <g transform="translate(0, 230)">
      <line x1="570" y1="0" x2="885" y2="0" class="msg-arrow radio" />
      <polygon points="883,-4 891,0 883,4" class="arrow-head radio" />
      <text x="725" y="-6" class="msg-text radio" text-anchor="middle">5. Доставка в сотовую сеть (MT-FwdSM)</text>

      <line x1="885" y1="18" x2="570" y2="18" class="msg-arrow radio" />
      <polygon points="572,14 564,18 572,22" class="arrow-head radio" />
      <text x="725" y="30" class="msg-text radio" text-anchor="middle">6. Подтверждение доставки от телефона (Ack)</text>
    </g>

    <!-- 4. DELIVER_SM (DLR) -->
    <g transform="translate(0, 280)">
      <line x1="570" y1="0" x2="160" y2="0" class="msg-arrow dlr" />
      <polygon points="162,-4 154,0 162,4" class="arrow-head dlr" />
      <text x="365" y="-6" class="msg-text dlr" text-anchor="middle">7. DELIVER_SM DLR ("id:04A19F8B stat:DELIVRD submit_date:..." )</text>

      <line x1="160" y1="18" x2="570" y2="18" class="msg-arrow resp" />
      <polygon points="568,14 576,18 568,22" class="arrow-head resp" />
      <text x="365" y="30" class="msg-text resp" text-anchor="middle">8. DELIVER_SM_RESP (ESME_ROK 0x00)</text>
    </g>

    <!-- Нижняя панель: Анатомия 16-байтного заголовка SMPP PDU -->
    <g transform="translate(30, 325)">
      <rect x="0" y="0" width="${WIDTH - 60}" height="70" rx="5" class="proto-info-box" />
      <text x="14" y="18" class="proto-info-title">СТРУКТУРА 16-БАЙТНОГО ЗАГОЛОВКА SMPP PDU (PDU HEADER):</text>
      
      <!-- 4 поля заголовка -->
      <g transform="translate(14, 26)">
        <rect x="0" y="0" width="180" height="34" rx="4" class="pdu-field" />
        <text x="10" y="14" class="pdu-f-name">command_length (4B)</text>
        <text x="10" y="26" class="pdu-f-sub">Полная длина пакета</text>

        <rect x="190" y="0" width="200" height="34" rx="4" class="pdu-field" />
        <text x="200" y="14" class="pdu-f-name">command_id (4B)</text>
        <text x="200" y="26" class="pdu-f-sub">ID команды (0x04: submit_sm)</text>

        <rect x="400" y="0" width="190" height="34" rx="4" class="pdu-field" />
        <text x="410" y="14" class="pdu-f-name">command_status (4B)</text>
        <text x="410" y="26" class="pdu-f-sub">Код статуса (0x00 = ROK)</text>

        <rect x="600" y="0" width="180" height="34" rx="4" class="pdu-field" />
        <text x="610" y="14" class="pdu-f-name">sequence_number (4B)</text>
        <text x="610" y="26" class="pdu-f-sub">ID транзакции запроса/ответа</text>

        <rect x="790" y="0" width="160" height="34" rx="4" class="pdu-field body" />
        <text x="800" y="14" class="pdu-f-name">PDU Body + TLV</text>
        <text x="800" y="26" class="pdu-f-sub">Тело SMS и атрибуты</text>
      </g>
    </g>
  </svg>
  `;
}

// СХЕМА 2: ПРОТОКОЛ SS7 (ОКС-7 / MAP)
function renderSs7Svg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} 420" class="iso-svg proto-svg" role="img" aria-label="Схема работы протокола SS7 MAP">
    <rect x="10" y="10" width="${WIDTH - 20}" height="400" rx="10" class="main-rack-plate" />
    <rect x="16" y="16" width="${WIDTH - 32}" height="388" rx="8" class="main-rack-inner-border" />

    <text x="30" y="40" class="proto-svg-title">СХЕМА ПРОТОКОЛА SS7 / ОКС-7 (MAP — MOBILE APPLICATION PART)</text>
    <text x="30" y="56" class="proto-svg-sub">Сигнальный обмен между SMSC, HLR (маршрутизация) и MSC/VLR (коммутация к соте)</text>

    <!-- Левая колонка: 7 уровней сигнального стека SS7 -->
    <g transform="translate(30, 75)">
      <rect x="0" y="0" width="260" height="320" rx="6" class="proto-info-box" />
      <text x="14" y="20" class="proto-info-title">СТЕК ПРОТОКОЛОВ SS7 (ОКС-7):</text>

      <!-- Слои стека -->
      <g transform="translate(14, 30)">
        <rect x="0" y="0" width="232" height="38" rx="4" class="stack-layer map" />
        <text x="12" y="16" class="stack-name">MAP (Mobile Application Part)</text>
        <text x="12" y="29" class="stack-desc">Команды SMS: SRI-for-SM, MT/MO-FwdSM, AlertSC</text>

        <rect x="0" y="44" width="232" height="38" rx="4" class="stack-layer tcap" />
        <text x="12" y="60" class="stack-name">TCAP (Transaction Capabilities)</text>
        <text x="12" y="73" class="stack-desc">Диалоги транзакций: Begin, Continue, End</text>

        <rect x="0" y="88" width="232" height="38" rx="4" class="stack-layer sccp" />
        <text x="12" y="104" class="stack-name">SCCP (Signaling Connection Control)</text>
        <text x="12" y="117" class="stack-desc">Маршрутизация по Global Title (GT) и SSN</text>

        <rect x="0" y="132" width="232" height="38" rx="4" class="stack-layer mtp3" />
        <text x="12" y="148" class="stack-name">MTP-3 (Сетевой уровень ОКС-7)</text>
        <text x="12" y="161" class="stack-desc">Маршрутизация по Point Code (OPC / DPC)</text>

        <rect x="0" y="176" width="232" height="38" rx="4" class="stack-layer mtp2" />
        <text x="12" y="192" class="stack-name">MTP-2 (Канальный уровень)</text>
        <text x="12" y="205" class="stack-desc">Контроль целостности, CRC-16, флаги</text>

        <rect x="0" y="220" width="232" height="38" rx="4" class="stack-layer mtp1" />
        <text x="12" y="236" class="stack-name">MTP-1 (Физический уровень E1)</text>
        <text x="12" y="249" class="stack-desc">Цифровые тракты E1 2.048 Мбит/с (64 Кбит/с таймслоты)</text>
      </g>
    </g>

    <!-- Правая колонка: Диаграмма сигнального обмена (Call Flow) -->
    <g transform="translate(315, 75)">
      <rect x="0" y="0" width="${WIDTH - 345}" height="320" rx="6" class="proto-info-box" />
      <text x="14" y="20" class="proto-info-title">СИГНАЛЬНЫЙ CALL-FLOW ДОСТАВКИ SMS ПО СЕТИ SS7:</text>

      <!-- Узлы: SMSC, HLR, MSC, MS -->
      <g transform="translate(20, 32)">
        <!-- SMSC -->
        <rect x="0" y="0" width="130" height="36" rx="5" class="proto-actor-box smsc-actor" />
        <text x="65" y="16" class="proto-actor-title" text-anchor="middle">SMSC</text>
        <text x="65" y="28" class="proto-actor-sub" text-anchor="middle">СМС-Центр</text>
        <line x1="65" y1="36" x2="65" y2="242" class="lifeline" />

        <!-- HLR -->
        <rect x="180" y="0" width="130" height="36" rx="5" class="proto-actor-box" />
        <text x="245" y="16" class="proto-actor-title" text-anchor="middle">HLR / HSS</text>
        <text x="245" y="28" class="proto-actor-sub" text-anchor="middle">База абонентов</text>
        <line x1="245" y1="36" x2="245" y2="242" class="lifeline" />

        <!-- MSC -->
        <rect x="360" y="0" width="130" height="36" rx="5" class="proto-actor-box" />
        <text x="425" y="16" class="proto-actor-title" text-anchor="middle">MSC / VLR</text>
        <text x="425" y="28" class="proto-actor-sub" text-anchor="middle">Коммутатор соты</text>
        <line x1="425" y1="36" x2="425" y2="242" class="lifeline" />

        <!-- Телефон -->
        <rect x="525" y="0" width="110" height="36" rx="5" class="proto-actor-box" />
        <text x="580" y="16" class="proto-actor-title" text-anchor="middle">MS (ТЕЛЕФОН)</text>
        <text x="580" y="28" class="proto-actor-sub" text-anchor="middle">Абонент</text>
        <line x1="580" y1="36" x2="580" y2="242" class="lifeline" />

        <!-- Сообщения обмена -->
        <!-- Фаза 1: Запрос HLR -->
        <g transform="translate(0, 56)">
          <line x1="65" y1="0" x2="245" y2="0" class="msg-arrow req" />
          <polygon points="243,-4 251,0 243,4" class="arrow-head req" />
          <text x="155" y="-6" class="msg-text req" text-anchor="middle">1. MAP_SEND_ROUTING_INFO_FOR_SM (MSISDN)</text>

          <line x1="245" y1="18" x2="65" y2="18" class="msg-arrow resp" />
          <polygon points="67,14 59,18 67,22" class="arrow-head resp" />
          <text x="155" y="30" class="msg-text resp" text-anchor="middle">2. SRI_ACK (IMSI, MSC-Address: +79997740001)</text>
        </g>

        <!-- Фаза 2: Отправка MT-FwdSM к MSC -->
        <g transform="translate(0, 110)">
          <line x1="65" y1="0" x2="425" y2="0" class="msg-arrow req" />
          <polygon points="423,-4 431,0 423,4" class="arrow-head req" />
          <text x="245" y="-6" class="msg-text req" text-anchor="middle">3. MAP_MT_FORWARD_SHORT_MESSAGE (IMSI, PDU)</text>
        </g>

        <!-- Фаза 3: Радиоканал MSC ➔ Телефон -->
        <g transform="translate(0, 148)">
          <line x1="425" y1="0" x2="580" y2="0" class="msg-arrow radio" />
          <polygon points="578,-4 586,0 578,4" class="arrow-head radio" />
          <text x="502" y="-6" class="msg-text radio" text-anchor="middle">4. CP-DATA / RP-DATA (Радиоканал SDCCH)</text>

          <line x1="580" y1="18" x2="425" y2="18" class="msg-arrow radio" />
          <polygon points="427,14 419,18 427,22" class="arrow-head radio" />
          <text x="502" y="30" class="msg-text radio" text-anchor="middle">5. RP-ACK (Подтверждение от телефона)</text>
        </g>

        <!-- Фаза 4: Ответ MSC ➔ SMSC -->
        <g transform="translate(0, 198)">
          <line x1="425" y1="0" x2="65" y2="0" class="msg-arrow dlr" />
          <polygon points="67,-4 59,0 67,4" class="arrow-head dlr" />
          <text x="245" y="-6" class="msg-text dlr" text-anchor="middle">6. MT_FORWARD_SHORT_MESSAGE_ACK (Успешная доставка)</text>
        </g>
      </g>
    </g>
  </svg>
  `;
}

// СХЕМА 3: ПРОТОКОЛ SIGTRAN (SS7 поверх сетей IP / SCTP + M3UA)
function renderSigtranSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} 420" class="iso-svg proto-svg" role="img" aria-label="Схема работы протокола SIGTRAN">
    <rect x="10" y="10" width="${WIDTH - 20}" height="400" rx="10" class="main-rack-plate" />
    <rect x="16" y="16" width="${WIDTH - 32}" height="388" rx="8" class="main-rack-inner-border" />

    <text x="30" y="40" class="proto-svg-title">СХЕМА ПРОТОКОЛА SIGTRAN (SS7 OVER IP: SCTP + M3UA)</text>
    <text x="30" y="56" class="proto-svg-sub">Перенос сигнализации ОКС-7 через высокоскоростные IP-сети оператора с резервированием Multi-homing</text>

    <!-- Сравнение 2 архитектур: Традиционный TDM SS7 vs Современный SIGTRAN IP -->
    <g transform="translate(30, 75)">
      <!-- Колонка 1: Традиционный SS7 (TDM E1) -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="280" height="320" rx="6" class="proto-info-box" />
        <text x="14" y="20" class="proto-info-title">1. ТРАДИЦИОННЫЙ SS7 (TDM / E1):</text>
        
        <g transform="translate(14, 30)">
          <rect x="0" y="0" width="252" height="34" rx="4" class="stack-layer map" />
          <text x="12" y="21" class="stack-name">MAP / CAP / ISUP</text>

          <rect x="0" y="38" width="252" height="34" rx="4" class="stack-layer tcap" />
          <text x="12" y="59" class="stack-name">TCAP (Транзакции)</text>

          <rect x="0" y="76" width="252" height="34" rx="4" class="stack-layer sccp" />
          <text x="12" y="97" class="stack-name">SCCP (Адресация Global Title)</text>

          <rect x="0" y="114" width="252" height="34" rx="4" class="stack-layer mtp3" />
          <text x="12" y="135" class="stack-name">MTP-3 (Сетевой уровень ОКС-7)</text>

          <rect x="0" y="152" width="252" height="34" rx="4" class="stack-layer mtp2" />
          <text x="12" y="173" class="stack-name">MTP-2 (Канальный уровень)</text>

          <rect x="0" y="190" width="252" height="34" rx="4" class="stack-layer mtp1" />
          <text x="12" y="211" class="stack-name">MTP-1 (Физический E1 / 2.048 Mbps)</text>
        </g>
        <text x="14" y="278" class="proto-info-note">⚠ Дорогие медные линии E1, лимит 64 Кбит/с</text>
      </g>

      <!-- Центральный шлюз SGW (Signaling Gateway) -->
      <g transform="translate(300, 0)">
        <rect x="0" y="0" width="130" height="320" rx="6" class="proto-actor-box sgw-box" />
        <text x="65" y="22" class="proto-actor-title" text-anchor="middle">SGW</text>
        <text x="65" y="36" class="proto-actor-sub" text-anchor="middle">Шлюз сигнализации</text>
        
        <!-- Трансляция MTP3 ⇄ M3UA -->
        <g transform="translate(10, 100)">
          <rect x="0" y="0" width="110" height="96" rx="4" class="sgw-bridge-box" />
          <text x="55" y="22" class="sgw-bridge-text" text-anchor="middle">ТРАНСЛЯЦИЯ</text>
          <text x="55" y="46" class="sgw-bridge-detail" text-anchor="middle">MTP-3</text>
          <text x="55" y="62" class="sgw-bridge-arrow" text-anchor="middle">⇅</text>
          <text x="55" y="82" class="sgw-bridge-detail" text-anchor="middle">M3UA</text>
        </g>

        <text x="65" y="260" class="sgw-note" text-anchor="middle">Стыкует старые MSC</text>
        <text x="65" y="274" class="sgw-note" text-anchor="middle">с IP-ядром SMSC</text>
      </g>

      <!-- Колонка 2: Современный SIGTRAN (IP / SCTP / M3UA) -->
      <g transform="translate(450, 0)">
        <rect x="0" y="0" width="530" height="320" rx="6" class="proto-info-box" />
        <text x="14" y="20" class="proto-info-title">2. SIGTRAN В SMSC (SS7 ПОВЕРХ IP):</text>

        <g transform="translate(14, 30)">
          <!-- Верхний прикладной стек (идентичен SS7!) -->
          <rect x="0" y="0" width="240" height="34" rx="4" class="stack-layer map" />
          <text x="12" y="21" class="stack-name">MAP (SMS: SRI-for-SM, MT-FwdSM)</text>

          <rect x="0" y="38" width="240" height="34" rx="4" class="stack-layer tcap" />
          <text x="12" y="59" class="stack-name">TCAP</text>

          <rect x="0" y="76" width="240" height="34" rx="4" class="stack-layer sccp" />
          <text x="12" y="97" class="stack-name">SCCP</text>

          <!-- Инновационный транспортный уровень SIGTRAN -->
          <rect x="0" y="114" width="240" height="34" rx="4" class="stack-layer m3ua" />
          <text x="12" y="135" class="stack-name">M3UA (MTP3 User Adaptation)</text>

          <rect x="0" y="152" width="240" height="34" rx="4" class="stack-layer sctp" />
          <text x="12" y="173" class="stack-name">SCTP (Транспорт ассоциаций)</text>

          <rect x="0" y="190" width="240" height="34" rx="4" class="stack-layer ip" />
          <text x="12" y="211" class="stack-name">IP (IPv4 / IPv6 Ethernet 10G)</text>
        </g>

        <!-- Блок ключевых преимуществ SCTP в SIGTRAN -->
        <g transform="translate(268, 30)">
          <rect x="0" y="0" width="248" height="224" rx="5" class="sigtran-features-box" />
          <text x="12" y="20" class="feat-title">ПРЕИМУЩЕСТВА SCTP:</text>
          
          <g transform="translate(12, 32)">
            <text x="0" y="10" class="feat-head">1. Multi-homing (Резерв путей):</text>
            <text x="0" y="24" class="feat-desc">Поддержка нескольких IP-адресов.</text>
            <text x="0" y="36" class="feat-desc">Мгновенный переход при сбое линка.</text>

            <text x="0" y="62" class="feat-head">2. Multi-streaming (Потоки):</text>
            <text x="0" y="76" class="feat-desc">Несколько независимых потоков данных.</text>
            <text x="0" y="88" class="feat-desc">Задержка одного SMS не блокирует другие.</text>

            <text x="0" y="114" class="feat-head">3. 4-Way Handshake &amp; Cookie:</text>
            <text x="0" y="128" class="feat-desc">Полная защита от SYN-Flood атак.</text>
            <text x="0" y="140" class="feat-desc">Гарантированный порядок доставки сигналов.</text>
          </g>
        </g>

        <text x="14" y="280" class="proto-info-note ok">✔ Высокая пропускная способность (100k+ TPS), полная надежность и резервирование</text>
      </g>
    </g>
  </svg>
  `;
}

// ══════════════════════════════════════════════════════════════
// 10B. ВКЛАДКА 3: ТОПОЛОГИЯ И АРХИТЕКТУРА СЕТИ GSM (МГУ АСВК)
// ══════════════════════════════════════════════════════════════

// База данных по узлам сети GSM (по материалам курса кафедры АСВК МГУ)
const GSM_NODES_INFO = {
  ms: {
    title: "MS (Mobile Station / Мобильная станция)",
    sub: "Абонентский терминал: ME (Mobile Equipment) + SIM-карта",
    interfaces: "Um (радиоинтерфейс к BTS, 200 кГц, TDMA/FDMA, 8 таймслотов)",
    role: "Обеспечивает доступ пользователя к голосовым услугам и передаче данных в сети GSM.",
    details: [
      "• <strong>SIM (Subscriber Identity Module):</strong> Хранит IMSI (международный номер абонента), секретный ключ Ki, криптоалгоритмы A3 и A8, PIN/PUK-коды, список предпочтительных сетей PLMN.",
      "• <strong>ME (Mobile Equipment):</strong> Аппаратная часть телефона с уникальным серийным номером IMEI (15 десятичных цифр).",
      "• <strong>Шифрование:</strong> Поддерживает потоковый шифр A5 (A5/1, A5/2, A5/3) для защиты голосового и сигнального трафика в эфире.",
    ],
  },
  bts: {
    title: "BTS (Base Transceiver Station / Базовая станция)",
    sub: "Приемопередающая станция, формирующая радиопокрытие соты",
    interfaces: "Um (к абонентам MS), Abis (к контроллеру BSC, 2.048 Мбит/с E1 или IP)",
    role: "Обслуживает одну или несколько сот (секторов). Содержит приемопередатчики TRX, усилители мощности, антенно-фидерные тракты.",
    details: [
      "• <strong>Функции радиоканала:</strong> Модуляция GMSK (0.3 Gaussian MSK), канальное кодирование, перемежение (Interleaving), измерение уровня и качества сигнала (RXLEV, RXQUAL).",
      "• <strong>Прыжки по частоте (Frequency Hopping):</strong> Снижение влияния интерференции и замираний радиоволн.",
      "• <strong>Шифрование A5:</strong> Аппаратное шифрование/дешифрование радиоканала на физическом уровне.",
    ],
  },
  bsc: {
    title: "BSC (Base Station Controller / Контроллер базовых станций)",
    sub: "Управляющий узел подсистемы BSS для группы из 10–100 BTS",
    interfaces: "Abis (к BTS), A (к коммутатору MSC по SS7/SIGTRAN), Ater (к TRAU)",
    role: "Освобождает MSC от рутинных задач управления радиоканалами. Координирует работу группы базовых станций.",
    details: [
      "• <strong>Radio Resource Management (RRM):</strong> Выделение и освобождение радиоканалов (TCH для речи, SDCCH для сигнализации/SMS).",
      "• <strong>Хэндовер (Handover):</strong> Принятие решения о переключении абонента между сотами на основе отчетов измерений (Intra-BSC Handover).",
      "• <strong>Управление мощностью:</strong> Динамическая регулировка мощности излучения терминала MS и передатчиков BTS.",
    ],
  },
  trau: {
    title: "TRAU (Transcoder Rate Adaptation Unit / Транскодер)",
    sub: "Преобразователь и сжатие цифрового речевого сигнала",
    interfaces: "Ater (к BSC, сжатый поток), A (к MSC, стандартный ИКМ 64 кбит/с)",
    role: "Транскодирует речь между сжатым стандартом GSM (13 кбит/с RPE-LTP / Full Rate) и проводным стандартом телефонии (64 кбит/с ИКМ, G.711 A-law).",
    details: [
      "• <strong>Экономия каналов передачи:</strong> Позволяет передавать до 4 сжатых речевых каналов по одному стандартному таймслоту 64 кбит/с.",
      "• <strong>VAD & DTX:</strong> Детектирование голосовой активности (VAD) и прерывистая передача (DTX) с генерацией комфортного шума (CNG).",
    ],
  },
  msc: {
    title: "MSC (Mobile Switching Centre / Коммутатор сотовой сети)",
    sub: "Центральное управляющее ядро коммутации вызовов и сообщений",
    interfaces: "A (к BSC), B (внутренний к VLR), C (к HLR), E (к другим MSC), F (к EIR)",
    role: "Цифровой телефонный коммутатор с поддержкой мобильности. Управляет всеми соединениями, маршрутизацией, генерацией биллинга.",
    details: [
      "• <strong>Управление вызовами:</strong> Установление, поддержание и разъединение телефонных соединений и SMS.",
      "• <strong>Межкоммутаторный хэндовер:</strong> Управление переключением абонента между разными MSC (Inter-MSC Handover по интерфейсу E).",
      "• <strong>Биллинг (CDR):</strong> Фиксация параметров вызовов для тарификации (время, длительность, вызываемый номер, сота).",
    ],
  },
  vlr: {
    title: "VLR (Visitor Location Register / Гостевой регистр)",
    sub: "Динамическая оперативная база данных активных абонентов зоны MSC",
    interfaces: "B (к MSC), D (к HLR), G (к соседним VLR)",
    role: "Содержит точную копию профиля абонентов, находящихся в зоне действия обслуживающего MSC. Исключает постоянные запросы в удаленный HLR.",
    details: [
      "• <strong>Временный идентификатор TMSI:</strong> Назначает временный номер абонента для скрытия реального IMSI в радиоэфире.",
      "• <strong>Location Area Identifier (LAI):</strong> Фиксирует зону местоположения абонента для процедуры пейджинга (Paging) при входящем звонке.",
      "• <strong>MSRN (Mobile Station Roaming Number):</strong> Выделяет временный маршрутный номер для адресации входящего вызова к MSC.",
    ],
  },
  hlr: {
    title: "HLR (Home Location Register / Домашний регистр)",
    sub: "Центральная база данных абонентов домашней сети оператора",
    interfaces: "C (к GMSC/MSC), D (к VLR), H (к AUC)",
    role: "Главное постоянное хранилище информации об абонентах оператора. Доступно для всех элементов сети через ОКС-7 / MAP.",
    details: [
      "• <strong>Параметры абонента:</strong> IMSI, абонентский номер MSISDN, профиль подписок (голос, SMS, роуминг, переадресация).",
      "• <strong>Текущая локализация:</strong> Адрес текущего VLR/MSC, где в данный момент зарегистрирован абонент.",
      "• <strong>Флаг ожидания SMS (MWD):</strong> Отслеживает недоставленные SMS и отправляет AlertSC при включении телефона.",
    ],
  },
  auc: {
    title: "AUC (Authentication Centre / Центр аутентификации)",
    sub: "Криптографический сервер генерации ключей безопасности",
    interfaces: "H (к HLR)",
    role: "Защищает сеть от несанкционированного доступа (клонирования SIM) и обеспечивает конфиденциальность переговоров.",
    details: [
      "• <strong>Секретный ключ Ki:</strong> Хранит эталонную копию ключа абонента (не передается по сети ни при каких условиях).",
      "• <strong>Генерация триплетов (RAND, SRES, Kc):</strong> Вычисляет отклик SRES (алгоритм A3) и сессионный ключ Kc (алгоритм A8) на основе случайного числа RAND.",
      "• <strong>Триплеты передаются в VLR:</strong> VLR использует их для проверки подлинности без раскрытия ключа Ki.",
    ],
  },
  eir: {
    title: "EIR (Equipment Identity Register / Регистр оборудования)",
    sub: "Центральная база данных подлинности телефонных аппаратов (IMEI)",
    interfaces: "F (к MSC по протоколу MAP_CHECK_IMEI)",
    role: "Предотвращает использование украденных, поврежденных или несертифицированных мобильных терминалов.",
    details: [
      "• <strong>Белый список (White List):</strong> Разрешенные аппараты, прошедшие сертификацию.",
      "• <strong>Серый список (Grey List):</strong> Аппараты с техническими неполадками или находящиеся под наблюдением.",
      "• <strong>Чёрный список (Black List):</strong> Украденные или заблокированные телефоны (доступ в сотовую сеть полностью запрещен).",
    ],
  },
  gmsc: {
    title: "GMSC (Gateway MSC / Шлюзовой коммутатор сети)",
    sub: "Точка сопряжения мобильной сети GSM с внешними телефонными сетями",
    interfaces: "C (к HLR), ISUP/SIP (к PSTN / ТфОП, ISDN)",
    role: "Принимает входящий вызов из внешней телефонной сети (PSTN), запрашивает HLR о местонахождении абонента и маршрутизирует вызов на целевой MSC.",
    details: [
      "• <strong>Запрос Send Routing Info (SRI):</strong> Обращается в HLR по номеру MSISDN.",
      "• <strong>Получение MSRN:</strong> HLR опрашивает текущий VLR и возвращает GMSC маршрутный номер MSRN для соединения.",
    ],
  },
  omc: {
    title: "OSS / OMC (Operations and Maintenance Centre)",
    sub: "Центр технической эксплуатации и управления сетью GSM",
    interfaces: "X.25 / IP к элементам BSS и NSS",
    role: "Обеспечивает централизованный круглосуточный контроль работоспособности всей сотовой сети оператора.",
    details: [
      "• <strong>Alarm Management:</strong> Сбор и визуализация аварийных сигналов от оборудования в реальном времени.",
      "• <strong>Конфигурирование сети:</strong> Удаленное изменение частот сот, мощности передатчиков, параметров хэндовера.",
      "• <strong>Статистика трафика (KPI):</strong> Анализ отпавших вызовов (Drop Call Rate), успешности соединений и нагрузки каналов.",
    ],
  },
};

// СХЕМА 1: ПОЛНАЯ ТОПОЛОГИЯ СЕТИ GSM
function renderGsmTopologySvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} 460" class="iso-svg proto-svg gsm-topo-svg" role="img" aria-label="Топология сети GSM">
    <rect x="10" y="10" width="${WIDTH - 20}" height="440" rx="10" class="main-rack-plate" />
    <rect x="16" y="16" width="${WIDTH - 32}" height="428" rx="8" class="main-rack-inner-border" />

    <text x="30" y="38" class="proto-svg-title">ТОПОЛОГИЯ И АРХИТЕКТУРА СЕТИ GSM (3GPP / ETSI)</text>
    <text x="30" y="54" class="proto-svg-sub">Взаимодействие подсистем MS (Абоненты) · BSS (Радиосеть) · NSS (Коммутация и БД) · OSS (Эксплуатация) · Внешние сети</text>

    <!-- ════════════ 1. ПОДСИСТЕМА АБОНЕНТОВ (MS) ════════════ -->
    <g class="gsm-subsystem-group" transform="translate(25, 70)">
      <rect x="0" y="0" width="125" height="360" rx="6" class="gsm-zone-box" />
      <text x="62" y="20" class="gsm-zone-title" text-anchor="middle">MS (АБОНЕНТЫ)</text>

      <!-- Мобильный терминал MS-1 -->
      <g class="gsm-node-clickable" data-gsm-node="ms" cursor="pointer" transform="translate(10, 32)">
        <rect x="0" y="0" width="105" height="150" rx="6" class="gsm-node-box ms-box" />
        <text x="52" y="18" class="gsm-node-header" text-anchor="middle">MS (ТЕЛЕФОН)</text>
        
        <!-- Экранчик телефона -->
        <rect x="12" y="26" width="81" height="34" rx="3" class="phone-screen" />
        <text x="52" y="42" class="phone-scr-txt" text-anchor="middle">GSM 900/1800</text>
        <text x="52" y="53" class="phone-scr-sub" text-anchor="middle">Сеть активна</text>

        <!-- Модули внутри MS -->
        <rect x="8" y="68" width="89" height="32" rx="3" class="gsm-subchip-box" />
        <text x="12" y="81" class="gsm-subchip-title">ME (Аппарат)</text>
        <text x="12" y="93" class="gsm-subchip-desc">IMEI: 3589... (15 цифр)</text>

        <rect x="8" y="106" width="89" height="36" rx="3" class="gsm-subchip-box sim" />
        <text x="12" y="119" class="gsm-subchip-title">SIM-КАРТА</text>
        <text x="12" y="131" class="gsm-subchip-desc">IMSI · Ключ Ki · A3/A8</text>
      </g>

      <!-- Второй мобильный терминал MS-2 -->
      <g class="gsm-node-clickable" data-gsm-node="ms" cursor="pointer" transform="translate(10, 200)">
        <rect x="0" y="0" width="105" height="145" rx="6" class="gsm-node-box ms-box" />
        <text x="52" y="18" class="gsm-node-header" text-anchor="middle">MS-2 (ТЕЛЕФОН)</text>
        <rect x="12" y="26" width="81" height="30" rx="3" class="phone-screen" />
        <text x="52" y="44" class="phone-scr-txt" text-anchor="middle">Режим разговора</text>
        
        <rect x="8" y="64" width="89" height="34" rx="3" class="gsm-subchip-box" />
        <text x="12" y="78" class="gsm-subchip-title">Радиоканал TCH</text>
        <text x="12" y="90" class="gsm-subchip-desc">Таймслот TS#3 (200 кГц)</text>

        <rect x="8" y="104" width="89" height="32" rx="3" class="gsm-subchip-box" />
        <text x="12" y="118" class="gsm-subchip-title">Шифрование</text>
        <text x="12" y="129" class="gsm-subchip-desc">Потоковый шифр A5/1</text>
      </g>
    </g>

    <!-- Радиоинтерфейс Um (Радиоволны между MS и BTS) -->
    <g class="gsm-interface-um" transform="translate(148, 170)">
      <path d="M4 0 Q14 -12 24 0" class="radio-arc" />
      <path d="M0 -6 Q14 -22 28 -6" class="radio-arc" />
      <path d="M4 24 Q14 12 24 24" class="radio-arc" />
      <path d="M0 30 Q14 44 28 30" class="radio-arc" />
      <rect x="0" y="4" width="28" height="16" rx="3" class="if-badge" />
      <text x="14" y="16" class="if-badge-txt" text-anchor="middle">Um</text>
    </g>

    <!-- ════════════ 2. ПОДСИСТЕМА БАЗОВЫХ СТАНЦИЙ (BSS) ════════════ -->
    <g class="gsm-subsystem-group" transform="translate(180, 70)">
      <rect x="0" y="0" width="250" height="360" rx="6" class="gsm-zone-box" />
      <text x="125" y="20" class="gsm-zone-title" text-anchor="middle">BSS (БАЗОВЫЕ СТАНЦИИ)</text>

      <!-- BTS-1 (Базовая станция) -->
      <g class="gsm-node-clickable" data-gsm-node="bts" cursor="pointer" transform="translate(10, 32)">
        <rect x="0" y="0" width="100" height="150" rx="5" class="gsm-node-box" />
        <text x="50" y="18" class="gsm-node-header" text-anchor="middle">BTS (СОТА-1)</text>

        <!-- Антенная мачта -->
        <g transform="translate(50, 48)">
          <line x1="0" y1="-12" x2="-14" y2="28" class="tower-leg" />
          <line x1="0" y1="-12" x2="14" y2="28" class="tower-leg" />
          <line x1="-8" y1="8" x2="8" y2="8" class="tower-cross" />
          <line x1="-11" y1="20" x2="11" y2="20" class="tower-cross" />
          <circle cx="0" cy="-14" r="4" class="tower-top" />
        </g>

        <rect x="8" y="86" width="84" height="26" rx="3" class="gsm-subchip-box" />
        <text x="12" y="98" class="gsm-subchip-title">Модуль TRX</text>
        <text x="12" y="108" class="gsm-subchip-desc">GMSK-модуляция</text>

        <rect x="8" y="116" width="84" height="26" rx="3" class="gsm-subchip-box" />
        <text x="12" y="128" class="gsm-subchip-title">Шифрование</text>
        <text x="12" y="138" class="gsm-subchip-desc">Аппаратный A5</text>
      </g>

      <!-- BTS-2 (Вторая сота) -->
      <g class="gsm-node-clickable" data-gsm-node="bts" cursor="pointer" transform="translate(10, 200)">
        <rect x="0" y="0" width="100" height="145" rx="5" class="gsm-node-box" />
        <text x="50" y="18" class="gsm-node-header" text-anchor="middle">BTS (СОТА-2)</text>

        <g transform="translate(50, 48)">
          <line x1="0" y1="-12" x2="-14" y2="28" class="tower-leg" />
          <line x1="0" y1="-12" x2="14" y2="28" class="tower-leg" />
          <line x1="-8" y1="8" x2="8" y2="8" class="tower-cross" />
          <line x1="-11" y1="20" x2="11" y2="20" class="tower-cross" />
          <circle cx="0" cy="-14" r="4" class="tower-top" />
        </g>

        <rect x="8" y="86" width="84" height="26" rx="3" class="gsm-subchip-box" />
        <text x="12" y="98" class="gsm-subchip-title">Частоты TRX</text>
        <text x="12" y="108" class="gsm-subchip-desc">Frequency Hopping</text>

        <rect x="8" y="116" width="84" height="23" rx="3" class="gsm-subchip-box" />
        <text x="12" y="130" class="gsm-subchip-title">Измерения RXLEV</text>
      </g>

      <!-- Шина интерфейса Abis между BTS и BSC -->
      <line x1="110" y1="107" x2="135" y2="107" class="gsm-wire" />
      <line x1="110" y1="272" x2="125" y2="272" class="gsm-wire" />
      <line x1="125" y1="272" x2="125" y2="107" class="gsm-wire" />
      
      <!-- Бейдж интерфейса Abis -->
      <rect x="112" y="170" width="26" height="16" rx="3" class="if-badge" />
      <text x="125" y="182" class="if-badge-txt" text-anchor="middle">Abis</text>

      <!-- BSC (Контроллер базовых станций) -->
      <g class="gsm-node-clickable" data-gsm-node="bsc" cursor="pointer" transform="translate(140, 32)">
        <rect x="0" y="0" width="100" height="160" rx="5" class="gsm-node-box bsc-box" />
        <text x="50" y="18" class="gsm-node-header" text-anchor="middle">BSC (КОНТРОЛЛЕР)</text>

        <rect x="8" y="28" width="84" height="34" rx="3" class="gsm-subchip-box" />
        <text x="12" y="42" class="gsm-subchip-title">RRM-управление</text>
        <text x="12" y="54" class="gsm-subchip-desc">Радиоресурсы сот</text>

        <rect x="8" y="68" width="84" height="34" rx="3" class="gsm-subchip-box" />
        <text x="12" y="82" class="gsm-subchip-title">Хэндовер</text>
        <text x="12" y="94" class="gsm-subchip-desc">Intra-BSC Handover</text>

        <rect x="8" y="108" width="84" height="42" rx="3" class="gsm-subchip-box" />
        <text x="12" y="122" class="gsm-subchip-title">Управление мощн.</text>
        <text x="12" y="134" class="gsm-subchip-desc">Power Control MS</text>
        <text x="12" y="144" class="gsm-subchip-desc">Группа 10–100 BTS</text>
      </g>

      <!-- TRAU (Транскодер) -->
      <g class="gsm-node-clickable" data-gsm-node="trau" cursor="pointer" transform="translate(140, 215)">
        <rect x="0" y="0" width="100" height="130" rx="5" class="gsm-node-box" />
        <text x="50" y="18" class="gsm-node-header" text-anchor="middle">TRAU (ТРАНСКОДЕР)</text>
        
        <rect x="8" y="28" width="84" height="38" rx="3" class="gsm-subchip-box" />
        <text x="12" y="42" class="gsm-subchip-title">Сжатие речи</text>
        <text x="12" y="54" class="gsm-subchip-desc">13 кбит/с RPE-LTP</text>
        <text x="12" y="62" class="gsm-subchip-desc">⇄ 64 кбит/с ИКМ</text>

        <rect x="8" y="74" width="84" height="46" rx="3" class="gsm-subchip-box" />
        <text x="12" y="88" class="gsm-subchip-title">VAD / DTX</text>
        <text x="12" y="100" class="gsm-subchip-desc">Детектор голоса</text>
        <text x="12" y="112" class="gsm-subchip-desc">Комфортный шум</text>
      </g>

      <!-- Связь BSC ⇄ TRAU (Интерфейс Ater) -->
      <line x1="190" y1="192" x2="190" y2="215" class="gsm-wire" />
      <rect x="178" y="198" width="24" height="12" rx="2" class="if-badge" />
      <text x="190" y="207" class="if-badge-txt sub" text-anchor="middle">Ater</text>
    </g>

    <!-- Интерфейс A между BSC и MSC -->
    <line x1="420" y1="140" x2="455" y2="140" class="gsm-wire main-trunk" />
    <rect x="428" y="131" width="18" height="18" rx="3" class="if-badge" />
    <text x="437" y="144" class="if-badge-txt" text-anchor="middle">A</text>

    <!-- ════════════ 3. ПОДСИСТЕМА КОММУТАЦИИ И БАЗ ДАННЫХ (NSS) ════════════ -->
    <g class="gsm-subsystem-group" transform="translate(445, 70)">
      <rect x="0" y="0" width="410" height="360" rx="6" class="gsm-zone-box" />
      <text x="205" y="20" class="gsm-zone-title" text-anchor="middle">NSS (ПОДСИСТЕМА КОММУТАЦИИ И СЕТИ)</text>

      <!-- Блок MSC / VLR -->
      <g class="gsm-node-clickable" data-gsm-node="msc" cursor="pointer" transform="translate(10, 32)">
        <rect x="0" y="0" width="185" height="175" rx="6" class="gsm-node-box msc-box" />
        <text x="92" y="18" class="gsm-node-header" text-anchor="middle">MSC / VLR (КОММУТАТОР)</text>

        <!-- MSC часть -->
        <rect x="8" y="26" width="169" height="66" rx="4" class="gsm-subchip-box msc-part" />
        <text x="14" y="40" class="gsm-subchip-title">MSC (Mobile Switching Centre)</text>
        <text x="14" y="53" class="gsm-subchip-desc">• Коммутация голосовых вызовов и SMS</text>
        <text x="14" y="65" class="gsm-subchip-desc">• Межкоммутаторный Handover (Интерфейс E)</text>
        <text x="14" y="77" class="gsm-subchip-desc">• Тарификация: генерация биллинга (CDR)</text>

        <!-- Внутренний интерфейс B -->
        <rect x="80" y="93" width="24" height="12" rx="2" class="if-badge" />
        <text x="92" y="102" class="if-badge-txt sub" text-anchor="middle">B</text>

        <!-- VLR часть -->
        <rect x="8" y="107" width="169" height="60" rx="4" class="gsm-subchip-box vlr-part" />
        <text x="14" y="121" class="gsm-subchip-title">VLR (Visitor Location Register)</text>
        <text x="14" y="134" class="gsm-subchip-desc">• Временная база активных абонентов</text>
        <text x="14" y="146" class="gsm-subchip-desc">• Назначение псевдонима TMSI и зоны LAI</text>
        <text x="14" y="158" class="gsm-subchip-desc">• Выделение роуминг-номера MSRN</text>
      </g>

      <!-- Блок GMSC (Шлюзовой MSC к PSTN) -->
      <g class="gsm-node-clickable" data-gsm-node="gmsc" cursor="pointer" transform="translate(10, 230)">
        <rect x="0" y="0" width="185" height="115" rx="6" class="gsm-node-box gmsc-box" />
        <text x="92" y="18" class="gsm-node-header" text-anchor="middle">GMSC (ШЛЮЗОВОЙ MSC)</text>
        
        <rect x="8" y="28" width="169" height="78" rx="4" class="gsm-subchip-box" />
        <text x="14" y="44" class="gsm-subchip-title">Шлюз к внешним телефонным сетям</text>
        <text x="14" y="58" class="gsm-subchip-desc">• Прием входящих вызовов из PSTN / ТфОП</text>
        <text x="14" y="72" class="gsm-subchip-desc">• Запрос HLR (Send Routing Info - SRI)</text>
        <text x="14" y="86" class="gsm-subchip-desc">• Маршрутизация по номеру MSRN</text>
        <text x="14" y="98" class="gsm-subchip-desc">• Сопряжение с ISDN и внешними операторами</text>
      </g>

      <!-- Сигнальные шины между MSC/VLR, GMSC и HLR -->
      <!-- Интерфейс C (GMSC/MSC ⇄ HLR) -->
      <path d="M195 270 L212 270 L212 95 L225 95" class="gsm-wire" />
      <rect x="203" y="180" width="18" height="16" rx="3" class="if-badge" />
      <text x="212" y="192" class="if-badge-txt" text-anchor="middle">C</text>

      <!-- Интерфейс D (VLR ⇄ HLR) -->
      <path d="M195 160 L225 160" class="gsm-wire" />
      <rect x="203" y="152" width="18" height="16" rx="3" class="if-badge" />
      <text x="212" y="164" class="if-badge-txt" text-anchor="middle">D</text>

      <!-- Блок HLR (Домашний регистр местоположения) -->
      <g class="gsm-node-clickable" data-gsm-node="hlr" cursor="pointer" transform="translate(225, 32)">
        <rect x="0" y="0" width="175" height="100" rx="6" class="gsm-node-box hlr-box" />
        <text x="87" y="18" class="gsm-node-header" text-anchor="middle">HLR (ДОМАШНИЙ РЕГИСТР)</text>
        
        <rect x="8" y="26" width="159" height="66" rx="4" class="gsm-subchip-box" />
        <text x="14" y="40" class="gsm-subchip-title">Центральная БД абонентов</text>
        <text x="14" y="52" class="gsm-subchip-desc">• IMSI · Телефонный номер MSISDN</text>
        <text x="14" y="64" class="gsm-subchip-desc">• Адрес текущего VLR (Location Update)</text>
        <text x="14" y="76" class="gsm-subchip-desc">• Профиль услуг, запреты, роуминг</text>
        <text x="14" y="86" class="gsm-subchip-desc">• Флаг MWD (Message Waiting Data)</text>
      </g>

      <!-- Интерфейс H между HLR и AUC -->
      <line x1="312" y1="132" x2="312" y2="148" class="gsm-wire" />
      <rect x="303" y="134" width="18" height="14" rx="2" class="if-badge" />
      <text x="312" y="145" class="if-badge-txt sub" text-anchor="middle">H</text>

      <!-- Блок AUC (Центр аутентификации) -->
      <g class="gsm-node-clickable" data-gsm-node="auc" cursor="pointer" transform="translate(225, 148)">
        <rect x="0" y="0" width="175" height="74" rx="6" class="gsm-node-box auc-box" />
        <text x="87" y="18" class="gsm-node-header" text-anchor="middle">AUC (АУТЕНТИФИКАЦИЯ)</text>
        
        <rect x="8" y="26" width="159" height="42" rx="4" class="gsm-subchip-box" />
        <text x="14" y="39" class="gsm-subchip-title">Генерация триплетов безопасности</text>
        <text x="14" y="51" class="gsm-subchip-desc">• Хранение секретного ключа Ki</text>
        <text x="14" y="62" class="gsm-subchip-desc">• Триплеты: RAND, SRES (A3), Kc (A8)</text>
      </g>

      <!-- Интерфейс F (MSC ⇄ EIR) -->
      <path d="M195 190 L212 190 L212 260 L225 260" class="gsm-wire" />
      <rect x="203" y="220" width="18" height="14" rx="2" class="if-badge" />
      <text x="212" y="231" class="if-badge-txt sub" text-anchor="middle">F</text>

      <!-- Блок EIR (Регистр идентификации оборудования) -->
      <g class="gsm-node-clickable" data-gsm-node="eir" cursor="pointer" transform="translate(225, 235)">
        <rect x="0" y="0" width="85" height="110" rx="5" class="gsm-node-box" />
        <text x="42" y="16" class="gsm-node-header" text-anchor="middle">EIR (IMEI)</text>
        
        <rect x="6" y="24" width="73" height="80" rx="3" class="gsm-subchip-box" />
        <text x="10" y="38" class="gsm-subchip-title">База IMEI</text>
        <text x="10" y="52" class="gsm-subchip-desc">✔ Белый список</text>
        <text x="10" y="66" class="gsm-subchip-desc">⚠ Серый список</text>
        <text x="10" y="80" class="gsm-subchip-desc">⛔ Чёрный список</text>
        <text x="10" y="96" class="gsm-subchip-desc">Блокировка краж</text>
      </g>

      <!-- Блок SMSC (СМС-Центр в топологии GSM) -->
      <g class="gsm-node-clickable" data-gsm-node="smsc" cursor="pointer" transform="translate(315, 235)">
        <rect x="0" y="0" width="85" height="110" rx="5" class="gsm-node-box smsc-box" />
        <text x="42" y="16" class="gsm-node-header" text-anchor="middle">SMSC (SMS)</text>
        
        <rect x="6" y="24" width="73" height="80" rx="3" class="gsm-subchip-box" />
        <text x="10" y="38" class="gsm-subchip-title">SMS-Центр</text>
        <text x="10" y="52" class="gsm-subchip-desc">• SMS-GMSC / IW</text>
        <text x="10" y="66" class="gsm-subchip-desc">• Store &amp; Forward</text>
        <text x="10" y="80" class="gsm-subchip-desc">• MO/MT-FwdSM</text>
        <text x="10" y="96" class="gsm-subchip-desc">• Опрос HLR (SRI)</text>
      </g>
    </g>

    <!-- ════════════ 4. OSS И ВНЕШНИЕ СЕТИ ════════════ -->
    <g class="gsm-subsystem-group" transform="translate(865, 70)">
      <rect x="0" y="0" width="150" height="360" rx="6" class="gsm-zone-box" />
      <text x="75" y="20" class="gsm-zone-title" text-anchor="middle">OSS &amp; ВНЕШНИЕ СЕТИ</text>

      <!-- OSS / OMC (Центр техобслуживания) -->
      <g class="gsm-node-clickable" data-gsm-node="omc" cursor="pointer" transform="translate(10, 32)">
        <rect x="0" y="0" width="130" height="175" rx="6" class="gsm-node-box omc-box" />
        <text x="65" y="18" class="gsm-node-header" text-anchor="middle">OSS / OMC</text>

        <rect x="8" y="28" width="114" height="135" rx="4" class="gsm-subchip-box" />
        <text x="14" y="44" class="gsm-subchip-title">Центр управления сетью</text>
        <text x="14" y="60" class="gsm-subchip-desc">• Мониторинг аварий (Alarms)</text>
        <text x="14" y="74" class="gsm-subchip-desc">• Конфигурирование сот и BSS</text>
        <text x="14" y="88" class="gsm-subchip-desc">• Сбор метрик KPI и трафика</text>
        <text x="14" y="102" class="gsm-subchip-desc">• Управление безопасностью</text>
        <text x="14" y="122" class="gsm-subchip-desc">NMC (Глобальное ядро)</text>
        <text x="14" y="146" class="gsm-subchip-desc">Контроль всей сети 24/7</text>
      </g>

      <!-- Внешние телефонные сети (PSTN, ISDN, PDN) -->
      <g class="gsm-node-clickable" data-gsm-node="pstn" cursor="pointer" transform="translate(10, 230)">
        <rect x="0" y="0" width="130" height="115" rx="6" class="gsm-node-box" />
        <text x="65" y="18" class="gsm-node-header" text-anchor="middle">ВНЕШНИЕ СЕТИ</text>

        <rect x="8" y="28" width="114" height="78" rx="4" class="gsm-subchip-box" />
        <text x="14" y="44" class="gsm-subchip-title">Проводная телефония</text>
        <text x="14" y="58" class="gsm-subchip-desc">• PSTN (ТфОП сеть)</text>
        <text x="14" y="70" class="gsm-subchip-desc">• ISDN (Цифровая сеть)</text>
        <text x="14" y="82" class="gsm-subchip-desc">• PDN (Сети передачи данных)</text>
        <text x="14" y="96" class="gsm-subchip-desc">• Другие сотовые сети</text>
      </g>

      <!-- Магистраль GMSC ⇄ PSTN -->
      <line x1="-10" y1="285" x2="10" y2="285" class="gsm-wire main-trunk" />
    </g>
  </svg>
  `;
}

// СХЕМА 2: ПРОЦЕДУРА АУТЕНТИФИКАЦИИ И БЕЗОПАСНОСТИ GSM (A3, A8, A5)
function renderGsmAuthSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} 450" class="iso-svg proto-svg" role="img" aria-label="Процедура аутентификации в сети GSM">
    <rect x="10" y="10" width="${WIDTH - 20}" height="430" rx="10" class="main-rack-plate" />
    <rect x="16" y="16" width="${WIDTH - 32}" height="418" rx="8" class="main-rack-inner-border" />

    <text x="30" y="38" class="proto-svg-title">МЕХАНИЗМ АУТЕНТИФИКАЦИИ И ШИФРОВАНИЯ GSM (АЛГОРИТМЫ A3, A8, A5)</text>
    <text x="30" y="54" class="proto-svg-sub">Защита от клонирования SIM и прослушивания радиоэфира Um с использованием триплетов (RAND, SRES, Kc)</text>

    <!-- 4 участника: SIM (MS), BTS, MSC / VLR, HLR / AUC -->
    <g transform="translate(30, 75)">
      <!-- SIM / MS -->
      <rect x="0" y="0" width="180" height="42" rx="5" class="proto-actor-box" />
      <text x="90" y="18" class="proto-actor-title" text-anchor="middle">SIM-КАРТА (MS)</text>
      <text x="90" y="32" class="proto-actor-sub" text-anchor="middle">Ключ Ki · Алгоритмы A3, A8</text>
      <line x1="90" y1="42" x2="90" y2="270" class="lifeline" />

      <!-- BTS -->
      <rect x="240" y="0" width="160" height="42" rx="5" class="proto-actor-box" />
      <text x="320" y="18" class="proto-actor-title" text-anchor="middle">БАЗОВАЯ СТАНЦИЯ (BTS)</text>
      <text x="320" y="32" class="proto-actor-sub" text-anchor="middle">Шифратор A5 радиоэфира</text>
      <line x1="320" y1="42" x2="320" y2="270" class="lifeline" />

      <!-- MSC / VLR -->
      <rect x="460" y="0" width="200" height="42" rx="5" class="proto-actor-box smsc-actor" />
      <text x="560" y="18" class="proto-actor-title" text-anchor="middle">КОММУТАТОР (MSC / VLR)</text>
      <text x="560" y="32" class="proto-actor-sub" text-anchor="middle">Проверка отклика SRES</text>
      <line x1="560" y1="42" x2="560" y2="270" class="lifeline" />

      <!-- HLR / AUC -->
      <rect x="720" y="0" width="230" height="42" rx="5" class="proto-actor-box" />
      <text x="835" y="18" class="proto-actor-title" text-anchor="middle">HLR / AUC (ЦЕНТР БЕЗОПАСНОСТИ)</text>
      <text x="835" y="32" class="proto-actor-sub" text-anchor="middle">Генератор триплетов (RAND, SRES, Kc)</text>
      <line x1="835" y1="42" x2="835" y2="270" class="lifeline" />

      <!-- Шаги сигнального диалога -->
      <!-- Шаг 1: Запрос триплетов в HLR/AUC -->
      <g transform="translate(0, 60)">
        <line x1="560" y1="0" x2="835" y2="0" class="msg-arrow req" />
        <polygon points="833,-4 841,0 833,4" class="arrow-head req" />
        <text x="697" y="-6" class="msg-text req" text-anchor="middle">1. MAP_SEND_AUTHENTICATION_INFO (IMSI)</text>
      </g>

      <!-- Шаг 2: Генерация триплета в AUC и возврат -->
      <g transform="translate(0, 95)">
        <line x1="835" y1="0" x2="560" y2="0" class="msg-arrow resp" />
        <polygon points="562,-4 554,0 562,4" class="arrow-head resp" />
        <text x="697" y="-6" class="msg-text resp" text-anchor="middle">2. Триплет: RAND (128 бит), SRES = A3(RAND,Ki), Kc = A8(RAND,Ki)</text>
      </g>

      <!-- Шаг 3: VLR шлет случайное число RAND на телефон -->
      <g transform="translate(0, 135)">
        <line x1="560" y1="0" x2="90" y2="0" class="msg-arrow req" />
        <polygon points="92,-4 84,0 92,4" class="arrow-head req" />
        <text x="325" y="-6" class="msg-text req" text-anchor="middle">3. Запрос аутентификации: RAND (128 бит) по радиоканалу Um</text>
      </g>

      <!-- Шаг 4: SIM вычисляет SRES и возвращает в VLR -->
      <g transform="translate(0, 175)">
        <line x1="90" y1="0" x2="560" y2="0" class="msg-arrow req" />
        <polygon points="558,-4 566,0 558,4" class="arrow-head req" />
        <text x="325" y="-6" class="msg-text req" text-anchor="middle">4. Ответ SIM: SRES' = A3(RAND, Ki) (32 бита). Ключ Ki не покидает SIM!</text>
      </g>

      <!-- Шаг 5: Проверка VLR и запуск шифрования -->
      <g transform="translate(0, 215)">
        <!-- Проверка в VLR -->
        <rect x="490" y="-12" width="140" height="24" rx="4" class="badge-ok-bg" />
        <text x="560" y="4" class="badge-ok-txt" text-anchor="middle">5. VLR: SRES == SRES' (OK!)</text>

        <!-- Передача Kc на BTS -->
        <line x1="560" y1="24" x2="320" y2="24" class="msg-arrow resp" />
        <polygon points="322,20 314,24 322,28" class="arrow-head resp" />
        <text x="440" y="18" class="msg-text resp" text-anchor="middle">6. Передача ключа Kc на BTS (BSSAP)</text>
      </g>

      <!-- Шаг 6: Запуск потокового шифрования A5 в радиоэфире -->
      <g transform="translate(0, 255)">
        <line x1="320" y1="0" x2="90" y2="0" class="msg-arrow radio" />
        <polygon points="92,-4 84,0 92,4" class="arrow-head radio" />
        <text x="205" y="-6" class="msg-text radio" text-anchor="middle">7. Ciphering Mode Command: Старт шифра A5/1 (Kc)</text>
      </g>
    </g>

    <!-- Нижняя панель: Описание криптоалгоритмов GSM -->
    <g transform="translate(30, 350)">
      <rect x="0" y="0" width="${WIDTH - 60}" height="75" rx="6" class="proto-info-box" />
      <text x="14" y="18" class="proto-info-title">ТРИАДА КРИПТОГРАФИЧЕСКИХ АЛГОРИТМОВ GSM (СПЕЦИФИКАЦИЯ 3GPP):</text>
      
      <g transform="translate(14, 28)">
        <g transform="translate(0, 0)">
          <rect x="0" y="0" width="300" height="38" rx="4" class="pdu-field" />
          <text x="10" y="15" class="pdu-f-name">АЛГОРИТМ A3 (АУТЕНТИФИКАЦИЯ)</text>
          <text x="10" y="28" class="pdu-f-sub">Вычисляет 32-битный отклик SRES = A3(RAND, Ki). Выполняется в SIM и AUC.</text>
        </g>

        <g transform="translate(315, 0)">
          <rect x="0" y="0" width="310" height="38" rx="4" class="pdu-field" />
          <text x="10" y="15" class="pdu-f-name">АЛГОРИТМ A8 (ГЕНЕРАЦИЯ КЛЮЧА ШИФРА)</text>
          <text x="10" y="28" class="pdu-f-sub">Вычисляет 64-битный ключ сессии Kc = A8(RAND, Ki). Выполняется в SIM и AUC.</text>
        </g>

        <g transform="translate(640, 0)">
          <rect x="0" y="0" width="315" height="38" rx="4" class="pdu-field body" />
          <text x="10" y="15" class="pdu-f-name">АЛГОРИТМ A5 (ШИФРОВАНИЕ РАДИОКАНАЛА)</text>
          <text x="10" y="28" class="pdu-f-sub">Потоковый шифр (A5/1, A5/3 Kasumi). Шифрует речь и SMS между MS и BTS.</text>
        </g>
      </g>
    </g>
  </svg>
  `;
}

// СХЕМА 3: МАРШРУТИЗАЦИЯ ВХОДЯЩЕГО ВЫЗОВА И LOCATION UPDATE (MTC CALL FLOW)
function renderGsmRoutingSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} 450" class="iso-svg proto-svg" role="img" aria-label="Маршрутизация вызова в GSM">
    <rect x="10" y="10" width="${WIDTH - 20}" height="430" rx="10" class="main-rack-plate" />
    <rect x="16" y="16" width="${WIDTH - 32}" height="418" rx="8" class="main-rack-inner-border" />

    <text x="30" y="38" class="proto-svg-title">ПРОЦЕСС УСТАНОВЛЕНИЯ ВХОДЯЩЕГО ВЫЗОВА В СЕТИ GSM (MTC CALL FLOW)</text>
    <text x="30" y="54" class="proto-svg-sub">Маршрутизация вызова из фиксированной сети PSTN через GMSC, опрос HLR, выделение MSRN в VLR и вызов MS</text>

    <!-- 6 участников: PSTN, GMSC, HLR, VLR, MSC, MS -->
    <g transform="translate(30, 75)">
      <!-- PSTN -->
      <rect x="0" y="0" width="110" height="38" rx="4" class="proto-actor-box" />
      <text x="55" y="16" class="proto-actor-title" text-anchor="middle">PSTN (ТфОП)</text>
      <text x="55" y="28" class="proto-actor-sub" text-anchor="middle">Внешняя сеть</text>
      <line x1="55" y1="38" x2="55" y2="280" class="lifeline" />

      <!-- GMSC -->
      <rect x="150" y="0" width="130" height="38" rx="4" class="proto-actor-box" />
      <text x="215" y="16" class="proto-actor-title" text-anchor="middle">GMSC (ШЛЮЗ)</text>
      <text x="215" y="28" class="proto-actor-sub" text-anchor="middle">Шлюзовой коммутатор</text>
      <line x1="215" y1="38" x2="215" y2="280" class="lifeline" />

      <!-- HLR -->
      <rect x="320" y="0" width="130" height="38" rx="4" class="proto-actor-box" />
      <text x="385" y="16" class="proto-actor-title" text-anchor="middle">HLR (ДОМАШНИЙ)</text>
      <text x="385" y="28" class="proto-actor-sub" text-anchor="middle">База абонентов</text>
      <line x1="385" y1="38" x2="385" y2="280" class="lifeline" />

      <!-- VLR -->
      <rect x="490" y="0" width="130" height="38" rx="4" class="proto-actor-box smsc-actor" />
      <text x="555" y="16" class="proto-actor-title" text-anchor="middle">VLR (ГОСТЕВОЙ)</text>
      <text x="555" y="28" class="proto-actor-sub" text-anchor="middle">Выделение MSRN</text>
      <line x1="555" y1="38" x2="555" y2="280" class="lifeline" />

      <!-- MSC -->
      <rect x="660" y="0" width="130" height="38" rx="4" class="proto-actor-box" />
      <text x="725" y="16" class="proto-actor-title" text-anchor="middle">ЦЕЛЕВОЙ MSC</text>
      <text x="725" y="28" class="proto-actor-sub" text-anchor="middle">Коммутатор соты</text>
      <line x1="725" y1="38" x2="725" y2="280" class="lifeline" />

      <!-- MS -->
      <rect x="830" y="0" width="120" height="38" rx="4" class="proto-actor-box" />
      <text x="890" y="16" class="proto-actor-title" text-anchor="middle">MS (ТЕЛЕФОН)</text>
      <text x="890" y="28" class="proto-actor-sub" text-anchor="middle">Вызываемый абонент</text>
      <line x1="890" y1="38" x2="890" y2="280" class="lifeline" />

      <!-- Шаги установления вызова -->
      <!-- 1. PSTN ➔ GMSC -->
      <g transform="translate(0, 50)">
        <line x1="55" y1="0" x2="215" y2="0" class="msg-arrow req" />
        <polygon points="213,-4 221,0 213,4" class="arrow-head req" />
        <text x="135" y="-6" class="msg-text req" text-anchor="middle">1. ISUP IAM (номер MSISDN)</text>
      </g>

      <!-- 2. GMSC ➔ HLR -->
      <g transform="translate(0, 85)">
        <line x1="215" y1="0" x2="385" y2="0" class="msg-arrow req" />
        <polygon points="383,-4 391,0 383,4" class="arrow-head req" />
        <text x="300" y="-6" class="msg-text req" text-anchor="middle">2. MAP_SEND_ROUTING_INFO (MSISDN)</text>
      </g>

      <!-- 3. HLR ➔ VLR: Запрос MSRN -->
      <g transform="translate(0, 120)">
        <line x1="385" y1="0" x2="555" y2="0" class="msg-arrow req" />
        <polygon points="553,-4 561,0 553,4" class="arrow-head req" />
        <text x="470" y="-6" class="msg-text req" text-anchor="middle">3. MAP_PROVIDE_ROAMING_NUMBER (IMSI)</text>
      </g>

      <!-- 4. VLR ➔ HLR: Возврат MSRN -->
      <g transform="translate(0, 150)">
        <line x1="555" y1="0" x2="385" y2="0" class="msg-arrow resp" />
        <polygon points="387,-4 379,0 387,4" class="arrow-head resp" />
        <text x="470" y="-6" class="msg-text resp" text-anchor="middle">4. Выделен временный номер роуминга MSRN</text>
      </g>

      <!-- 5. HLR ➔ GMSC: Ответ со значением MSRN -->
      <g transform="translate(0, 180)">
        <line x1="385" y1="0" x2="215" y2="0" class="msg-arrow resp" />
        <polygon points="217,-4 209,0 217,4" class="arrow-head resp" />
        <text x="300" y="-6" class="msg-text resp" text-anchor="middle">5. SRI_ACK (MSRN)</text>
      </g>

      <!-- 6. GMSC ➔ MSC: Маршрутизация вызова -->
      <g transform="translate(0, 215)">
        <line x1="215" y1="0" x2="725" y2="0" class="msg-arrow req" />
        <polygon points="723,-4 731,0 723,4" class="arrow-head req" />
        <text x="470" y="-6" class="msg-text req" text-anchor="middle">6. ISUP IAM (маршрутизация к целевому MSC по номеру MSRN)</text>
      </g>

      <!-- 7. MSC ➔ MS: Пейджинг в Location Area -->
      <g transform="translate(0, 250)">
        <line x1="725" y1="0" x2="890" y2="0" class="msg-arrow radio" />
        <polygon points="888,-4 896,0 888,4" class="arrow-head radio" />
        <text x="807" y="-6" class="msg-text radio" text-anchor="middle">7. Paging (поиск по TMSI в зоне LAI)</text>
      </g>

      <!-- 8. MS ➔ MSC: Ответ на вызов -->
      <g transform="translate(0, 275)">
        <line x1="890" y1="0" x2="725" y2="0" class="msg-arrow radio" />
        <polygon points="727,-4 719,0 727,4" class="arrow-head radio" />
        <text x="807" y="-6" class="msg-text radio" text-anchor="middle">8. Paging Response ➔ Звонок принят!</text>
      </g>
    </g>

    <!-- Нижняя подсказка -->
    <text x="${WIDTH / 2}" y="420" class="proto-info-note ok" text-anchor="middle">
      ✔ Полное соответствие процедуре маршрутизации входящего вызова по стандарту 3GPP TS 23.018 (Basic Call Handling)
    </text>
  </svg>
  `;
}

// ══════════════════════════════════════════════════════════════
// 11. КЛИЕНТСКИЙ ИНТЕРАКТИВНЫЙ СКРИПТ (ТРИ ВКЛАДКИ)
// ══════════════════════════════════════════════════════════════
const live = `
const STATIONS = ${JSON.stringify(STATIONS)};
const OVERHEAD_Y = ${OVERHEAD_Y};
const GSM_NODES_INFO = ${JSON.stringify(GSM_NODES_INFO)};

const stage        = document.querySelector(".iso-stage");
const svgEl        = stage.querySelector("svg");
const packet       = svgEl ? svgEl.querySelector("#active-sms-packet") : null;
const hlrLine      = svgEl ? svgEl.querySelector("#hlr-radar-line") : null;
const dlrLine      = svgEl ? svgEl.querySelector("#dlr-needle-line") : null;
const readout      = document.querySelector("[data-readout]");
const still        = matchMedia("(prefers-reduced-motion: reduce)");

// База данных по 5 узлам СМС-центра (Вкладка 1)
const NODES_INFO = {
  ingress: {
    title: "1. ВХОДНОЙ ШЛЮЗ (INGRESS GATEWAY)",
    sub: "Приём входящего потока, контроль сессий и проверка биллинга",
    protocol: "SMPP v3.4/5.0, SS7 MAP v2/v3, HTTP/REST API",
    action: "Принимает входящие PDU-сообщения от операторов, корпоративных клиентов и абонентов. Контролирует лимиты TPS (Transactions Per Second), проверяет авторизацию и биллинг.",
    details: "• Канал SMPP: Для банков, SMS-агрегаторов и систем одноразовых паролей (OTP).\\n• Канал SS7 MAP (MO-FwdSM): Сообщения от абонентов сотовой сети через базовые станции и MSC.\\n• Канал HTTP REST: Для веб-сервисов, CRM и корпоративных платформ.",
    waypoint: [STATIONS.ingress.x + STATIONS.ingress.w / 2, OVERHEAD_Y],
  },
  router: {
    title: "2. МАРШРУТИЗАТОР И ЗАПРОСЫ HLR (ROUTING CORE)",
    sub: "Антиспам-фильтрация и поиск местоположения абонента в сети",
    protocol: "SS7 MAP (SRI-for-SM: Send Routing Info for Short Message)",
    action: "Анализирует текст и заголовки сообщения на спам и фишинг. Отправляет сигнальный запрос SRI-for-SM в базу данных абонентов HLR/HSS для определения обслуживающего коммутатора MSC/VLR.",
    details: "• Модуль Антиспама: Проверяет текст на стоп-слова, флуд и валидность отправителя (Sender ID).\\n• Радар HLR/HSS: Получает IMSI абонента и текущий адрес MSC или ошибку сети (AbsentSubscriber).",
    waypoint: [STATIONS.router.x + STATIONS.router.w / 2, OVERHEAD_Y],
  },
  buffer: {
    title: "3. НАКОПИТЕЛЬ ОЧЕРЕДЕЙ (STORE & FORWARD QUEUES)",
    sub: "Фирменное ядро SMSC: надежное сохранение и планирование очередей",
    protocol: "Энергонезависимая СУБД очередей с таймерами жизни (TTL)",
    action: "Реализует фундаментальный стандартный принцип Store-and-Forward («Сохрани и перешли»). Гарантирует доставку даже при временной недоступности абонента.",
    details: "• Очередь OTP (Экспресс): Наивысший приоритет, нулевая задержка, короткий TTL (до 2 мин).\\n• Основная FIFO: Стандартный массив абонентского трафика.\\n• Буфер повторов (Retry): Хранилище сообщений для выключенных телефонов до получения сигнала AlertSC от HLR.\\n• Карантин: Изолятор для подозрительного трафика и спама.",
    waypoint: [STATIONS.buffer.x + STATIONS.buffer.w / 2, OVERHEAD_Y],
  },
  egress: {
    title: "4. ПЕРЕДАТЧИК В СЕТЬ (MT-FwdSM TRANSMITTER)",
    sub: "Формирование пакетов MT-FwdSM и отправка на целевой MSC получателя",
    protocol: "SS7 MAP MT-FwdSM / SIGTRAN M3UA / Diameter",
    action: "Упаковывает сообщение в сигнальный PDU-пакет Mobile Terminated Forward Short Message (MT-FwdSM) и направляет его по сигнальной сети на сотовый коммутатор MSC получателя.",
    details: "• Коммутатор MSC передает сообщение через контроллер BSC на базовую станцию (вышку связи).\\n• Телефон абонента принимает SMS и отправляет подтверждение доставки в MSC.",
    waypoint: [STATIONS.egress.x + STATIONS.egress.w / 2, OVERHEAD_Y],
  },
  dlr: {
    title: "5. РЕГИСТРАТОР КВИТАНЦИЙ (DLR ENGINE)",
    sub: "Фиксация статуса доставки и отправка квитанции отправителю",
    protocol: "SMPP DELIVER_SM / DLR Receipts / SS7 Delivery-Ack",
    action: "Принимает отчет о доставке от MSC. Формирует официальную квитанцию DLR (Delivery Receipt) с Message ID и направляет её исходному отправителю (банку по SMPP или абоненту).",
    details: "• DELIVRD (вверху/справа): Успешно доставлено на телефон абонента.\\n• BUFFERD (внизу/справа): Абонент вне сети; SMS буферизовано в SMSC.\\n• EXPIRED (внизу/слева): Истёк срок жизни сообщения (TTL), доставка прекращена.\\n• REJECTD (вверху/слева): Отклонено антиспамом или ошибкой сети.",
    waypoint: [STATIONS.dlr.x + STATIONS.dlr.w / 2, OVERHEAD_Y],
  },
};

// 4 детальных процесса движения SMS (конверт движется НАД блоками)
const SCENARIOS = [
  {
    id: "mo_mt",
    name: "1. Абонентское SMS (MO-MT)",
    desc: "Классическая доставка от одного сотового абонента другому через сеть ОКС-7 / SS7 MAP",
    steps: [
      {
        node: "ingress",
        pos: [STATIONS.ingress.x + STATIONS.ingress.w / 2, OVERHEAD_Y],
        radarAngle: 0.4, dlrAngle: -0.6,
        text: "⬤ Шаг 1/4 [Шлюз приёма]: SMS принято от базовой станции отправителя через канал SS7 MAP (пакет MO-FwdSM).",
      },
      {
        node: "router",
        pos: [STATIONS.router.x + STATIONS.router.w / 2, OVERHEAD_Y],
        radarAngle: 1.2, dlrAngle: -0.6,
        text: "⬤ Шаг 2/4 [Маршрутизатор]: Антиспам пройден. Выполнен сигнальный запрос HLR (SRI-for-SM), получен адрес MSC получателя.",
      },
      {
        node: "buffer",
        pos: [STATIONS.buffer.x + STATIONS.buffer.w / 2, OVERHEAD_Y],
        radarAngle: 1.2, dlrAngle: -0.6,
        text: "⬤ Шаг 3/4 [Буфер Store-and-Forward]: Сохранено в основной очереди FIFO с присвоением уникального Message ID.",
      },
      {
        node: "egress",
        pos: [STATIONS.egress.x + STATIONS.egress.w / 2, OVERHEAD_Y],
        radarAngle: 1.2, dlrAngle: -0.6,
        text: "⬤ Шаг 4/4 [Передатчик & DLR]: Отправлен пакет MT-FwdSM на MSC получателя. Доставлено на телефон! Квитанция: DELIVRD.",
      },
    ],
  },
  {
    id: "otp",
    name: "2. Банковский OTP (SMPP)",
    desc: "Экспресс-доставка одноразового пароля от банковского сервера с наивысшим приоритетом",
    steps: [
      {
        node: "ingress",
        pos: [STATIONS.ingress.x + STATIONS.ingress.w / 2, OVERHEAD_Y],
        radarAngle: 0.8, dlrAngle: -0.6,
        text: "⬤ Шаг 1/4 [Шлюз приёма]: Банк передал OTP через канал SMPP (команда SUBMIT_SM) с флагом наивысшего приоритета.",
      },
      {
        node: "router",
        pos: [STATIONS.router.x + STATIONS.router.w / 2, OVERHEAD_Y],
        radarAngle: 1.8, dlrAngle: -0.6,
        text: "⬤ Шаг 2/4 [Маршрутизатор]: Экспресс-маршрутизация без очередей. Мгновенный запрос HLR (SRI-for-SM).",
      },
      {
        node: "buffer",
        pos: [STATIONS.buffer.x + STATIONS.buffer.w / 2, OVERHEAD_Y],
        radarAngle: 1.8, dlrAngle: -0.6,
        text: "⬤ Шаг 3/4 [Буфер Store-and-Forward]: Помещение на экспресс-полку OTP (TTL = 120 сек, приоритетный выход).",
      },
      {
        node: "egress",
        pos: [STATIONS.egress.x + STATIONS.egress.w / 2, OVERHEAD_Y],
        radarAngle: 1.8, dlrAngle: -0.6,
        text: "⬤ Шаг 4/4 [Передатчик & DLR]: Прямая отправка MT-FwdSM на базовую станцию. Вручено абоненту за 80 мс! DLR: DELIVRD.",
      },
    ],
  },
  {
    id: "offline",
    name: "3. Абонент вне сети (Store-and-Forward)",
    desc: "Буферизация сообщения при выключенном телефоне и автоматическая доставка при появлении в сети",
    steps: [
      {
        node: "ingress",
        pos: [STATIONS.ingress.x + STATIONS.ingress.w / 2, OVERHEAD_Y],
        radarAngle: 0.4, dlrAngle: 0.6,
        text: "⬤ Шаг 1/4 [Шлюз приёма]: Входящее сообщение от абонента принято через канал SS7 MAP.",
      },
      {
        node: "router",
        pos: [STATIONS.router.x + STATIONS.router.w / 2, OVERHEAD_Y],
        radarAngle: 2.4, dlrAngle: 0.6,
        text: "⬤ Шаг 2/4 [Маршрутизатор]: Запрос HLR вернул статус «Абонент недоступен» (AbsentSubscriber).",
      },
      {
        node: "buffer",
        pos: [STATIONS.buffer.x + STATIONS.buffer.w / 2, OVERHEAD_Y],
        radarAngle: 2.4, dlrAngle: 0.6,
        text: "⬤ Шаг 3/4 [Буфер Store-and-Forward]: SMS сохранено в накопителе Retry. Статус DLR: BUFFERD. Ожидание сигнала сети AlertSC.",
      },
      {
        node: "egress",
        pos: [STATIONS.egress.x + STATIONS.egress.w / 2, OVERHEAD_Y],
        radarAngle: 2.4, dlrAngle: -0.6,
        text: "⬤ Шаг 4/4 [Передатчик]: Абонент включил телефон! Сеть прислала AlertSC, SMS отправлено через MT-FwdSM. DLR: DELIVRD.",
      },
    ],
  },
  {
    id: "antispam",
    name: "4. Блокировка спама",
    desc: "Обнаружение подозрительного трафика, изоляция в карантин и отказ в доставке",
    steps: [
      {
        node: "ingress",
        pos: [STATIONS.ingress.x + STATIONS.ingress.w / 2, OVERHEAD_Y],
        radarAngle: 4.2, dlrAngle: -2.4,
        text: "⬤ Шаг 1/4 [Шлюз приёма]: Массовый подозрительный трафик поступил через внешний канал HTTP API.",
      },
      {
        node: "router",
        pos: [STATIONS.router.x + STATIONS.router.w / 2, OVERHEAD_Y],
        radarAngle: 4.2, dlrAngle: -2.4,
        text: "⬤ Шаг 2/4 [Маршрутизатор]: Сработал модуль Антиспама: обнаружен запрещенный контент и превышение лимита TPS.",
      },
      {
        node: "buffer",
        pos: [STATIONS.buffer.x + STATIONS.buffer.w / 2, OVERHEAD_Y],
        radarAngle: 4.2, dlrAngle: -2.4,
        text: "⬤ Шаг 3/4 [Буфер Store-and-Forward]: Сообщение изолировано в отсеке «Карантин». Доставка заблокирована.",
      },
      {
        node: "dlr",
        pos: [STATIONS.dlr.x + STATIONS.dlr.w / 2, OVERHEAD_Y],
        radarAngle: 4.2, dlrAngle: -2.4,
        text: "⬤ Шаг 4/4 [Регистратор DLR]: Передача в сеть отменена. Сформирована квитанция DLR: REJECTD (запрет отправки).",
      },
    ],
  },
];

// Данные по протоколам для Вкладки 2
const PROTO_DETAILS = {
  smpp: {
    title: "ПРОТОКОЛ SMPP (Short Message Peer-to-Peer v3.4 / v5.0)",
    spec: "Спецификация: SMPP Developers Forum / SMS Forum · Порт TCP: 2775 (нешифрованный) / 3550 (TLS)",
    role: "Основной отраслевой протокол взаимодействия внешних систем (ESME: банков, шлюзов, CRM) с СМС-Центром.",
    points: [
      "• <strong>Синхронный и асинхронный режимы:</strong> Поддержка скользящего окна (Sliding Window) с пропускной способностью до 10 000+ SMS/сек на соединение.",
      "• <strong>16-байтный бинарный заголовок:</strong> Длина команды, ID команды (SUBMIT_SM = 0x04, DELIVER_SM = 0x05), статус ошибки и порядковый номер.",
      "• <strong>Квитанции о доставке (DLR):</strong> SMSC асинхронно отправляет пакет DELIVER_SM клиенту при смене статуса (DELIVRD, EXPIRED, UNDELIV).",
      "• <strong>Keepalive (Контроль линка):</strong> Пакеты ENQUIRE_LINK отправляются каждые 30–60 сек для контроля целостности сокета.",
    ],
  },
  ss7: {
    title: "ПРОТОКОЛ SS7 / ОКС-7 (MAP — Mobile Application Part)",
    spec: "Стандарты: 3GPP TS 29.002, ITU-T Q.771-Q.775 · Архитектура: Сигнальная сеть ОКС-7",
    role: "Главный сигнальный протокол взаимодействия компонентов сотовой сети GSM/UMTS/LTE (SMSC, HLR, MSC, VLR).",
    points: [
      "• <strong>Двухфазная маршрутизация:</strong> Сначала SMSC запрашивает HLR по команде <code>MAP_SEND_ROUTING_INFO_FOR_SM</code>, узнает IMSI и адрес MSC, затем шлет <code>MAP_MT_FORWARD_SHORT_MESSAGE</code>.",
      "• <strong>Глобальная адресация (Global Title):</strong> Маршрутизация на уровне SCCP осуществляется по международным телефонным номерам (E.164 GT).",
      "• <strong>Механизм AlertSC (Store & Forward):</strong> Если абонент выключен, HLR ставит флаг MWD (Message Waiting Data) и шлет сигнал <code>MAP_ALERT_SERVICE_CENTRE</code> сразу при включении телефона.",
      "• <strong>Транзакционный уровень TCAP:</strong> Обеспечивает безопасный сессионный обмен командами между коммутаторами.",
    ],
  },
  sigtran: {
    title: "ПРОТОКОЛ SIGTRAN (SS7 поверх сетей IP: SCTP + M3UA)",
    spec: "Стандарты: RFC 4666 (M3UA), RFC 4960 (SCTP), 3GPP TS 29.202",
    role: "Современный стандарт миграции сигнализации SS7 в скоростные пакетные IP-сети операторов.",
    points: [
      "• <strong>Multi-homing (Мультихоминг SCTP):</strong> Каждая ассоциация имеет несколько резервных IP-путей (Primary / Secondary) для мгновенного переключения при аварии.",
      "• <strong>Multi-streaming (Многопоточность):</strong> Устранение блокировки Head-of-Line — задержка доставки одного длинного SMS не замедляет остальные сообщения.",
      "• <strong>Адаптационный уровень M3UA:</strong> Позволяет протоколу SCCP и MAP прозрачно работать поверх IP без модификации прикладной логики СМС-центра.",
      "• <strong>Шлюз сигнализации SGW:</strong> Обеспечивает стык между устаревшими TDM-линиями E1 базовых станций и современным IP-ядром SMSC.",
    ],
  },
};

let currentMainTab = "arch"; // "arch" | "proto" | "gsm"
let currentProto = "smpp";  // "smpp" | "ss7" | "sigtran"
let currentGsmView = "topology"; // "topology" | "auth" | "routing"
let selectedGsmNode = "ms";
let appMode = "process";    // "process" | "node"
let curScenario = 0;
let curStep = 0;
let selectedNode = null;
let isPlaying = true;
let curPos = [...SCENARIOS[0].steps[0].pos];
let curDlrAngle = -0.6, curRadarAngle = 0.4;
let frame = 0, last = 0, clock = 0, visible = true;

function updateNeedles(dlrA, radarA) {
  if (!hlrLine || !dlrLine) return;
  // Стрелка HLR
  const rCX = STATIONS.router.x + STATIONS.router.w / 2;
  const rCY = STATIONS.router.y + 172;
  const rLen = 24;
  hlrLine.setAttribute("x2", (rCX + Math.cos(radarA) * rLen).toFixed(1));
  hlrLine.setAttribute("y2", (rCY + Math.sin(radarA) * rLen).toFixed(1));

  // Стрелка DLR
  const dCX = STATIONS.dlr.x + STATIONS.dlr.w / 2;
  const dCY = STATIONS.dlr.y + 116;
  const dLen = 28;
  dlrLine.setAttribute("x2", (dCX + Math.cos(dlrA) * dLen).toFixed(1));
  dlrLine.setAttribute("y2", (dCY + Math.sin(dlrA) * dLen).toFixed(1));
}

function updateNodeHighlights(activeNode) {
  if (!svgEl) return;
  svgEl.querySelectorAll(".block-25d-group").forEach((grp) => {
    const node = grp.getAttribute("data-node");
    if (!activeNode) {
      grp.style.opacity = "1";
      grp.style.filter = "none";
    } else if (node === activeNode) {
      grp.style.opacity = "1";
      grp.style.filter = "drop-shadow(0 0 12px rgba(255,255,255,0.8))";
    } else {
      grp.style.opacity = "0.7";
      grp.style.filter = "none";
    }
  });

  // Подсветка узловых точек на верхней рельсе
  svgEl.querySelectorAll(".overhead-stop").forEach((stp) => {
    const stpNode = stp.getAttribute("data-stop");
    stp.classList.toggle("active", stpNode === activeNode);
  });
}

function renderUI() {
  if (currentMainTab === "arch") {
    const scen = SCENARIOS[curScenario];
    const stepObj = scen.steps[curStep];

    document.querySelectorAll("[data-scen-btn]").forEach((btn, i) => {
      btn.setAttribute("aria-selected", (appMode === "process" && i === curScenario) ? "true" : "false");
    });

    document.querySelectorAll("[data-node-btn]").forEach((btn) => {
      const n = btn.getAttribute("data-node-btn");
      btn.setAttribute("aria-selected", (appMode === "node" && n === selectedNode) ? "true" : "false");
    });

    const modeBadge = document.querySelector("#mode-badge");
    if (modeBadge) {
      modeBadge.textContent = appMode === "process" ? "РЕЖИМ ПРОЦЕССА" : "РЕЖИМ ВЫДЕЛЕНИЯ УЗЛА";
    }

    const card = document.querySelector("#inspect-card");
    if (card) {
      if (appMode === "node" && selectedNode && NODES_INFO[selectedNode]) {
        const info = NODES_INFO[selectedNode];
        card.innerHTML = \`
          <div class="smsc-card-header">
            <div class="smsc-card-title">\${info.title}</div>
            <div class="smsc-card-sub">\${info.sub}</div>
          </div>
          <div class="smsc-card-body">
            <div class="smsc-param"><strong>Протоколы:</strong> <code>\${info.protocol}</code></div>
            <div class="smsc-param"><strong>Функция:</strong> \${info.action}</div>
            <div class="smsc-param-details">\${info.details.replace(/\\\\n/g, "<br>")}</div>
          </div>
        \`;
        updateNodeHighlights(selectedNode);
        if (readout) readout.textContent = "Узел: " + info.title.split("(")[0].trim();
      } else {
        card.innerHTML = \`
          <div class="smsc-card-header">
            <div class="smsc-card-title">\${scen.name}</div>
            <div class="smsc-card-sub">\${scen.desc}</div>
          </div>
          <div class="smsc-card-body">
            <div class="smsc-steps-bar">
              \${scen.steps.map((s, idx) => \`
                <button type="button" class="smsc-step-pill \${idx === curStep ? "active" : ""}" onclick="window.__gotoStep(\${idx})">
                  Шаг \${idx + 1}
                </button>
              \`).join("")}
            </div>
            <div class="smsc-step-text">\${stepObj.text}</div>
          </div>
        \`;
        updateNodeHighlights(stepObj.node);
        if (readout) readout.textContent = "Фаза " + (curStep + 1) + "/4 · " + stepObj.node.toUpperCase();
      }
    }

    const playBtn = document.querySelector("#play-pause-btn");
    if (playBtn) playBtn.textContent = isPlaying ? "⏸ Пауза" : "▶ Воспроизведение";
  } else if (currentMainTab === "proto") {
    // Вкладка 2: протоколы
    document.querySelectorAll("[data-proto-btn]").forEach((btn) => {
      const p = btn.getAttribute("data-proto-btn");
      btn.setAttribute("aria-selected", p === currentProto ? "true" : "false");
    });

    document.querySelectorAll(".proto-view-panel").forEach((pnl) => {
      pnl.style.display = pnl.id === "panel-" + currentProto ? "block" : "none";
    });

    const info = PROTO_DETAILS[currentProto];
    const protoCard = document.querySelector("#proto-info-card");
    if (protoCard && info) {
      protoCard.innerHTML = \`
        <div class="smsc-card-header">
          <div class="smsc-card-title">\${info.title}</div>
          <div class="smsc-card-sub">\${info.spec}</div>
        </div>
        <div class="smsc-card-body">
          <div class="smsc-param"><strong>Назначение:</strong> \${info.role}</div>
          <div class="smsc-param-details" style="margin-top:8px">
            \${info.points.join("<br>")}
          </div>
        </div>
      \`;
    }
    if (readout) readout.textContent = "Протокол: " + currentProto.toUpperCase();
  } else if (currentMainTab === "gsm") {
    // Вкладка 3: топология сети GSM (МГУ АСВК)
    document.querySelectorAll("[data-gsm-view-btn]").forEach((btn) => {
      const v = btn.getAttribute("data-gsm-view-btn");
      btn.setAttribute("aria-selected", v === currentGsmView ? "true" : "false");
    });

    document.querySelectorAll("[data-gsm-btn]").forEach((btn) => {
      const n = btn.getAttribute("data-gsm-btn");
      btn.setAttribute("aria-selected", n === selectedGsmNode ? "true" : "false");
    });

    document.querySelectorAll(".gsm-view-panel").forEach((pnl) => {
      pnl.style.display = pnl.id === "panel-gsm-" + currentGsmView ? "block" : "none";
    });

    // Подсветка кликнутого узла на схеме топологии GSM
    if (currentGsmView === "topology") {
      document.querySelectorAll(".gsm-node-clickable").forEach((nodeEl) => {
        const nid = nodeEl.getAttribute("data-gsm-node");
        const box = nodeEl.querySelector(".gsm-node-box");
        if (box) {
          if (nid === selectedGsmNode) {
            box.style.stroke = "var(--anatomy-lit)";
            box.style.strokeWidth = "2px";
            box.style.filter = "drop-shadow(0 0 10px rgba(255,255,255,0.7))";
          } else {
            box.style.stroke = "var(--anatomy-mid)";
            box.style.strokeWidth = "1px";
            box.style.filter = "none";
          }
        }
      });
    }

    const gsmCard = document.querySelector("#gsm-info-card");
    if (gsmCard) {
      if (currentGsmView === "topology") {
        const info = GSM_NODES_INFO[selectedGsmNode] || GSM_NODES_INFO["ms"];
        gsmCard.innerHTML = \`
          <div class="smsc-card-header">
            <div class="smsc-card-title">\${info.title}</div>
            <div class="smsc-card-sub">\${info.sub}</div>
          </div>
          <div class="smsc-card-body">
            <div class="smsc-param"><strong>Стандартные интерфейсы:</strong> <code>\${info.interfaces}</code></div>
            <div class="smsc-param"><strong>Назначение и роль в GSM:</strong> \${info.role}</div>
            <div class="smsc-param-details" style="margin-top:8px">
              \${info.details.join("<br>")}
            </div>
          </div>
        \`;
        if (readout) readout.textContent = "Узел GSM: " + selectedGsmNode.toUpperCase();
      } else if (currentGsmView === "auth") {
        gsmCard.innerHTML = \`
          <div class="smsc-card-header">
            <div class="smsc-card-title">ПРОЦЕДУРА АУТЕНТИФИКАЦИИ И ШИФРОВАНИЯ В СЕТИ GSM (АЛГОРИТМЫ A3, A8, A5)</div>
            <div class="smsc-card-sub">Спецификация 3GPP TS 43.020 / GSM 03.20 · Безопасность и криптозащита</div>
          </div>
          <div class="smsc-card-body">
            <div class="smsc-param"><strong>Механизм «Запрос-Ответ» (Challenge-Response):</strong> Секретный 128-битный ключ абонента Ki хранится только на SIM-карте и в крипто-центре AUC сети. Он никогда не передается по радиоэфиру.</div>
            <div class="smsc-param-details" style="margin-top:8px">
              • <strong>1. AUC генерирует триплет безопасности:</strong> Случайное число RAND (128 бит) ➔ вычисление отклика SRES (32 бита, алгоритм A3) ➔ сессионного ключа шифрования Kc (64 бита, алгоритм A8).<br>
              • <strong>2. VLR запрашивает аутентификацию:</strong> VLR получает готовый триплет (RAND, SRES, Kc) из HLR/AUC и отправляет на телефон только число RAND через базовую станцию (BTS).<br>
              • <strong>3. SIM-карта выполняет A3 и A8:</strong> Используя встроенный ключ Ki, SIM вычисляет SRES' и Kc'. Телефон передает SRES' обратно в VLR по радиоканалу.<br>
              • <strong>4. Сравнение в VLR:</strong> Если SRES == SRES', аутентификация успешна. Сессионный ключ Kc загружается в аппаратный шифратор потока A5 (A5/1 или A5/3) на MS и BTS для скремблирования радиосигнала.
            </div>
          </div>
        \`;
        if (readout) readout.textContent = "Безопасность: A3 / A8 / A5";
      } else if (currentGsmView === "routing") {
        gsmCard.innerHTML = \`
          <div class="smsc-card-header">
            <div class="smsc-card-title">МАРШРУТИЗАЦИЯ ВХОДЯЩЕГО ВЫЗОВА В СЕТИ GSM (MTC — MOBILE TERMINATED CALL)</div>
            <div class="smsc-card-sub">Спецификация 3GPP TS 23.018 · Выделение временного маршрутного номера MSRN</div>
          </div>
          <div class="smsc-card-body">
            <div class="smsc-param"><strong>Ключевая задача:</strong> Доставить вызов абоненту, свободно перемещающемуся между сотами и региональными коммутаторами MSC/VLR.</div>
            <div class="smsc-param-details" style="margin-top:8px">
              • <strong>1. Входящий звонок:</strong> Сеть фиксированной связи PSTN/ТфОП направляет вызов ISUP IAM на входной шлюз сотового оператора — GMSC.<br>
              • <strong>2. Запрос маршрута:</strong> GMSC по протоколу MAP посылает запрос SRI (Send Routing Info) в домашний регистр HLR по номеру MSISDN.<br>
              • <strong>3-4. Выделение номера MSRN:</strong> HLR обращается в текущий гостевой регистр VLR, где сейчас находится абонент (Provide Roaming Number). VLR временно резервирует внутренний номер маршрутизации MSRN (Mobile Station Roaming Number) из пула и возвращает его в HLR, а тот — в GMSC.<br>
              • <strong>5-6. Коммутация транка:</strong> GMSC проключает разговорный тракт ISUP IAM напрямую к целевому MSC по временному адресу MSRN.<br>
              • <strong>7-8. Пейджинг и ответ:</strong> Целевой MSC запускает поиск абонента Paging в зоне местоположения LAI. Телефон откликается (Paging Response), выделяется речевой канал TCH, звонок звенит!
            </div>
          </div>
        \`;
        if (readout) readout.textContent = "Маршрутизация: MTC / MSRN";
      }
    }
  }
}

function draw() {
  if (packet) {
    packet.setAttribute("transform", "translate(" + curPos[0].toFixed(1) + ", " + curPos[1].toFixed(1) + ")");
  }
  updateNeedles(curDlrAngle, curRadarAngle);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;

  if (currentMainTab === "arch") {
    if (isPlaying && appMode === "process") {
      clock += dt;
      const stepDuration = 2.4;
      const scenDuration = stepDuration * 4;
      const totalClock = clock % (scenDuration * SCENARIOS.length);
      const targetScen = Math.floor(totalClock / scenDuration);
      const targetStep = Math.floor((totalClock % scenDuration) / stepDuration);

      if (targetScen !== curScenario || targetStep !== curStep) {
        curScenario = targetScen;
        curStep = targetStep;
        renderUI();
      }
    }

    let targetPos, targetDlr, targetRadar;
    if (appMode === "node" && selectedNode && NODES_INFO[selectedNode]) {
      targetPos = NODES_INFO[selectedNode].waypoint;
      targetDlr = selectedNode === "dlr" ? 0.6 : -0.6;
      targetRadar = selectedNode === "router" ? 1.6 : 0.4;
    } else {
      const stepObj = SCENARIOS[curScenario].steps[curStep];
      targetPos = stepObj.pos;
      targetDlr = stepObj.dlrAngle;
      targetRadar = stepObj.radarAngle;
    }

    const ease = calm ? 1 : 1 - Math.exp(-dt / 0.22);
    curPos[0] += (targetPos[0] - curPos[0]) * ease;
    curPos[1] += (targetPos[1] - curPos[1]) * ease;
    curDlrAngle += (targetDlr - curDlrAngle) * ease;
    curRadarAngle += (targetRadar - curRadarAngle) * ease;

    draw();
  }

  frame = visible ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };

window.__switchMainTab = (tabId) => {
  currentMainTab = tabId;
  document.querySelectorAll(".smsc-main-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.getAttribute("data-tab") === tabId);
  });
  const tabArch = document.querySelector("#tab-content-arch");
  const tabProto = document.querySelector("#tab-content-proto");
  const tabGsm = document.querySelector("#tab-content-gsm");
  if (tabArch) tabArch.style.display = tabId === "arch" ? "block" : "none";
  if (tabProto) tabProto.style.display = tabId === "proto" ? "block" : "none";
  if (tabGsm) tabGsm.style.display = tabId === "gsm" ? "block" : "none";
  renderUI();
  if (tabId === "arch") run();
};

window.__switchProto = (protoId) => {
  currentProto = protoId;
  renderUI();
};

window.__switchGsmView = (viewId) => {
  currentGsmView = viewId;
  renderUI();
};

window.__selectGsmNode = (nodeId) => {
  selectedGsmNode = nodeId;
  renderUI();
};

window.__selectScenario = (i) => {
  appMode = "process";
  curScenario = i;
  curStep = 0;
  clock = i * 9.6;
  renderUI();
  run();
};

window.__selectNode = (nodeId) => {
  appMode = "node";
  selectedNode = nodeId;
  isPlaying = false;
  renderUI();
  run();
};

window.__gotoStep = (s) => {
  appMode = "process";
  curStep = s;
  isPlaying = false;
  clock = curScenario * 9.6 + s * 2.4;
  renderUI();
  run();
};

window.__stepBack = () => {
  appMode = "process";
  isPlaying = false;
  if (curStep > 0) curStep--;
  else if (curScenario > 0) { curScenario--; curStep = 3; }
  else { curScenario = SCENARIOS.length - 1; curStep = 3; }
  clock = curScenario * 9.6 + curStep * 2.4;
  renderUI();
  run();
};

window.__stepForward = () => {
  appMode = "process";
  isPlaying = false;
  if (curStep < 3) curStep++;
  else if (curScenario < SCENARIOS.length - 1) { curScenario++; curStep = 0; }
  else { curScenario = 0; curStep = 0; }
  clock = curScenario * 9.6 + curStep * 2.4;
  renderUI();
  run();
};

window.__togglePlay = () => {
  if (appMode === "node") appMode = "process";
  isPlaying = !isPlaying;
  renderUI();
  run();
};

window.__toggleTheme = () => {
  const next = document.body.getAttribute("data-theme") === "light" ? "dark" : "light";
  document.body.setAttribute("data-theme", next);
};

// Интерактивный клик прямо по блокам 2.5D схемы
if (svgEl) {
  svgEl.querySelectorAll(".block-25d-group").forEach((grp) => {
    grp.addEventListener("click", (e) => {
      e.stopPropagation();
      const node = grp.getAttribute("data-node");
      window.__selectNode(node);
    });
  });
}

// Интерактивный клик по блокам топологии GSM
document.querySelectorAll(".gsm-node-clickable").forEach((grp) => {
  grp.addEventListener("click", (e) => {
    e.stopPropagation();
    const gNode = grp.getAttribute("data-gsm-node");
    if (gNode) window.__selectGsmNode(gNode);
  });
});

if (stage) {
  new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
}

renderUI();
draw();
run();
`;

// ══════════════════════════════════════════════════════════════
// 12. HTML-ОБЁРТКА И ВЕРСТКА ДВУХ ВКЛАДОК
// ══════════════════════════════════════════════════════════════
const controlsHtml = `
<div class="smsc-app">
  <!-- ВЕРХНИЕ ГЛАВНЫЕ ВКЛАДКИ (ТРЕБОВАНИЕ ПОЛЬЗОВАТЕЛЯ №3) -->
  <div class="smsc-main-nav">
    <div class="smsc-tab-bar">
      <button type="button" class="smsc-main-tab active" data-tab="arch" onclick="window.__switchMainTab('arch')">
        <span class="tab-badge">Вкладка 1</span>
        <span class="tab-title">Архитектура и процессы SMSC</span>
      </button>
      <button type="button" class="smsc-main-tab" data-tab="proto" onclick="window.__switchMainTab('proto')">
        <span class="tab-badge">Вкладка 2</span>
        <span class="tab-title">Схемы протоколов SMPP, SS7, SIGTRAN</span>
      </button>
      <button type="button" class="smsc-main-tab" data-tab="gsm" onclick="window.__switchMainTab('gsm')">
        <span class="tab-badge">Вкладка 3</span>
        <span class="tab-title">Топология сети GSM</span>
      </button>
    </div>
    <button type="button" class="smsc-btn smsc-theme-btn" onclick="window.__toggleTheme()" title="Переключить тему оформления">🌓 Тема</button>
  </div>

  <!-- ════════════ СОДЕРЖИМОЕ ВКЛАДКИ 1 ════════════ -->
  <div id="tab-content-arch" class="tab-content-section" style="display:block;">
    <div class="smsc-topbar">
      <div class="smsc-modes">
        <span class="smsc-badge" id="mode-badge">РЕЖИМ ПРОЦЕССА</span>
        <span class="smsc-mode-label">Функциональная схема СМС-центра и технологические сценарии:</span>
      </div>
    </div>

    <div class="smsc-panel-row">
      <!-- Секция 1: Выбор процессов -->
      <div class="smsc-section">
        <div class="smsc-section-title">⚡ Технологические сценарии движения SMS:</div>
        <div class="smsc-buttons-group">
          <button type="button" class="smsc-btn" data-scen-btn onclick="window.__selectScenario(0)" aria-selected="true">1. MO-MT SMS (ОКС-7)</button>
          <button type="button" class="smsc-btn" data-scen-btn onclick="window.__selectScenario(1)" aria-selected="false">2. Банковский OTP (SMPP)</button>
          <button type="button" class="smsc-btn" data-scen-btn onclick="window.__selectScenario(2)" aria-selected="false">3. Абонент вне сети (S&amp;F)</button>
          <button type="button" class="smsc-btn" data-scen-btn onclick="window.__selectScenario(3)" aria-selected="false">4. Спам-атака и блокировка</button>
        </div>
      </div>

      <!-- Секция 2: Выделение узлов -->
      <div class="smsc-section">
        <div class="smsc-section-title">🔍 Выделение и анализ отдельных блоков:</div>
        <div class="smsc-buttons-group">
          <button type="button" class="smsc-btn smsc-node-btn" data-node-btn="ingress" onclick="window.__selectNode('ingress')" aria-selected="false">① Шлюз приёма</button>
          <button type="button" class="smsc-btn smsc-node-btn" data-node-btn="router" onclick="window.__selectNode('router')" aria-selected="false">② Маршрутизатор HLR</button>
          <button type="button" class="smsc-btn smsc-node-btn" data-node-btn="buffer" onclick="window.__selectNode('buffer')" aria-selected="false">③ Буфер Store &amp; Forward</button>
          <button type="button" class="smsc-btn smsc-node-btn" data-node-btn="egress" onclick="window.__selectNode('egress')" aria-selected="false">④ Передатчик MT к MSC</button>
          <button type="button" class="smsc-btn smsc-node-btn" data-node-btn="dlr" onclick="window.__selectNode('dlr')" aria-selected="false">⑤ Регистратор DLR</button>
        </div>
      </div>
    </div>

    <!-- Карточка текущего шага / выбранного узла -->
    <div class="smsc-inspect-card" id="inspect-card"></div>

    <!-- Пошаговое управление процессом -->
    <div class="smsc-timeline-bar">
      <button type="button" class="smsc-btn smsc-nav-btn" onclick="window.__stepBack()">⏮ Предыдущий шаг</button>
      <button type="button" class="smsc-btn smsc-nav-btn smsc-primary-btn" id="play-pause-btn" onclick="window.__togglePlay()">⏸ Пауза</button>
      <button type="button" class="smsc-btn smsc-nav-btn" onclick="window.__stepForward()">Следующий шаг ⏭</button>
    </div>

    <!-- Сама 2.5D схема СМС-центра -->
    <div class="iso-stage smsc-diagram-wrapper" tabindex="0" role="region" aria-label="Интерактивная 2.5D схема СМС-центра">
      ${renderArchitectureSvg()}
    </div>
  </div>

  <!-- ════════════ СОДЕРЖИМОЕ ВКЛАДКИ 2 (ПРОТОКОЛЫ SMPP, SS7, SIGTRAN) ════════════ -->
  <div id="tab-content-proto" class="tab-content-section" style="display:none;">
    <div class="smsc-proto-toolbar">
      <div class="smsc-proto-nav">
        <span class="smsc-section-title" style="margin-right:10px">Выберите протокол:</span>
        <button type="button" class="smsc-btn proto-select-btn" data-proto-btn="smpp" onclick="window.__switchProto('smpp')" aria-selected="true">
          ⚡ SMPP (Шлюз приложений)
        </button>
        <button type="button" class="smsc-btn proto-select-btn" data-proto-btn="ss7" onclick="window.__switchProto('ss7')" aria-selected="false">
          📡 SS7 MAP (Сигнализация ОКС-7)
        </button>
        <button type="button" class="smsc-btn proto-select-btn" data-proto-btn="sigtran" onclick="window.__switchProto('sigtran')" aria-selected="false">
          🌐 SIGTRAN (SS7 поверх сетей IP)
        </button>
      </div>
    </div>

    <!-- Карточка описания протокола -->
    <div class="smsc-inspect-card" id="proto-info-card"></div>

    <!-- 3 интерактивные векторные схемы протоколов -->
    <div id="panel-smpp" class="proto-view-panel" style="display:block;">
      ${renderSmppSvg()}
    </div>
    <div id="panel-ss7" class="proto-view-panel" style="display:none;">
      ${renderSs7Svg()}
    </div>
    <div id="panel-sigtran" class="proto-view-panel" style="display:none;">
      ${renderSigtranSvg()}
    </div>
  </div>

  <!-- ════════════ СОДЕРЖИМОЕ ВКЛАДКИ 3 (ТОПОЛОГИЯ СЕТИ GSM) ════════════ -->
  <div id="tab-content-gsm" class="tab-content-section" style="display:none;">
    <div class="smsc-proto-toolbar">
      <div class="smsc-proto-nav">
        <span class="smsc-section-title" style="margin-right:10px">Режим отображения GSM:</span>
        <button type="button" class="smsc-btn gsm-view-btn" data-gsm-view-btn="topology" onclick="window.__switchGsmView('topology')" aria-selected="true">
          🏛 Полная топология (MS · BSS · NSS · OSS)
        </button>
        <button type="button" class="smsc-btn gsm-view-btn" data-gsm-view-btn="auth" onclick="window.__switchGsmView('auth')" aria-selected="false">
          🔐 Безопасность и триплеты (A3, A8, A5)
        </button>
        <button type="button" class="smsc-btn gsm-view-btn" data-gsm-view-btn="routing" onclick="window.__switchGsmView('routing')" aria-selected="false">
          📞 Маршрутизация вызова (MTC / MSRN)
        </button>
      </div>
    </div>

    <!-- Быстрый выбор узлов GSM для инспекции -->
    <div class="smsc-section" style="margin-bottom:10px;">
      <div class="smsc-section-title">🔍 Выделение компонентов архитектуры GSM:</div>
      <div class="smsc-buttons-group">
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="ms" onclick="window.__selectGsmNode('ms')">MS (Телефон + SIM)</button>
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="bts" onclick="window.__selectGsmNode('bts')">BTS (Базовая станция)</button>
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="bsc" onclick="window.__selectGsmNode('bsc')">BSC (Контроллер)</button>
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="trau" onclick="window.__selectGsmNode('trau')">TRAU (Транскодер)</button>
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="msc" onclick="window.__selectGsmNode('msc')">MSC (Коммутатор)</button>
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="vlr" onclick="window.__selectGsmNode('vlr')">VLR (Гостевой регистр)</button>
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="hlr" onclick="window.__selectGsmNode('hlr')">HLR (Домашний регистр)</button>
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="auc" onclick="window.__selectGsmNode('auc')">AUC (Аутентификация)</button>
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="eir" onclick="window.__selectGsmNode('eir')">EIR (Регистр IMEI)</button>
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="gmsc" onclick="window.__selectGsmNode('gmsc')">GMSC (Шлюзовой MSC)</button>
        <button type="button" class="smsc-btn gsm-node-btn" data-gsm-btn="omc" onclick="window.__selectGsmNode('omc')">OSS/OMC (Эксплуатация)</button>
      </div>
    </div>

    <!-- Карточка описания узла / процедуры GSM -->
    <div class="smsc-inspect-card" id="gsm-info-card"></div>

    <!-- 3 векторные схемы GSM -->
    <div id="panel-gsm-topology" class="gsm-view-panel" style="display:block;">
      ${renderGsmTopologySvg()}
    </div>
    <div id="panel-gsm-auth" class="gsm-view-panel" style="display:none;">
      ${renderGsmAuthSvg()}
    </div>
    <div id="panel-gsm-routing" class="gsm-view-panel" style="display:none;">
      ${renderGsmRoutingSvg()}
    </div>
  </div>
</div>
`;

const EXTRA_CSS = `
/* Адаптивный масштаб страницы для комфортного чтения на 100% масштабе */
.iso-page {
  width: min(1520px, calc(100% - 32px)) !important;
  margin: 28px auto 56px !important;
}

.iso-plate {
  padding: 44px 24px 36px 24px !important;
  border-radius: 10px !important;
}

.smsc-app {
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Главная панель вкладок */
.smsc-main-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--anatomy-card);
  border: 1px solid var(--anatomy-mid);
  border-radius: 8px;
  padding: 8px 14px;
  gap: 12px;
}
.smsc-tab-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.smsc-main-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--anatomy-shade-1);
  border: 1px solid var(--anatomy-lo);
  color: var(--anatomy-muted);
  padding: 9px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-family: var(--anatomy-mono);
  font-size: 13px;
  font-weight: 600;
  transition: all .15s ease;
}
.smsc-main-tab:hover {
  border-color: var(--anatomy-mid);
  color: var(--anatomy-strong);
  background: var(--anatomy-shade-2);
}
.smsc-main-tab.active {
  background: var(--anatomy-shade-3);
  border-color: var(--anatomy-lit);
  color: var(--anatomy-strong);
  box-shadow: 0 0 12px rgba(255,255,255,0.18);
}
.tab-badge {
  background: var(--anatomy-shade-0);
  border: 1px solid var(--anatomy-lo);
  color: var(--anatomy-lit);
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 3px;
  letter-spacing: .05em;
}

.smsc-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--anatomy-card);
  border: 1px solid var(--anatomy-lo);
  border-radius: 6px;
  padding: 10px 16px;
  margin-bottom: 12px;
}
.smsc-modes {
  display: flex;
  align-items: center;
  gap: 12px;
}
.smsc-badge {
  background: var(--anatomy-shade-3);
  border: 1px solid var(--anatomy-mid);
  color: var(--anatomy-strong);
  font-family: var(--anatomy-mono);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 4px;
  letter-spacing: .05em;
}
.smsc-mode-label {
  font-size: 13.5px;
  color: var(--anatomy-text);
}
.smsc-panel-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 12px;
}
@media(max-width:820px){.smsc-panel-row{grid-template-columns:1fr}}
.smsc-section {
  background: var(--anatomy-card);
  border: 1px solid var(--anatomy-lo);
  border-radius: 6px;
  padding: 12px 14px;
}
.smsc-section-title {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--anatomy-strong);
  margin-bottom: 10px;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.smsc-buttons-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.smsc-btn {
  background: var(--anatomy-card);
  border: 1px solid var(--anatomy-lo);
  color: var(--anatomy-text);
  font-family: var(--anatomy-mono);
  font-size: 12px;
  padding: 7px 12px;
  cursor: pointer;
  border-radius: 5px;
  line-height: 1.35;
  transition: all .15s ease;
}
.smsc-btn:hover {
  border-color: var(--anatomy-mid);
  color: var(--anatomy-strong);
}
.smsc-btn[aria-selected="true"] {
  border-color: var(--anatomy-lit);
  background: var(--anatomy-shade-3);
  color: var(--anatomy-strong);
  font-weight: 600;
}
.smsc-node-btn[aria-selected="true"] {
  border-color: var(--anatomy-strong);
  background: var(--anatomy-shade-2);
}
.smsc-theme-btn {
  opacity: .85;
  padding: 8px 14px;
  font-size: 12.5px;
}
.smsc-theme-btn:hover {
  opacity: 1;
}

.smsc-inspect-card {
  background: var(--anatomy-card);
  border: 1px solid var(--anatomy-mid);
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: var(--anatomy-lift);
  margin-bottom: 14px;
}
.smsc-card-header {
  margin-bottom: 10px;
  border-bottom: 1px solid var(--anatomy-faint);
  padding-bottom: 8px;
}
.smsc-card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--anatomy-strong);
}
.smsc-card-sub {
  font-size: 13px;
  color: var(--anatomy-muted);
  margin-top: 3px;
}
.smsc-card-body {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--anatomy-text);
}
.smsc-param {
  margin: 6px 0;
  font-size: 13.5px;
}
.smsc-param code {
  background: var(--anatomy-shade-2);
  padding: 3px 8px;
  border-radius: 3px;
  font-family: var(--anatomy-mono);
  font-size: 12px;
  color: var(--anatomy-strong);
}
.smsc-param-details {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--anatomy-faint);
  font-size: 13px;
  line-height: 1.65;
  color: var(--anatomy-muted);
}
.smsc-steps-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.smsc-step-pill {
  background: var(--anatomy-shade-1);
  border: 1px solid var(--anatomy-lo);
  color: var(--anatomy-muted);
  font-family: var(--anatomy-mono);
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 14px;
  cursor: pointer;
  transition: all .15s ease;
}
.smsc-step-pill.active {
  background: var(--anatomy-shade-3);
  border-color: var(--anatomy-lit);
  color: var(--anatomy-strong);
  font-weight: 700;
}
.smsc-step-text {
  font-size: 14.5px;
  font-weight: 500;
  color: var(--anatomy-strong);
  line-height: 1.55;
}
.smsc-timeline-bar {
  display: flex;
  justify-content: center;
  gap: 12px;
  align-items: center;
  margin: 8px 0 16px 0;
}
.smsc-nav-btn {
  padding: 8px 16px;
  font-size: 12.5px;
  font-weight: 600;
}
.smsc-primary-btn {
  background: var(--anatomy-shade-2);
  border-color: var(--anatomy-mid);
  color: var(--anatomy-strong);
}

.smsc-diagram-wrapper {
  background: var(--anatomy-card);
  border: 1px solid var(--anatomy-mid);
  border-radius: 8px;
  padding: 8px;
  box-shadow: var(--anatomy-lift);
}

/* Панель Вкладки 2 */
.smsc-proto-toolbar {
  background: var(--anatomy-card);
  border: 1px solid var(--anatomy-lo);
  border-radius: 6px;
  padding: 10px 16px;
  margin-bottom: 12px;
}
.smsc-proto-nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.proto-view-panel {
  background: var(--anatomy-card);
  border: 1px solid var(--anatomy-mid);
  border-radius: 8px;
  padding: 8px;
  box-shadow: var(--anatomy-lift);
}

/* ════════════ Стили 2D + 2.5D схемы SVG ════════════ */
.smsc-2d-svg,.proto-svg{display:block;width:100%;height:auto;overflow:visible;user-select:none}
.main-rack-plate{fill:var(--anatomy-card);stroke:var(--anatomy-lo);stroke-width:1}
.main-rack-inner-border{fill:none;stroke:var(--anatomy-faint);stroke-width:0.8;stroke-dasharray:4 4}

/* 2.5D блоки */
.block-25d-group{transition:all .25s ease}
.block-25d-group:hover{filter:drop-shadow(0 6px 16px rgba(255,255,255,0.25))}
.block-shadow{fill:#000000;opacity:0.35}
.block-3d-side{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:0.6}
.block-front{fill:var(--anatomy-paper);stroke:none}
.block-border{stroke:var(--anatomy-mid);stroke-width:1}
.block-header{fill:var(--anatomy-shade-2)}
.block-divider{stroke:var(--anatomy-lo);stroke-width:1}
.block-title{font-size:12px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono);letter-spacing:.02em}
.block-sub{font-size:9.5px;fill:var(--anatomy-muted);font-family:sans-serif}
.block-led{fill:var(--anatomy-lit)}
.block-led-glow{fill:var(--anatomy-lit);opacity:0.25;filter:url(#glow)}

/* Модули внутри блоков */
.submodule-bg{fill:var(--anatomy-shade-1);stroke:var(--anatomy-faint);stroke-width:0.6}
.submodule-title{font-size:9.5px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono);letter-spacing:.03em}

/* Каналы Шлюза */
.ch-bg{fill:var(--anatomy-shade-1);stroke:var(--anatomy-faint);stroke-width:0.6;transition:all .2s ease}
.ch-accent{fill:var(--anatomy-lit)}
.channel-card:hover .ch-bg{fill:var(--anatomy-shade-2)}
.ch-name{font-size:10.5px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}
.ch-desc{font-size:8.5px;fill:var(--anatomy-muted);font-family:sans-serif}
.ch-port{fill:var(--anatomy-shade-0);stroke:var(--anatomy-mid);stroke-width:1}
.ch-port-core{fill:var(--anatomy-lit)}

.tps-bg{fill:var(--anatomy-shade-1);stroke:var(--anatomy-faint);stroke-width:0.6}
.tps-label{font-size:8.5px;font-weight:700;fill:var(--anatomy-muted);font-family:var(--anatomy-mono)}
.tps-val{font-size:9.5px;font-weight:700;fill:var(--anatomy-lit);font-family:var(--anatomy-mono)}
.tps-track{fill:var(--anatomy-shade-0)}
.tps-fill{fill:var(--anatomy-strong)}
.tps-subinfo{font-size:8px;fill:var(--anatomy-muted);font-family:sans-serif}

/* Антиспам и HLR */
.check-item{font-size:8.5px;fill:var(--anatomy-text);font-family:sans-serif}
.badge-ok-bg{fill:var(--anatomy-shade-3);stroke:var(--anatomy-mid);stroke-width:0.8}
.badge-ok-txt{font-size:8px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}
.radar-circle{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:0.8}
.radar-circle-inner{fill:none;stroke:var(--anatomy-faint);stroke-width:0.6;stroke-dasharray:3 3}
.radar-grid{stroke:var(--anatomy-faint);stroke-width:0.6}
.radar-needle{stroke:var(--anatomy-lit);stroke-width:1.8;stroke-linecap:round}
.radar-hub{fill:var(--anatomy-lit)}
.hlr-res-label{font-size:8.5px;fill:var(--anatomy-muted);font-family:sans-serif}
.hlr-res-val{font-size:9px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}

/* Очереди Store & Forward */
.q-bg{fill:var(--anatomy-shade-1);stroke:var(--anatomy-faint);stroke-width:0.6}
.q-accent{fill:var(--anatomy-mid)}
.q-otp .q-accent{fill:var(--anatomy-lit)}
.q-name{font-size:9.5px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}
.q-desc{font-size:8px;fill:var(--anatomy-muted);font-family:sans-serif}
.q-bar-bg{fill:var(--anatomy-shade-0)}
.q-bar-fill{fill:var(--anatomy-mid)}
.q-otp .q-bar-fill{fill:var(--anatomy-lit)}
.s-and-f-note{font-size:8px;fill:var(--anatomy-muted);font-family:sans-serif}

/* Передатчик */
.code-line{font-size:8.5px;fill:var(--anatomy-muted);font-family:var(--anatomy-mono)}
.tower-leg{stroke:var(--anatomy-mid);stroke-width:1.4}
.tower-cross{stroke:var(--anatomy-lo);stroke-width:0.8}
.tower-top{fill:var(--anatomy-lit)}
.tower-wave-1{fill:none;stroke:var(--anatomy-lit);stroke-width:0.8;opacity:0.6;animation:wavePulse 1.8s infinite ease-out}
.tower-wave-2{fill:none;stroke:var(--anatomy-lit);stroke-width:0.6;opacity:0.3;animation:wavePulse 1.8s infinite ease-out 0.6s}
.tower-status-lbl{font-size:8.5px;fill:var(--anatomy-muted);font-family:sans-serif}
.tower-status-val{font-size:9px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}

/* DLR */
.dlr-dial-bg{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:1}
.dlr-dial-rim{fill:none;stroke:var(--anatomy-faint);stroke-width:0.6}
.dlr-q-lbl{font-size:8px;font-weight:700;font-family:var(--anatomy-mono);fill:var(--anatomy-muted)}
.dlr-q-lbl.delivrd{fill:var(--anatomy-strong)}
.dlr-needle{stroke:var(--anatomy-lit);stroke-width:2;stroke-linecap:round}
.dlr-hub{fill:var(--anatomy-lit)}
.dlr-sub-hint{font-size:8px;fill:var(--anatomy-muted);font-family:sans-serif}
.dlr-ret-desc{font-size:8.5px;fill:var(--anatomy-strong);font-family:sans-serif}
.dlr-ret-desc-sub{font-size:8px;fill:var(--anatomy-muted);font-family:var(--anatomy-mono)}

/* НАДБЛОЧНАЯ ЭСТАКАДА (OVERHEAD GANTRY) */
.overhead-rail-bg{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:0.8}
.overhead-rail-line{stroke:var(--anatomy-mid);stroke-width:2;stroke-dasharray:4 4;animation:highwayFlow 1.2s linear infinite}
.overhead-stop-ring{fill:var(--anatomy-shade-1);stroke:var(--anatomy-lo);stroke-width:1.2}
.overhead-stop-core{fill:var(--anatomy-muted)}
.overhead-stop.active .overhead-stop-core{fill:var(--anatomy-lit)}
.overhead-stop.active .overhead-stop-ring{stroke:var(--anatomy-lit);filter:url(#glow)}
.overhead-drop-guide{stroke:var(--anatomy-faint);stroke-width:1;stroke-dasharray:2 3}
.overhead-stop.active .overhead-drop-guide{stroke:var(--anatomy-lit);stroke-width:1.4}
.overhead-title{font-size:8.5px;font-weight:700;fill:var(--anatomy-muted);font-family:var(--anatomy-mono);letter-spacing:.05em}

/* Активный конверт над блоками */
#active-sms-packet{will-change:transform}
.packet-glow{fill:var(--anatomy-lit);opacity:0.35;filter:url(#glow)}
.packet-body{fill:var(--anatomy-strong);stroke:var(--anatomy-page);stroke-width:1.5}
.packet-flap{stroke:var(--anatomy-page);stroke-width:1.2}
.packet-text{font-size:8px;font-weight:800;fill:var(--anatomy-page);font-family:var(--anatomy-mono);letter-spacing:.05em}
.packet-laser-ray{stroke:var(--anatomy-lit);stroke-width:2;stroke-linecap:round;filter:url(#glow)}
.packet-laser-arrow{fill:var(--anatomy-lit);filter:url(#glow)}

/* Магистрали шины данных */
.highway-pipe{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:0.8}
.highway-flow-line{stroke:var(--anatomy-mid);stroke-width:2;stroke-dasharray:3 3;animation:highwayFlow 0.8s linear infinite}
.highway-joint{fill:var(--anatomy-shade-2);stroke:var(--anatomy-lo);stroke-width:1}
.return-flow-line{fill:none;stroke:var(--anatomy-faint);stroke-width:1.5;stroke-dasharray:4 4;animation:returnFlow 2s linear infinite}
.return-flow-text{font-size:9.5px;fill:var(--anatomy-muted);font-family:var(--anatomy-mono)}

/* ════════════ СТИЛИ ДИАГРАММ ПРОТОКОЛОВ (ВКЛАДКА 2) ════════════ */
.proto-svg-title{font-size:12px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono);letter-spacing:.03em}
.proto-svg-sub{font-size:9.5px;fill:var(--anatomy-muted);font-family:sans-serif}

.proto-actor-box{fill:var(--anatomy-shade-1);stroke:var(--anatomy-mid);stroke-width:1}
.proto-actor-box.smsc-actor{fill:var(--anatomy-shade-2);stroke:var(--anatomy-lit);stroke-width:1.2}
.proto-actor-title{font-size:11px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}
.proto-actor-sub{font-size:8.5px;fill:var(--anatomy-muted);font-family:sans-serif}
.lifeline{stroke:var(--anatomy-faint);stroke-width:1;stroke-dasharray:3 3}

.msg-arrow{stroke-width:1.6}
.msg-arrow.req{stroke:var(--anatomy-strong)}
.msg-arrow.resp{stroke:var(--anatomy-mid);stroke-dasharray:3 2}
.msg-arrow.radio{stroke:var(--anatomy-lit)}
.msg-arrow.dlr{stroke:var(--anatomy-lit);stroke-dasharray:4 3}

.arrow-head{stroke:none}
.arrow-head.req{fill:var(--anatomy-strong)}
.arrow-head.resp{fill:var(--anatomy-mid)}
.arrow-head.radio{fill:var(--anatomy-lit)}
.arrow-head.dlr{fill:var(--anatomy-lit)}

.msg-text{font-size:8.5px;font-family:var(--anatomy-mono);font-weight:600}
.msg-text.req{fill:var(--anatomy-strong)}
.msg-text.resp{fill:var(--anatomy-muted)}
.msg-text.radio{fill:var(--anatomy-lit)}
.msg-text.dlr{fill:var(--anatomy-lit)}

.proto-info-box{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:1}
.proto-info-title{font-size:10px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono);letter-spacing:.03em}
.proto-info-note{font-size:8.5px;fill:var(--anatomy-muted);font-family:sans-serif}
.proto-info-note.ok{fill:var(--anatomy-lit)}

/* Слои стеков */
.stack-layer{stroke:var(--anatomy-lo);stroke-width:0.8}
.stack-layer.map{fill:var(--anatomy-shade-3);stroke:var(--anatomy-lit)}
.stack-layer.tcap{fill:var(--anatomy-shade-2)}
.stack-layer.sccp{fill:var(--anatomy-shade-2)}
.stack-layer.m3ua{fill:var(--anatomy-shade-3);stroke:var(--anatomy-mid)}
.stack-layer.sctp{fill:var(--anatomy-shade-2)}
.stack-layer.ip{fill:var(--anatomy-shade-1)}
.stack-layer.mtp3{fill:var(--anatomy-shade-1)}
.stack-layer.mtp2{fill:var(--anatomy-shade-1)}
.stack-layer.mtp1{fill:var(--anatomy-shade-0)}

.stack-name{font-size:9.5px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}
.stack-desc{font-size:8px;fill:var(--anatomy-muted);font-family:sans-serif}

/* Поля PDU заголовка */
.pdu-field{fill:var(--anatomy-shade-1);stroke:var(--anatomy-mid);stroke-width:0.8}
.pdu-field.body{fill:var(--anatomy-shade-2);stroke:var(--anatomy-lit)}
.pdu-f-name{font-size:9px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}
.pdu-f-sub{font-size:7.5px;fill:var(--anatomy-muted);font-family:sans-serif}

/* Шлюз SGW */
.sgw-box{fill:var(--anatomy-shade-2);stroke:var(--anatomy-mid)}
.sgw-bridge-box{fill:var(--anatomy-shade-3);stroke:var(--anatomy-lit);stroke-width:1}
.sgw-bridge-text{font-size:8.5px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}
.sgw-bridge-detail{font-size:10px;font-weight:800;fill:var(--anatomy-lit);font-family:var(--anatomy-mono)}
.sgw-bridge-arrow{font-size:14px;fill:var(--anatomy-mid)}
.sgw-note{font-size:8px;fill:var(--anatomy-muted);font-family:sans-serif}

/* Особенности SIGTRAN */
.sigtran-features-box{fill:var(--anatomy-shade-1);stroke:var(--anatomy-lo);stroke-width:0.8}
.feat-title{font-size:9.5px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}
.feat-head{font-size:8.5px;font-weight:700;fill:var(--anatomy-lit);font-family:var(--anatomy-mono)}
.feat-desc{font-size:8px;fill:var(--anatomy-text);font-family:sans-serif}

/* ════════════ СТИЛИ ТОПОЛОГИИ GSM (ВКЛАДКА 3) ════════════ */
.gsm-view-panel{background:var(--anatomy-card);border:1px solid var(--anatomy-mid);border-radius:8px;padding:6px;box-shadow:var(--anatomy-lift)}
.gsm-topo-svg{display:block;width:100%;height:auto}
.gsm-zone-box{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:1}
.gsm-zone-title{font-size:10px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono);letter-spacing:.05em}

.gsm-node-box{fill:var(--anatomy-paper);stroke:var(--anatomy-mid);stroke-width:1;transition:all .18s ease}
.gsm-node-clickable:hover .gsm-node-box{stroke:var(--anatomy-lit);filter:drop-shadow(0 2px 8px rgba(255,255,255,0.25))}
.gsm-node-header{font-size:9.5px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono);letter-spacing:.02em}

.gsm-subchip-box{fill:var(--anatomy-shade-1);stroke:var(--anatomy-faint);stroke-width:0.6}
.gsm-subchip-box.sim{fill:var(--anatomy-shade-2);stroke:var(--anatomy-lit);stroke-width:0.8}
.gsm-subchip-title{font-size:8.5px;font-weight:700;fill:var(--anatomy-strong);font-family:var(--anatomy-mono)}
.gsm-subchip-desc{font-size:7.5px;fill:var(--anatomy-muted);font-family:sans-serif}

.phone-screen{fill:var(--anatomy-shade-3);stroke:var(--anatomy-lo);stroke-width:0.8}
.phone-scr-txt{font-size:8px;font-weight:700;fill:var(--anatomy-lit);font-family:var(--anatomy-mono)}
.phone-scr-sub{font-size:7px;fill:var(--anatomy-muted);font-family:sans-serif}

.if-box{fill:var(--anatomy-shade-2);stroke:var(--anatomy-mid);stroke-width:0.8}
.if-name{font-size:8.5px;font-weight:800;fill:var(--anatomy-lit);font-family:var(--anatomy-mono)}
.if-spec{font-size:6.5px;fill:var(--anatomy-muted);font-family:sans-serif}

.gsm-wire{stroke:var(--anatomy-mid);stroke-width:1.2;fill:none}
.gsm-wire.main-trunk{stroke:var(--anatomy-strong);stroke-width:2}
.gsm-wire.internal{stroke:var(--anatomy-faint);stroke-dasharray:3 3}

.radio-arc{stroke:var(--anatomy-lit);stroke-width:1;fill:none;stroke-linecap:round}
.radio-arc.pulse{animation:wavePulse 2s infinite ease-out}

.cell-hex{fill:none;stroke:var(--anatomy-faint);stroke-width:1;stroke-dasharray:3 2}
.cell-lbl{font-size:8px;fill:var(--anatomy-faint);font-family:var(--anatomy-mono)}

.gsm-node-btn[aria-selected="true"],.gsm-view-btn[aria-selected="true"]{border-color:var(--anatomy-lit);background:var(--anatomy-shade-3);color:var(--anatomy-strong);font-weight:600}

@keyframes highwayFlow{to{stroke-dashoffset:-8}}
@keyframes returnFlow{to{stroke-dashoffset:-16}}
@keyframes wavePulse{0%{r:4.5;opacity:0.8}100%{r:20;opacity:0}}
`;

const body = k.plateHtml({
  fig: "Рис. 1",
  title: "ТЕЛЕКОММУНИКАЦИОННЫЙ КОМПЛЕКС СМС-ЦЕНТРА (SMSC) И ТОПОЛОГИЯ СЕТИ GSM",
  hint: "Используйте вкладки 1, 2 и 3 вверху",
  readout: "Фаза 1/4 · ШЛЮЗ",
  keys: [
    { mark: "lit",    label: "Активный пакет SMS (маршрут обработки)" },
    { mark: "raised", label: "Серверные функциональные блоки 2.5D (1-5)" },
    { mark: "edge",   label: "Стрелочные радары HLR и DLR-статуса" },
    { mark: "flat",   label: "Очереди сообщений Store & Forward (OTP, FIFO, Retry, Карантин)" },
    { mark: "dashed", label: "Стек протоколов: SMPP, SS7 MAP, SIGTRAN · Топология GSM" },
  ],
  caption:
    "Интерактивная телекоммуникационная система СМС-центра (SMSC) по стандарту 3GPP TS 23.040 и архитектура сотовой сети GSM. " +
    "Вкладка 1: Архитектура и сквозные процессы 5 функциональных узлов (Шлюз приёма, Маршрутизатор HLR, Буфер Store-and-Forward, Передатчик MT, Регистратор DLR). Демонстрация сквозного прохождения сообщений по технологическим сценариям. " +
    "Вкладка 2: Наглядные схемы работы базовых протоколов — клиентского SMPP v3.4/5.0 с анатомией PDU, мобильной сигнализации SS7 MAP (ОКС-7) с 7 уровнями стека и сессионным Call-Flow, а также эволюционного IP-транспорта SIGTRAN (SCTP + M3UA) с шлюзом SGW. " +
    "Вкладка 3: Полная топология сети GSM по стандарту ETSI/3GPP — 4 базовые подсистемы (MS c терминалом ME/IMEI и картой SIM/IMSI/Ki; BSS c базовыми станциями BTS, контроллерами BSC и транскодерами TRAU; NSS с коммутатором MSC, регистрами VLR/TMSI, HLR/MSISDN/MWD, криптоцентром AUC, базой краж EIR, шлюзом GMSC и СМС-центром SMSC; OSS/OMC), стандартизированные интерфейсы (Um, Abis, A, Ater, B, C, D, E, F, H), алгоритмы безопасности (A3, A8, A5) и процедура сквозной маршрутизации входящего вызова (MTC / MSRN).",
  body: controlsHtml,
});

const html = k.pageHtml({
  title: "СМС-Центр (SMSC) и Топология Сети GSM · Архитектура, Протоколы, Безопасность",
  theme,
  body: `<style>${EXTRA_CSS}</style>${body}`,
  script: kitScript() + live,
  width: 1480,
});

const outName = theme === "light" ? "smsc-anatomy-light.html" : "smsc-anatomy.html";
writeFileSync(join(HERE, outName), html);
console.log("Wrote", outName);
if (theme === "dark") {
  writeFileSync(join(HERE, "index.html"), html);
  console.log("Wrote index.html");
}
