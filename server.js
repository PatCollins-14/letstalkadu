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
app.get("/api/health", (req, res) => res.json({ ok: true, site: "letstalkadu.com", xverify: !!process.env.XVERIFY_API_KEY, time: new Date().toISOString() }));

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
