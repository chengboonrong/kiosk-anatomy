// Drawing helpers shared by the build and the live page (the card, the receipt, turning marks).
export function makeParts(k, G, P) {
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const signed = (poly) => poly.reduce((a, [x, y], i) => {
    const [x2, y2] = poly[(i + 1) % poly.length];
    return a + x * y2 - x2 * y;
  }, 0);
  const screenOriented = (pts) => (signed(pts) < 0 ? [...pts].reverse() : pts);
  function runsOf(flags, want) {
    const count = flags.length;
    const runs = [];
    const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
    if (start < 0) return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
    let run = null;
    for (let step = 0; step < count; step++) {
      const index = (start + step) % count;
      if (flags[index] === want) {
        if (!run) run = [index];
        run.push((index + 1) % count);
      } else if (run) {
        runs.push(run);
        run = null;
      }
    }
    if (run) runs.push(run);
    return runs;
  }
  // A prism of any (also concave) polygon in the frame's u, v plane, extruded along F.a (from the arcade cabinet).
  function prismPaths(F, poly, s0, s1) {
    const ring = signed(poly) > 0 ? poly : [...poly].reverse();
    const n = ring.length;
    const W3 = (s, [x, y]) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
    const capNear = G.dot3(F.a, V) > 0;
    const [nearS, farS] = capNear ? [s1, s0] : [s0, s1];
    const near = ring.map((p) => at(W3(nearS, p)));
    const far = ring.map((p) => at(W3(farS, p)));
    const normals = ring.map(([x0, y0], i) => {
      const [x1, y1] = ring[(i + 1) % n];
      return G.unit3(G.add3(G.mul3(F.u, y1 - y0), G.mul3(F.v, -(x1 - x0))));
    });
    const facing = normals.map((m) => G.dot3(m, V) > 1e-9);
    const outline = [];
    const crease = [];
    for (const run of runsOf(facing, false)) outline.push(k.pathOf(run.map((i) => near[i])));
    for (const run of runsOf(facing, true)) {
      crease.push(k.pathOf(run.map((i) => near[i])));
      outline.push(k.pathOf(run.map((i) => far[i])));
    }
    for (let i = 0; i < n; i++) if (facing[(i + n - 1) % n] !== facing[i]) outline.push(k.pathOf([near[i], far[i]]));
    const parts = [k.pathOf(screenOriented(near), true), k.pathOf(screenOriented(far), true)];
    const buckets = [[], [], [], [], []];
    for (let i = 0; i < n; i++) {
      if (!facing[i]) continue;
      const quad = screenOriented([near[i], near[(i + 1) % n], far[(i + 1) % n], far[i]]);
      parts.push(k.pathOf(quad, true));
      buckets[G.toneOf(normals[i], P)].push(k.pathOf(quad, true));
    }
    const capTone = G.toneOf(capNear ? F.a : G.mul3(F.a, -1), P);
    buckets[capTone].push(k.pathOf(screenOriented(near), true));
    return { fill: parts.join(""), outline: outline.join(""), crease: crease.join(""), top: buckets[4].join(""), shades: buckets.slice(0, 4).map((b) => b.join("")) };
  }
  const roundRect = (u0, u1, v0, v1, r, steps = 4) => k.roundedPlan({ x: u0, y: v0, w: u1 - u0, d: v1 - v0, r }, steps);

  // A bank card: 85.6 × 54 mm (17.1 × 10.8 units), 0.76 mm thick, posed by a frame whose axis is its face normal.
  const CARD = { w: 17.12, h: 10.8, t: 0.3, r: 0.64 };
  function card(F, { lit = true } = {}) {
    const ring = roundRect(-CARD.w / 2, CARD.w / 2, -CARD.h / 2, CARD.h / 2, CARD.r, 3);
    const body = S(prismPaths(F, ring, 0, CARD.t), { tone: "hi", lit });
    const face = G.dot3(F.a, V) > 0 ? CARD.t : 0;
    const P3 = (u, v) => G.add3(G.add3(G.add3(F.o, G.mul3(F.a, face + 0.01)), G.mul3(F.u, u)), G.mul3(F.v, v));
    const chip = k.pathOf([P3(-6.2, -1.2), P3(-3.6, -1.2), P3(-3.6, 1), P3(-6.2, 1)].map(at), true);
    const stripe = k.pathOf([P3(-6.6, -3.6), P3(6.6, -3.6), P3(6.6, -2.9), P3(-6.6, -2.9)].map(at), true);
    const waves = [1.1, 1.9, 2.7].map((r) => k.pathOf(Array.from({ length: 9 }, (_, i) => {
      const a = -0.7 + (i / 8) * 1.4;
      return at(P3(4.2 + r * Math.cos(a), 0.4 + r * Math.sin(a)));
    }))).join("");
    return body + (face || G.dot3(F.a, V) < 0 ? `<path class="ks-chip" d="${chip}"/>` + Ln(stripe, { tone: "lo" }) + Ln(waves, { tone: "mid", free: true }) : "");
  }

  // The receipt leaving the slot: straight out along the face normal, then curling down under its own weight.
  function receiptLine(slot, out, length, { bend = 9, straight = 3, step = 0.8 } = {}) {
    const pts = [[slot[0], slot[1]]];
    let [y, z] = slot;
    let a = Math.atan2(out[1], out[0]);
    const down = -Math.PI / 2;
    for (let s = 0; s < length; s += step) {
      const ds = Math.min(step, length - s);
      if (s > straight) a = Math.max(down, a - ds / bend);
      y += Math.cos(a) * ds;
      z += Math.sin(a) * ds;
      pts.push([y, z]);
    }
    return pts;
  }
  function receipt(slot, out, length, x0, x1, { t = 0.18, cut = false, lines = [] } = {}) {
    if (length < 0.3) return "";
    const line = receiptLine(slot, out, length);
    const normals = line.map((p, i) => {
      const a = line[Math.max(0, i - 1)];
      const b = line[Math.min(line.length - 1, i + 1)];
      const d = [b[0] - a[0], b[1] - a[1]];
      const l = Math.hypot(d[0], d[1]) || 1;
      return [-d[1] / l, d[0] / l];
    });
    const top = line.map((p, i) => [p[0] + normals[i][0] * t, p[1] + normals[i][1] * t]);
    const poly = [...top, ...line.slice().reverse()];
    const XF = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const body = S(prismPaths(XF, poly, x0, x1), { tone: "hi", lit: true });
    // Printed lines sit at fixed distances from the leading edge, which left the slot first.
    const cum = [0];
    for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const total = cum[cum.length - 1];
    const pointAt = (s) => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f + normals[i][0] * (t + 0.02), line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f + normals[i][1] * (t + 0.02)];
    };
    const marks = lines
      .filter(([from]) => from < total - 0.4)
      .map(([from, u0, u1]) => {
        const [y, z] = pointAt(total - from);
        return k.pathOf([at([x0 + u0, y, z]), at([x0 + u1, y, z])]);
      })
      .join("");
    return body + (marks ? Ln(marks, { tone: "mid", free: true }) : "") + (cut ? "" : "");
  }

  // The paper web from the front of the roll (radius r) down into the printer's entry.
  function webPoly(rollY, rollZ, r) {
    const web = G.fillet([[0, rollY + r, rollZ], [0, rollY + r, 131], [0, 61.6, 128.4], [0, 70.2, 128.4]], 2.4, 8).map(([, y, z]) => [y, z]);
    const normals = web.map((p, i) => {
      const a = web[Math.max(0, i - 1)];
      const b = web[Math.min(web.length - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
    });
    return [...web.map((p, i) => [p[0] + normals[i][0] * 0.18, p[1] + normals[i][1] * 0.18]), ...web.slice().reverse()];
  }

  // Radial marks on a turning end face (spokes of a hub, teeth of a gear), angle in radians.
  function spokes(F, s, r0, r1, count, angle, tone = "mid") {
    let d = "";
    for (let i = 0; i < count; i++) {
      const a = angle + (i / count) * Math.PI * 2;
      d += k.pathOf([at(G.pointOf(F, s, r0, a)), at(G.pointOf(F, s, r1, a))]);
    }
    return Ln(d, { tone });
  }
  return { prismPaths, roundRect, signed, runsOf, card, CARD, receipt, receiptLine, spokes, webPoly };
}
