
const D = __DATA__;
const P = D.P;
const M = D.model;
const K = { iso, pathOf, solidSvg, lineSvg, dotsSvg, roundedPlan };
const PARTS = makeParts(K, G, P);
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (sel) => svg.querySelector(sel);
const $$ = (sel) => [...svg.querySelectorAll(sel)];
const readout = document.querySelector("[data-readout]");
const status = document.querySelector("[data-status]");
const tools = Object.fromEntries([...document.querySelectorAll("[data-tool]")].map((b) => [b.dataset.tool, b]));
const still = matchMedia("(prefers-reduced-motion: reduce)");

const el = {
  ui: $('[data-part="ui"]'),
  modes: Object.fromEntries($$("[data-mode]").map((g) => [g.dataset.mode, g])),
  tiles: $$("[data-tile]"),
  badges: $$("[data-badge]"),
  counts: $$("[data-count]"),
  items: $('[data-part="items"]'),
  total: $('[data-part="total"]'),
  due: $('[data-part="due"]'),
  due2: $('[data-part="due2"]'),
  paynote: $('[data-part="paynote"]'),
  paypill: $('[data-part="paypill"]'),
  jack: $('[data-part="uplink-jack"]'),
  lte: $$('[data-led^="lte"]'),
  authnote: $('[data-part="authnote"]'),
  done1: $('[data-part="done1"]'),
  done2: $('[data-part="done2"]'),
  order: $('[data-part="order"]'),
  paybtn: $('[data-part="paybtn"]'),
  spin: $('[data-part="spin"]'),
  touch: $('[data-part="touch"]'),
  term: [$('[data-line="0"]'), $('[data-line="1"]')],
  nfc: [0, 1, 2, 3].map((i) => $(`[data-led="nfc${i}"]`)),
  keys: $$("[data-key]"),
  sw: $$('[data-led^="sw"]'),
  store: $$('[data-led^="store"]'),
  pc: $('[data-led="pc"]'),
  psu: $('[data-led="psu"]'),
  paperLed: $('[data-led="paper"]'),
  kprint: $('[data-led="kprint"]'),
  light: $('[data-part="lightbar"]'),
  card: $('[data-part="card"]'),
  cardHome: $('[data-part="card-home"]'),
  receipt: $('[data-part="receipt"]'),
  ticket: $('[data-part="ticket"]'),
  roll: $('[data-part="roll"]'),
  web: $('[data-part="web"]'),
  hub: $('[data-part="hub"]'),
  gear: $('[data-part="gear"]'),
  unplugged: $('[data-part="unplugged"]'),
  plugEnd: $('[data-name="lan.up.end0"]'),
  prep: $$("[data-prep]"),
  ready: $$("[data-ready]"),
};
const routes = {};
for (const g of $$("[data-route]")) (routes[g.dataset.route] ??= []).push(g);
for (const list of Object.values(routes)) list.sort((a, b) => a.dataset.chunk - b.dataset.chunk);
const plugChunks = (routes["lan.up"] ?? []).filter((g) => g.dataset.to && Number(g.dataset.to) <= D.unplugAt + 0.01);

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

const FEED = M.printer.mmPerS / M.unitMm;
const RECEIPT = M.printer.receiptMm / M.unitMm;
const TICKET = M.kitchen.ticketMm / M.unitMm;
const ROLL_W = FEED / D.roll.r;
const COOK = M.kitchen.cookS / M.kitchen.timelapse;
const CARD_FLY = 0.9;
const CARD_BACK = 0.8;
const READ = M.nfc.readS;
const LIMIT = M.nfc.limit;
const PIN_STEP = 0.45;
const LOW_R = D.roll.core + 1.6;

