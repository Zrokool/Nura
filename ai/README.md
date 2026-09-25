# ai/ : Embedding Ollama in Nura

How a free, open-source model running **offline** on the zone gateway turns streetlight telemetry into repair instructions a local fixer can follow.

**Rule zero: rules decide, AI explains.** The deterministic rules in [`analytics/detection-rules.md`](../analytics/detection-rules.md) decide whether a light is out. The model is called only *after* an incident is confirmed. It infers the likely cause and writes the human part of the email.

| # | Guide | What you'll learn |
|---|---|---|
| 01 | [Ollama setup](01-ollama-setup.md) | Install Ollama on a Raspberry Pi 5 gateway, pull a model, test the API |
| 02 | [Model selection](02-model-selection.md) | Which small models fit a Pi, and speed/quality trade-offs |
| 03 | [Sensor data schema](03-sensor-data-schema.md) | What the model sees: telemetry fields and how to compress them into a prompt |
| 04 | [Prompt engineering](04-prompt-engineering.md) | System prompt, JSON output, few-shot examples |
| 05 | [Diagnosis pipeline](05-diagnosis-pipeline.md) | End-to-end Python service: incident → prompt → validated JSON → fallback |
| 06 | [Repair email generation](06-repair-email-generation.md) | Model text + reviewed playbook = safe email; SMS version |
| 07 | [Edge deployment](07-edge-deployment.md) | systemd, Modelfile, offline updates, power and heat |
| 08 | [Safety guardrails](08-safety-guardrails.md) | Hallucination checks, electrical safety, prompt injection, privacy |
| 09 | [Multilingual](09-multilingual.md) | Arabic, Somali, French and Hausa emails |

The browser dashboard (`frontend/assets/js/dashboard.js`) simulates this pipeline. Its `diagnose()`, `buildPrompt()` and `composeEmail()` functions mirror guides 04–06.
