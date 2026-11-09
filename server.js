// letstalkadu.com on Hostinger (Node.js web app).
// Serves the same static files GitHub Pages serves, and is the home for future /api routes
// (RentCast, Regrid, spam checks), whose secret keys go in Hostinger's environment variables, never in this repo.
const path = require("path");
const express = require("express");

const app = express();
const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.set("trust proxy", true);

// Server files and repo files are never served
const BLOCKED = /^\/(server\.js|package(-lock)?\.json|node_modules|\.git|\.env|README\.md|CNAME|\.nojekyll)(\/|$)/i;
app.use((req, res, next) => (BLOCKED.test(req.path) ? res.status(404).end() : next()));

// Basic security headers
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)"
  });
  next();
});

// Send www to the main domain
app.use((req, res, next) => {
  const host = (req.headers.host || "").toLowerCase();
  if (host.startsWith("www.")) return res.redirect(301, "https://" + host.slice(4) + req.originalUrl);
  next();
});

// Health check for Hostinger and for testing a deploy
app.get("/api/health", (req, res) => res.json({ ok: true, site: "letstalkadu.com", xverify: !!process.env.XVERIFY_API_KEY, rentcast: !!process.env.RENTCAST_API_KEY, time: new Date().toISOString() }));

// ---------- Email check (Xverify) ----------
// The forms ask this route before sending a lead. The key stays here (hPanel env vars XVERIFY_API_KEY and
// XVERIFY_DOMAIN). Any failure answers "unchecked" so a lead is never lost because Xverify was slow or down.
const XV_URL = process.env.XVERIFY_URL || "https://api.xverify.com/v2/ev";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const xvCache = new Map();   // email -> { at, body }: one paid check per address per day
const xvHits = new Map();    // ip -> [timestamps]: at most 15 checks per IP per 10 minutes
function sameSite(req) {
  const from = req.get("origin") || req.get("referer") || "";
  try {
    const h = new URL(from).hostname.toLowerCase();
    return h === "letstalkadu.com" || h === "www.letstalkadu.com" || h.endsWith(".hostingersite.com") || h === "localhost" || h === "127.0.0.1";
  } catch (e) { return false; }
}
function tooMany(ip) {
  const now = Date.now(), list = (xvHits.get(ip) || []).filter((t) => now - t < 600000);
  list.push(now); xvHits.set(ip, list);
  if (xvHits.size > 5000) xvHits.clear();
  return list.length > 15;
}
app.post("/api/verify-email", express.json({ limit: "2kb" }), async (req, res) => {
  res.set("Cache-Control", "no-store");
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ status: "invalid", reason: "syntax" });
  if (!sameSite(req)) return res.status(403).json({ status: "unchecked", reason: "origin" });
  const key = process.env.XVERIFY_API_KEY, domain = process.env.XVERIFY_DOMAIN || "letstalkadu.com";
  if (!key) return res.json({ status: "unchecked", reason: "not_configured" });
  const hit = xvCache.get(email);
  if (hit && Date.now() - hit.at < 86400000) return res.json(hit.body);
  if (tooMany(req.ip)) return res.json({ status: "unchecked", reason: "rate_limited" });
  const q = new URLSearchParams({ email, api_key: key, domain, ip: req.ip || "", ua: (req.get("user-agent") || "").slice(0, 300), aff: "letstalkadu.com" });
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(XV_URL + "?" + q.toString(), { signal: ctl.signal, headers: { Accept: "application/json" } });
    const j = await r.json().catch(() => ({}));
    const status = ["valid", "invalid", "accept_all", "risky", "unknown"].includes(j.status) ? j.status : "unchecked";
    const body = { status, reason: String(j.reason || (status === "unchecked" ? "xverify_" + r.status : "")).slice(0, 60), correction: j.correction && j.correction !== email ? String(j.correction).slice(0, 254) : "" };
    if (status !== "unchecked" && status !== "unknown") { xvCache.set(email, { at: Date.now(), body }); if (xvCache.size > 5000) xvCache.clear(); }
    res.json(body);
  } catch (e) {
    res.json({ status: "unchecked", reason: e.name === "AbortError" ? "timeout" : "error" });
  } finally { clearTimeout(timer); }
});