const state = {
  clock: 0,
  phase: "attract",
  phaseAt: 0,
  cart: M.menu.map(() => 0),
  next: M.firstOrder,
  order: M.firstOrder,
  due: 0,
  touch: null,
  note: null,
  queue: [],
  pulses: [],
  card: null,
  pin: null,
  declined: false,
  printAt: -1,
  cutAt: -1,
  takeAt: -1,
  noReceipt: false,
  ticketAt: -1,
  ticketGone: -1,
  waiting: [],
  board: [
    { n: M.firstOrder - 5, s: "ready" },
    { n: M.firstOrder - 3, s: "ready" },
    { n: M.firstOrder - 2, s: "prep" },
    { n: M.firstOrder - 1, s: "prep" },
  ],
  boardTick: 0,
  modes: { paper: false, offline: false, decline: false },
  hub: 0,
  gear: 0,
};
const calm = () => still.matches;
function after(seconds, fn) {
  state.queue.push({ at: state.clock + (calm() ? 0 : seconds), fn });
  run();
}
function pulse(route, { delay = 0, seconds = 0.4, reverse = false } = {}) {
  if (!routes[route] || calm()) return;
  state.pulses.push({ route, t: -delay, seconds, reverse });
  run();
}
// Sequential pulses along a chain of routes, sharing `seconds` by weight.
function chain(list, seconds, { delay = 0, reverse = false } = {}) {
  const parts = reverse ? [...list].reverse() : list;
  const sum = parts.reduce((a, [, w]) => a + w, 0);
  let t = delay;
  for (const [route, w] of parts) {
    const d = (seconds * w) / sum;
    pulse(route, { delay: t, seconds: d, reverse });
    t += d;
  }
}
const ONLINE = [["lan.pay", 2], ["lan.up", 3], ["raceway", 2], ["wan", 1]];
const BACKUP = [["lan.pay", 3], ["lan.lte", 1], ["lte", 2]];
const KITCHEN = [["lan.pc", 2], ["lan.up", 3], ["raceway", 2]];
const items = () => state.cart.reduce((a, n) => a + n, 0);
const total = () => Math.round(state.cart.reduce((a, n, i) => a + n * M.menu[i].price, 0) * 100) / 100;
function setPhase(phase, say) {
  state.phase = phase;
  state.phaseAt = state.clock;
  const words = say ?? { menu: "Menu.", pay: "Card terminal ready. Tap your card.", auth: "Authorising with the bank.", attract: "Ready. Touch to order." }[phase];
  if (words) status.textContent = words;
  run();
}
function noteFor(text, seconds = 1.2) {
  state.note = { text, until: state.clock + seconds };
}

// ── failure modes ──
function setMode(id, on) {
  if (id === "paper") {
    state.modes.paper = on;
    drawRoll(on ? LOW_R : D.roll.r);
    el.paperLed.toggleAttribute("data-on", on);
    status.textContent = on ? "Paper roll nearly empty." : "Paper roll replaced.";
  } else if (id === "offline") {
    state.modes.offline = on;
    el.unplugged.style.display = on ? "" : "none";
    plugChunks.forEach((g) => (g.style.display = on ? "none" : ""));
    if (el.plugEnd) el.plugEnd.style.display = on ? "none" : "";
    status.textContent = on ? "Network cable unplugged from the kiosk's switch." : "Network cable plugged back in.";
    if (!on) flushWaiting();
  } else if (id === "decline") {
    state.modes.decline = on;
    status.textContent = on ? "The next card will be declined." : "Cards will be approved.";
  }
  tools[id]?.setAttribute("aria-pressed", String(on));
  run();
}
function bigOrder() {
  if (state.phase !== "attract" && state.phase !== "menu") return;
  state.cart = [...M.bigOrder];
  if (state.phase === "attract") setPhase("menu");
  noteFor(`big order · ${rm(total())} · over the RM ${LIMIT} contactless limit`, 2);
  status.textContent = `Big order, ${rm(total())}. Over RM ${LIMIT} a contactless card needs a PIN.`;
  draw();
}
function drawRoll(r) {
  const F = D.roll.f;
  const h = D.roll.x1 - D.roll.x0;
  const layers = [0.45, 0.7].map((f) => D.roll.r * f).filter((rr) => rr < r - 0.6).map((rr) => G.circleOf(F, -0.01, rr, P, 48)).join("");
  el.roll.innerHTML = solidSvg(G.ringBand(0, h, D.roll.core, r, F, P), { tone: "hi" }) + (layers ? lineSvg(layers, { tone: "faint" }) : "");
  const XF = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  el.web.innerHTML = solidSvg(PARTS.prismPaths(XF, PARTS.webPoly(D.roll.y, D.roll.z, r), D.roll.x0 + 0.2, D.roll.x1 - 0.2), { tone: "hi" });
}

