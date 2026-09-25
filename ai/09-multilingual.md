# 09 · Multilingual dispatch

| Zone language | Countries | Model notes |
|---|---|---|
| Arabic (Sudanese) | Sudan, Chad | `qwen2.5:3b` writes better Arabic than `llama3.2:3b` |
| Somali | Somalia | Small models are weak. Use **translated playbooks** plus English/Somali template sentences, and let the model output only `likely_cause` + numbers |
| French | Mali, Niger, Burkina Faso, Chad, Senegal | All listed models are good |
| Hausa | Nigeria, Niger | Same approach as Somali |
| English | Fallback / pilots | All models |

## Strategy

1. **Playbooks are translated by humans** (steps, tools and safety), stored as `playbooks/<cause>.<lang>.yaml`.
2. The model outputs **structured JSON** (cause, confidence, evidence). Evidence sentences come from templates with number slots, so any language works without trusting the model's grammar.
3. Where the model writes well in the language (Arabic, French), it may also write the `summary` sentence directly. Add `"Write the summary in Arabic."` to the system prompt.

## Example: Arabic system-prompt addition

```text
اكتب حقل "summary" باللغة العربية البسيطة لفني محلي. لا تغيّر مفاتيح JSON.
```
("Write the summary field in simple Arabic for a local technician. Do not change the JSON keys.")

## Fixer preference

The `fixers.lang` column decides the language per person, so one zone can have an Arabic-speaking and an English-speaking fixer.
