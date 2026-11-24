# ANSS — portfolio (custom code)

Hand-built rebuild of the Framer site `anss.framer.website` (project "Version 2 - Portfolio").
Plain HTML/CSS/JS — no build step, no dependencies.

```
index.html                Home
about.html                About
business-loan.html        Case study — business loan (sticky section nav)
hrms-design-system.html   Case study — HRMS design system (sticky section nav)
nyumba.html               Case study — Nyumba resident app
sveltego.html             Case study — SvelteGo fashion app
sukha.html                Case study — Sukha wellness app
404.html                  Not-found page
css/site.css              Tokens, reset, nav, footer, shared bits
css/home.css              Home page sections
css/about.css             About page
css/case.css              Business loan + HRMS layout (hero, sticky nav, story, next)
css/story.css             Shared sections for Nyumba, Sukha and SvelteGo
css/nyumba.css            Nyumba-only sections
css/sukha.css             Sukha-only sections
css/sveltego.css          SvelteGo-only sections
js/site.js                Smart nav (hide on scroll), appear-on-scroll, back to top
js/effects.js             Hero portrait reveal + scroll-fill "About" text
js/case.js                Section-nav scroll-spy on #cs-* sections
assets/logo.svg           ANSS wordmark
assets/img/, assets/video/  Every image and video, downloaded from Framer
scripts/localize-assets.sh  Pulls any Framer-hosted images into assets/img/
_headers                  Cloudflare Pages cache headers
```

## Status
| Page | Path | Status |
|---|---|---|
| Home | `/` | ✅ Done (desktop ≥1440 + phone <1440, all effects) |
| About | `/about` | ✅ Done |
| Business loan | `/business-loan` | ✅ Done |
| Nyumba | `/nyumba` | ✅ Done |
| HRMS design system | `/hrms-design-system` | ✅ Done |
| SvelteGo | `/sveltego` | ✅ Done |
| Sukha | `/sukha` | ✅ Done |

## Preview locally
```bash
python3 -m http.server 8000     # then open http://localhost:8000 (use /about.html etc. — clean URLs like /about only work on Cloudflare)
```

## Images
All images and videos are stored in the repo (`assets/img/`, `assets/video/`); nothing loads from Framer's CDN.
If you add a section that still points at `framerusercontent.com`, run `bash scripts/localize-assets.sh` to pull it in.

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