// ── the screen: touch, menu, pay ──
const inBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
function touchAt(x, y) {
  state.touch = { x, y, at: state.clock };
  noteFor(`touch · x ${Math.round(x)} y ${Math.round(y)} px · ${M.touch.scanHz} Hz scan`, 0.9);
  pulse("flex.touch", { seconds: 0.25, reverse: true });
  pulse("usb.touch", { delay: 0.2, seconds: 0.35 });
  const act = actionAt(x, y);
  if (!act) return;
  after(0.5, () => {
    act();
    pulse("hdmi", { seconds: 0.25 });
    pulse("lvds", { delay: 0.2, seconds: 0.25 });
    draw();
  });
}
function actionAt(x, y) {
  const B = SCREEN.BUTTONS;
  if (state.phase === "attract" && inBox(B.start, x, y)) return () => setPhase("menu");
  if (state.phase === "menu") {
    const i = M.menu.findIndex((_, i) => inBox(SCREEN.tileBox(i), x, y));
    if (i >= 0) return () => {
      state.cart[i] = Math.min(9, state.cart[i] + 1);
    };
    if (inBox(B.pay, x, y) && items() > 0) return () => startPay();
  }
  if (state.phase === "pay" && !state.card && inBox(B.cancel, x, y)) return () => setPhase("menu");
  return null;
}
function startPay() {
  state.due = total();
  state.declined = false;
  setPhase("pay");
  pulse("usb.pay", { seconds: 0.45 });
}
const centre = (b) => [b.x + b.w / 2, b.y + b.h / 2];
function nextTouch() {
  if (state.phase === "attract") return touchAt(...centre(SCREEN.BUTTONS.start));
  if (state.phase === "menu") {
    const n = items();
    if (n < 3) return touchAt(...centre(SCREEN.tileBox(n % M.menu.length)));
    return touchAt(...centre(SCREEN.BUTTONS.pay));
  }
}

// ── the card: from the pad to the reader and back ──
function tapCard() {
  if (state.phase !== "pay") {
    if (state.phase === "attract" || state.phase === "menu") {
      noteFor("terminal · choose Pay on the screen first");
      status.textContent = "Choose Pay on the screen first.";
      run();
    }
    return;
  }
  if (state.card || state.pin) return;
  state.declined = false;
  state.card = { at: state.clock };
  status.textContent = "Card on the reader.";
  if (calm()) {
    state.card = null;
    afterRead();
  }
  run();
}
function afterRead() {
  if (state.due > LIMIT) {
    state.pin = { at: state.clock, digits: 0 };
    setPhase("pay", "Over the contactless limit. Enter your PIN.");
    return;
  }
  authorise();
}
const REST = D.rest;
const HOLD = D.term.zone;
const UP = [0, 0, 1];
const FACE_N = D.term.n;
function cardPose(t) {
  const mid = [(REST[0] + HOLD[0]) / 2 - 8, (REST[1] + HOLD[1]) / 2 + 22, Math.max(REST[2], HOLD[2]) + 10];
  if (t < CARD_FLY) {
    const s = ease(t / CARD_FLY);
    return { p: lerp3(lerp3(REST, mid, s), lerp3(mid, HOLD, s), s), a: norm(lerp3(UP, FACE_N, ease((t / CARD_FLY - 0.1) / 0.8))) };
  }
  const tr = t - CARD_FLY;
  if (tr < READ + 0.25) return { p: HOLD, a: FACE_N, reading: tr };
  const tb = tr - READ - 0.25;
  if (tb < CARD_BACK) {
    const s = ease(tb / CARD_BACK);
    return { p: lerp3(lerp3(HOLD, mid, s), lerp3(mid, REST, s), s), a: norm(lerp3(FACE_N, UP, ease((tb / CARD_BACK - 0.1) / 0.8))) };
  }
  return null;
}
function drawCard() {
  if (!state.card) {
    if (el.card.innerHTML) el.card.innerHTML = "";
    el.cardHome.style.visibility = "";
    return false;
  }
  const pose = cardPose(state.clock - state.card.at);
  if (!pose) {
    state.card = null;
    el.card.innerHTML = "";
    el.cardHome.style.visibility = "";
    return false;
  }
  const u = [1, 0, 0];
  const a = pose.a;
  const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  el.card.innerHTML = PARTS.card({ o: pose.p, a, u, v }, { lit: true });
  el.cardHome.style.visibility = "hidden";
  if (pose.reading !== undefined && !state.card.read && pose.reading >= READ) {
    state.card.read = true;
    afterRead();
  }
  return true;
}

