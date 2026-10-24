// The kiosk app as the panel shows it, in panel pixels (1080 × 1920, portrait).
export const SCREEN = (() => {
  const W = 1080;
  const H = 1920;
  const TILE = { x0: 60, y0: 220, w: 460, h: 420, gx: 500, gy: 460 };
  const tileBox = (i) => ({ x: TILE.x0 + (i % 2) * TILE.gx, y: TILE.y0 + Math.floor(i / 2) * TILE.gy, w: TILE.w, h: TILE.h });
  const BUTTONS = {
    start: { x: 240, y: 1400, w: 600, h: 160 },
    pay: { x: 600, y: 1690, w: 420, h: 170 },
    cancel: { x: 60, y: 1700, w: 340, h: 140 },
  };
  const n = (v) => Math.round(v * 10) / 10;
  const rr = (b, r, cls, extra = "") => `<rect class="${cls}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${r}"${extra}/>`;
  const tx = (x, y, size, str, { cls = "ks-tx", anchor = "start", extra = "" } = {}) =>
    `<text class="${cls}" x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}"${extra}>${str}</text>`;

  // Simple flat icons, centred on (cx, cy), about 200 px across.
  const ICONS = {
    burger: (cx, cy) =>
      `<path class="ks-ic" d="M${cx - 100} ${cy - 10}a100 80 0 0 1 200 0z"/>` +
      `<rect class="ks-ic2" x="${cx - 108}" y="${cy + 2}" width="216" height="22" rx="11"/>` +
      `<rect class="ks-ic" x="${cx - 100}" y="${cy + 34}" width="200" height="30" rx="8"/>` +
      `<path class="ks-ic" d="M${cx - 100} ${cy + 74}h200v14a26 26 0 0 1-26 26h-148a26 26 0 0 1-26-26z"/>`,
    fries: (cx, cy) =>
      [-60, -30, 0, 30, 60].map((dx, i) => `<rect class="ks-ic2" x="${cx + dx - 11}" y="${cy - 100 + (i % 2) * 24}" width="22" height="120" rx="6"/>`).join("") +
      `<path class="ks-ic" d="M${cx - 86} ${cy - 10}h172l-22 124h-128z"/>`,
    tea: (cx, cy) =>
      `<path class="ks-ic" d="M${cx - 66} ${cy - 80}h132l-16 190h-100z"/>` +
      `<rect class="ks-ic2" x="${cx - 6}" y="${cy - 140}" width="12" height="90" rx="6"/>` +
      `<path class="ks-ic2" d="M${cx - 58} ${cy - 30}h116l-4 40h-108z"/>`,
    nuggets: (cx, cy) =>
      [[-56, -20, 52, 40], [50, -30, 48, 38], [-4, 40, 56, 40]].map(([dx, dy, rx, ry]) => `<ellipse class="ks-ic" cx="${cx + dx}" cy="${cy + dy}" rx="${rx}" ry="${ry}"/>`).join(""),
    sundae: (cx, cy) =>
      `<path class="ks-ic2" d="M${cx - 70} ${cy - 20}a70 70 0 0 1 140 0z"/>` +
      `<path class="ks-ic" d="M${cx - 84} ${cy - 20}h168l-34 90h-100z"/>` +
      `<rect class="ks-ic" x="${cx - 14}" y="${cy + 70}" width="28" height="40"/>` +
      `<rect class="ks-ic" x="${cx - 60}" y="${cy + 108}" width="120" height="16" rx="8"/>`,
    kopi: (cx, cy) =>
      `<path class="ks-ic" d="M${cx - 80} ${cy - 50}h140v90a50 50 0 0 1-50 50h-40a50 50 0 0 1-50-50z"/>` +
      `<path class="ks-ic2" d="M${cx + 60} ${cy - 30}a34 34 0 0 1 0 68v-20a14 14 0 0 0 0-28z"/>` +
      `<rect class="ks-ic" x="${cx - 110}" y="${cy + 96}" width="200" height="14" rx="7"/>`,
  };

  function svg(menu) {
    const out = [];
    out.push(`<rect class="ks-bg" x="0" y="0" width="${W}" height="${H}"/>`);
    // attract
    out.push(`<g data-mode="attract">`);
    out.push(`<circle class="ks-ring" cx="540" cy="560" r="230"/>`, ICONS.burger(540, 560));
    out.push(tx(540, 1000, 96, "Touch to order", { anchor: "middle", cls: "ks-tx ks-big" }));
    out.push(tx(540, 1100, 52, "Sentuh untuk pesan", { anchor: "middle", cls: "ks-tx ks-soft" }));
    out.push(rr(BUTTONS.start, 80, "ks-btn") + tx(540, 1505, 72, "Start", { anchor: "middle", cls: "ks-tx ks-inv" }));
    out.push(tx(540, 1780, 44, "Eat in · Take away", { anchor: "middle", cls: "ks-tx ks-soft" }));
    out.push(`</g>`);
    // menu
    out.push(`<g data-mode="menu" style="display:none">`);
    out.push(`<rect class="ks-bar" x="0" y="0" width="${W}" height="170"/>` + tx(60, 116, 76, "Menu", { cls: "ks-tx ks-big" }) + tx(1020, 108, 40, "EN · BM", { anchor: "end", cls: "ks-tx ks-soft" }));
    menu.forEach((item, i) => {
      const b = tileBox(i);
      out.push(`<g data-tile="${i}">${rr(b, 36, "ks-tile")}${ICONS[item.id](b.x + b.w / 2, b.y + 170)}`);
      out.push(tx(b.x + 40, b.y + 340, 54, item.name, { cls: "ks-tx" }) + tx(b.x + 40, b.y + 394, 42, `RM ${item.price.toFixed(2)}`, { cls: "ks-tx ks-soft" }));
      out.push(`<g data-badge="${i}" style="display:none"><circle class="ks-dot" cx="${b.x + b.w - 54}" cy="${b.y + 54}" r="36"/>${tx(b.x + b.w - 54, b.y + 70, 44, "1", { anchor: "middle", cls: "ks-tx ks-inv", extra: ` data-count="${i}"` })}</g></g>`);
    });
    out.push(`<rect class="ks-bar" x="0" y="1640" width="${W}" height="280"/>`);
    out.push(tx(60, 1728, 46, "0 items", { cls: "ks-tx ks-soft", extra: ' data-part="items"' }));
    out.push(tx(60, 1820, 76, "RM 0.00", { cls: "ks-tx ks-big", extra: ' data-part="total"' }));
    out.push(`<g data-part="paybtn">${rr(BUTTONS.pay, 50, "ks-btn")}${tx(810, 1800, 72, "Pay", { anchor: "middle", cls: "ks-tx ks-inv" })}</g>`);
    out.push(`</g>`);
    // pay
    out.push(`<g data-mode="pay" style="display:none">`);
    out.push(`<rect class="ks-bar" x="0" y="0" width="${W}" height="170"/>` + tx(60, 116, 76, "Pay", { cls: "ks-tx ks-big" }));
    out.push(tx(540, 470, 60, "Total", { anchor: "middle", cls: "ks-tx ks-soft" }));
    out.push(tx(540, 620, 136, "RM 0.00", { anchor: "middle", cls: "ks-tx ks-big", extra: ' data-part="due"' }));
    out.push(tx(540, 820, 56, "Tap, insert or swipe", { anchor: "middle", cls: "ks-tx" }));
    out.push(tx(540, 900, 56, "your card below", { anchor: "middle", cls: "ks-tx" }));
    out.push(`<g data-part="paypill" style="display:none"><rect class="ks-btn" x="110" y="940" width="860" height="110" rx="55"/>${tx(540, 1012, 54, "", { anchor: "middle", cls: "ks-tx ks-inv", extra: ' data-part="paynote"' })}</g>`);
    out.push(`<g data-part="arrow" transform="translate(0 70)"><rect class="ks-tile" x="560" y="1020" width="250" height="160" rx="22"/><rect class="ks-ic2" x="600" y="1060" width="50" height="40" rx="6"/>`);
    out.push(`<path class="ks-ic" d="M665 1230h40v240h70l-90 110l-90-110h70z"/></g>`);
    out.push(rr(BUTTONS.cancel, 40, "ks-tile") + tx(230, 1790, 52, "Cancel", { anchor: "middle", cls: "ks-tx" }));
    out.push(`</g>`);
    // authorising
    out.push(`<g data-mode="auth" style="display:none">`);
    out.push(`<circle class="ks-ring" cx="540" cy="860" r="130"/><path class="ks-spin" data-part="spin" d="M540 730a130 130 0 0 1 130 130"/>`);
    out.push(tx(540, 1200, 68, "Authorising", { anchor: "middle", cls: "ks-tx ks-big" }));
    out.push(tx(540, 1290, 48, "Please wait", { anchor: "middle", cls: "ks-tx ks-soft", extra: ' data-part="authnote"' }));
    out.push(tx(540, 1450, 60, "RM 0.00", { anchor: "middle", cls: "ks-tx", extra: ' data-part="due2"' }));
    out.push(`</g>`);
    // done
    out.push(`<g data-mode="done" style="display:none">`);
    out.push(tx(540, 420, 92, "Thank you", { anchor: "middle", cls: "ks-tx ks-big" }));
    out.push(tx(540, 660, 56, "Your order number", { anchor: "middle", cls: "ks-tx ks-soft" }));
    out.push(tx(540, 1010, 300, "247", { anchor: "middle", cls: "ks-tx ks-num", extra: ' data-part="order"' }));
    out.push(tx(540, 1300, 56, "Take your receipt", { anchor: "middle", cls: "ks-tx", extra: ' data-part="done1"' }));
    out.push(tx(540, 1380, 56, "and wait at the counter", { anchor: "middle", cls: "ks-tx", extra: ' data-part="done2"' }));
    out.push(`</g>`);
    out.push(`<circle class="ks-touch" data-part="touch" cx="0" cy="0" r="40" style="opacity:0"/>`);
    return out.join("");
  }
  return { W, H, TILE, tileBox, BUTTONS, svg, n };
})();

