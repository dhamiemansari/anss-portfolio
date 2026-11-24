# ANSS — portfolio (custom code)

Hand-built rebuild of the Framer site `anss.framer.website` (project "Version 2 - Portfolio").
Plain HTML/CSS/JS — no build step, no dependencies.

```
index.html            Home
404.html              Not-found page
css/site.css          Tokens, nav, footer, shared bits
css/home.css          Home page sections
js/site.js            Smart nav (hide on scroll), appear-on-scroll, back to top
js/effects.js         Hero portrait reveal + scroll-fill "About" text
assets/logo.svg       ANSS wordmark
scripts/localize-assets.sh   Pulls Framer-hosted images into assets/img/
_headers              Cloudflare Pages cache headers
```

## Status
| Page | Path | Status |
|---|---|---|
| Home | `/` | ✅ Done (desktop ≥1440 + phone <1440, all effects) |
| About | `/about` | ⏳ Session 2 |
| Business loan | `/business-loan` | ⏳ Session 2 |
| Nyumba | `/nyumba` | ⏳ Session 2 |
| HRMS design system | `/hrms-design-system` | ⏳ Session 2 |
| SvelteGo | `/sveltego` | ⏳ Session 2 |
| Sukha | `/sukha` | ⏳ Session 2 |

## Preview locally
```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## Images
Images still load from Framer's CDN (`framerusercontent.com`). Before you cancel Framer, run once:
```bash
bash scripts/localize-assets.sh
```
It downloads every image into `assets/img/` and rewrites the links. Commit the result.

## Deploy — GitHub → Cloudflare Pages → GoDaddy
1. **GitHub**: new repo `anss-portfolio` → push this folder (or drag-and-drop the files on github.com → "uploading an existing file").
2. **Cloudflare**: Workers & Pages → Create → Pages → Connect to Git → pick the repo.
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/`
3. **Domain**: Cloudflare → Add a domain (Free) → copy the 2 nameservers →
   GoDaddy → My Products → Domain → DNS → Nameservers → Change → "I'll use my own" → paste.
   Then Pages project → Custom domains → add `yourdomain.com` and `www.yourdomain.com`.

Clean URLs work automatically on Cloudflare Pages (`/about` serves `about.html`).