// ── PIN entry on the keypad ──
const PIN_KEYS = [5, 10, 13, 6, 15];
function drawPin() {
  const pin = state.pin;
  el.keys.forEach((g) => g.removeAttribute("data-down"));
  if (!pin) return false;
  const t = calm() ? 99 : state.clock - pin.at - 0.4;
  const step = Math.floor(t / PIN_STEP);
  const within = t - step * PIN_STEP;
  pin.digits = Math.max(0, Math.min(4, step + (within > PIN_STEP * 0.4 ? 1 : 0)));
  if (step >= 0 && step < PIN_KEYS.length && within < PIN_STEP * 0.55) el.keys[PIN_KEYS[step]]?.setAttribute("data-down", "");
  if (step >= PIN_KEYS.length) {
    state.pin = null;
    authorise();
    return false;
  }
  return true;
}

// ── the bank, the kitchen, the printers ──
function authorise() {
  const backup = state.modes.offline;
  setPhase("auth", backup ? "Network down. Authorising over the kiosk's 4G modem." : "Authorising with the bank.");
  const path = backup ? BACKUP : ONLINE;
  const leg = M.auth.s / 2;
  chain(path, leg);
  chain(path, leg, { delay: leg, reverse: true });
  after(M.auth.s, () => {
    pulse("usb.pay", { seconds: 0.35, reverse: true });
    if (state.modes.decline) {
      setMode("decline", false);
      state.declined = true;
      setPhase("pay", "Card declined. Try another card.");
      return;
    }
    after(0.35, approved);
  });
}
function approved() {
  state.order = state.next;
  state.next += 2;
  state.noReceipt = state.modes.paper;
  setPhase("done", `Approved. Order ${state.order}.` + (state.noReceipt ? " The printer is out of paper: remember your number." : " Printing the receipt."));
  sendToKitchen(state.order);
  if (state.noReceipt) return;
  pulse("usb.print", { seconds: 0.3 });
  after(0.3, () => {
    state.printAt = state.clock;
    state.cutAt = state.clock + RECEIPT / FEED;
  });
}
function sendToKitchen(n) {
  if (state.modes.offline) {
    pulse("lan.pc", { seconds: 0.3 });
    state.waiting.push(n);
    return;
  }
  chain(KITCHEN, 0.9);
  pulse("kitchen.lan", { delay: 0.9, seconds: 0.25 });
  pulse("board.lan", { delay: 0.9, seconds: 0.5 });
  after(1.15, () => {
    state.ticketAt = state.clock;
    state.ticketGone = -1;
    state.ticketNo = n;
  });
  after(1.4, () => {
    state.board.push({ n, s: "prep", mine: true, readyAt: state.clock + COOK });
    state.board.push({ n: n + 1, s: "prep" });
    status.textContent = `Order ${n} is on the kitchen printer and the pickup board.`;
  });
}
function flushWaiting() {
  const list = state.waiting.splice(0);
  list.forEach((n, i) => after(0.4 + i * 0.6, () => {
    chain([["lan.pc", 2], ["lan.up", 3], ["raceway", 2]], 0.9);
    after(0.9, () => sendLocal(n));
  }));
}
function sendLocal(n) {
  pulse("kitchen.lan", { seconds: 0.25 });
  pulse("board.lan", { seconds: 0.5 });
  after(0.4, () => {
    state.ticketAt = state.clock;
    state.ticketNo = n;
    state.ticketGone = -1;
    state.board.push({ n, s: "prep", mine: true, readyAt: state.clock + COOK });
    status.textContent = `Queued order ${n} sent to the kitchen.`;
  });
}
function receiptLength() {
  if (state.printAt < 0) return 0;
  if (calm()) return RECEIPT;
  return Math.min(RECEIPT, Math.max(0, (state.clock - state.printAt) * FEED));
}
const PRINT_LINES = [[2, 4.4, 11.6], [3.2, 5.6, 10.4], [5.4, 6, 10], [6.2, 5.2, 10.8], [7, 6, 10], [9.6, 1.6, 9], [10.8, 1.6, 7.4], [12, 1.6, 8.6], [9.6, 12.4, 14.4], [10.8, 12.4, 14.4], [12, 12.4, 14.4], [14.6, 1.6, 14.4], [16.2, 1.6, 6], [16.2, 10.4, 14.4], [19.4, 3.6, 12.4], [20.6, 5, 11]];
const TICKET_LINES = [[1.8, 2, 10], [3.6, 3, 9], [4.4, 3.4, 8.6], [5.2, 3, 9], [7.6, 1.6, 12], [8.8, 1.6, 9.6], [10, 1.6, 11], [12.6, 4, 8]];
function drawReceipt() {
  let len = receiptLength();
  let lift = 0;
  let fade = 1;
  if (state.takeAt >= 0) {
    const t = calm() ? 1 : (state.clock - state.takeAt) / 0.7;
    lift = ease(t) * 14;
    fade = 1 - ease(t);
    if (t >= 1) {
      state.takeAt = -1;
      state.printAt = -1;
      len = 0;
    }
  }
  if (len <= 0) {
    if (el.receipt.innerHTML) el.receipt.innerHTML = "";
    return false;
  }
  const off = iso([0, lift, -lift * 0.6], P);
  const o = iso([0, 0, 0], P);
  el.receipt.setAttribute("transform", lift ? `translate(${(off[0] - o[0]).toFixed(2)} ${(off[1] - o[1]).toFixed(2)})` : "");
  el.receipt.style.opacity = fade < 1 ? fade.toFixed(3) : "";
  el.receipt.innerHTML = PARTS.receipt(D.slot.yz, D.slot.out, len, D.slot.x0, D.slot.x1, { lines: PRINT_LINES });
  return state.takeAt >= 0 || (state.printAt >= 0 && len < RECEIPT);
}
function drawTicket() {
  if (state.ticketAt < 0) {
    if (el.ticket.innerHTML) el.ticket.innerHTML = "";
    return false;
  }
  const len = calm() ? TICKET : Math.min(TICKET, (state.clock - state.ticketAt) * FEED);
  let fade = 1;
  if (state.ticketGone >= 0) {
    fade = calm() ? 0 : 1 - ease((state.clock - state.ticketGone) / 0.6);
    if (fade <= 0) {
      state.ticketAt = -1;
      el.ticket.innerHTML = "";
      return false;
    }
  }
  el.ticket.style.opacity = fade < 1 ? fade.toFixed(3) : "";
  el.ticket.innerHTML = PARTS.receipt(D.ticket.yz, D.ticket.out, len, D.ticket.x0, D.ticket.x1, { lines: TICKET_LINES });
  return len < TICKET || state.ticketGone >= 0;
}
function stepBoard(dt) {
  let moving = false;
  for (const o of state.board) {
    if (o.mine && o.s === "prep" && state.clock >= o.readyAt) {
      o.s = "ready";
      o.readyAt = state.clock;
      o.goneAt = state.clock + 10;
      if (state.ticketNo === o.n && state.ticketAt >= 0) state.ticketGone = state.clock;
      status.textContent = `Order ${o.n} is ready.`;
    }
    if (o.mine && o.s === "prep") moving = true;
  }
  state.boardTick += dt;
  if (state.boardTick > 7) {
    state.boardTick = 0;
    const other = state.board.find((o) => !o.mine && o.s === "prep");
    if (other) other.s = "ready";
    const ready = state.board.filter((o) => o.s === "ready" && !o.mine);
    if (ready.length > 2) state.board.splice(state.board.indexOf(ready[0]), 1);
  }
  state.board = state.board.filter((o) => !(o.mine && o.s === "ready" && state.clock > o.goneAt));
  const prep = state.board.filter((o) => o.s === "prep").slice(-6);
  const ready = state.board.filter((o) => o.s === "ready").slice(-6);
  el.prep.forEach((t, i) => setText(t, prep[i] ? String(prep[i].n) : ""));
  const flash = Math.floor(state.clock * 3) % 2 === 0;
  el.ready.forEach((t, i) => {
    const o = ready[i];
    setText(t, o ? String(o.n) : "");
    t.classList.toggle("ks-flash", !!(o && o.mine && state.clock - o.readyAt < 3 && flash));
  });
  return moving || state.board.some((o) => o.mine && o.s === "ready" && state.clock - o.readyAt < 3);
}

