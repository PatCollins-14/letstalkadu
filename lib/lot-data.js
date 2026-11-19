// Free public data for the lot fit check: parcel outline, building outlines, streets, ground elevation.
// Every lookup has a timeout and resolves to null/[] on failure, so a slow source never blocks a lead.
"use strict";

const UA = { Accept: "application/json", "User-Agent": "letstalkadu-lotcheck/1.0" };
async function getJson(url, ms, opts) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 8000);
  try {
    const r = await fetch(url, Object.assign({ signal: ctl.signal, headers: UA }, opts || {}));
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; } finally { clearTimeout(t); }
}
function qs(o) { return new URLSearchParams(o).toString(); }

// ---------- Parcels (polygon) by point, all six SoCal counties (verified 2026-11-19) ----------
// Always pass an explicit field list: some county layers also carry owner names, which we never pull.
const box = (s, n, w, e) => (lat, lng) => lat > s && lat < n && lng > w && lng < e;
const num = (v) => { const n = Number(String(v == null ? "" : v).trim()); return isFinite(n) ? n : 0; };
const sum5 = (a, f) => [1, 2, 3, 4, 5].reduce((t, i) => t + num(a[f + i]), 0);
const PARCEL_SOURCES = [
  { id: "LA County Assessor", county: "Los Angeles", test: box(33.65, 34.85, -118.95, -117.64),
    url: "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0",
    fields: "APN,UseType,UseDescription,TaxRateCity,YearBuilt1," + [1, 2, 3, 4, 5].map((i) => "SQFTmain" + i + ",Units" + i + ",Bedrooms" + i).join(","),
    norm: (a) => ({ apn: a.APN, use: a.UseDescription, residential: a.UseType === "Residential", cityOfLA: String(a.TaxRateCity || "").toUpperCase() === "LOS ANGELES", livingSqft: sum5(a, "SQFTmain"), units: sum5(a, "Units"), beds: sum5(a, "Bedrooms"), yearBuilt: /^d{4}$/.test(String(a.YearBuilt1 || "").trim()) ? String(a.YearBuilt1).trim() : "" }) },
  { id: "SCAG 2024 parcels (Orange County)", county: "Orange", test: box(33.38, 33.95, -118.13, -117.40),
    url: "https://rdp.scag.ca.gov/mapping/rest/services/LDX/Zoning_poly_OR/MapServer/0", fields: "APN24,CITY,ZN24_CITY",
    norm: (a) => ({ apn: a.APN24, zoning: a.ZN24_CITY, city: a.CITY }) },
  { id: "Riverside County Assessor", county: "Riverside", test: box(33.42, 34.08, -117.68, -114.43), retries: 2,
    url: "https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50", fields: "APN,CLASS_CODE,CITY",
    norm: (a) => ({ apn: a.APN, use: a.CLASS_CODE, residential: /dwelling|residen|family/i.test(a.CLASS_CODE || "") }) },
  { id: "San Bernardino County Assessor", county: "San Bernardino", test: box(33.87, 35.81, -117.81, -114.13),
    url: "https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/San_Bernardino_County_Parcel_Dataset/FeatureServer/0", fields: "APN,TYPEUSE,CONST_YEAR",
    norm: (a) => ({ apn: a.APN, residential: /^5/.test(String(a.TYPEUSE || "")), yearBuilt: num(a.CONST_YEAR) > 1800 ? String(a.CONST_YEAR) : "" }) },
  { id: "San Diego County Assessor", county: "San Diego", test: box(32.53, 33.51, -117.61, -116.08),
    url: "https://gis-public.sandiegocounty.gov/arcgis/rest/services/PPM_Public/MapServer/0", fields: "APN,NUCLEUS_USE_CD,UNITQTY,TOTAL_LVG_AREA,BEDROOMS,YEAR_EFFECTIVE,GARAGE_STALLS,POOL",
    pick: (fs) => fs.filter((f) => /^1[0-9]{2}$/.test(String(f.attributes.NUCLEUS_USE_CD || "")))[0] || fs[0],
    norm: (a) => { const yy = num(a.YEAR_EFFECTIVE); return { apn: a.APN, residential: /^1/.test(String(a.NUCLEUS_USE_CD || "")), livingSqft: num(a.TOTAL_LVG_AREA), units: num(a.UNITQTY), beds: num(a.BEDROOMS),
      yearBuilt: yy ? String(yy > 30 ? 1900 + yy : 2000 + yy) : "", garageStalls: num(a.GARAGE_STALLS), pool: /^y|^1|^t/i.test(String(a.POOL || "")) }; } },
  { id: "SCAG 2020 regional parcels", county: "", test: (lat, lng) => lat > 33.38 && lat < 35.81 && lng > -119.48 && lng < -114.13, fallback: true,
    url: "https://rdp.scag.ca.gov/mapping/rest/services/Housing/2020_Annual_Land_Use/MapServer/0", fields: "APN20,ALU20",
    norm: (a) => ({ apn: a.APN20, residential: /^11/.test(String(a.ALU20 || "")) }) },
  { id: "Ventura County parcels", county: "Ventura", test: box(34.04, 34.90, -119.48, -118.63),
    url: "https://services2.arcgis.com/XJ5Tb7dTYtAMoyYT/arcgis/rest/services/Parcels_Quarterly/FeatureServer/0", fields: "APN",
    norm: (a) => ({ apn: a.APN }) }
];
function arcQuery(url, params, ms) {
  return getJson(url + "/query?" + qs(Object.assign({ inSR: "4326", spatialRel: "esriSpatialRelIntersects", returnGeometry: "true", outSR: "4326", f: "json" }, params)), ms || 9000);
}
async function arcgisPolygonAt(src, lat, lng) {
  let j = null;
  for (let i = 0; i <= (src.retries || 0) && !(j && j.features); i++) j = await arcQuery(src.url, { geometry: lng + "," + lat, geometryType: "esriGeometryPoint", outFields: src.fields });
  if (!j || !j.features) return { failed: true };
  const f = src.pick ? src.pick(j.features) : j.features[0];
  if (!f || !f.geometry || !f.geometry.rings) return null;
  return { rings: f.geometry.rings, attrs: src.norm(f.attributes || {}) };
}
const countyOf = (lat, lng) => { const s = PARCEL_SOURCES.find((x) => !x.fallback && x.test(lat, lng)); return s ? s.county : ""; };
async function parcelAt(lat, lng) {
  let failed = false;
  const order = PARCEL_SOURCES.filter((s) => !s.fallback).concat(PARCEL_SOURCES.filter((s) => s.fallback));
  for (const s of order) {
    if (!s.test(lat, lng)) continue;
    if (s.fallback && !failed && countyOf(lat, lng) !== "Riverside") continue;  // regional copy only when a county map is down
    const got = await arcgisPolygonAt(s, lat, lng);
    if (got && got.failed) { failed = true; continue; }
    if (got) return Object.assign({ source: s.id, county: s.county || countyOf(lat, lng), src: s }, got);
  }
  // The point may sit on the street (a geocoded address): take the closest parcel within about 25 m
  for (const s of order) {
    if (!s.test(lat, lng) || (s.fallback && !failed)) continue;
    const d = 0.00025, j = await arcQuery(s.url, { geometry: [lng - d, lat - d, lng + d, lat + d].join(","), geometryType: "esriGeometryEnvelope", outFields: s.fields }, 9000);
    if (!j || !j.features || !j.features.length) continue;
    const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110574;
    const distTo = (ring) => Math.min.apply(null, ring.map((p, i) => { const q = ring[(i + 1) % ring.length];
      const ax = (p[0] - lng) * kx, ay = (p[1] - lat) * ky, bx = (q[0] - lng) * kx, by = (q[1] - lat) * ky, dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0; return Math.hypot(ax + t * dx, ay + t * dy); }));
    const best = j.features.filter((f) => f.geometry && f.geometry.rings).map((f) => ({ f, d: distTo(f.geometry.rings[0]) })).sort((a, b) => a.d - b.d)[0];
    if (best && best.d <= 25) return Object.assign({ source: s.id, county: s.county || countyOf(lat, lng), src: s, nearest: true, rings: best.f.geometry.rings, attrs: s.norm(best.f.attributes || {}) });
  }
  return failed ? { failed: true } : null;
}
// Neighboring parcel outlines (to tell which sides face a street: a street side has no parcel behind it)
async function parcelsInBBox(src, bbox) {
  let j = null;
  for (let i = 0; i < 3 && !(j && j.features); i++)  // some county servers drop requests now and then
    j = await arcQuery(src.url, { geometry: [bbox[1], bbox[0], bbox[3], bbox[2]].join(","), geometryType: "esriGeometryEnvelope", outFields: src.fields.split(",")[0], resultRecordCount: 200 }, 9000);
  return j && j.features ? j.features.filter((f) => f.geometry && f.geometry.rings).map((f) => f.geometry.rings[0]) : null;
}

