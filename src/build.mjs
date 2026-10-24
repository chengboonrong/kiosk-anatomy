import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { tubePieces, tubeSvg, crossingsOf } from "./kit/tube.mjs";
import * as A from "./kit/audit.mjs";
import { makeParts } from "./parts.mjs";
import { SCREEN, BOARD } from "./screen.mjs";
import { MODEL, rm, dotsPerLine, rollMetres } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = join(HERE, "kit");
const kitScript = () => readFileSync(join(KIT, "iso-kit.mjs"), "utf8").replace(/^export /gm, "");
const THEME = process.argv.includes("--light") ? "light" : "dark";

const W = 600;
const H = 760;
const AZIMUTH = 148;
const ELEVATION = 26;
const U = MODEL.unitMm;

const PLATE = { x: -114, y: -16, w: 198, d: 172, r: 10 };
const PLATE_H = 10;
const FOOT_H = 5;
const XI = 52;
const XW = 55;
const TOPZ = 352;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-XW, 0, TOPZ], [XW, 0, TOPZ], [XW, 66, TOPZ], [-XW, 66, TOPZ], [-XW, 90, 120], [XW, 90, 120]],
  W,
  H,
  { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const Faded = (list, style) => k.fadedSvg(list, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const f2 = (v) => Math.round(v * 100) / 100;
const PARTS = makeParts(k, G, P);
const { prismPaths, roundRect } = PARTS;

const R = A.recorder(P);
const record = R.solid;
function put(name, ref, svg, shapes = [], { bias = 0, ...rest } = {}) {
  return R.put({ name, at: ref, bias, svg, shapes, piece: "kiosk", ...rest });
}
const XF = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
function board(name, poly, x0, x1, style = {}, { extra = "", inner = "", bias = 0, ref } = {}) {
  const shape = record(A.prism(XF, poly, x0, x1, { name }));
  const cy = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  put(name, ref ?? [(x0 + x1) / 2, cy, cz], S(prismPaths(XF, poly, x0, x1), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
  return shape;
}
function prism(name, F, poly, s0, s1, style = {}, { extra = "", inner = "", bias = 0, ref, owner, attrs } = {}) {
  const shape = record(A.prism(F, poly, s0, s1, { name, owner }));
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  const centre = G.add3(G.add3(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), G.mul3(F.u, cx)), G.mul3(F.v, cy));
  put(name, ref ?? centre, S(prismPaths(F, poly, s0, s1), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs });
  return shape;
}
const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
function box(name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.4, steps = 2, bevel = 0, extra = "", inner = "", bias = 0, owner, attrs } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  const shape = record(A.slab(plan, z0, z1 - z0, { name, owner }, steps));
  put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs });
  return shape;
}
const seamOf = ([x0, y0], [x1, y1], z, r = 0.4, steps = 2) => k.sideSeam({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r }, z, P, steps);
function turned(name, F, profile, style = {}, { extra = "", inner = "", bias = 0, smooth, steps, rims, bevel = 0, owner, hole, attrs } = {}) {
  const opts = { bevel, ...(smooth !== undefined ? { smooth } : {}), ...(steps ? { steps } : {}), ...(rims ? { rims } : {}) };
  const paths = G.solidOf(profile, F, P, opts);
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = record(A.solid(F, profile, { name, owner, radius: smooth && smooth.radius ? smooth.radius : null }));
  put(name, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs });
  return shape;
}
function disc(name, F, s0, s1, r, style = {}, options = {}) {
  return turned(name, F, [[s0, r], [s1, r]], style, options);
}
function ring(name, F, s0, s1, rIn, rOut, style = {}, { extra = "", bias = 0, owner } = {}) {
  const shape = record(A.ring(F, s0, s1, rIn, rOut, { name, owner }));
  put(name, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.ringBand(s0, s1, rIn, rOut, F, P), { tone: "mid", ...style }) + extra, [shape], { bias });
  return shape;
}
function planeMatrix(o, ex, ey) {
  const p0 = at(o);
  const px = at(G.add3(o, ex));
  const py = at(G.add3(o, ey));
  const v = (x) => x.toFixed(4);
  return `matrix(${v(px[0] - p0[0])} ${v(px[1] - p0[1])} ${v(py[0] - p0[0])} ${v(py[1] - p0[1])} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)})`;
}
const flat = (ring) => `M${ring.map(([u, w]) => `${f2(u)} ${f2(w)}`).join("L")}Z`;

const CABLES = [];
const UNPLUG = { at: 0 };
const CLAMP_T = 0.75;
function cable(name, points, r = 0.5, { tone = "mid", bend = 3, ends = [true, true], shells = [false, false], rings, maxLength = 14, bias = 0.05, limp = true, touch, bundle, gaps: through = [], clamps = [], clampsAt = [], floorAt = null, breaks = [] } = {}) {
  const route = G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
  const total = G.pathLength(route);
  const held = [...clamps, ...clampsAt].flatMap((c) => crossingsOf(route, c, [0, 0, 1], 4)).map((at) => [at - CLAMP_T, at + CLAMP_T]);
  if (floorAt) {
    const top = crossingsOf(route, [floorAt[0], floorAt[1], 19.8], [0, 0, 1], 2)[0];
    const bottom = crossingsOf(route, [floorAt[0], floorAt[1], 15.6], [0, 0, 1], 2)[0];
    held.push([Math.min(top, bottom), Math.max(top, bottom)]);
  }
  const SHELL = Math.max(1.6, r * 2.4);
  const gaps = [...(shells[0] ? [[0, SHELL]] : []), ...through.map(([a, b]) => [a < 0 ? total + a : a, b < 0 ? total + b : b]), ...held, ...(shells[1] ? [[total - SHELL, total]] : [])];
  R.route(name, route, r, { gaps, limp, touch, bundle, rims: shells.map((on) => (on ? r * 1.9 : r)), piece: "kiosk" });
  CABLES.push(name);
  tubePieces(route, r, P, { maxLength, spacing: Math.max(0.6, Math.min(1.6, r)), gaps, breaks: typeof breaks === "function" ? breaks(route) : breaks, ...(rings ? { rings } : {}) }).forEach((piece, index) =>
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone }), [A.tube(piece.points, piece.radii)], { bias, route: name, chunk: index, attrs: ` data-route="${name}" data-chunk="${index}" data-to="${piece.to.toFixed(2)}"` }),
  );
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    if (shells[index]) {
      const tangent = G.tangentAlong(route, index ? total : 0);
      const F = G.frameAlong(end, tangent);
      const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
      const shape = record(A.disc(F, s0, s1, r * 1.9, { name: `${name}.shell${index}`, owner: name }));
      put(`${name}.shell${index}`, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), `<g data-route="${name}" data-chunk="${index ? 999 : -1}">${S(G.disc(s0, s1, r * 1.9, F, P, { steps: 20, bevel: 0.2 }), { tone: "mid" })}</g>`, [shape], { bias: bias + 0.1 });
    } else if (ends[index]) {
      const size = Math.max(0.5, r * KS * 0.9);
      put(`${name}.end${index}`, end, Dots([at(end)], { size, tone: "hi" }), [A.ball(end, size / KS, { name: `${name}.end${index}`, owner: name })], { bias: bias + 0.15 });
    }
  });
  return route;
}

