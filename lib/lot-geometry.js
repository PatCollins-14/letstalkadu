// Lot geometry for the ADU lot fit check (server side, no dependencies).
// Input: the parcel outline, building outlines and nearby street centerlines (all [lng, lat]).
// Output: the real buildable area for a detached ADU and the largest rectangle that fits in it, measured on a
// 1 ft grid aligned with the lot's front line.
//
// Rules used (typical Southern California values; the PDF labels them as assumptions):
//   - 4 ft from side and rear property lines (state ADU limit, Gov. Code 66314(d)(7))
//   - front yard kept clear: FRONT_SETBACK ft from the street-facing front line
//   - street side of a corner lot: STREET_SIDE_SETBACK ft
//   - SEPARATION ft from any existing building (fire separation; some cities ask for more)
//   - a usable ADU footprint is at least MIN_DIM ft on its short side
"use strict";

const FT_PER_M = 3.28084;
const RULES = { FRONT_SETBACK: 20, SIDE_REAR: 4, STREET_SIDE_SETBACK: 10, SEPARATION: 6, MIN_DIM: 14, MAX_ASPECT: 2.5, ADU_MAX: 1200 };

// ---------- projection: lng/lat -> local feet around an origin ----------
function projector(lng0, lat0) {
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180) * FT_PER_M, ky = 110574 * FT_PER_M;
  return {
    fwd: ([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * ky],
    inv: ([x, y]) => [lng0 + x / kx, lat0 + y / ky]
  };
}

// ---------- basic geometry ----------
function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
function ringCentroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; }
  return a ? [cx / (3 * a), cy / (3 * a)] : r[0];
}
function inRing(p, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function inPoly(p, rings) { if (!inRing(p, rings[0])) return false; for (let k = 1; k < rings.length; k++) if (inRing(p, rings[k])) return false; return true; }
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function edgesOf(r) { const e = []; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; if (a[0] !== b[0] || a[1] !== b[1]) e.push([a, b]); } return e; }
function lineDist(p, line) { let d = Infinity; for (let i = 1; i < line.length; i++) d = Math.min(d, segDist(p, line[i - 1], line[i])); return d; }
function rot(p, c, s) { return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
function closeRing(r) { const a = r[0], b = r[r.length - 1]; return a[0] === b[0] && a[1] === b[1] ? r.slice(0, -1) : r.slice(); }

// Merge collinear-ish consecutive parcel edges so a front line drawn in many short pieces counts as one
function mergedSides(ring) {
  const e = edgesOf(ring), out = [];
  e.forEach(([a, b]) => {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), last = out[out.length - 1];
    if (last && Math.abs(Math.atan2(Math.sin(ang - last.ang), Math.cos(ang - last.ang))) < 0.26) { last.b = b; last.pts.push(b); last.len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    else out.push({ a, b, ang, len: Math.hypot(b[0] - a[0], b[1] - a[1]), pts: [a, b] });
  });
  if (out.length > 1) { const f = out[0], l = out[out.length - 1]; if (Math.abs(Math.atan2(Math.sin(f.ang - l.ang), Math.cos(f.ang - l.ang))) < 0.26) { l.b = f.b; l.pts = l.pts.concat(f.pts.slice(1)); l.len += f.len; out.shift(); } }
  return out;
}

// ---------- largest rectangle in a 0/1 grid with both sides >= minDim (histogram method) ----------
function bestRect(free, W, H, minDim, maxAspect) {
  const h = new Int32Array(W); let best = null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) h[x] = free[y * W + x] ? h[x] + 1 : 0;
    const st = [];
    for (let x = 0; x <= W; x++) {
      const cur = x < W ? h[x] : 0;
      let start = x;
      while (st.length && st[st.length - 1][1] > cur) {
        const [sx, sh] = st.pop();
        const w = x - sx;
        // every height from sh down to cur is achievable over this width; try the tallest and a few useful cuts
        for (const hh of [sh, Math.max(cur, minDim)]) {
          if (hh < minDim || w < minDim || hh > sh) continue;
          const short = Math.min(w, hh), long = Math.min(Math.max(w, hh), short * maxAspect), usable = short * long;
          if (!best || usable > best.usable || (usable === best.usable && w * hh > best.w * best.h)) best = { x: sx, y: y - hh + 1, w, h: hh, usable };
        }
        start = sx;
      }
      st.push([start, cur]);
    }
  }
  return best;
}