// ---------- Building outlines: county layers where they are best, Overture (OSM + county imports) elsewhere ----------
const OVERTURE = { id: "Overture Maps", url: "https://services1.arcgis.com/SvBZpJ7eKEZhhKPa/arcgis/rest/services/OMF_Buildings_CONUS/FeatureServer/0", fields: "*", noLimit: true };
const BUILDING_SOURCES = {
  "Los Angeles": { id: "LA County (LARIAC 2020)", url: "https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Countywide_Building_Outlines_(2020)/FeatureServer/0", fields: "BLD_ID" },
  "Riverside": { id: "Riverside County", url: "https://services1.arcgis.com/pWmBUdSlVpXStHU6/arcgis/rest/services/Building_Footprints/FeatureServer/1", fields: "APN" },
  "San Diego": { id: "San Diego County", url: "https://gis-public.sandiegocounty.gov/arcgis/rest/services/sdep_warehouse/BUILDING_OUTLINES/FeatureServer/0", fields: "bldgID" },
  "Ventura": { id: "Ventura County (OSM import)", url: "https://services6.arcgis.com/Do88DoK2xjTUCXd1/arcgis/rest/services/Ventura_County_CA_Buildings/FeatureServer/0", fields: "*" }
};
async function buildingLayer(src, bbox) {
  const p = { geometry: [bbox[1], bbox[0], bbox[3], bbox[2]].join(","), geometryType: "esriGeometryEnvelope", outFields: src.fields };
  if (!src.noLimit) p.resultRecordCount = 300;  // Overture rejects this parameter
  const j = await arcQuery(src.url, p, 9000);
  if (!j || !j.features) return null;
  return j.features.filter((f) => f.geometry && f.geometry.rings).map((f) => f.geometry.rings[0]);
}
function inRingLL(p, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
function centroidLL(r) { let x = 0, y = 0; r.forEach((p) => { x += p[0]; y += p[1]; }); return [x / r.length, y / r.length]; }
// County outlines are the most precise, but some are years old. Overture (2024) adds structures built since,
// such as newer garages and ADUs: any Overture building that no county outline covers is added.
async function buildingsAround(bbox, county) {
  const first = BUILDING_SOURCES[county];
  const [c, o] = await Promise.all([first ? buildingLayer(first, bbox) : Promise.resolve(null), buildingLayer(OVERTURE, bbox)]);
  if (c && c.length) {
    const extra = (o || []).filter((b) => { const m = centroidLL(b); return !c.some((k) => inRingLL(m, k) || inRingLL(centroidLL(k), b)); });
    return { buildings: c.concat(extra), source: first.id + (extra.length ? " + Overture Maps" : ""), added: extra.length };
  }
  return o ? { buildings: o, source: OVERTURE.id } : null;
}

// ---------- Buildings and streets near a parcel (OpenStreetMap Overpass; LA County buildings are in OSM) ----------
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const ROAD_TYPES = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link";
async function osmAround(bbox) {  // bbox = [south, west, north, east]
  const b = bbox.map((v) => v.toFixed(6)).join(",");
  const q = `[out:json][timeout:12];(way["building"](${b});relation["building"](${b});way["highway"~"^(${ROAD_TYPES})$"](${b}););out geom;`;
  for (const url of OVERPASS) {
    const j = await getJson(url, 14000, { method: "POST", body: "data=" + encodeURIComponent(q), headers: Object.assign({ "Content-Type": "application/x-www-form-urlencoded" }, UA) });
    if (!j || !j.elements) continue;
    const buildings = [], roads = [];
    j.elements.forEach((e) => {
      if (e.type === "way" && e.geometry) {
        const line = e.geometry.map((g) => [g.lon, g.lat]);
        if (e.tags && e.tags.building) buildings.push({ ring: line, tag: e.tags.building });
        else if (e.tags && e.tags.highway) roads.push(line);
      } else if (e.type === "relation" && e.members) {
        e.members.filter((m) => m.role === "outer" && m.geometry).forEach((m) => buildings.push({ ring: m.geometry.map((g) => [g.lon, g.lat]), tag: e.tags && e.tags.building }));
      }
    });
    return { buildings, roads, source: "OpenStreetMap" };
  }
  return null;
}

// ---------- Ground elevation (USGS 3DEP via EPQS) ----------
const EPQS_URL = process.env.EPQS_URL || "https://epqs.nationalmap.gov/v1/json";
async function groundFt(lng, lat) {
  for (let i = 0; i < 2; i++) {
    const j = await getJson(EPQS_URL + "?" + qs({ x: lng.toFixed(7), y: lat.toFixed(7), wkid: 4326, units: "Feet", includeDate: "false" }), 12000);
    const raw = j && j.value;
    const v = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    if (isFinite(v) && v > -500 && v < 15000) return v;
  }
  return NaN;
}
// Slope across a set of points (lng/lat): least-squares plane grade, steepest neighbor pair, relief
async function slopeAcross(points) {
  const lat0 = points[0][1], kx = 111320 * Math.cos(lat0 * Math.PI / 180) * 3.28084, ky = 110574 * 3.28084;
  const zs = await Promise.all(points.map(([lng, lat]) => groundFt(lng, lat)));
  const pts = points.map(([lng, lat], i) => ({ x: (lng - points[0][0]) * kx, y: (lat - lat0) * ky, z: zs[i] })).filter((p) => isFinite(p.z));
  if (pts.length < Math.max(4, Math.ceil(points.length * 0.7))) return null;
  let n = 0, sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
  pts.forEach((p) => { n++; sx += p.x; sy += p.y; sz += p.z; sxx += p.x * p.x; syy += p.y * p.y; sxy += p.x * p.y; sxz += p.x * p.z; syz += p.y * p.z; });
  const mx = sx / n, my = sy / n, mz = sz / n;
  const Sxx = sxx - n * mx * mx, Syy = syy - n * my * my, Sxy = sxy - n * mx * my, Sxz = sxz - n * mx * mz, Syz = syz - n * my * mz;
  const det = Sxx * Syy - Sxy * Sxy;
  if (Math.abs(det) < 1e-9) return null;
  const b = (Sxz * Syy - Syz * Sxy) / det, c = (Syz * Sxx - Sxz * Sxy) / det;
  let maxPair = 0;
  for (let i = 0; i < pts.length; i++) for (let k = i + 1; k < pts.length; k++) {
    const d = Math.hypot(pts[i].x - pts[k].x, pts[i].y - pts[k].y);
    if (d >= 10) maxPair = Math.max(maxPair, Math.abs(pts[i].z - pts[k].z) / d * 100);
  }
  const zv = pts.map((p) => p.z);
  return { avgPct: Math.round(Math.hypot(b, c) * 1000) / 10, maxPct: Math.round(maxPair * 10) / 10, reliefFt: Math.round((Math.max(...zv) - Math.min(...zv)) * 10) / 10, points: pts.length };
}
// A 3 x 3 grid inside a rectangle (corners inset 15%)
function gridIn(corners, n) {
  n = n || 3; const out = [];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    const u = 0.15 + 0.7 * i / (n - 1), v = 0.15 + 0.7 * k / (n - 1);
    out.push(lerp(lerp(corners[0], corners[1], u), lerp(corners[3], corners[2], u), v));
  }
  return out;
}