// ---------- Parcel facts for the Blueprint PDF (free public map services, no key) ----------
// LA County Assessor parcels (APN, use, units, year built, building and lot size), City of LA zoning,
// LA County zoning for unincorporated areas, LA Times neighborhoods (City of LA) and county community names.
// Outside LA County nothing matches and the page falls back to its general lot check.
const GIS = {
  parcel: process.env.PARCEL_URL || "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query",
  laZoning: "https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/Zoning/FeatureServer/15/query",
  laHood: "https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/LA_Times_Neighborhood_Boundaries/FeatureServer/0/query",
  countyZoning: "https://arcgis.gis.lacounty.gov/arcgis/rest/services/DRP/GISNET_Public/MapServer/345/query",
  community: "https://arcgis.gis.lacounty.gov/arcgis/rest/services/DRP/GISNET_Public/MapServer/41/query"
};
const PARCEL_FIELDS = "AIN,APN,SitusFullAddress,SitusCity,TaxRateCity,UseType,UseDescription,LegalDescription,CENTER_LAT,CENTER_LON,Shape.STArea()," +
  [1, 2, 3, 4, 5].map((i) => ["YearBuilt", "Units", "Bedrooms", "Bathrooms", "SQFTmain"].map((f) => f + i).join(",")).join(",");