// ───────────────────────── bench ─────────────────────────
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
  back.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
}
back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
back.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
const plateScrews = k.corners(PLATE, 10);
back.push(Ln(plateScrews.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(plateScrews.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
record(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate", ground: true }, 8));
const STRIP = { x: PLATE.x + PLATE.w - 13, y: PLATE.y + 14, w: 6, d: 112, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(STRIP.y + 4, STRIP.y + STRIP.d - 4, 4, 5, STRIP.x, 0.6, [1.8, 3.4], P, "y");
back.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
// The card rests on a rubber pad in front of the kiosk.
const PAD = { x: -64, y: 86, w: 26, d: 17, r: 2 };
back.push(`<path class="iso-halo" d="${k.haloOf(PAD, 0, 1, P)}"/>`);
back.push(S(k.slabOf(PAD, 0, 0.8, P, 4, 0.3), { tone: "lo" }));
back.push(Ln(k.planOutline(k.insetPlan(PAD, 1.6), 0.8, P, 4), { tone: "faint" }));
const CARD_REST = { o: [PAD.x + PAD.w / 2, PAD.y + PAD.d / 2, 0.8] };

// ───────────────────────── kiosk shell ─────────────────────────
const WALL = [[0, 16], [70, 16], [70, 118], [90, 118], [90, 120], [82, 184], [78, 184], [66, 332], [66, 352], [0, 352]];
for (const [x, y] of byDepth([[-42, 10], [42, 10], [-42, 58], [42, 58]])) {
  const F = G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const shapes = [record(A.disc(F, 0, 1.2, 3.4, { name: "leveler.pad" })), record(A.disc(F, 1.2, 2.4, 2.4, { name: "leveler.nut" })), record(A.disc(F, 2.4, 4, 1, { name: "leveler.stem" }))];
  put("leveler", [x, y, 2], S(G.disc(0, 1.2, 3.4, F, P, { steps: 32 }), { tone: "lo" }) + S(G.disc(1.2, 2.4, 2.4, F, P, { steps: 6 }), { tone: "mid" }) + S(G.disc(2.4, 4, 1, F, P, { steps: 16 }), { tone: "mid" }), shapes);
}
box("plinth.base", [-48, 4, 4], [48, 64, 5.4], { tone: "lo" });
board("plinth.back", [[4, 5.4], [6, 5.4], [6, 16], [4, 16]], -48, 48, { tone: "lo" });
board("plinth.kick", [[62, 5.4], [64, 5.4], [64, 16], [62, 16]], -48, 48, { tone: "lo" }, { extra: Dots([-40, -14, 14, 40].map((x) => at([x, 64, 10.6])), { size: 0.45 }) });
box("plinth.far", [46, 6, 5.4], [48, 62, 16], { tone: "lo" });

const signed = PARTS.signed;
const wallPaths = prismPaths(XF, WALL, XI, XW);
const ringW = signed(WALL) > 0 ? WALL : [...WALL].reverse();
const tFacing = ringW.map(([y0, z0], i) => {
  const [y1, z1] = ringW[(i + 1) % ringW.length];
  return G.dot3(G.unit3([0, z1 - z0, -(y1 - y0)]), V) > 1e-9;
});
const bead = PARTS.runsOf(tFacing, true).map((run) => path3(run.map((i) => [XI + 1.2, ...ringW[i]]))).join("");
put("wall", [XW, 40, 180], S(wallPaths, { tone: "mid", inner: Ln(bead, { tone: "lo" }) }), [record(A.prism(XF, WALL, XI, XW, { name: "wall" }))], { bias: -400 });
box("cleat.floor", [48, 6, 19], [52, 64, 22], { tone: "lo" });
box("cleat.back", [48, 3, 22], [52, 6, 346], { tone: "lo" });
box("cleat.top", [48, 6, 346], [52, 62, 350], { tone: "lo" });
box("cleat.front", [48, 64, 22], [52, 68, 114], { tone: "lo" });
box("cleat.shelf", [48, 14, 114], [52, 64, 118], { tone: "lo" });

board("floor", [[3, 16], [68, 16], [68, 19], [3, 19]], -XI, XI, { tone: "lo" }, { extra: Dots([[-46, 8], [46, 8], [-46, 62], [46, 62]].map(([x, y]) => at([x, y, 19])), { size: 0.45 }) });
board("back", [[0, 16], [3, 16], [3, 350], [0, 350]], -XI, XI, {}, { bias: -300 });
board("top", [[0, 350], [66, 350], [66, 352], [0, 352]], -XI, XI, {}, {
  extra: Ln(Array.from({ length: 10 }, (_, i) => k.planOutline({ x: -36 + i * 7.6, y: 10, w: 3, d: 26, r: 1.5 }, 352, P, 3)).join(""), { tone: "faint" }),
});
board("front", [[68, 16], [70, 16], [70, 118], [68, 118]], -XI, XI);
board("shelf", [[14, 118], [90, 118], [90, 120], [14, 120]], -XI, XI, { tone: "lo" }, { extra: Dots([[-46, 18], [46, 18], [-46, 64], [46, 64]].map(([x, y]) => at([x, y, 120])), { size: 0.45 }) });
board("chin.front", [[90, 120], [82, 184], [80, 184], [88, 120]], -XI, XI);
board("chin.top", [[68, 182], [80, 182], [80, 184], [68, 184]], -XI, XI, { tone: "lo" });
board("header", [[64, 332], [66, 332], [66, 350], [64, 350]], -XI, XI);

// Header: status light bar, camera, speaker grille.
put("lightbar", [0, 66.6, 335.2], `<g class="ks-lamp" data-part="lightbar">${S(k.slabOf({ x: -46, y: 66, w: 92, d: 1.2, r: 0.6 }, 334, 2.4, P, 3, 0.3), { tone: "hi" })}</g>`, [record(A.box([-46, 66, 334], [46, 67.2, 336.4], { name: "lightbar" }))], { bias: 0.3 });
{
  const CAM = G.frameAlong([0, 66, 343.4], [0, 1, 0]);
  disc("camera.bezel", CAM, 0, 0.6, 2.6, { tone: "mid" });
  disc("camera.lens", CAM, 0.6, 1.1, 1.3, { tone: "hi" }, { extra: Ln(G.circleOf(CAM, 1.1, 0.6, P, 20), { tone: "lo" }) });
}
put("grille", [35, 66.05, 343], Ln(Array.from({ length: 6 }, (_, i) => path3([[27 + i * 3, 66.03, 338.6], [28.4 + i * 3, 66.03, 338.6], [28.4 + i * 3, 66.03, 347.6], [27 + i * 3, 66.03, 347.6]], true)).join(""), { tone: "lo" }), [record(A.box([27, 66, 338.6], [44.4, 66.05, 347.6], { name: "grille" }))], { bias: 0.1 });
put("grille", [-35, 66.05, 343], Ln(Array.from({ length: 6 }, (_, i) => path3([[-44 + i * 3, 66.03, 338.6], [-42.6 + i * 3, 66.03, 338.6], [-42.6 + i * 3, 66.03, 347.6], [-44 + i * 3, 66.03, 347.6]], true)).join(""), { tone: "lo" }), [record(A.box([-44, 66, 338.6], [-27.4, 66.05, 347.6], { name: "grille.l" }))], { bias: 0.1 });

// Lower front: a locked service door with louvres and a model plate.
box("door.plate", [-44, 70, 28], [44, 71, 112], { tone: "mid" }, { r: 1, steps: 3, bevel: 0.4 });
put("door.louvres", [0, 71.05, 44], Ln(Array.from({ length: 7 }, (_, i) => path3([[-24, 71.03, 36 + i * 3.2], [24, 71.03, 36 + i * 3.2], [24, 71.03, 37.4 + i * 3.2], [-24, 71.03, 37.4 + i * 3.2]], true)).join(""), { tone: "lo" }), [record(A.box([-24, 71, 36], [24, 71.05, 57], { name: "door.louvres" }))], { bias: 0.1 });
disc("door.lock", G.frameAlong([36, 71, 98], [0, 1, 0]), 0, 1.4, 2.2, { tone: "mid" }, { extra: Ln(path3([[36, 72.42, 96.9], [36, 72.42, 99.1]]), { tone: "lo", free: true }) });
for (const z of [40, 100]) disc("door.hinge", G.frameAlong([-44.9, 70.9, z], [0, 0, 1]), -3, 3, 0.9, { tone: "mid" });
box("door.label", [-36, 71, 98], [-16, 71.5, 106], { tone: "lo" }, { extra: Ln(path3([[-34, 71.52, 103.4], [-22, 71.52, 103.4]]) + path3([[-34, 71.52, 100.6], [-26, 71.52, 100.6]]), { tone: "lo", free: true }) });

// ───────────────────────── screen ─────────────────────────
const BEZEL_T = [66, 332];
const BEZEL_B = [78, 184];
const bd = G.unit3([0, BEZEL_B[0] - BEZEL_T[0], BEZEL_B[1] - BEZEL_T[1]]);
const NB = [0, -bd[2], bd[1]];
const C3 = [0, (BEZEL_T[0] + BEZEL_B[0]) / 2, (BEZEL_T[1] + BEZEL_B[1]) / 2];
const HALF_LEN = Math.hypot(BEZEL_T[0] - BEZEL_B[0], BEZEL_T[1] - BEZEL_B[1]) / 2;
const ACTIVE = { u: MODEL.panel.mm[0] / U / 2, w: MODEL.panel.mm[1] / U / 2 };
const OPEN = { u: ACTIVE.u + 1.6, w: ACTIVE.w + 1.6, r: 2 };
const SCREEN_W0 = -3;
const FACE_OFF = -1.2;
const bezelPt = (u, w, off = 0) => G.add3(G.add3(G.add3(C3, [u, 0, 0]), G.mul3(bd, w)), G.mul3(NB, off));
const bezelMatrix = (off) => planeMatrix(bezelPt(0, 0, off), [1, 0, 0], bd);

const MON_A = G.mul3(NB, -1);
const monPoint = (u, w, s) => G.add3(G.add3(G.add3(C3, G.mul3([1, 0, 0], u)), G.mul3(bd, w)), G.mul3(MON_A, s));
const MON = G.frameOf(C3, MON_A, [1, 0, 0], bd);
prism("lcd", MON, rect(-38, 38, -68, 66), 1.6, 9.6, { tone: "mid" }, { inner: "" });
prism("lcd.vesa", MON, rect(-10, 10, -10, 10), 9.6, 10.6, { tone: "lo" }, { extra: Dots([[-7.5, -7.5], [7.5, -7.5], [-7.5, 7.5], [7.5, 7.5]].map(([u, w]) => at(monPoint(u, w, 9.6))), { size: 0.4, tone: "lo" }) });
box("arm.plate", [-8, 3, 249], [8, 4, 265], { tone: "lo" }, { extra: Dots([[-6, 251], [6, 251], [-6, 263], [6, 263]].map(([x, z]) => at([x, 4, z])), { size: 0.45 }) });
box("arm", [-4, 4, 254], [4, 61.2, 260], { tone: "mid" }, { inner: Ln(seamOf([-4, 4], [4, 61.2], 257), { tone: "faint" }) });

// The touch controller sits on the display arm, a flat cable from the glass on one side and USB to the PC on the other.
const TBF = G.frameOf([-4, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
const tbPoint = (y, z, out) => [-4 - out, y, z];
for (const [y, z] of [[15.4, 255], [30.6, 255], [15.4, 259], [30.6, 259]]) disc("touch.standoff", G.frameAlong(tbPoint(y, z, 0), [-1, 0, 0]), 0, 1.2, 0.5, { tone: "lo" });
prism("touch.board", TBF, rect(14, 32, 250.5, 263.5), 1.2, 1.8, { tone: "lo" }, { extra: Ln(path3([[-5.82, 18.4, 255.6], [-5.82, 20, 255.6], [-5.82, 20, 257.4]]) + path3([[-5.82, 25, 257], [-5.82, 28, 257], [-5.82, 28, 259]]), { tone: "faint" }) });
prism("touch.chip", TBF, rect(20, 25, 254.6, 259.4), 1.8, 2.4, { tone: "hi" }, { extra: Dots([at(tbPoint(20.8, 258.6, 2.4))], { size: 0.32, tone: "lo" }) });
prism("touch.fpc", TBF, rect(27.6, 31.4, 259, 262.4), 1.8, 2.6, { tone: "mid" });
prism("touch.usb", TBF, rect(15, 18, 250.5, 253), 1.8, 3.2, { tone: "mid" });

const openRing = roundRect(-OPEN.u, OPEN.u, SCREEN_W0 - OPEN.w, SCREEN_W0 + OPEN.w, OPEN.r, 4);
const activeRing = roundRect(-ACTIVE.u, ACTIVE.u, SCREEN_W0 - ACTIVE.w, SCREEN_W0 + ACTIVE.w, 0.4, 2);
const bezelFace = `M${-XI} ${-HALF_LEN}H${XI}V${HALF_LEN}H${-XI}Z` + flat([...openRing].reverse());
const recess = [];
{
  const n = openRing.length;
  for (let i = 0; i < n; i++) {
    const [a, b] = [openRing[i], openRing[(i + 1) % n]];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - SCREEN_W0];
    const inward = G.unit3(G.add3(G.mul3([1, 0, 0], -mid[0]), G.mul3(bd, -mid[1])));
    const along = G.unit3(G.add3(G.mul3([1, 0, 0], b[0] - a[0]), G.mul3(bd, b[1] - a[1])));
    let normal = G.cross3(along, NB);
    if (G.dot3(normal, inward) < 0) normal = G.mul3(normal, -1);
    if (G.dot3(normal, V) <= 0) continue;
    recess.push({ tone: G.toneOf(normal, P), d: path3([bezelPt(a[0], a[1], -0.1), bezelPt(b[0], b[1], -0.1), bezelPt(b[0], b[1], FACE_OFF), bezelPt(a[0], a[1], FACE_OFF)], true) });
  }
}
const openClip = path3(openRing.map(([u, w]) => bezelPt(u, w, -0.1)), true);
const activeClip = path3(activeRing.map(([u, w]) => bezelPt(u, w, FACE_OFF)), true);
const UI = { sx: (ACTIVE.u * 2) / SCREEN.W, ox: -ACTIVE.u, oy: SCREEN_W0 - ACTIVE.w };
const bezelItem = [
  `<clipPath id="ks-open"><path d="${openClip}"/></clipPath>`,
  `<clipPath id="ks-active"><path d="${activeClip}"/></clipPath>`,
  `<g clip-path="url(#ks-open)">`,
  `<path class="ks-glass" d="${openClip}"/>`,
  `<g clip-path="url(#ks-active)"><g transform="${bezelMatrix(FACE_OFF)}"><g data-part="ui" class="ks-ui" transform="translate(${f2(UI.ox)} ${f2(UI.oy)}) scale(${UI.sx.toFixed(5)})">${SCREEN.svg(MODEL.menu)}</g></g></g>`,
  ...recess.map((q) => `<path class="iso-shade" data-shade="${Math.min(3, q.tone)}" d="${q.d}"/>`),
  `</g>`,
  `<g transform="${bezelMatrix(0)}"><path class="ks-bezel" d="${bezelFace}"/><path class="iso-line" data-tone="lo" d="${flat(openRing)}"/>`,
  `<path class="iso-line" data-tone="faint" d="${flat(roundRect(-OPEN.u - 2.4, OPEN.u + 2.4, SCREEN_W0 - OPEN.w - 2.4, SCREEN_W0 + OPEN.w + 2.4, OPEN.r + 2.4, 4))}"/></g>`,
].join("");
const BZF = G.frameOf(bezelPt(0, 0, 0), [1, 0, 0], NB, bd);
{
  const section = [[-1.6, -HALF_LEN], [0, -HALF_LEN], [0, HALF_LEN], [-1.6, HALF_LEN]];
  const shape = record(A.prism(BZF, section, -XI, XI, { name: "bezel" }));
  const edge = S(prismPaths(BZF, section, -XI, XI), { tone: "lo", flat: true });
  put("bezel", bezelPt(0, 0, 0), `<g class="ks-bezel-solid">${edge}</g>${bezelItem}`, [shape], { bias: 1 });
}

// ───────────────────────── chin: card terminal, receipt slot, scanner ─────────────────────────
const dC = G.unit3([0, 82 - 90, 184 - 120]);
const nC = [0, dC[2], -dC[1]];
const CHO = [0, 90, 120];
const CHF = G.frameOf(CHO, nC, [1, 0, 0], dC);
const chinPt = (x, t, off = 0) => G.add3(G.add3(G.add3(CHO, [x, 0, 0]), G.mul3(dC, t)), G.mul3(nC, off));
const TERM = { x0: -1, x1: 19, t0: 18, t1: 58, face: 4.2 };
prism("term.bezel", CHF, roundRect(-3.4, 21.4, 15.6, 60.4, 1.6, 3), 0, 1, { tone: "mid" }, { extra: Dots([[-2, 17], [20, 17], [-2, 59], [20, 59]].map(([x, t]) => at(chinPt(x, t, 1))), { size: 0.45 }) });
const termFace = (x, t) => chinPt(x, t, TERM.face + 0.01);
{
  const zone = roundRect(1.2, 16.8, 45.6, 55.6, 1.4, 3).map(([x, t]) => termFace(x, t));
  const waves = [2, 3.2, 4.4, 5.6].map((r) => path3(Array.from({ length: 9 }, (_, i) => {
    const a = -0.62 + (i / 8) * 1.24;
    return termFace(5.6 + r * Math.cos(a), 50.6 + r * Math.sin(a));
  }))).join("");
  const slot = roundRect(4, 14, 18.8, 19.5, 0.3, 2).map(([x, t]) => termFace(x, t));
  const extra = Ln(path3(zone, true), { tone: "lo" }) + Ln(waves, { tone: "mid", free: true }) + `<path class="ks-slot" d="${path3(slot, true)}"/>`;
  prism("term.body", CHF, roundRect(TERM.x0, TERM.x1, TERM.t0, TERM.t1, 1.4, 3), 1, TERM.face, { tone: "hi" }, { extra });
}
put("term.leds", termFace(9, 57), `<g data-part="nfc-leds">${[3.8, 7.3, 10.8, 14.3].map((x, i) => `<g class="ks-led" data-led="nfc${i}">${Dots([at(termFace(x, 57))], { size: 0.62, tone: "hi" })}</g>`).join("")}</g>`, [record(A.prism(CHF, rect(3, 15, 56.4, 57.6), TERM.face, TERM.face + 0.1, { name: "term.leds" }))], { bias: 0.4 });
const TWIN = { x0: 2.4, x1: 15.6, t0: 33.6, t1: 43.6 };
{
  const m = planeMatrix(termFace(TWIN.x0, TWIN.t1), [1, 0, 0], G.mul3(dC, -1));
  const w = TWIN.x1 - TWIN.x0;
  const h = TWIN.t1 - TWIN.t0;
  const svg = `<g transform="${m}"><rect class="ks-twin" x="0" y="0" width="${f2(w)}" height="${f2(h)}" rx="0.5"/><g data-part="term-text"><text class="ks-ttx" data-line="0" x="${f2(w / 2)}" y="3.6" font-size="2" text-anchor="middle">WELCOME</text><text class="ks-ttx ks-ttx-big" data-line="1" x="${f2(w / 2)}" y="7.6" font-size="2.3" text-anchor="middle"></text></g></g>`;
  put("term.screen", termFace(9, 38.6), svg, [record(A.prism(CHF, rect(TWIN.x0, TWIN.x1, TWIN.t0, TWIN.t1), TERM.face, TERM.face + 0.05, { name: "term.screen" }))], { bias: 0.3 });
}
for (let row = 0, key = 0; row < 4; row++) {
  for (let col = 0; col < 4; col++, key++) {
    const x0 = 2.3 + col * 3.5;
    const t0 = 21 + (3 - row) * 3;
    prism(col === 3 ? "term.key.fn" : "term.key", CHF, roundRect(x0, x0 + 2.8, t0, t0 + 2.1, 0.5, 2), TERM.face, TERM.face + 0.55, { tone: col === 3 ? "mid" : "hi" }, { bias: 0.2, attrs: ` data-key="${key}"` });
  }
}
prism("term.housing", CHF, rect(0.5, 17.5, 20, 56), -12, -2, { tone: "mid" }, { inner: "" });

const SLOT = { x0: -40.4, x1: -23.6, t: 8 };
{
  const hatch = roundRect(-47, -7, 15.6, 58, 1.2, 3).map(([x, t]) => chinPt(x, t, 0.02));
  put("chin.hatch", chinPt(-27, 37, 0.02), Ln(path3(hatch, true), { tone: "lo" }), [record(A.prism(CHF, rect(-47, -7, 15.6, 58), 0, 0.03, { name: "chin.hatch" }))], { bias: 0.1 });
  for (const [x, t] of [[-44.4, 55.4], [-9.6, 55.4], [-44.4, 18.2], [-9.6, 18.2]]) {
    const F = G.frameAlong(chinPt(x, t, 0), nC);
    disc("chin.screw", F, 0, 0.5, 1, { tone: "mid" }, { extra: Ln(path3([chinPt(x - 0.62, t, 0.51), chinPt(x + 0.62, t, 0.51)]), { tone: "lo", free: true }) });
  }
}
{
  const slot = rect(SLOT.x0, SLOT.x1, SLOT.t - 0.45, SLOT.t + 0.45).map(([x, t]) => chinPt(x, t, 1.41));
  prism("slot.bezel", CHF, roundRect(-43.4, -20.6, 3.4, 12.6, 1.4, 3), 0, 1.4, { tone: "mid" }, { extra: `<path class="ks-slot" d="${path3(slot, true)}"/>` + Dots([[-42, 8], [-22, 8]].map(([x, t]) => at(chinPt(x, t, 1.4))), { size: 0.45 }) });
}
prism("scan.bezel", CHF, roundRect(25.6, 44.4, 29.6, 46.4, 1.2, 3), 0, 1, { tone: "mid" });
{
  const glass = roundRect(27.6, 42.4, 31.6, 44.4, 0.6, 2).map(([x, t]) => chinPt(x, t, 1.01));
  put("scan.window", chinPt(35, 38, 1.02), `<path class="ks-dark" d="${path3(glass, true)}"/><g class="ks-led" data-led="scan">${Dots([at(chinPt(35, 30.6, 1))], { size: 0.5, tone: "hi" })}</g>`, [record(A.prism(CHF, rect(27.6, 42.4, 31.6, 44.4), 1, 1.03, { name: "scan.window" }))], { bias: 0.2 });
}
prism("scan.module", CHF, rect(28.4, 41.6, 32.4, 43.6), -9, -2, { tone: "mid" });
{
  const NAV = G.frameAlong(chinPt(32, 20.4, 0), nC);
  disc("nav.pad", NAV, 0, 0.8, 4.8, { tone: "mid" });
  disc("nav.select", NAV, 0.8, 1.5, 1.3, { tone: "hi" });
  for (const [x, t] of [[0, 2.9], [0, -2.9], [2.9, 0], [-2.9, 0]]) prism("nav.key", CHF, roundRect(32 + x - 0.9, 32 + x + 0.9, 20.4 + t - 0.9, 20.4 + t + 0.9, 0.4, 2), 0.8, 1.3, { tone: "hi" });
  const JACK = G.frameAlong(chinPt(41, 20.4, 0), nC);
  disc("jack", JACK, 0, 0.7, 1.4, { tone: "mid" }, { extra: `<path class="ks-dark" d="${G.circleOf(JACK, 0.71, 0.6, P, 20)}"/>` });
}

// ───────────────────────── printer ─────────────────────────
const ROLL = { x0: -40, x1: -24, y: 44, z: 137, r: MODEL.roll.dMm / U / 2, core: MODEL.roll.coreMm / U / 2 };
const ROLL_F = G.frameAlong([ROLL.x0, ROLL.y, ROLL.z], [1, 0, 0]);
box("roll.cradle", [-44, 40.6, 120], [-42, 47.4, ROLL.z - ROLL.core], { tone: "lo" }, { owner: "printer.holder", extra: Dots([at([-44, 42.2, 123]), at([-44, 45.8, 123])], { size: 0.4 }) });
box("roll.cradle", [-22, 40.6, 120], [-20, 47.4, ROLL.z - ROLL.core], { tone: "lo" }, { owner: "printer.holder" });
disc("roll.spindle", G.frameAlong([-44, ROLL.y, ROLL.z], [1, 0, 0]), 0, 2.8, ROLL.core, { tone: "mid" }, { owner: "printer.holder" });
disc("roll.spindle", G.frameAlong([ROLL.x1, ROLL.y, ROLL.z], [1, 0, 0]), 0, 4, ROLL.core, { tone: "mid" }, { owner: "printer.holder" });
const HUB_F = G.frameAlong([ROLL.x0 - 1.2, ROLL.y, ROLL.z], [1, 0, 0]);
ring("roll.flange", HUB_F, 0, 1.2, ROLL.core, ROLL.core + 3.4, { tone: "mid" }, { owner: "printer.holder", extra: `<g data-part="hub">${PARTS.spokes(HUB_F, -0.02, ROLL.core + 0.5, ROLL.core + 3, 6, 0, "lo")}</g>` });
{
  const shape = record(A.ring(ROLL_F, 0, ROLL.x1 - ROLL.x0, ROLL.core, ROLL.r, { name: "roll" }));
  const paths = G.ringBand(0, ROLL.x1 - ROLL.x0, ROLL.core, ROLL.r, ROLL_F, P);
  const layers = Ln([ROLL.r * 0.45, ROLL.r * 0.7].map((r) => G.circleOf(ROLL_F, -0.01, r, P, 48)).join(""), { tone: "faint" });
  put("roll", G.add3(ROLL_F.o, [8, 0, 0]), `<g data-part="roll">${S(paths, { tone: "hi" }) + layers}</g>`, [shape], { bias: 0.2 });
}
{
  const poly = PARTS.webPoly(ROLL.y, ROLL.z, ROLL.r);
  const shape = record(A.prism(XF, poly, ROLL.x0 + 0.2, ROLL.x1 - 0.2, { name: "paper.web", owner: "printer" }));
  put("paper.web", [ROLL.x0 + 8, 64, 130], `<g data-part="web">${S(prismPaths(XF, poly, ROLL.x0 + 0.2, ROLL.x1 - 0.2), { tone: "hi" })}</g>`, [shape]);
}
box("printer.body", [-42, 70, 120], [-22, 84, 134], { tone: "mid" }, { bevel: 0.4, owner: "printer", inner: Ln(seamOf([-42, 70], [-22, 84], 130), { tone: "faint" }) });
box("printer.cutter", [-41, 78, 134], [-23, 84, 137], { tone: "lo" }, { owner: "printer", extra: Dots([at([-39, 81, 137]), at([-25, 81, 137])], { size: 0.45 }) });
box("printer.nose", [-41, 84, 124.6], [-23, 86.9, 131.2], { tone: "lo" }, { owner: "printer" });
box("printer.plug", [-41, 68.4, 122], [-37, 70, 126], { tone: "mid" }, { owner: "printer" });
const GEAR_F = G.frameAlong([-42, 77.4, 130.6], [-1, 0, 0]);
disc("printer.gear", GEAR_F, 0, 0.8, 2.6, { tone: "hi" }, { owner: "printer", extra: `<g data-part="gear">${PARTS.spokes(GEAR_F, 0.81, 1.6, 2.6, 12, 0, "lo")}</g>` });
box("paper.sensor", [-22, 47.4, 126], [-20, 50.4, 131], { tone: "mid" }, { owner: "printer.holder", extra: `<g class="ks-led" data-led="paper">${Dots([at([-22, 48.9, 128.5])], { size: 0.5, tone: "hi" })}</g>` });

// ───────────────────────── lower cabinet: power and network ─────────────────────────
box("mains.box", [-20, 3, 24], [-6, 10, 38], { tone: "mid" }, { inner: Ln(seamOf([-20, 3], [-6, 10], 35), { tone: "faint" }) });
box("mains.switch", [-17, 10, 27], [-12, 11.2, 32], { tone: "mid" }, { extra: Ln(path3([[-16.2, 11.22, 29.5], [-12.8, 11.22, 29.5]]), { tone: "lo" }) });
disc("mains.gland", G.frameAlong([-9, 7.4, 24], [0, 0, -1]), 0, 1.6, 1.6, { tone: "lo" });
put("din.rail", [2, 3.7, 56.8], S(k.slabOf({ x: -30, y: 3, w: 64, d: 1.4, r: 0.2 }, 55, 3.6, P, 2), { tone: "lo" }) + Ln(Array.from({ length: 10 }, (_, i) => path3([[-28.6 + i * 6.2, 4.42, 56], [-26.2 + i * 6.2, 4.42, 56], [-26.2 + i * 6.2, 4.42, 57.6], [-28.6 + i * 6.2, 4.42, 57.6]], true)).join(""), { tone: "faint" }), [record(A.box([-30, 3, 55], [34, 4.4, 58.6], { name: "din.rail" }))]);
box("breaker", [-28, 4.4, 49], [-22, 13, 65], { tone: "mid" }, { inner: Ln(seamOf([-28, 4.4], [-22, 13], 53), { tone: "faint" }), extra: S(k.slabOf({ x: -26, y: 13, w: 2, d: 1.6, r: 0.3 }, 57.4, 2.6, P, 2), { tone: "mid" }) });
for (let i = 0; i < 6; i++) box("terminal", [-20 + i * 2.3, 4.4, 50], [-18 + i * 2.3, 11, 63], { tone: "mid" }, { extra: Dots([at([-19 + i * 2.3, 11, 60.6]), at([-19 + i * 2.3, 11, 52.4])], { size: 0.4, tone: "hi" }) });
box("psu", [-4, 4.4, 46], [18, 18, 67], { tone: "mid" }, {
  bevel: 0.4,
  extra: Ln(Array.from({ length: 7 }, (_, i) => path3([[-2 + i * 1.8, 18.02, 53], [-1 + i * 1.8, 18.02, 53], [-1 + i * 1.8, 18.02, 64], [-2 + i * 1.8, 18.02, 64]], true)).join(""), { tone: "lo" }) + `<g class="ks-led" data-led="psu">${Dots([at([15, 18, 63])], { size: 0.55, tone: "hi" })}</g>`,
});
box("psu.strip", [-3, 18, 47], [17, 19.4, 50.4], { tone: "lo" }, { extra: Dots(Array.from({ length: 7 }, (_, i) => at([-1 + i * 2.8, 19.4, 48.7])), { size: 0.42, tone: "hi" }) });
box("psu.out", [-3, 5, 67], [1, 9, 68.6], { tone: "lo" });
box("switch", [-38, 3, 74], [-4, 16, 86], { tone: "mid" }, { bevel: 0.4, extra: Ln(Array.from({ length: 7 }, (_, i) => k.planOutline({ x: -32 + i * 3.6, y: 6, w: 1.4, d: 7, r: 0.7 }, 86, P, 3)).join(""), { tone: "faint" }) });
const PORTS = Array.from({ length: 5 }, (_, i) => ({ x: -34 + i * 5.6, z: 76.4 }));
put("switch.ports", [-21, 16.05, 79], `<path class="ks-dark" d="${PORTS.map((p) => path3([[p.x, 16.02, p.z], [p.x + 3.6, 16.02, p.z], [p.x + 3.6, 16.02, p.z + 3.4], [p.x, 16.02, p.z + 3.4]], true)).join("")}"/>` + PORTS.map((p, i) => `<g class="ks-led" data-led="sw${i}">${Dots([at([p.x + 1.8, 16, 82.8])], { size: 0.45, tone: "hi" })}</g>`).join(""), [record(A.box([-34, 16, 76.4], [-4.4, 16.05, 83.4], { name: "switch.ports" }))], { bias: 0.2 });
for (const x of [-40, -4]) box("switch.ear", [x, 3, 74], [x + 2, 4, 86], { tone: "lo" }, { extra: Dots([at([x + 1, 4, 76.4]), at([x + 1, 4, 83.6])], { size: 0.4 }) });
const SW_JACKS = [{ y: 9.2, z: 83 }, { y: 12.6, z: 77.4 }];
for (const j of SW_JACKS) box("switch.jack", [-39.6, j.y - 1.4, j.z - 1.2], [-38, j.y + 1.4, j.z + 1.2], { tone: "mid" });
box("switch.jack", [-35.4, 11.6, 72.4], [-32.6, 14.4, 74], { tone: "mid" }, { attrs: ' data-part="uplink-jack"' });
box("router", [4, 3, 74], [26, 13, 88], { tone: "mid" }, { bevel: 0.4, extra: [10, 13, 16, 19].map((x, i) => `<g class="ks-led" data-led="lte${i}">${Dots([at([x, 13, 85])], { size: 0.45, tone: "hi" })}</g>`).join("") });
disc("router.knuckle", G.frameAlong([21, 8, 88], [0, 0, 1]), 0, 1.6, 1.8, { tone: "lo" });
turned("router.antenna", G.frameAlong([21, 8, 89.6], [0, 0, 1]), [[0, 1.2], [17, 1.2], [18, 0.9, 1], [18.6, 0.4]], { tone: "mid" }, { attrs: ' data-route="lte" data-chunk="0"' });
const GROMMETS = [{ x: -34, y: 13 }, { x: -9, y: 7.4 }];
for (const g of GROMMETS) ring("grommet", G.frameAlong([g.x, g.y, 19], [0, 0, 1]), 0, 0.8, 1.5, 2.6, { tone: "mid" });

// ───────────────────────── head: PC, display board, fan, speaker ─────────────────────────
box("pc.bracket", [-42, 3, 214], [-2, 4, 240], { tone: "lo" }, { extra: Dots([[-40, 216], [-4, 216], [-40, 238], [-4, 238]].map(([x, z]) => at([x, 4, z])), { size: 0.45 }) });
box("pc.shelf", [-42, 4, 224], [-2, 34, 226], { tone: "lo" });
for (const x of [-41, -4]) board("pc.gusset", [[4, 224], [20, 224], [4, 216]], x, x + 1, { tone: "lo" });
box("pc", [-40, 6, 226], [-4, 32, 236], { tone: "mid" }, { bevel: 0.4, extra: `<path class="ks-dark" d="${[-27, -21].map((x) => path3([[x, 32.02, 229], [x + 4, 32.02, 229], [x + 4, 32.02, 231], [x, 32.02, 231]], true)).join("")}"/><g class="ks-led" data-led="pc">${Dots([at([-6.4, 32, 233.4])], { size: 0.5, tone: "hi" })}</g>` });
const PC_JACKS = { print: { y: 9, z: 228, w: 2.4 }, pay: { y: 12, z: 230, w: 2.4 }, lan: { y: 15, z: 232, w: 2.8 }, dc: { y: 18.2, z: 234, w: 1.8 }, hdmi: { y: 28, z: 233, w: 3.6 } };
for (const [id, j] of Object.entries(PC_JACKS)) box(`pc.jack.${id}`, [-41.6, j.y - j.w / 2, j.z - 1.1], [-40, j.y + j.w / 2, j.z + 1.1], { tone: "mid" });
const pcJack = (id) => [-41.6, PC_JACKS[id].y, PC_JACKS[id].z];
box("pc.jack.touch", [-11, 32, 228.4], [-8.2, 33.6, 230.6], { tone: "mid" });
for (let i = 0; i < 8; i++) box("pc.fin", [-39, 7.6 + i * 3, 236], [-5, 8.4 + i * 3, 240], { tone: "mid" }, { r: 0.2, steps: 1 });
for (const [x, z] of [[-44, 266], [-20, 266], [-44, 288], [-20, 288]]) disc("scaler.standoff", G.frameAlong([x, 3, z], [0, 1, 0]), 0, 2, 0.7, { tone: "lo" });
box("scaler", [-46, 5, 264], [-18, 5.8, 290], { tone: "lo" }, { r: 0.5 });
box("scaler.chip", [-38, 5.8, 274], [-30, 7, 282], { tone: "mid" }, { r: 0.2, steps: 1, extra: Dots([at([-37.2, 7, 281.2])], { size: 0.35, tone: "lo" }) });
box("scaler.sink", [-28, 5.8, 274], [-22, 9.4, 282], { tone: "mid" }, { r: 0.2, steps: 1, extra: Ln([-27, -25.6, -24.2, -22.8].map((x) => path3([[x, 9.4, 274], [x, 9.4, 282]])).join(""), { tone: "lo" }) });
box("scaler.hdmi", [-44, 5.8, 264], [-38, 8.6, 267], { tone: "mid" });
box("scaler.dc", [-24, 5.8, 265.6], [-20, 8.6, 268.4], { tone: "mid" });
box("scaler.lvds", [-40, 5.8, 285.6], [-28, 7.8, 288.4], { tone: "mid" });
const FAN = { x: 9, z: 309 };
const FANF = G.frameOf([FAN.x, 3, FAN.z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
prism("fan.frame", FANF, rect(-13, 13, -13, 13), 0, 3.4, { tone: "mid" }, { extra: Dots([[-11, -11], [11, -11], [-11, 11], [11, 11]].map(([u, v]) => at([FAN.x + u, 6.4, FAN.z + v])), { size: 0.5, tone: "hi" }) });
{
  const m = planeMatrix([FAN.x, 6.42, FAN.z], [1, 0, 0], [0, 0, -1]);
  const blades = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2;
    const pt = (r, da) => [r * Math.cos(a + da), r * Math.sin(a + da)].map((v) => f2(v)).join(" ");
    return `M${pt(3.6, 0)}Q${pt(8, 0.25)} ${pt(11, 0.12)}L${pt(11, 0.62)}Q${pt(7.6, 0.72)} ${pt(3.6, 0.7)}Z`;
  }).join("");
  const guard = [11.6, 8, 4.6].map((r) => `M${r} 0A${r} ${r} 0 1 1 ${-r} 0A${r} ${r} 0 1 1 ${r} 0Z`).join("");
  const spokes = [0, 1, 2, 3].map((i) => `M${f2(3 * Math.cos(i * Math.PI / 2 + 0.4))} ${f2(3 * Math.sin(i * Math.PI / 2 + 0.4))}L${f2(11.6 * Math.cos(i * Math.PI / 2 + 0.4))} ${f2(11.6 * Math.sin(i * Math.PI / 2 + 0.4))}`).join("");
  put("fan.rotor", [FAN.x, 6.5, FAN.z], `<g transform="${m}"><circle class="ks-fan-hole" r="12"/><g class="ks-spin-fan"><path class="ks-blade" d="${blades}"/></g><circle class="ks-fan-hub" r="3.4"/><path class="ks-guard" d="${guard}${spokes}"/></g>`, [record(A.disc(FANF, 3.4, 3.5, 12, { name: "fan.rotor" }))], { bias: 0.2 });
}
{
  const SPK = G.frameAlong([35, 64, 343], [0, -1, 0]);
  turned("speaker.basket", SPK, [[0, 4.8], [0.8, 4.8], [0.8, 4.2], [2.4, 2.6, 1], [2.8, 2.2]], { tone: "mid" });
  disc("speaker.magnet", SPK, 2.8, 3.8, 2.4, { tone: "lo" });
}

// A spare paper roll stands on the cabinet floor.
{
  const F = G.frameAlong([-27, 40, 19], [0, 0, 1]);
  const h = MODEL.printer.paperMm / U;
  const shape = record(A.ring(F, 0, h, ROLL.core, ROLL.r, { name: "spare.roll" }));
  const top = `<path class="ks-core" d="${G.circleOf(F, h + 0.01, ROLL.core, P, 32)}"/>` + Ln([ROLL.r * 0.5, ROLL.r * 0.78].map((r) => G.circleOf(F, h + 0.01, r, P, 64)).join(""), { tone: "faint" });
  put("spare.roll", G.add3(F.o, [0, 0, h / 2]), S(G.ringBand(0, h, ROLL.core, ROLL.r, F, P), { tone: "mid" }) + top, [shape], { bias: 0.1 });
}
// Service label (a wiring diagram) and intake louvres on the back panel.
box("service.label", [-38, 3, 176], [-12, 3.6, 202], { tone: "lo" }, { r: 0.6, extra: Ln(path3([[-36.4, 3.62, 177.6], [-13.6, 3.62, 177.6], [-13.6, 3.62, 200.4], [-36.4, 3.62, 200.4]], true), { tone: "faint" }) + Ln([[197, 14], [194.4, 18], [191.8, 11], [188, 16], [185.4, 9], [182.8, 15], [180.2, 12]].map(([z, w]) => path3([[-34.6, 3.62, z], [-34.6 + w, 3.62, z]])).join(""), { tone: "lo", free: true }) + Dots([[-37, 177], [-13, 177], [-37, 201], [-13, 201]].map(([x, z]) => at([x, 3.6, z])), { size: 0.45 }) });
put("back.louvres", [14, 3.05, 103], Ln(Array.from({ length: 5 }, (_, i) => path3([[-2, 3.03, 96 + i * 3], [30, 3.03, 96 + i * 3], [30, 3.03, 97.4 + i * 3], [-2, 3.03, 97.4 + i * 3]], true)).join(""), { tone: "lo" }), [record(A.box([-2, 3, 96], [30, 3.05, 109.4], { name: "back.louvres" }))], { bias: 0.1 });
box("earth.stud", [-44, 3, 150], [-41, 4.6, 153], { tone: "mid" }, { r: 0.4 });

// ───────────────────────── floor box ─────────────────────────
const FB = { x: -98, y: -2, w: 22, d: 24, r: 1.5 };
back.push(`<path class="iso-halo" d="${k.haloOf(FB, 0, 4, P)}"/>`);
box("floorbox", [FB.x, FB.y, 0], [FB.x + FB.w, FB.y + FB.d, 6], { tone: "mid" }, { r: 1.5, steps: 3, bevel: 0.4, extra: Ln(k.planOutline(k.insetPlan(FB, 2), 6, P, 3), { tone: "lo" }) + Dots(k.corners(FB, 3.4).map(([x, y]) => at([x, y, 6])), { size: 0.45 }) });
for (const y of [7.4, 13]) disc("floorbox.gland", G.frameAlong([FB.x + FB.w, y, 3], [1, 0, 0]), 0, 2, 1.7, { tone: "lo" });

// ───────────────────────── harness: every signal and the power, clamped along the open edge ─────────────────────────
const LANE = { A: -45.2, B: -46.6, C: -48, D: -49.4, y: 5.2 };
const CLAMPS = [100, 140, 190].map((z) => [-47.3, LANE.y, z]);
for (const [, , z] of CLAMPS) {
  const shape = record(A.box([-50.8, 3, z - CLAMP_T], [-43.8, 6.4, z + CLAMP_T], { name: "clamp", bundle: "harness", anchor: false, fitting: true }));
  put("clamp", [-47.3, 4.7, z], S(k.slabOf({ x: -50.8, y: 3, w: 7, d: 3.4, r: 0.6 }, z - CLAMP_T, CLAMP_T * 2, P, 2, 0.2), { tone: "mid" }) + Dots([at([-44.6, 6.4, z])], { size: 0.4, tone: "hi" }), [shape], { bias: 0.3 });
}
const chinBack = (x, t) => chinPt(x, t, -12);
const PAY_IN = chinBack(6, 52);
const PAY_LAN = chinBack(12, 45);
const HARNESS = { bundle: "harness", clamps: CLAMPS, touch: ["clamp"] };
cable("usb.print", [pcJack("print"), [-44.6, PC_JACKS.print.y, 228], [LANE.A, LANE.y, 228], [LANE.A, LANE.y, 124], [LANE.A, 62, 124], [-39, 62, 124], [-39, 68.4, 124]], 0.5, { ...HARNESS, tone: "mid", bend: 2.4 });
cable("usb.pay", [pcJack("pay"), [-44.6, PC_JACKS.pay.y, 230], [LANE.B, LANE.y, 230], [LANE.B, LANE.y, PAY_IN[2]], [LANE.B, 58, PAY_IN[2]], [PAY_IN[0], 58, PAY_IN[2]], PAY_IN], 0.5, { ...HARNESS, tone: "mid", bend: 2.4 });
cable("lan.pay", [PAY_LAN, [PAY_LAN[0], 55, PAY_LAN[2]], [LANE.B, 55, PAY_LAN[2]], [LANE.B, LANE.y, PAY_LAN[2]], [LANE.B, LANE.y, SW_JACKS[0].z], [-42.8, SW_JACKS[0].y, SW_JACKS[0].z], [-39.6, SW_JACKS[0].y, SW_JACKS[0].z]], 0.55, { ...HARNESS, tone: "mid", bend: 2.4 });
cable("lan.pc", [pcJack("lan"), [-44.6, PC_JACKS.lan.y, 232], [LANE.C, LANE.y, 232], [LANE.C, LANE.y, SW_JACKS[1].z], [-42.8, SW_JACKS[1].y, SW_JACKS[1].z], [-39.6, SW_JACKS[1].y, SW_JACKS[1].z]], 0.55, { ...HARNESS, tone: "mid", bend: 2.4 });
cable("dc.pc", [[-1, 7, 68.6], [-1, 7, 70.8], [LANE.D, LANE.y, 70.8], [LANE.D, LANE.y, 234], [-44.6, PC_JACKS.dc.y, 234], pcJack("dc")], 0.6, { ...HARNESS, tone: "lo", bend: 2.4 });
cable("hdmi", [pcJack("hdmi"), [-44.6, 28, 233], [-50, 28, 238.4], [-50, 28, 262], [-41, 14, 265.5], [-41, 8.6, 265.5]], 0.7, { tone: "lo", bend: 3 });
const modBack = (x, z) => [x, C3[1] + (-9.6 - NB[2] * (z - C3[2])) / NB[1], z];
cable("lvds", [[-34, 6.8, 288.4], [-34, 6.8, 295], modBack(-34, 295)], 0.7, { tone: "lo", bend: 3 });
cable("usb.touch", [[-6.5, 16.5, 250.5], [-6.5, 16.5, 245], [-9.6, 37, 245], [-9.6, 37, 229.5], [-9.6, 33.6, 229.5]], 0.45, { tone: "mid", bend: 2 });
cable("flex.touch", [[-6.2, 29.5, 262.4], [-6.2, 29.5, 265.5], [-6.2, 40, 265.5], [-13, 46, 265.5], modBack(-13, 265.5)], 0.3, { tone: "lo", bend: 1.6 });
{
  const shape = record(A.box([-36.4, 3, 46.2], [-31.6, 8.6, 47.8], { name: "clip.uplink", anchor: false, fitting: true }));
  put("clip.uplink", [-34, 5.8, 47], S(k.slabOf({ x: -36.4, y: 3, w: 4.8, d: 5.6, r: 0.6 }, 46.2, 1.6, P, 2, 0.2), { tone: "mid" }) + Dots([at([-35.6, 8.6, 47])], { size: 0.4, tone: "hi" }), [shape], { bias: 0.3 });
}
cable("lan.up", [[-34, 13, 72.4], [-34, 13, 66.5], [-34, 7.2, 60.5], [-34, 7.2, 34], [-34, 13, 28], [-34, 13, 10.5], [-54, 13, 10.5], [-54, 13, 3], [FB.x + FB.w + 2, 13, 3]], 0.55, { tone: "mid", bend: 2.4, touch: ["clip.uplink"], clampsAt: [[-34, 7.2, 47]], floorAt: [-34, 13], breaks: (route) => [UNPLUG.at = crossingsOf(route, [-34, 7.2, 57], [0, 0, 1], 2)[0]] });
cable("lan.lte", [[-4, 8.4, 80], [4, 8.4, 80]], 0.5, { tone: "mid", bend: 2 });
cable("cord.mains", [[-9, 7.4, 22.4], [-9, 7.4, 19.8], [-9, 7.4, 9.6], [-54, 7.4, 9.6], [-54, 7.4, 3], [FB.x + FB.w + 2, 7.4, 3]], 0.7, { tone: "lo", bend: 2.6, floorAt: [-9, 7.4] });

// ───────────────────────── the store side: floor cable cover, store router, kitchen printer, pickup board ─────────────────────────
const RACE = { x: -90, y0: FB.y + FB.d, y1: 134.5, corner: [-93.5, 134.5, -86.5, 141.5], x1: -80, y: 138 };
const RACE_SECTION = [[-3.5, 0], [3.5, 0], [2, 2.4], [-2, 2.4]];
{
  let chunk = 0;
  const segment = (F, s0, s1) => prism("raceway", F, RACE_SECTION, s0, s1, { tone: "lo" }, { attrs: ` data-route="raceway" data-chunk="${chunk++}"` });
  const FA = G.frameOf([RACE.x, 0, 0], [0, 1, 0], [-1, 0, 0], [0, 0, 1]);
  const n = 8;
  for (let i = 0; i < n; i++) segment(FA, RACE.y0 + ((RACE.y1 - RACE.y0) * i) / n, RACE.y0 + ((RACE.y1 - RACE.y0) * (i + 1)) / n);
  const [cx0, cy0, cx1, cy1] = RACE.corner;
  box("raceway.corner", [cx0, cy0, 0], [cx1, cy1, 2.8], { tone: "lo" }, { r: 0.8, bevel: 0.3, attrs: ` data-route="raceway" data-chunk="${chunk++}"` });
  segment(G.frameOf([0, RACE.y, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]), cx1, RACE.x1);
}
const ROUTER = { x0: -80, x1: -44, y0: 126, y1: 150, h: 7 };
box("store.router", [ROUTER.x0, ROUTER.y0, 0], [ROUTER.x1, ROUTER.y1, ROUTER.h], { tone: "mid" }, {
  r: 1.2,
  steps: 3,
  bevel: 0.4,
  extra: Ln(Array.from({ length: 6 }, (_, i) => k.planOutline({ x: -72 + i * 4, y: 133, w: 1.6, d: 10, r: 0.8 }, ROUTER.h, P, 3)).join(""), { tone: "faint" }) + [-74, -70, -66, -62].map((x, i) => `<g class="ks-led" data-led="store${i}">${Dots([at([x, ROUTER.y1, 5])], { size: 0.45, tone: "hi" })}</g>`).join(""),
});
[-76, -48].forEach((x, i) => {
  disc("store.knuckle", G.frameAlong([x, 128.4, ROUTER.h], [0, 0, 1]), 0, 1.6, 1.6, { tone: "lo" });
  turned("store.antenna", G.frameAlong([x, 128.4, ROUTER.h + 1.6], [0, 0, 1]), [[0, 1], [27, 1], [28, 0.7, 1], [28.5, 0.3]], { tone: "mid" }, { attrs: ` data-route="wan" data-chunk="${i}"` });
});
const KP = { x0: -32, x1: -4, y0: 108, y1: 146, h: 26 };
box("kprinter", [KP.x0, KP.y0, 0], [KP.x1, KP.y1, KP.h], { tone: "mid" }, { r: 1.4, steps: 3, bevel: 0.4, inner: Ln(seamOf([KP.x0, KP.y0], [KP.x1, KP.y1], 6, 1.4, 3), { tone: "faint" }) });
{
  const slot = [[-28, 140.4], [-8, 140.4], [-8, 141.4], [-28, 141.4]].map(([x, y]) => at([x, y, KP.h + 3.02]));
  box("kprinter.lid", [KP.x0 + 1, KP.y0 + 1, KP.h], [KP.x1 - 1, KP.y1 - 1, KP.h + 3], { tone: "mid" }, { r: 1.2, steps: 3, bevel: 0.3, extra: `<path class="ks-slot" d="${k.pathOf(slot, true)}"/>` });
}
disc("kprinter.feed", G.frameAlong([-9, KP.y1, 13], [0, 1, 0]), 0, 0.8, 1.6, { tone: "hi" });
put("kprinter.led", [-14, KP.y1, 13], `<g class="ks-led" data-led="kprint">${Dots([at([-14, KP.y1, 13])], { size: 0.5, tone: "hi" })}</g>`, [record(A.ball([-14, KP.y1, 13], 0.3, { name: "kprinter.led" }))], { bias: 0.2 });
box("kprinter.jack", [KP.x0 - 1.6, 138.6, 2.3], [KP.x0, 141.4, 4.7], { tone: "mid" });
box("kprinter.switch", [KP.x0 - 1.2, 116, 8], [KP.x0, 120, 13], { tone: "mid" }, { extra: Ln(k.pathOf([at([KP.x0 - 1.22, 117, 10.5]), at([KP.x0 - 1.22, 119, 10.5])]), { tone: "lo" }) });
const DISP = { x0: 17, x1: 83, y: 146, z0: 32, z1: 71, active: { x0: 19, x1: 81, z0: 34.2, z1: 69 } };
box("board.base", [36, 134, 0], [64, 154, 1.6], { tone: "lo" }, { r: 2, steps: 3, bevel: 0.3, extra: Dots([[39, 151], [61, 151]].map(([x, y]) => at([x, y, 1.6])), { size: 0.45 }) });
box("board.neck", [47, 138, 1.6], [53, 142, DISP.z0 + 2], { tone: "mid" });
{
  const a = DISP.active;
  const m = planeMatrix([a.x0, DISP.y + 0.05, a.z1], [1, 0, 0], [0, 0, -1]);
  const scale = (a.x1 - a.x0) / BOARD.W;
  const face = `<g transform="${m}"><g class="ks-ui" transform="scale(${scale.toFixed(5)})"><rect class="ks-glass" x="0" y="0" width="${BOARD.W}" height="${BOARD.H}"/>${BOARD.svg()}</g><rect class="ks-twin" x="0" y="0" width="${f2(a.x1 - a.x0)}" height="${f2(a.z1 - a.z0)}" rx="0.4" style="fill:none"/></g>`;
  box("board", [DISP.x0, DISP.y - 4, DISP.z0], [DISP.x1, DISP.y, DISP.z1], { tone: "mid" }, { r: 1, steps: 3, bevel: 0.4, extra: face });
}
{
  const shape = record(A.box([40.4, 138.4, 15.2], [47, 140.6, 16.8], { name: "clip.board", anchor: false, fitting: true }));
  put("clip.board", [43.7, 139.5, 16], S(k.slabOf({ x: 40.4, y: 138.4, w: 6.6, d: 2.2, r: 0.4 }, 15.2, 1.6, P, 2, 0.2), { tone: "mid" }), [shape], { bias: 0.3 });
}
cable("kitchen.lan", [[ROUTER.x1, 140, 3.5], [KP.x0 - 1.6, 140, 3.5]], 0.55, { tone: "mid", bend: 2 });
cable("board.lan", [[ROUTER.x1, 147, 3.5], [-40, 147, 3.5], [-40, 151.5, 3.5], [41.4, 151.5, 3.5], [41.4, 139.5, 3.5], [41.4, 139.5, 37], [41.4, 142, 37]], 0.55, { tone: "mid", bend: 2.4, touch: ["clip.board"], clampsAt: [[41.4, 139.5, 16]] });

// The uplink pulled out of the switch: drawn for the live page only, like the receipt and the card.
const UNPLUGGED = (() => {
  const route = R.routes.find((r) => r.name === "lan.up").points;
  const from = G.pointAlong(route, UNPLUG.at);
  const tail = G.fillet([from, G.add3(from, [0, 0, 2.5]), G.add3(from, [-3, 3, 5]), G.add3(from, [-7, 6, 3]), G.add3(from, [-9, 7.5, -4])], 2, 8, { P, tube: 0.55 });
  const pieces = tubePieces(tail, 0.55, P, { maxLength: 30, spacing: 0.6, gaps: [[G.pathLength(tail) - 1.6, G.pathLength(tail)]] });
  const end = tail[tail.length - 1];
  const dir = G.tangentAlong(tail, G.pathLength(tail));
  const F = G.frameAlong(end, dir);
  return pieces.map((p) => tubeSvg(p, { tone: "mid" })).join("") + S(G.disc(-1.6, 0, 1.1, F, P, { steps: 20, bevel: 0.2 }), { tone: "hi", lit: true });
})();

// ───────────────────────── settle, page ─────────────────────────
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const indexOf = (name) => R.items.findIndex((item) => item.name === name);
const slots = new Map();
slots.set(Math.max(indexOf("door.plate"), indexOf("slot.bezel"), indexOf("door.louvres")), `<g data-part="receipt"></g>`);
slots.set(Math.max(indexOf("kprinter.lid"), indexOf("kprinter")), `<g data-part="ticket"></g>`);
slots.set(Math.max(indexOf("switch"), indexOf("breaker"), indexOf("clip.uplink"), ...R.items.map((it, i) => (it.route === "lan.up" ? i : -1))), `<g data-part="unplugged" style="display:none">${UNPLUGGED}</g>`);
const groups = R.items.map((item, index) => `<g class="it" data-name="${item.name}"${item.attrs ?? ""}>${item.svg}</g>${slots.get(index) ?? ""}`);

const cardHome = G.frameOf(CARD_REST.o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const LABEL_TEXT =
  "A self-service ordering kiosk on a bench with its left side panel off: a 27-inch portrait touchscreen with its touch controller and display board, a fanless PC, a card terminal, receipt slot and QR scanner in the chin, a thermal printer with its paper roll, and a power supply, network switch and 4G backup modem in the base. Its network cable runs to a floor box and on under a floor cable cover to a store router, which feeds a kitchen ticket printer and an order-status board at the pickup point. A bank card lies on a pad in front.";
const svg = k.figureSvg({
  width: W,
  height: H,
  label: LABEL_TEXT,
  body: [...back, `<g data-part="card-home">${PARTS.card(cardHome, { lit: false })}</g>`, `<g class="ks-kiosk">${groups.join("")}</g>`, `<g data-part="card"></g>`],
});

const DATA = {
  P,
  model: MODEL,
  rest: CARD_REST.o,
  term: { zone: chinPt(9, 50.6, TERM.face + 2.4), n: nC, d: dC },
  slot: { yz: [chinPt(0, SLOT.t, 1.4)[1], chinPt(0, SLOT.t, 1.4)[2]], out: [nC[1], nC[2]], x0: SLOT.x0 + 0.4, x1: SLOT.x1 - 0.4 },
  hub: { f: HUB_F, r0: ROLL.core + 0.5, r1: ROLL.core + 3 },
  roll: { f: ROLL_F, y: ROLL.y, z: ROLL.z, x0: ROLL.x0, x1: ROLL.x1, r: ROLL.r, core: ROLL.core },
  ticket: { yz: [140.9, KP.h + 3.02], out: [0.26, 0.97], x0: -27.6, x1: -8.4 },
  unplugAt: UNPLUG.at,
  gear: { f: GEAR_F },
  ui: { matrix: bezelMatrix(FACE_OFF), ...UI },
};

const CSS = readFileSync(join(HERE, "kiosk.css"), "utf8");
const latheSource = readFileSync(join(KIT, "lathe.mjs"), "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const latheScript = `const G = (() => {${latheSource}\nreturn { viewOf, scaleOf, frameAlong, frameOf, pointOf, disc, ringBand, fillet, sphereOf, prismOf, circleOf, arcOf, dot3, add3, sub3, mul3, unit3, cross3, len3, lightOf, toneOf, radialOf };})();\n`;
const strip = (file) => readFileSync(join(HERE, file), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));

const body =
  `<style>${CSS}</style>` +
  k.plateHtml({
    fig: "Fig 5",
    title: "Ordering kiosk, side off",
    hint: "tap screen · C card · P N D B break it",
    readout: "ready · touch to order",
    keys: [
      { mark: "lit", label: "What is happening now: the touch, the card, the receipt, the ticket, the order on the board" },
      { mark: "raised", label: "The order path: glass, PC, card terminal, printer, then out to the kitchen and the pickup board" },
      { mark: "edge", label: "Cables carry each step: USB inside the kiosk, then Ethernet to the switch, the floor box and the store router, which feeds the kitchen and reaches the bank" },
    ],
    caption: `A 27-inch portrait kiosk (${MODEL.panel.px.join(" × ")}) with the left side panel off. Tap the glass: its projected-capacitive sensor is scanned ${MODEL.touch.scanHz} times a second and the touch controller reports the point over USB to the PC. At Pay the PC sends only the amount to the card terminal, which reads the card at ${MODEL.nfc.mhz} MHz and sends it, encrypted, through the store router to the bank; the approval comes back in about ${MODEL.auth.s} s. Over RM ${MODEL.nfc.limit} a contactless card needs a PIN. The order then goes to the kitchen ticket printer and onto the pickup board, where it stays Preparing for the cooking time (${MODEL.kitchen.cookS / 60} min, shown ${MODEL.kitchen.timelapse}× faster) before it turns Ready. The receipt is ${MODEL.printer.receiptMm} mm of ${MODEL.printer.paperMm} mm thermal paper at ${MODEL.printer.mmPerS} mm/s, ${dotsPerLine()} dots per line, from a ${MODEL.roll.dMm} mm roll that holds about ${Math.round(rollMetres())} m. Break it with the buttons: run the paper low, pull the network cable (card payments fall back to the kiosk's 4G modem and the order waits until the cable is back), decline a card, or place an order big enough to need a PIN.`,
    body: `<div class="iso-stage ks-stage" tabindex="0" role="group" aria-label="Ordering kiosk. Tap the screen to order, press C or click the card to pay, Escape to cancel. P runs the paper low, N unplugs the network, D declines the next card, B places a big order that needs a PIN.">${svg}<span class="ks-sr" role="status" aria-live="polite" data-status></span></div>`,
  });

const TOOLS = `<div class="ks-tools" role="group" aria-label="Break the kiosk">${[["paper", "Paper low", "P"], ["offline", "Unplug network", "N"], ["decline", "Decline next card", "D"], ["big", "Big order (PIN)", "B"]].map(([id, label, key]) => `<button type="button" class="ks-tool" data-tool="${id}" aria-pressed="false" aria-keyshortcuts="${key}"><span>${key}</span> ${label}</button>`).join("")}</div>`;
const page = k.pageHtml({ title: "Ordering kiosk", theme: THEME, body: body.replace("</div><figcaption", `</div>${TOOLS}<figcaption`), script: kitScript() + latheScript + strip("model.mjs") + strip("parts.mjs") + strip("screen.mjs") + LIVE, width: 650 });
const name = THEME === "light" ? "index.html" : "dark.html";
writeFileSync(join(HERE, "..", name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `${R.solids.length} solids`, `scale ${KS.toFixed(3)}`, `${CABLES.length} cables`);

A.auditOrExit(R, P, {});
