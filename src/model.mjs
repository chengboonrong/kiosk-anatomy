// The truth the figure shows: a 27-inch portrait ordering kiosk with a semi-integrated card terminal.
// Every number on the page (readout, screen, receipt length, timings) comes from here.
export const MODEL = {
  unitMm: 5,
  panel: { inch: 27, px: [1080, 1920], mm: [336.2, 597.7] },
  touch: { scanHz: 120 },
  menu: [
    { id: "burger", name: "Burger", price: 12.9 },
    { id: "fries", name: "Fries", price: 5.5 },
    { id: "tea", name: "Teh ais", price: 3.2 },
    { id: "nuggets", name: "Nuggets", price: 9.9 },
    { id: "sundae", name: "Sundae", price: 4.5 },
    { id: "kopi", name: "Kopi", price: 3.8 },
  ],
  nfc: { mhz: 13.56, readS: 0.45, rangeMm: 40, limit: 250 },
  auth: { s: 1.6 },
  printer: { mmPerS: 150, dotsPerMm: 8, paperMm: 80, printMm: 72, receiptMm: 120, cutS: 0.3 },
  roll: { dMm: 150, coreMm: 25, paperMm: 0.075 },
  firstOrder: 247,
  kitchen: { cookS: 180, timelapse: 30, ticketMm: 80 },
  bigOrder: [9, 9, 0, 9, 0, 0],
};

export const rm = (v) => `RM ${v.toFixed(2)}`;
export const dotsPerLine = (p = MODEL.printer) => p.printMm * p.dotsPerMm;
export const rollMetres = (r = MODEL.roll) => (Math.PI * (r.dMm ** 2 - r.coreMm ** 2)) / (4 * r.paperMm) / 1000;
