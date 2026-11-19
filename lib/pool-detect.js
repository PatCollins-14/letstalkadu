// Find swimming pools on a lot from public USGS aerial imagery (NAIP Plus, about 0.3-0.6 m per pixel).
// Pools aren't in any free building map, but in an aerial photo they are bright turquoise, which few other
// things in a yard are. Returns pool outlines (as small boxes, lng/lat) so the lot geometry can avoid them.
// No dependencies: a minimal PNG decoder (zlib is built into Node).
"use strict";
const zlib = require("zlib");

const NAIP = process.env.NAIP_URL || "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage";

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not png");
  let p = 8, w = 0, h = 0, bitDepth = 0, ctype = 0, idat = [], pal = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), data = buf.slice(p + 8, p + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; ctype = data[9]; if (data[12]) throw new Error("interlaced png"); }
    else if (type === "PLTE") pal = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("bit depth " + bitDepth);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype], raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch;
  const out = Buffer.alloc(w * h * 3), line = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      let r, g, bl;
      if (ctype === 3) { const i = line[x] * 3; r = pal[i]; g = pal[i + 1]; bl = pal[i + 2]; }
      else if (ch >= 3) { r = line[x * ch]; g = line[x * ch + 1]; bl = line[x * ch + 2]; }
      else { r = g = bl = line[x * ch]; }
      out[(y * w + x) * 3] = r; out[(y * w + x) * 3 + 1] = g; out[(y * w + x) * 3 + 2] = bl;
    }
    line.copy(prev);
  }
  return { w, h, rgb: out };
}

// Pool water: blue-green, clearly bluer than red, and not dark (dark blue is usually solar panels or shade)
function isPoolPixel(r, g, b) {
  return b >= 105 && g >= 95 && b - r >= 35 && g - r >= 18 && b + g >= 240 && Math.abs(b - g) <= 70;
}

async function poolsIn(bbox) {  // bbox = [south, west, north, east] (lng/lat)
  const [s, w, n, e] = bbox, kx = 111320 * Math.cos((s + n) / 2 * Math.PI / 180), ky = 110574;
  const wm = (e - w) * kx, hm = (n - s) * ky, mpp = 0.3;
  const W = Math.max(40, Math.min(500, Math.round(wm / mpp))), H = Math.max(40, Math.min(500, Math.round(hm / mpp)));
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
  let img;
  try {
    const r = await fetch(NAIP + "?" + new URLSearchParams({ bbox: [w, s, e, n].join(","), bboxSR: "4326", imageSR: "4326", size: W + "," + H, format: "png24", f: "image" }), { signal: ctl.signal });
    if (!r.ok || !/png/.test(r.headers.get("content-type") || "")) return null;
    img = decodePng(Buffer.from(await r.arrayBuffer()));
  } catch (err) { return null; } finally { clearTimeout(t); }
  const { w: iw, h: ih, rgb } = img, mask = new Uint8Array(iw * ih);
  for (let i = 0; i < iw * ih; i++) if (isPoolPixel(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2])) mask[i] = 1;
  // connected blobs; keep pool-sized ones (about 6 to 250 square meters)
  const pxArea = (wm / iw) * (hm / ih), seen = new Uint8Array(iw * ih), pools = [];
  for (let i = 0; i < iw * ih; i++) {
    if (!mask[i] || seen[i]) continue;
    const stack = [i]; seen[i] = 1; let cnt = 0, x0 = iw, x1 = 0, y0 = ih, y1 = 0;
    while (stack.length) {
      const k = stack.pop(), x = k % iw, y = (k - x) / iw; cnt++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = ny * iw + nx;
        if (nx >= 0 && ny >= 0 && nx < iw && ny < ih && mask[nk] && !seen[nk]) { seen[nk] = 1; stack.push(nk); }
      }
    }
    const m2 = cnt * pxArea, fill = cnt / ((x1 - x0 + 1) * (y1 - y0 + 1));
    if (m2 < 6 || m2 > 250 || fill < 0.35) continue;  // too small (a tarp, a car), too big (a reservoir) or too stringy
    const lng = (x) => w + (x / iw) * (e - w), lat = (y) => n - (y / ih) * (n - s);
    pools.push({ sqft: Math.round(m2 * 10.764), ring: [[lng(x0), lat(y1 + 1)], [lng(x1 + 1), lat(y1 + 1)], [lng(x1 + 1), lat(y0)], [lng(x0), lat(y0)]] });
  }
  return { pools, source: "USGS NAIP Plus aerial imagery", mPerPx: Math.round(Math.sqrt(pxArea) * 100) / 100 };
}

module.exports = { poolsIn, decodePng, isPoolPixel };