const parcelCache = new Map();   // key -> { at, body }, 7 days
const parcelHits = new Map();    // ip -> timestamps, 30 lookups per 10 minutes
async function gisQuery(url, params, ms) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms || 5000);
  try {
    const q = new URLSearchParams(Object.assign({ returnGeometry: "false", f: "json" }, params));
    const r = await fetch(url + "?" + q.toString(), { signal: ctl.signal, headers: { Accept: "application/json" } });
    const j = await r.json();
    return (j.features || []).map((f) => f.attributes);
  } catch (e) { return []; } finally { clearTimeout(timer); }
}
const atPoint = (lng, lat, fields) => ({ geometry: lng + "," + lat, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: fields || "*" });
const titleCase = (t) => String(t || "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\s+/g, " ").trim();
const LA_ZONE_NAMES = { A1: "Agricultural", A2: "Agricultural", RA: "Suburban residential", RE: "Residential estate", RS: "Suburban residential", R1: "One-family residential",
  RU: "Small-lot residential", RZ: "Residential zero side yard", RW1: "One-family residential waterways", R2: "Two-family residential", RD: "Restricted-density multiple dwelling",
  RMP: "Mobile home park", RW2: "Two-family residential waterways", R3: "Multiple dwelling", RAS3: "Residential/accessory services", R4: "Multiple dwelling", RAS4: "Residential/accessory services", R5: "Multiple dwelling" };
function useName(desc, units) {
  const d = String(desc || "").toLowerCase();
  if (/^single/.test(d) || units === 1) return "Single-family home";
  if (/two units/.test(d) || units === 2) return "Duplex";
  if (/three units/.test(d) || units === 3) return "Triplex";
  if (/four units/.test(d) || units === 4) return "Fourplex";
  return titleCase(desc);
}
function legalName(legal) {
  const t = String(legal || "").replace(/\s+/g, " ").trim();
  let m = t.match(/^(?:TRACT|TR)\s*(?:NO|#|=)?\s*(\d+)\s+LOT\s+(\w+)/i);
  if (m) return "Tract " + m[1] + ", Lot " + m[2];
  m = t.match(/^([A-Z][A-Z .'&-]+?)\s+LOT\s+(\w+)/i);
  if (m && !/^(TRACT|TR|PARCEL|SUB|POR|EX)\b/i.test(m[1])) return titleCase(m[1]) + ", Lot " + m[2];
  return "";
}
function parseAddress(a) {
  const t = String(a || "").toUpperCase().replace(/[^A-Z0-9 ,]/g, " ");
  const house = (t.match(/^\s*(\d{1,6})\b/) || [])[1], zip = (t.match(/\b(9\d{4})\b(?!.*\b9\d{4}\b)/) || [])[1];
  const street = (t.split(",")[0] || "").replace(/^\s*\d+\s*/, "").split(/\s+/)
    .filter((w) => w && !/^(N|S|E|W|NE|NW|SE|SW|NORTH|SOUTH|EAST|WEST|ST|STREET|AVE|AV|AVENUE|BLVD|DR|DRIVE|RD|ROAD|PL|PLACE|CT|COURT|LN|LANE|WAY|TER|CIR|PKWY|HWY|APT|UNIT|NO)$/.test(w) && !/^\d+$/.test(w))
    .sort((x, y) => y.length - x.length)[0];
  return house && zip && street ? { house, zip, street } : null;
}
app.post("/api/parcel", express.json({ limit: "2kb" }), async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameSite(req)) return res.status(403).json({ found: false, reason: "origin" });
  const b = req.body || {}, lat = Number(b.lat), lng = Number(b.lng), address = String(b.address || "").slice(0, 200);
  const hasPt = isFinite(lat) && isFinite(lng) && lat > 32 && lat < 35.5 && lng > -119.5 && lng < -117;
  const key = hasPt ? lat.toFixed(5) + "," + lng.toFixed(5) : address.toUpperCase().replace(/\s+/g, " ");
  if (!key) return res.status(400).json({ found: false, reason: "no address" });
  const hit = parcelCache.get(key);
  if (hit && Date.now() - hit.at < 7 * 86400000) return res.json(hit.body);
  const now = Date.now(), list = (parcelHits.get(req.ip) || []).filter((t) => now - t < 600000);
  list.push(now); parcelHits.set(req.ip, list); if (parcelHits.size > 5000) parcelHits.clear();
  if (list.length > 30) return res.json({ found: false, reason: "rate_limited" });

  let rows = hasPt ? await gisQuery(GIS.parcel, atPoint(lng, lat, PARCEL_FIELDS)) : [];
  if (!rows.length) {
    // The pin can land on the street; match the typed address instead (house number + street name + ZIP)
    const p = parseAddress(address);
    if (p) rows = await gisQuery(GIS.parcel, { where: "SitusHouseNo='" + p.house + "' AND SitusStreet LIKE '%" + p.street + "%' AND SitusZIP LIKE '" + p.zip + "%'", outFields: PARCEL_FIELDS, resultRecordCount: "3" });
  }
  const a = rows[0];
  if (!a) { const body = { found: false, reason: "no parcel" }; parcelCache.set(key, { at: Date.now(), body }); return res.json(body); }
  const sum = (f) => [1, 2, 3, 4, 5].reduce((s, i) => s + (Number(a[f + i]) || 0), 0);
  const units = sum("Units"), x = a.CENTER_LON || lng, y = a.CENTER_LAT || lat;
  const taxCity = String(a.TaxRateCity || "").toUpperCase();
  const [laZ, laH, coZ, comm] = await Promise.all([
    taxCity === "LOS ANGELES" ? gisQuery(GIS.laZoning, atPoint(x, y, "Zoning,CATEGORY")) : [],
    taxCity === "LOS ANGELES" ? gisQuery(GIS.laHood, atPoint(x, y, "name")) : [],
    taxCity === "UNINCORPORATED" ? gisQuery(GIS.countyZoning, atPoint(x, y, "ZONE,Z_DESC")) : [],
    gisQuery(GIS.community, atPoint(x, y, "CITYNAME_ALF,NAME,JURISDICTION"))
  ]);
  let zoning = "", zoningDesc = "", jurisdiction = "";
  if (laZ[0]) {
    zoning = String(laZ[0].Zoning || "").trim();
    const base = zoning.replace(/^\[?Q\]?|^\(T\)|^\(Q\)/, "").replace(/^\W+/, "").split(/[-(]/)[0];
    zoningDesc = LA_ZONE_NAMES[base] || titleCase(laZ[0].CATEGORY);
  } else if (coZ[0]) { zoning = String(coZ[0].ZONE || "").trim(); zoningDesc = titleCase(coZ[0].Z_DESC); }
  const c = comm[0] || {};
  const city = c.CITYNAME_ALF ? titleCase(c.CITYNAME_ALF) : titleCase(String(a.SitusCity || "").replace(/\s+CA$/, ""));
  jurisdiction = c.JURISDICTION === "UNINCORPORATED AREA" ? "Unincorporated Los Angeles County" : city ? "City of " + city : "";
  const neighborhood = laH[0] ? String(laH[0].name || "") : c.NAME ? titleCase(c.NAME) : "";
  const year = String(a.YearBuilt1 || "").trim();
  const body = {
    found: true, source: "LA County Assessor",
    residential: a.UseType === "Residential",  // cemeteries, stores, schools etc. get the general lot check instead
    apn: a.APN || "", address: titleCase(a.SitusFullAddress || "").replace(/ Ca (\d{5})$/, ", CA $1"), city, jurisdiction, neighborhood,
    legal: legalName(a.LegalDescription), use: useName(a.UseDescription, units), useType: a.UseType || "",
    units, beds: sum("Bedrooms"), baths: sum("Bathrooms"), yearBuilt: /^\d{4}$/.test(year) && year !== "0000" ? year : "",
    buildingSqft: sum("SQFTmain"), lotSqft: Math.round(Number(a["Shape.STArea()"]) || 0),
    zoning, zoningDesc, cityOfLA: taxCity === "LOS ANGELES"
  };
  parcelCache.set(key, { at: Date.now(), body }); if (parcelCache.size > 5000) parcelCache.clear();
  res.json(body);
});

// ---------- Address-specific rent (RentCast) ----------
// The lot check asks this once per submission. The key stays here (hPanel env var RENTCAST_API_KEY).
// Any failure answers found:false and the page keeps its own model rent, so a lead is never lost.
// RENTCAST_MONTHLY_CAP limits paid lookups (default 45, inside the free plan's 50); raise it after upgrading.
const RC_URL = process.env.RENTCAST_URL || "https://api.rentcast.io/v1/avm/rent/long-term";
const rentCache = new Map();  // address|beds|baths|sqft -> { at, body }, 30 days
const rentHits = new Map();   // ip -> timestamps, 10 lookups per 10 minutes
let rentMonth = "", rentUsed = 0;
app.post("/api/rent", express.json({ limit: "2kb" }), async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameSite(req)) return res.status(403).json({ found: false, reason: "origin" });
  const key = process.env.RENTCAST_API_KEY;
  if (!key) return res.json({ found: false, reason: "not_configured" });
  const b = req.body || {}, address = String(b.address || "").trim().slice(0, 200);
  const lat = Number(b.lat), lng = Number(b.lng), hasPt = !!b.lat && !!b.lng && isFinite(lat) && isFinite(lng);
  const bedrooms = Math.max(0, Math.min(8, Math.round(Number(b.bedrooms) || 0)));
  const bathrooms = Math.max(1, Math.min(8, Number(b.bathrooms) || 1));
  const sqft = Math.round(Number(b.sqft) || 0);
  const useAddress = /\b\d{5}\b/.test(address);
  if (!sqft || (!useAddress && !hasPt)) return res.json({ found: false, reason: "no_address" });
  const cacheKey = [address.toUpperCase().replace(/\s+/g, " "), bedrooms, bathrooms, sqft].join("|");
  const hit = rentCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 30 * 86400000) return res.json(hit.body);
  const now = Date.now(), list = (rentHits.get(req.ip) || []).filter((t) => now - t < 600000);
  list.push(now); rentHits.set(req.ip, list); if (rentHits.size > 5000) rentHits.clear();
  if (list.length > 10) return res.json({ found: false, reason: "rate_limited" });
  const month = new Date().toISOString().slice(0, 7), cap = Number(process.env.RENTCAST_MONTHLY_CAP) || 45;
  if (month !== rentMonth) { rentMonth = month; rentUsed = 0; }
  if (rentUsed >= cap) return res.json({ found: false, reason: "monthly_cap" });
  const q = new URLSearchParams({ propertyType: "Apartment", bedrooms: String(bedrooms), bathrooms: String(bathrooms), squareFootage: String(sqft), compCount: "15", lookupSubjectAttributes: "false" });
  if (useAddress) q.set("address", address); else { q.set("latitude", String(lat)); q.set("longitude", String(lng)); }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
  try {
    rentUsed++;
    const r = await fetch(RC_URL + "?" + q.toString(), { signal: ctl.signal, headers: { Accept: "application/json", "X-Api-Key": key } });
    if (!r.ok) return res.json({ found: false, reason: "rentcast_" + r.status });
    const j = await r.json();
    const ten = (n) => Math.round(Number(n) / 10) * 10;
    const rent = ten(j.rent), low = ten(j.rentRangeLow), high = ten(j.rentRangeHigh);
    if (!(rent >= 400 && rent <= 20000)) return res.json({ found: false, reason: "no_estimate" });
    const body = { found: true, rent, low: low > 0 && low <= rent ? low : rent, high: high >= rent ? high : rent, compCount: Array.isArray(j.comparables) ? j.comparables.length : 0 };
    rentCache.set(cacheKey, { at: Date.now(), body }); if (rentCache.size > 5000) rentCache.clear();
    res.json(body);
  } catch (e) {
    res.json({ found: false, reason: e.name === "AbortError" ? "timeout" : "error" });
  } finally { clearTimeout(timer); }
});

// Static site: pages are short-cached so edits show quickly, images and fonts cache longer
app.use(express.static(ROOT, {
  dotfiles: "ignore",
  extensions: ["html"],
  setHeaders(res, file) {
    if (/\.(jpg|jpeg|png|webp|svg|ico|woff2?)$/i.test(file)) res.set("Cache-Control", "public, max-age=604800");
    else res.set("Cache-Control", "public, max-age=300");
  }
}));

// Anything else goes back to the homepage
app.use((req, res) => res.status(404).redirect(302, "/"));

app.listen(PORT, () => console.log("letstalkadu.com listening on " + PORT));
