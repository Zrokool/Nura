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
├── .github/workflows/
│   ├── pages.yml        GitHub Pages deployment
│   └── security.yml     Security checks: SAST, dependency scan, secret scans
├── .claude/commands/    frontend-scurity.md, the 8-check frontend security review
├── index.html           Root redirect to frontend/ (so the short Pages URL opens the site)
├── solution.md, Deployment.md   Original brief
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

### Frontend controls

Every page passes the 8 checks in `.claude/commands/frontend-scurity.md`:

- Strict Content Security Policy (`default-src 'self'`) on every page, including the root redirect, which also blocks all scripts (`script-src 'none'`).
- No external scripts, styles or fonts, so there is no third-party code to swap in (SRI not needed).
- `'use strict'` in every script.
- DOM output only through `textContent` or `createElement`. No `innerHTML`, `eval` or string timers.
- No secrets anywhere in the code.
- `.gitignore` covers `.env`, `.env.*`, `*.key`, `*.pem`, credentials and secrets.

The dashboard makes **no network requests**. All its data is simulated in the browser.

### Automated security checks

`.github/workflows/security.yml` runs four open-source scanners **in parallel** on every push and pull request, when started by hand, and every Monday at 06:00 UTC:

| Check | Tool | Scans | Fails the build on |
|---|---|---|---|
| SAST | [Semgrep](https://semgrep.dev) | JavaScript, XSS, secrets and GitHub Actions rules | Severity ERROR only |
| Dependency scan | [Trivy](https://trivy.dev) | Vulnerable packages and misconfigurations | CRITICAL only |
| Secret scan | [Gitleaks](https://github.com/gitleaks/gitleaks) | Full git history | Any committed secret |
| Secret scan | [TruffleHog](https://github.com/trufflesecurity/trufflehog) | Full git history | Verified live secrets |

- **Critical only:** the build fails only on critical findings. Semgrep and Trivy print all their findings in the job log first, so lower-severity issues can still be reviewed.
- **One result:** a final **Security gate** job waits for all four scanners and fails if any of them did. Make it a required check under **Settings → Branches → Branch protection** to block merges with critical findings.
- **Dependencies today:** the site has no package files, so the dependency scan passes. It starts covering them automatically if any are added, for example Python for the zone gateway.
- **Run locally:** the Docker commands for each scanner are in the header of `security.yml`.

### Known limits

- GitHub Pages can't send HTTP headers, so the site can't block being framed by another site (clickjacking). The risk is low because the site has no logins or actions.
- Workflow actions and images are pinned by version tag. For production, pin them to full commit SHAs or image digests.

## Status

This is a prototype. Figures on the site come from the brief's OIC, SESRIC and Afrobarometer summaries, and the costs are retail estimates. See `docs/Nebo.md` §12 for the open issues in the original brief and how each is resolved.
