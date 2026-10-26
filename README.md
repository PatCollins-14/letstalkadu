# Let's Talk ADU

Single-page landing site for Let's Talk ADU: ADU design, permits, and construction in Southern California.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole page (styles, fonts, scripts, structured data are inline) |
| `img/` | Photos, logo, social preview image (`og-image.jpg`), and app icons |
| `favicon.ico` | Browser tab icon (the logo) |
| `site.webmanifest` | Web app manifest for home-screen icons |
| `robots.txt`, `sitemap.xml`, `llms.txt` | Search engine and AI crawler files |

## Before going live

- **Domain placeholder:** `https://www.example.com` appears in the canonical link, Open Graph tags, JSON-LD, `sitemap.xml`, `robots.txt`, and `llms.txt`. Replace it with the real domain everywhere.
- **Lead form:** the form validates and shows a thank-you message but does not send submissions anywhere yet. Connect it to your CRM or a form service (see the comment in the form's `submit` handler in `index.html`).
- **Reviews:** the three review cards are placeholders labeled "Sample". Replace them with real reviews.
- **Photos:** images are representative stock photos (Adobe Stock free tier), not project photos. The footer says so.
- **Builder details:** the CSLB license, classifications, and the "100+ ADUs" and "111 reviews" figures come from the builder's website. Confirm with the builder before publishing.

## Hosting

It is static, so any static host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages). Upload everything in this repo together.
