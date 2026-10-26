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

- **Domain:** set to `https://letstalkadu.com` in the canonical link, Open Graph tags, JSON-LD, `sitemap.xml`, `robots.txt`, and `llms.txt`. If it ever changes, replace it in all of those.
- **Lead form:** the form validates and shows a thank-you message but does not send submissions anywhere yet. Connect it to your CRM or a form service (see the comment in the form's `submit` handler in `index.html`).
- **Reviews:** the three review cards are placeholders labeled "Sample". Replace them with real reviews.
- **Photos:** images are representative stock photos (Adobe Stock free tier), not project photos. The footer says so.
- **Builder details:** the CSLB license, classifications, and the "100+ ADUs" and "111 reviews" figures come from the builder's website. Confirm with the builder before publishing.

## Hosting

It is static, so any static host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages). Upload everything in this repo together.

### GitHub Pages with a domain registered at Hostinger

The `CNAME` file in this repo tells GitHub Pages to serve `letstalkadu.com`. In Hostinger (hPanel, Domains, DNS records):

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `patcollins-14.github.io` |

Delete the existing parking `A` record for `@` and the parking `CNAME` for `www` first. In the repo's Pages settings, turn on **Enforce HTTPS** once the certificate is issued (it can take up to an hour after DNS updates).
