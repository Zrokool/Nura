# Frontend Security Review

 

Checks vanilla HTML / CSS / JavaScript front-end code for the security issues. 

- This apply to client-side-only projects. Always Auto-detects files. 

---
 ## Step 1 — Auto-detect frontend files
Use Glob to find the following in the current working directory

(exclude `node_modules/`, `.git/`, `*.min.js`, `*.min.css`):

 

- `**/*.html` — all HTML entry points

- `**/*.js` — all JavaScript source files

- `**/*.css` — all CSS files

- `.gitignore` — at the project root (may not exist)

 

Read every file found. If no HTML files are found, stop and report:

"No HTML files detected — is this a vanilla frontend project?"

 

---

 

## Step 2 — Run these 8 checks against every discovered file

 

**Check 1 — DOM XSS sinks**

Search all JS files for: `innerHTML`, `outerHTML`, `insertAdjacentHTML`,

`document.write`.

- PASS if none found

- FAIL for each occurrence; note whether the assigned value is user-controlled

  or a static string (static = Low, user-controlled = Critical)

 

**Check 2 — eval-family patterns**

Search all JS files for: `eval(`, `new Function(`, `setTimeout(` with a string

literal as its first argument, `setInterval(` with a string literal.

- PASS if none found

- FAIL for each hit — unconditional finding, no exceptions

 

**Check 3 — Content Security Policy**

Check every HTML file for `<meta http-equiv="Content-Security-Policy"`.

- PASS if found with at least `default-src 'self'`

- FAIL if absent — CSP is the last XSS backstop available without a server

- Fix: add inside `<head>`:

  `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'">`

 

**Check 4 — External resources without SRI**

Search every HTML file for `<script src=` or `<link rel="stylesheet" href=`

where the URL begins with `http` or `//`.

- N/A if no external resources are loaded (note this explicitly)

- PASS if every external resource has `integrity="sha384-..."` and

  `crossorigin="anonymous"`

- FAIL for any external resource missing the `integrity` attribute

 

**Check 5 — Strict mode**

Search each JS file for `'use strict';` or `"use strict";`.

- PASS if found at the top of each file (or the file uses `type="module"`)

- FAIL if absent

 

**Check 6 — User-visible output uses safe DOM API**

Find every place any JS file writes a value to the DOM for display (assignments to

element text, labels, or output containers).

- PASS if all such assignments use `.textContent =` or `createTextNode()`

- FAIL if any use `.innerHTML =` or `.outerHTML =` for content that could contain

  user input or computed values

 

**Check 7 — Hardcoded secrets**

Search all files (HTML, JS, CSS) for (case-insensitive):

`api_key`, `apikey`, `api-key`, `token =`, `secret =`, `password =`, `bearer `,

`authorization:`, and string literals of 20+ consecutive word characters assigned

with `=` or `:`.

- PASS if none found

- FAIL for each hit

 

**Check 8 — .gitignore coverage**

Check the project root for a `.gitignore` file. Look for entries covering:

`.env`, `.env.*`, `*.key`, `*.pem`, `credentials`, `secrets`.

- PASS if `.env` is covered

- FAIL if .gitignore is absent or does not cover `.env` patterns

- Report explicitly if no .gitignore exists at all

 

---

 

## Step 3 — Output

 

Produce this table with one row per check. Fill in File and Line for every finding;

use `—` for checks that are file-wide or absent.

 

| # | Check | File | Line | Result | Severity | Fix |

|---|-------|------|------|--------|----------|-----|

| 1 | DOM XSS sinks | | | PASS / FAIL | Critical | |

| 2 | eval-family | | | PASS / FAIL | Critical | |

| 3 | CSP meta tag | | — | PASS / FAIL | Medium | |

| 4 | External SRI | | — | PASS / N/A / FAIL | High | |

| 5 | Strict mode | | 1 | PASS / FAIL | Low | |

| 6 | Safe DOM output | | | PASS / FAIL | High | |

| 7 | Hardcoded secrets | | | PASS / FAIL | Critical | |

| 8 | .gitignore | .gitignore | — | PASS / FAIL | Medium | |

 

After the table: list only FAIL items grouped Critical → High → Medium → Low,

one line per item with a concrete fix. If all 8 pass, say so in one line.