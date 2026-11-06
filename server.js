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
app.get("/api/health", (req, res) => res.json({ ok: true, site: "letstalkadu.com", time: new Date().toISOString() }));

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
