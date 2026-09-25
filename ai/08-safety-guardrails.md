# 08 · Safety guardrails

| Risk | Guardrail |
|---|---|
| **Model decides a light is out when it isn't** | It can't. Incidents come only from rules R1–R5 |
| **Hallucinated readings** ("battery 3%" when it was 60%) | Faithfulness check: every number in `evidence` must exist in the input, otherwise the fallback is used |
| **Invented or unsafe repair steps** | Steps, tools and safety notes come only from electrician-reviewed playbooks |
| **Wrong cause** | Confidence and the rule-table cross-check are shown. The fixer checks the top cause first, and replies feed accuracy tracking |
| **Prompt injection via data** (for example a malicious node name) | Node IDs are validated against `^[A-Z]{2}-[A-Z]-[0-9]{2}$`, and free text never enters the prompt. Frames are MIC-authenticated |
| **Dispatching someone into danger** | R5 segments always open with "do not go alone or at night". `UNSAFE` reply pauses dispatch. No night dispatch for vandalism |
| **Privacy** | No personal data in prompts. Fixer contacts stay in the gateway DB only. The model runs on 127.0.0.1 |
| **Model or service down** | Fallback table, so dispatch continues without AI |
| **Electrical hazards** | Every playbook starts with isolating the fuse. The system is 12 V DC only, with no mains anywhere in a Nura node |

## Review cadence

- Playbooks: re-reviewed by an electrician at every change and yearly.
- Model: re-evaluated on the labelled set before every model or prompt update.
- Monthly: sample 10 dispatched emails and check them for accuracy, tone and language quality with the zone committee.