// ── draw ──
function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}
function draw() {
  for (const [mode, g] of Object.entries(el.modes)) {
    const want = mode === state.phase ? "" : "none";
    if (g.style.display !== want) g.style.display = want;
  }
  state.cart.forEach((n, i) => {
    el.badges[i].style.display = n ? "" : "none";
    setText(el.counts[i], String(n));
    el.tiles[i].toggleAttribute("data-on", n > 0);
  });
  const n = items();
  setText(el.items, `${n} item${n === 1 ? "" : "s"}`);
  setText(el.total, rm(total()));
  el.paybtn.toggleAttribute("data-off", n === 0);
  setText(el.due, rm(state.due));
  setText(el.due2, rm(state.due));
  setText(el.order, String(state.order));
  const note = state.declined ? "Card declined · try another card" : state.pin ? "Enter your PIN on the keypad" : state.due > LIMIT ? `Over RM ${LIMIT}: PIN needed` : "";
  setText(el.paynote, note);
  el.paypill.style.display = note ? "" : "none";
  setText(el.authnote, state.modes.offline ? "Please wait · 4G backup" : "Please wait");
  const queued = state.waiting.includes(state.order);
  setText(el.done1, state.noReceipt ? "No receipt today" : "Take your receipt");
  setText(el.done2, queued ? "Kitchen offline: order queued" : state.noReceipt ? "Please remember your number" : "and wait at the counter");
  let term;
  if (state.phase === "pay") term = state.pin ? ["ENTER PIN", "*".repeat(state.pin.digits) || "_"] : state.declined ? [rm(state.due), "DECLINED"] : [rm(state.due), state.card ? "READING" : "TAP CARD"];
  else term = { attract: ["WELCOME", ""], menu: ["WELCOME", ""], auth: [rm(state.due), state.modes.offline ? "VIA 4G" : "ONLINE"], done: [rm(state.due), "APPROVED"] }[state.phase];
  setText(el.term[0], term[0]);
  setText(el.term[1], term[1]);
}
function drawTouch() {
  const t = state.touch;
  if (!t) return false;
  const age = calm() ? 1 : (state.clock - t.at) / 0.45;
  if (age >= 1) {
    el.touch.style.opacity = "0";
    state.touch = null;
    return false;
  }
  el.touch.setAttribute("cx", t.x.toFixed(0));
  el.touch.setAttribute("cy", t.y.toFixed(0));
  el.touch.setAttribute("r", (24 + 80 * age).toFixed(1));
  el.touch.style.opacity = (1 - age).toFixed(3);
  return true;
}
function drawPulses(dt) {
  const hot = new Set();
  let lan = false;
  let store = false;
  state.pulses = state.pulses.filter((p) => {
    p.t += dt;
    if (p.t < 0) return true;
    const list = routes[p.route];
    const f = p.t / p.seconds;
    const pos = (p.reverse ? 1 - f : f) * (list.length + 1);
    list.forEach((g, i) => Math.abs(i - pos + 0.5) < 1.1 && hot.add(g));
    if (f <= 1 && /^lan\./.test(p.route)) lan = true;
    if (f <= 1 && /raceway|wan|kitchen|board/.test(p.route)) store = true;
    return p.t < p.seconds * 1.2;
  });
  for (const list of Object.values(routes)) for (const g of list) g.toggleAttribute("data-hot", hot.has(g));
  el.sw.forEach((g, i) => g.toggleAttribute("data-on", lan && Math.floor(state.clock * 14 + i * 1.7) % 2 === 0));
  el.store.forEach((g, i) => g.toggleAttribute("data-on", (i === 0 && !state.modes.offline) || (store && Math.floor(state.clock * 12 + i * 1.3) % 2 === 0)));
  const lte = state.pulses.some((p) => p.t >= 0 && /lte/.test(p.route));
  el.lte.forEach((g, i) => g.toggleAttribute("data-on", state.modes.offline && (i === 0 || (lte && Math.floor(state.clock * 12 + i * 1.3) % 2 === 0))));
  el.jack?.toggleAttribute("data-blink", state.modes.offline && (calm() || Math.floor(state.clock * 2) % 2 === 0));
  return state.pulses.length > 0;
}
function drawLeds() {
  const reading = state.card && state.clock - state.card.at > CARD_FLY ? (state.clock - state.card.at - CARD_FLY) / READ : -1;
  const lit = state.phase !== "pay" && state.phase !== "auth" ? 0 : state.declined ? 0 : reading < 0 ? 1 : Math.min(4, 1 + Math.floor(reading * 4));
  const done = state.phase === "done" && state.clock - state.phaseAt < 1.2 ? 4 : 0;
  el.nfc.forEach((g, i) => g.toggleAttribute("data-on", i < Math.max(lit, done)));
  el.light.toggleAttribute("data-on", state.phase === "attract");
  el.kprint.toggleAttribute("data-on", state.ticketAt >= 0 && state.clock - state.ticketAt < TICKET / FEED + 0.3);
}
function turnParts(dt) {
  const feeding = state.printAt >= 0 && state.clock < state.cutAt && !calm();
  if (!feeding) return false;
  state.hub += ROLL_W * dt;
  state.gear += ROLL_W * 4 * dt;
  el.hub.innerHTML = PARTS.spokes(D.hub.f, -0.02, D.hub.r0, D.hub.r1, 6, state.hub, "lo");
  el.gear.innerHTML = PARTS.spokes(D.gear.f, 0.81, 1.6, 2.6, 12, state.gear, "lo");
  return true;
}

