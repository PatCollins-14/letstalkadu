# Let's Talk ADU

Website for Let's Talk ADU: ADU lot checks, financing, design, permits, and construction in Southern California. Live at https://letstalkadu.com

## Files

| File | Purpose |
|---|---|
| `index.html` | The homepage: lot check, before/after slider, financing, calculator, city plans, FAQ. Built from `letstalkadu-feasibility/index.html` with `node build-for-site.js`; edit it there, not here. |
| `previous-home.html` | The earlier homepage, kept for reference. Hidden from search engines. |
| `adu-lot-check/` | Redirects to the homepage (the page lived here briefly on 2026-11-04). |
| `img/` | Photos, logo, social preview image (`og-image.jpg`), and app icons |
| `favicon.ico` | Browser tab icon |
| `site.webmanifest` | Web app manifest for home-screen icons |
| `robots.txt`, `sitemap.xml`, `llms.txt` | Search engine and AI crawler files |
| `CNAME` | Tells GitHub Pages to serve `letstalkadu.com` |

## Hosting

Static site served by GitHub Pages from the `main` branch. DNS for `letstalkadu.com` is managed at Hostinger:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| CNAME | `www` | `patcollins-14.github.io` |

One `A` record is enough. For extra redundancy, GitHub also recommends adding `185.199.109.153`, `185.199.110.153`, and `185.199.111.153` as additional `A` records on `@`.

Photos are representative stock images (Adobe Stock free tier).