/**
 * analyzeLot({ parcel: [[lng,lat],...] (outer ring) or [[ring],[hole]...], buildings: [[ [lng,lat]... ]], roads: [[ [lng,lat]... ]], streetPoint: [lng,lat] })
 * Everything except parcel is optional; missing data lowers the confidence and is reported.
 */
function analyzeLot(input, rulesIn) {
  const R = Object.assign({}, RULES, rulesIn || {});
  const rawRings = Array.isArray(input.parcel[0][0]) ? input.parcel : [input.parcel];
  const outer0 = closeRing(rawRings[0]);
  const c0 = ringCentroid(outer0);
  const P = projector(c0[0], c0[1]);
  const rings = rawRings.map((r) => closeRing(r).map(P.fwd));
  const outer = rings[0];
  const lotArea = ringArea(outer) - rings.slice(1).reduce((s, r) => s + ringArea(r), 0);
  const notes = [], conf = {};

  // Buildings that sit on this parcel (centroid inside, or at least 30% of their corners inside)
  const blds = (input.buildings || []).map((b) => closeRing(Array.isArray(b[0][0]) ? b[0] : b).map(P.fwd)).filter((b) => {
    if (b.length < 3) return false;
    if (inPoly(ringCentroid(b), rings)) return true;
    return b.filter((p) => inPoly(p, rings)).length / b.length >= 0.3;
  }).map((b) => ({ ring: b, area: ringArea(b) })).sort((a, b) => b.area - a.area);
  const main = blds[0] || null;
  // Other things the ADU must stay clear of (pools found in aerial imagery), kept apart from the building list
  const obst = (input.obstacles || []).map((o) => closeRing(o).map(P.fwd)).filter((o) => o.length > 2 && (inPoly(ringCentroid(o), rings) || o.some((p) => inPoly(p, rings))));
  const accessory = blds.slice(1).filter((b) => b.area >= 80);

  // Which sides face a street
  const allSides = mergedSides(outer), sides = allSides.filter((s) => s.len >= 8);
  const roads = (input.roads || []).map((l) => l.map(P.fwd));
  let streetSides = [], frontMethod = "none";
  if (roads.length) {
    sides.forEach((s) => {
      const mids = [0.25, 0.5, 0.75].map((t) => [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t]);
      // every point along the side must be near the same street (a side line only touches the street at its end)
      s.roadDist = Math.min(...roads.map((l) => Math.max(...mids.map((m) => lineDist(m, l)))));
    });
    streetSides = sides.filter((s) => s.roadDist <= 70).sort((a, b) => a.roadDist - b.roadDist);
    if (streetSides.length) frontMethod = "streets";
  }
  // No street lines? A side faces a street when the land just outside it belongs to no other parcel.
  // other parcels only (skip our own outline, which the neighbor query also returns)
  const neigh = (input.neighbors || []).map((r) => closeRing(r).map(P.fwd)).filter((r) => r.length > 2 && !inPoly(ringCentroid(r), rings));
  if (!streetSides.length && neigh.length) {
    const cen0 = ringCentroid(outer);
    sides.forEach((s) => {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy) || 1;
      let nx = dy / L, ny = -dx / L; const mid = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
      if ((cen0[0] - mid[0]) * nx + (cen0[1] - mid[1]) * ny > 0) { nx = -nx; ny = -ny; }
      const open = [0.2, 0.5, 0.8].filter((t) => {
        const q = [s.a[0] + dx * t + nx * 10, s.a[1] + dy * t + ny * 10];
        return !inPoly(q, rings) && !neigh.some((r) => inRing(q, r));
      }).length;
      s.open = open;
      // an alley is narrow: another parcel starts within about 30 ft. Streets are wider (50 ft or more of right of way)
      s.alley = open >= 2 && [0.3, 0.5, 0.7].some((t) => { const q = [s.a[0] + dx * t + nx * 30, s.a[1] + dy * t + ny * 30]; return neigh.some((r) => inRing(q, r)); });
    });
    streetSides = sides.filter((s) => s.open >= 2 && !s.alley);
    if (streetSides.length && streetSides.length < sides.length) frontMethod = "neighbors"; else streetSides = [];
  }
  let front = null;
  const sp = input.streetPoint ? P.fwd(input.streetPoint) : null;
  if (streetSides.length) {
    const mainC = main ? ringCentroid(main.ring) : null;
    if (!sp && streetSides.length > 1 && neigh.length) {
      // Homes usually face the narrower, residential street: measure how far across each street the next parcel starts
      const cen1 = ringCentroid(outer);
      streetSides.forEach((s) => {
        const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy) || 1, mid = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
        let nx = dy / L, ny = -dx / L; if ((cen1[0] - mid[0]) * nx + (cen1[1] - mid[1]) * ny > 0) { nx = -nx; ny = -ny; }
        s.row = 250;
        for (let d = 20; d <= 250; d += 10) if (neigh.some((r) => inRing([mid[0] + nx * d, mid[1] + ny * d], r))) { s.row = d; break; }
      });
      front = streetSides.slice().sort((a, b) => (a.row - b.row) || (a.len - b.len))[0];
    }
    else if (!sp && mainC && streetSides.length > 1) front = streetSides.slice().sort((a, b) => segDist(mainC, a.a, a.b) - segDist(mainC, b.a, b.b))[0];
    else front = sp ? streetSides.slice().sort((a, b) => segDist(sp, a.a, a.b) - segDist(sp, b.a, b.b))[0] : streetSides.slice().sort((a, b) => a.len - b.len)[0];
  } else if (sp) {
    // The geocoded point sits on the street but can drift along it, so use each side's infinite line and only
    // sides whose outward face looks toward the point
    const cen = ringCentroid(outer);
    const facing = sides.map((s) => {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy) || 1;
      let nx = dy / L, ny = -dx / L; const mid = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
      if ((cen[0] - mid[0]) * nx + (cen[1] - mid[1]) * ny > 0) { nx = -nx; ny = -ny; }  // make the normal point outward
      const along = (sp[0] - mid[0]) * nx + (sp[1] - mid[1]) * ny;
      return { s, along };
    }).filter((o) => o.along > 0).sort((a, b) => a.along - b.along);
    front = (facing[0] || { s: sides[0] }).s; frontMethod = "address point";
  } else if (main) {
    const mc = ringCentroid(main.ring);
    front = sides.slice().sort((a, b) => segDist(mc, a.a, a.b) - segDist(mc, b.a, b.b))[0]; frontMethod = "nearest the house";
  } else { front = sides.slice().sort((a, b) => b.len - a.len)[0]; frontMethod = "guess"; }
  conf.front = frontMethod === "streets" || frontMethod === "neighbors" ? "Measured" : "Estimated";

  // Rotate so the front line runs along x and the lot extends toward +y
  const ang = Math.atan2(front.b[1] - front.a[1], front.b[0] - front.a[0]);
  let cs = Math.cos(-ang), sn = Math.sin(-ang);
  const R2 = (p) => rot(p, cs, sn);
  let oR = outer.map(R2);
  const fA = R2(front.a);
  if (oR.reduce((s, p) => s + p[1], 0) / oR.length < fA[1]) { cs = Math.cos(Math.PI - ang); sn = Math.sin(Math.PI - ang); oR = outer.map(R2); }
  const ringsR = rings.map((r) => r.map(R2));
  const sidesR = allSides.map((s) => ({ s, a: R2(s.a), b: R2(s.b), pts: s.pts.map(R2) }));
  const bldR = blds.map((b) => b.ring.map(R2)).concat(obst.map((o) => o.map(R2)));
  const xs = oR.map((p) => p[0]), ys = oR.map((p) => p[1]);
  const minX = Math.floor(Math.min(...xs)), minY = Math.floor(Math.min(...ys)), maxX = Math.ceil(Math.max(...xs)), maxY = Math.ceil(Math.max(...ys));
  const cell = lotArea > 60000 ? 2 : 1;
  const W = Math.max(1, Math.ceil((maxX - minX) / cell)), H = Math.max(1, Math.ceil((maxY - minY) / cell));
  if (W * H > 2500000) return { ok: false, reason: "lot too large to grid", lotArea: Math.round(lotArea) };

  // Keep the ADU behind the front of the house (many cities don't allow a detached ADU in front of the home).
  // The front yard is checked separately (behindHouse: false) as the fallback California allows when nothing else fits.
  const fyLine = Math.min(R2(front.a)[1], R2(front.b)[1]);
  let houseFrontY = -Infinity;
  if (R.BEHIND_HOUSE !== false && main) {
    const mR = main.ring.map(R2), near = Math.min.apply(null, mR.map((p) => p[1]));
    if (near - fyLine < 120) houseFrontY = near;  // ignore when the house sits far back on a big lot
  }
  const free = new Uint8Array(W * H);
  let freeCells = 0;
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    const p = [minX + (gx + 0.5) * cell, minY + (gy + 0.5) * cell];
    if (!inPoly(p, ringsR)) continue;
    if (p[1] < houseFrontY) continue;
    let ok = true;
    for (const sd of sidesR) {
      const need = sd.s === front ? R.FRONT_SETBACK : streetSides.indexOf(sd.s) >= 0 ? R.STREET_SIDE_SETBACK : R.SIDE_REAR;
      if (lineDist(p, sd.pts) < need) { ok = false; break; }
    }
    if (ok) for (let k = 1; k < ringsR.length && ok; k++) if (lineDist(p, ringsR[k].concat([ringsR[k][0]])) < R.SIDE_REAR) ok = false;
    if (ok) for (const b of bldR) { if (inRing(p, b) || lineDist(p, b.concat([b[0]])) < R.SEPARATION) { ok = false; break; } }
    if (ok) { free[gy * W + gx] = 1; freeCells++; }
  }
  const md = Math.ceil(R.MIN_DIM / cell);
  const br = bestRect(free, W, H, md, R.MAX_ASPECT);
  let rect = null, maxFit = 0, rectLocal = null;
  if (br) {
    const w = br.w * cell, h = br.h * cell;
    const short = Math.min(w, h), long = Math.min(Math.max(w, h), short * R.MAX_ASPECT);
    maxFit = Math.min(R.ADU_MAX, Math.floor(short * long / 10) * 10);
    const x0 = minX + br.x * cell, y0 = minY + br.y * cell;
    const back = (p) => { const q = rot(p, cs, -sn); return P.inv(q); };  // inverse rotation
    rectLocal = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]];
    rect = { w: Math.round(w), h: Math.round(h), area: Math.round(w * h), corners: [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]].map(back) };
  }
  const freeArea = freeCells * cell * cell;
  // A small site diagram in feet, front line along the bottom (y = 0), for the PDF
  const fy = Math.min(R2(front.a)[1], R2(front.b)[1]);
  const D = (p) => [Math.round((p[0] - minX) * 10) / 10, Math.round((p[1] - fy) * 10) / 10];
  const drawing = { parcel: oR.map(D), buildings: bldR.slice(0, blds.length).map((b) => b.map(D)), pools: bldR.slice(blds.length).map((b) => b.map(D)), rect: rectLocal ? rectLocal.map(D) : null, front: [D(R2(front.a)), D(R2(front.b))],
    streets: sidesR.filter((sd) => streetSides.indexOf(sd.s) >= 0 && sd.s !== front).map((sd) => [D(sd.a), D(sd.b)]) };
  if (!blds.length) notes.push("no building outlines found on this parcel");
  return {
    ok: true, lotArea: Math.round(lotArea), frontMethod, cornerLot: streetSides.length > 1,
    mainFootprint: main ? Math.round(main.area) : null,
    accessory: accessory.map((b) => ({ area: Math.round(b.area) })),
    buildingsFound: blds.length, obstaclesOnLot: obst.map((o) => Math.round(ringArea(o))),
    buildableArea: Math.round(freeArea), maxFit, rect,
    frontLine: [P.inv(front.a), P.inv(front.b)], drawing,
    rules: R, confidence: conf, notes
  };
}

module.exports = { analyzeLot, RULES, _internal: { bestRect, ringArea, mergedSides, projector } };