function say() {
  let text;
  const t = state.clock - state.phaseAt;
  const mine = state.board.find((o) => o.mine && o.n === state.order);
  if (state.note && !calm() && state.clock < state.note.until) text = state.note.text;
  else if (state.phase === "attract") text = mine && mine.s === "ready" ? `pickup board · ${mine.n} ready` : "ready · touch to order";
  else if (state.phase === "menu") text = `menu · ${items()} item${items() === 1 ? "" : "s"} · ${rm(total())}`;
  else if (state.phase === "pay") {
    if (state.pin) text = `PIN · over the RM ${LIMIT} contactless limit · ${state.pin.digits}/4`;
    else if (state.declined && !state.card) text = "declined · the bank refused the card · try another";
    else if (!state.card) text = `terminal · ${rm(state.due)} · tap card`;
    else {
      const ct = state.clock - state.card.at;
      text = ct < CARD_FLY ? "card · to the reader" : `card · reading at ${M.nfc.mhz} MHz · ${Math.min(READ, ct - CARD_FLY).toFixed(2)} s`;
    }
  } else if (state.phase === "auth") text = `authorising · ${state.modes.offline ? "over the kiosk's 4G modem" : "store router to the bank"} · ${Math.min(M.auth.s, t).toFixed(1)} s`;
  else if (state.phase === "done") {
    const len = receiptLength();
    if (state.printAt >= 0 && len < RECEIPT) text = `printing · ${Math.round(len * M.unitMm)} / ${M.printer.receiptMm} mm · ${M.printer.mmPerS} mm/s`;
    else if (state.waiting.includes(state.order)) text = `order ${state.order} queued · kitchen offline`;
    else if (state.noReceipt && t < 3) text = `order ${state.order} · printer out of paper · number on screen`;
    else if (mine && mine.s === "prep") text = `kitchen · ${mine.n} preparing · ${M.kitchen.cookS / 60} min, shown ${M.kitchen.timelapse}× faster`;
    else if (mine && mine.s === "ready") text = `pickup board · ${mine.n} ready`;
    else if (t < 1.5) text = `approved · order ${state.order} to the kitchen`;
    else text = `order ${state.order} · ${state.noReceipt ? "remember your number" : "take your receipt"}`;
  }
  setText(readout, text);
}