// ---------- Census geocoder (street-interpolated point: sits on the address's street) ----------
async function censusPoint(address) {
  const j = await getJson("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?" + qs({ address, benchmark: "Public_AR_Current", format: "json" }), 8000);
  const m = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
  return m && m.coordinates ? { lat: Number(m.coordinates.y), lng: Number(m.coordinates.x), matched: m.matchedAddress } : null;
}

function ringsBBox(rings, padDeg) {
  let s = 90, w = 180, n = -90, e = -180;
  rings.forEach((r) => r.forEach(([x, y]) => { s = Math.min(s, y); n = Math.max(n, y); w = Math.min(w, x); e = Math.max(e, x); }));
  return [s - padDeg, w - padDeg, n + padDeg, e + padDeg];
}

// ---------- Overlays that can block or change an ADU (official public layers, verified 2026-11-19) ----------
const CF = "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services";
const OVERLAY = {
  fireSRA: { url: CF + "/FHSZSRA_23_3/FeatureServer/0", fields: "FHSZ,FHSZ_Description", src: "CAL FIRE state responsibility area map (effective April 1, 2024)" },
  fireLRA: { url: CF + "/FHSALRA25_v1_All/FeatureServer/0", fields: "FHSZ,FHSZ_Description", src: "CAL FIRE local responsibility area map (March 24, 2025)" },
  flood: { url: "https://services5.arcgis.com/7weheFjxuNkGGiZi/arcgis/rest/services/USA_Flood_Hazard_Areas_view/FeatureServer/0", fields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF", src: "FEMA National Flood Hazard Layer (Esri copy, March 2026)" },
  laHillside: { url: "https://maps.lacity.org/lahub/rest/services/Special_Areas/MapServer/6", fields: "H_TYPE", src: "City of LA Hillside Area" },
  laHpoz: { url: "https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/Historic_Preservation_Overlay_Zones/FeatureServer/5", fields: "NAME", src: "City of LA Historic Preservation Overlay Zones" },
  laSpecific: { url: "https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/Specific_Plan_Areas/FeatureServer/6", fields: "SPA_NM", src: "City of LA Specific Plan areas" },
  transit: { url: "https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHrailroad/CA_Transit_Stops/FeatureServer/0", src: "Caltrans California Transit Stops (from agency schedules)" }
};
async function pointQuery(o, lat, lng) {
  const j = await getJson(o.url + "/query?" + qs({ geometry: lng + "," + lat, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: o.fields, returnGeometry: "false", f: "json" }), 6000);
  if (!j || !j.features) return null;  // lookup failed
  return j.features.map((f) => f.attributes || {});
}
async function nearestStop(lat, lng) {
  const j = await getJson(OVERLAY.transit.url + "/query?" + qs({ geometry: lng + "," + lat, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", distance: 900, units: "esriSRUnit_Meter",
    outFields: "agency,stop_name,route_type", returnGeometry: "true", outSR: "4326", f: "json" }), 6000);
  if (!j || !j.features) return null;
  const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110574;
  const best = j.features.map((f) => ({ name: f.attributes.stop_name, agency: f.attributes.agency, m: Math.hypot((f.geometry.x - lng) * kx, (f.geometry.y - lat) * ky) })).sort((a, b) => a.m - b.m)[0];
  return best ? { miles: Math.round(best.m / 1609.34 * 100) / 100, name: best.name, agency: best.agency } : { miles: null };
}
async function overlaysAt(lat, lng, cityOfLA) {
  const [sra, lra, flood, hill, hpoz, spec, stop] = await Promise.all([
    pointQuery(OVERLAY.fireSRA, lat, lng), pointQuery(OVERLAY.fireLRA, lat, lng), pointQuery(OVERLAY.flood, lat, lng),
    cityOfLA ? pointQuery(OVERLAY.laHillside, lat, lng) : Promise.resolve(undefined),
    cityOfLA ? pointQuery(OVERLAY.laHpoz, lat, lng) : Promise.resolve(undefined),
    cityOfLA ? pointQuery(OVERLAY.laSpecific, lat, lng) : Promise.resolve(undefined),
    nearestStop(lat, lng)
  ]);
  const fireRow = (sra && sra[0]) || (lra && lra[0]);
  const fire = sra === null && lra === null ? null : { zone: fireRow && fireRow.FHSZ > 0 ? fireRow.FHSZ_Description : "Not in a fire hazard zone", area: sra && sra[0] ? "state" : "local", veryHigh: !!(fireRow && fireRow.FHSZ === 3) };
  const fz = flood && flood[0];
  return {
    fire, flood: flood === null ? null : { zone: fz ? fz.FLD_ZONE : "X (minimal)", subtype: fz ? fz.ZONE_SUBTY || "" : "", special: !!(fz && fz.SFHA_TF === "T") },
    hillside: hill === undefined ? undefined : hill === null ? null : hill.length > 0,
    hpoz: hpoz === undefined ? undefined : hpoz === null ? null : (hpoz[0] ? hpoz[0].NAME : ""),
    specificPlans: spec === undefined ? undefined : spec === null ? null : spec.map((r) => r.SPA_NM).filter(Boolean),
    transit: stop, sources: OVERLAY
  };
}

module.exports = { overlaysAt, nearestStop, OVERLAY, getJson, parcelAt, arcgisPolygonAt, PARCEL_SOURCES, parcelsInBBox, buildingsAround, BUILDING_SOURCES, osmAround, groundFt, slopeAcross, gridIn, censusPoint, ringsBBox };
