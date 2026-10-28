# Телекоммуникационный комплекс СМС-центра (SMSC) и Топология сети GSM

Интерактивная 2D/2.5D векторная визуализация архитектуры SMSC (3GPP TS 23.040), базовых телекоммуникационных протоколов и топологии сотовой сети GSM.

🌐 **Демонстрация онлайн (GitHub Pages)**: [https://ddunaev247.github.io/smsc_gsm/](https://ddunaev247.github.io/smsc_gsm/)

---

## Разделы проекта

### 1. Вкладка 1: Архитектура и сквозные процессы SMSC
- 5 функциональных серверных узлов:
  1. **Шлюз приёма (Ingress Gateway)**: каналы SMPP, SS7 MAP, HTTP REST, мониторинг TPS.
  2. **Маршрутизатор HLR (Routing Core)**: антиспам-фильтрация, сигнальные запросы `SRI-for-SM`.
  3. **Буфер Store & Forward**: очереди Экспресс OTP, Основная FIFO, Повторы Retry с AlertSC, Карантин.
  4. **Передатчик MT (Egress Transmitter)**: кодирование PDU, отправка `MT-ForwardSM` к MSC.
  5. **Регистратор DLR (Delivery Receipts)**: учет статусов DELIVRD, EXPIRED, UNDELIV, REJECTD.
- 4 технологических сценария с пошаговым управлением и анимацией движения пакета SMS по верхней магистрали:
  - Абонентское SMS (MO-MT)
  - Банковский OTP (SMPP)
  - Абонент вне сети (Store & Forward)
  - Спам-атака и блокировка

### 2. Вкладка 2: Протоколы связи
- **SMPP v3.4 / v5.0**: клиент-серверный обмен с ESME, 16-байтный бинарный заголовок PDU, sliding window, keepalive.
- **SS7 MAP (ОКС-7)**: 7 уровней сигнального стека (MAP, TCAP, SCCP, MTP3, MTP2, MTP1), двухфазная маршрутизация.
- **SIGTRAN**: миграция SS7 в IP-сети, протоколы SCTP и M3UA, шлюз SGW, multi-homing и multi-streaming.

### 3. Вкладка 3: Топология сотовой сети GSM
- **Подсистемы сети (3GPP / ETSI)**:
  - **MS (Mobile Station)**: ME (IMEI) + SIM (IMSI, Ki, A3, A8).
  - **BSS (Base Station Subsystem)**: соты BTS, контроллер BSC (RRM, Handover), транскодер TRAU.
  - **NSS (Network & Switching Subsystem)**: MSC, VLR (TMSI, LAI, MSRN), HLR (MSISDN, MWD), AUC, EIR, GMSC, SMSC.
  - **OSS / OMC**: эксплуатация и мониторинг.
  - **Интерфейсы**: Um, Abis, A, Ater, B, C, D, E, F, H.
- **Безопасность и криптозащита**:
  - Механизм Challenge-Response с триплетами (RAND, SRES, Kc).
  - Алгоритмы A3, A8, A5/1, A5/3.
- **Маршрутизация входящего вызова (MTC / MSRN)**:
  - Сквозной Call Flow от PSTN до абонента через GMSC, HLR, VLR и MSC.

---

## Локальный запуск и сборка

Проект не требует внешних рантайм-зависимостей, всё работает в браузере (HTML5, SVG, Vanilla JS/CSS).

Сборка HTML из исходного файла `build.mjs`:
```bash
# Сборка темной темы (index.html) и светлой темы
node build.mjs
node build.mjs --light
```

Открыть локально:
```bash
# В любом браузере:
start index.html
```
