# Nura

**Light up the night. Created for the people.**

Nura is a prototype of city-owned, solar-powered streetlights for the Sahel and East Africa (Sudan and Somalia). Each light watches its left and right neighbours. When one goes dark, an offline Ollama model on the zone gateway writes a local fixer a plain-language repair email with the likely cause, the tools to bring and step-by-step instructions.

## Repository map

```
Nura/
├── frontend/            Public website (GitHub Pages deploy root)
│   ├── index.html       Home: the problem and the impact
│   ├── ummah.html       Why it matters: the Sahel and East Africa
│   ├── nura.html        The solution: node, sensors, cost, ownership, case
│   ├── implementation.html  Printed parts, printer-bed fit, four build stages
│   ├── dashboard.html   Simulated sensor-mapping dashboard with AI repair emails
│   └── assets/          CSS, JS, self-hosted fonts, SVG art
├── docs/Nebo.md         Senior engineering and infrastructure blueprint + logic-conflict review
├── ai/                  How Ollama is embedded (setup → prompts → pipeline → safety)
├── analytics/           Detection rules, telemetry JSON Schema, sample data, KPIs
├── hardware/            Parametric OpenJSCAD case + 3-prong pole clamp, print spec
├── .github/workflows/   GitHub Pages deployment
├── Vison.md, solution.md, Deployment.md   Original brief (unchanged)
```

## Run locally

```bash
python3 -m http.server 8000 -d frontend
# open http://localhost:8000
```

Deep-link a dashboard zone: `dashboard.html#refugee`, `#education` or `#healthcare`.

## Deploy to GitHub Pages

The site lives in `frontend/`, so it is published by a GitHub Actions workflow instead of "Deploy from a branch".

1. Create a **public** repository on GitHub (for example `nura`).
2. Push this folder:
   ```bash
   git init && git add . && git commit -m "Nura prototype"
   git branch -M main
   git remote add origin https://github.com/<your-username>/nura.git
   git push -u origin main
   ```
3. On GitHub, open **Settings → Pages → Build and deployment**, and set **Source = GitHub Actions**. This is the one change from `Deployment.md` step 4.
4. The workflow `.github/workflows/pages.yml` runs on every push to `main`. After 1–5 minutes the site is live at `https://<your-username>.github.io/nura/`.

All links and assets are relative, so the `/nura/` sub-path works without changes.

## Security

The site follows `claude\commands/frontend-scurity.md`:

- Strict CSP (`default-src 'self'`) on every page.
- No external scripts, styles or fonts.
- `'use strict'` in every script.
- DOM output only through `textContent` or `createElement`.
- No secrets anywhere.
- `.gitignore` covers `.env`, keys and credentials.

The dashboard makes **no network requests**. All its data is simulated in the browser.

## Status

This is a prototype. Figures on the site come from the brief's OIC, SESRIC and Afrobarometer summaries, and the costs are retail estimates. See `docs/Nebo.md` §12 for the open issues in the original brief and how each is resolved.
