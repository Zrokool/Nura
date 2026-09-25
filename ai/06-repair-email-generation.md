# 06 · Repair email generation

The email has two parts, and only one of them comes from the model.

| Part | Source | Why |
|---|---|---|
| Opening: what happened, which neighbours lost it, why the street matters | Template + incident data | Facts must be exact |
| Likely cause, confidence, "what the data shows" | **Model** (validated, guide 05) | This is where the model adds value |
| Tools, parts, step-by-step fix, safety | **Reviewed playbook**, keyed by `likely_cause` | Electrical safety: never free-generated |
| Closing: auto-close note, reply keywords | Template | Must match the reply parser |

The playbooks are the `PLAYBOOK` object in `frontend/assets/js/dashboard.js`. On the gateway they live in `playbooks/<cause>.<lang>.yaml`, reviewed by a qualified electrician before each release.

## Email skeleton

```text
Subject: [Nura · {severity}] Light {id} out on {street}: likely {cause_label}

Salaam {fixer_name},

{opening}

Why it matters: {zone_why}

Likely cause ({confidence}% confidence): {cause_label}
What the data shows:
  • {evidence[0]}
  • {evidence[1]}

Tools to bring:      {playbook.tools}
Parts to bring:      {playbook.parts}
Step-by-step fix:    {playbook.steps}
Safety:              {playbook.safety}

When you finish, the neighbouring lights will check {id} again automatically.
Reply LIT / DARK / REPLACE {id} / DONE {id} {what you replaced}.
```

## SMS version (160–320 characters)

When there is no data connection, `nebo-outbox` sends a short SMS through the GSM modem:

```text
NURA HIGH: Light RC-A-04 Water Point Rd OUT. Likely solar panel (88%). Bring: multimeter, cloth, 10mm spanner, spare panel. Daylight only. Reply DONE RC-A-04 when fixed.
```

The full guide is served on the gateway's local Wi-Fi at `http://nura.local/i/<incident_id>`, so a fixer with a smartphone can open it on site without internet.

## Reply keywords

| Reply | Effect |
|---|---|
| `LIT` / `DARK` | Updates a radio-fault incident (is the lamp still on?) |
| `DONE <id> <text>` | Logs the repair and what was replaced (feeds the accuracy metric) |
| `REPLACE <id>` | Raises a replacement-kit request to the city owner |
| `UNSAFE <id>` | Pauses dispatch for that street for 24 h and alerts the committee |