function reset() {
  state.cart = M.menu.map(() => 0);
  state.due = 0;
  state.declined = false;
  state.pin = null;
  if (state.printAt >= 0) state.takeAt = state.clock;
  setPhase("attract");
  draw();
}

// ── tour: five short scenarios ──
const T = (i) => () => touchAt(...centre(SCREEN.tileBox(i)));
const start = () => touchAt(...centre(SCREEN.BUTTONS.start));
const pay = () => touchAt(...centre(SCREEN.BUTTONS.pay));
const clear = () => ["paper", "offline", "decline"].forEach((id) => state.modes[id] && setMode(id, false));
const SCENES = [
  [[0.2, clear], [1.6, start], [3.2, T(0)], [4.3, T(1)], [5.4, T(2)], [6.8, pay], [8.6, tapCard], [22, reset], [25, null]],
  [[0.2, clear], [0.6, () => setMode("decline", true)], [1.6, start], [3.2, T(3)], [4.3, T(5)], [5.7, pay], [7.4, tapCard], [13.2, tapCard], [30, reset], [33, null]],
  [[0.2, clear], [1.2, bigOrder], [3.6, pay], [5.4, tapCard], [27, reset], [30, null]],
  [[0.2, clear], [0.6, () => setMode("offline", true)], [1.6, start], [3.2, T(0)], [4.3, T(4)], [5.7, pay], [7.4, tapCard], [16, () => setMode("offline", false)], [30, reset], [33, null]],
  [[0.2, clear], [0.6, () => setMode("paper", true)], [1.6, start], [3.2, T(2)], [4.3, T(1)], [5.7, pay], [7.4, tapCard], [17, () => setMode("paper", false)], [20, reset], [23, null]],
];
let frame = 0;
let last = 0;
let visible = false;
let touring = !still.matches;
let scene = 0;
let tourClock = 0;
let tourIndex = 0;
let idle = 0;
function tourStep(dt) {
  tourClock += dt;
  const list = SCENES[scene];
  while (tourIndex < list.length && tourClock >= list[tourIndex][0]) {
    const action = list[tourIndex][1];
    tourIndex++;
    if (action) action();
    else {
      scene = (scene + 1) % SCENES.length;
      tourClock = 0;
      tourIndex = 0;
      return;
    }
  }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  state.clock += dt;
  if (touring) tourStep(dt);
  const due = state.queue.filter((q) => q.at <= state.clock);
  state.queue = state.queue.filter((q) => q.at > state.clock);
  due.forEach((q) => q.fn());
  if (state.phase === "done" && !touring && state.clock - state.phaseAt > 9 && state.takeAt < 0) reset();
  if (state.phase === "auth" && el.spin) el.spin.setAttribute("transform", `rotate(${((state.clock * 300) % 360).toFixed(1)} 540 860)`);
  const busy = [drawTouch(), drawCard(), drawPin(), drawPulses(dt), drawReceipt(), drawTicket(), turnParts(dt), stepBoard(dt)].some(Boolean);
  drawLeds();
  draw();
  say();
  const alive = touring || busy || (state.modes.offline && !calm()) || state.queue.length > 0 || state.phase === "auth" || state.board.some((o) => o.mine) || (state.phase === "done" && state.clock - state.phaseAt < 10);
  frame = visible && alive ? requestAnimationFrame(tick) : 0;
}
function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
function takeOver() {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(function resume() {
    if (still.matches) return;
    if (state.phase !== "attract" || state.card || state.pin || state.queue.length) {
      idle = setTimeout(resume, 2000);
      return;
    }
    touring = true;
    scene = 0;
    tourClock = 0;
    tourIndex = 0;
    run();
  }, 12000);
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

function useTool(id) {
  takeOver();
  if (id === "big") bigOrder();
  else setMode(id, !state.modes[id]);
}
for (const [id, button] of Object.entries(tools)) button.addEventListener("click", () => useTool(id));
stage.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    takeOver();
    if (state.phase === "pay") tapCard();
    else nextTouch();
  } else if (key >= "1" && key <= "6") {
    event.preventDefault();
    takeOver();
    if (state.phase === "attract") nextTouch();
    else if (state.phase === "menu") touchAt(...centre(SCREEN.tileBox(Number(key) - 1)));
  } else if (key === "c") {
    event.preventDefault();
    takeOver();
    tapCard();
  } else if (key === "p" || key === "n" || key === "d" || key === "b") {
    event.preventDefault();
    useTool({ p: "paper", n: "offline", d: "decline", b: "big" }[key]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    takeOver();
    if (!state.card && !state.pin && state.phase !== "auth") reset();
  }
});
svg.addEventListener("click", (event) => {
  if (event.target.closest('[data-part="card-home"], [data-part="card"]')) {
    takeOver();
    tapCard();
    stage.focus({ preventScroll: true });
    return;
  }
  if (event.target.closest('[data-name="bezel"]')) {
    const m = el.ui.getScreenCTM();
    if (!m) return;
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
    if (pt.x < 0 || pt.y < 0 || pt.x > SCREEN.W || pt.y > SCREEN.H) return;
    takeOver();
    touchAt(pt.x, pt.y);
    stage.focus({ preventScroll: true });
  }
});

el.pc.toggleAttribute("data-on", true);
el.psu.toggleAttribute("data-on", true);
stepBoard(0);
draw();
drawLeds();
say();
if (still.matches) touring = false;