// The order-status board at the pickup point, in panel pixels (1280 × 720, landscape).
export const BOARD = (() => {
  const W = 1280;
  const H = 720;
  const SLOTS = [[70, 330], [330, 330], [70, 500], [330, 500], [70, 670], [330, 670]];
  const tx = (x, y, size, str, cls, extra = "") => `<text class="${cls}" x="${x}" y="${y}" font-size="${size}"${extra}>${str}</text>`;
  function svg() {
    const out = [`<rect class="ks-bg" x="0" y="0" width="${W}" height="${H}"/>`];
    out.push(`<rect class="ks-bar" x="0" y="0" width="${W}" height="130"/>`);
    out.push(tx(60, 90, 60, "Preparing", "ks-tx ks-big") + tx(700, 90, 60, "Ready", "ks-tx ks-big"));
    out.push(`<rect class="ks-ic2" x="636" y="160" width="8" height="530" rx="4"/>`);
    SLOTS.forEach(([x, y], i) => {
      out.push(tx(x, y, 130, "", "ks-tx ks-soft", ` data-prep="${i}"`));
      out.push(tx(x + 640, y, 130, "", "ks-tx ks-num", ` data-ready="${i}"`));
    });
    return out.join("");
  }
  return { W, H, SLOTS, svg };
})();
