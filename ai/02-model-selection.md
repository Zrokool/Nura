# 02 · Model selection

The task is small: read about 40 numbers, pick one of 8 causes, and write 3–5 sentences. A 1–4 B parameter model is enough. Bigger models waste the gateway's solar budget.

| Model (Ollama tag) | Size | Pi 5 speed* | JSON reliability | Languages | Use |
|---|---|---|---|---|---|
| `llama3.2:3b` | 2.0 GB | ~4–6 tok/s | Good with `format: json` | EN, FR, AR (fair) | **Default** |
| `qwen2.5:3b` | 1.9 GB | ~4–6 tok/s | Very good | EN, FR, **AR good** | Arabic-first zones |
| `qwen2.5:1.5b` | 1.0 GB | ~9–12 tok/s | Good | EN, FR, AR | 4 GB boards / hot days |
| `phi3.5:3.8b` | 2.2 GB | ~3–4 tok/s | Good | EN mainly | English-only pilots |
| `gemma2:2b` | 1.6 GB | ~6–8 tok/s | Fair | EN, FR | Alternative |

\* Rough CPU-only figures; measure on your own hardware (guide 07).

## How to choose

1. Run the **evaluation set**: 50 labelled incidents built from `analytics/sample-telemetry.json` plus the fault signatures in guide 05.
2. Score **cause accuracy**, **JSON validity** and **evidence faithfulness** (every number cited exists in the input).
3. Pick the smallest model that scores ≥ 90% on JSON validity and ≥ 80% on cause accuracy.

## Energy

At about 8 W for about 40 s per incident, one diagnosis costs roughly 0.1 Wh. Even 50 incidents a day is under 5 Wh, which is negligible next to the gateway's 100 W panel.
