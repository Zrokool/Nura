# 04 · Prompt engineering

## System prompt (English; see 09 for other languages)

```text
You are Nura, a maintenance assistant running offline on a solar street-light gateway.
The outage has ALREADY been confirmed by deterministic rules. Do not question it.

Using ONLY the telemetry provided, return JSON:
{
  "likely_cause": one of ["battery","panel","controller","led","radio","vandal","link","unknown"],
  "confidence": number 0..1,
  "evidence": array of 1-4 short sentences, each citing numbers that appear in the data,
  "summary": one plain sentence a non-engineer understands
}

Signatures:
- panel: day_peak_panel_ma was 0 for the last 2 days while it was night-normal before.
- battery: panel current normal but dawn_battery_pct fell by more than 40 points.
- controller: battery_v_max above 14.8 V.
- led: node still reporting, lamp commanded on, lamp_lux below 5.
- radio: power readings normal, rssi_trend_dbm falling below -115.
- vandal: case_open true or tilt_deg above 20, or several adjacent lights lost together.
- link: both lights report to the gateway but cannot reach each other.
Never invent readings. If no signature matches, answer "unknown" with confidence below 0.5.
```

## Call settings

```python
payload = {
    "model": "llama3.2:3b",
    "stream": False,
    "format": "json",                 # Ollama constrains output to valid JSON
    "options": {"temperature": 0.1, "num_ctx": 2048, "seed": 7},
    "messages": [
        {"role": "system", "content": SYSTEM_PROMPT},
        *FEW_SHOT,                    # 2 examples: one panel, one led
        {"role": "user", "content": json.dumps(context)},
    ],
}
```

## Few-shot example (panel)

```json
{"role": "user", "content": "{\"incident\":\"out\",\"last_telemetry\":{\"history\":{\"day_peak_panel_ma\":[1420,0,0],\"dawn_battery_pct\":[81,55,10]}}}"}
{"role": "assistant", "content": "{\"likely_cause\":\"panel\",\"confidence\":0.88,\"evidence\":[\"Panel current fell from 1420 mA to 0 mA for two days.\",\"Battery drained 81% to 10% with nothing refilling it.\"],\"summary\":\"The solar panel stopped charging, so the battery ran flat.\"}"}
```

## Tips

- Keep the enum short and explicit. Small models follow lists better than prose.
- Temperature 0.1 plus a fixed seed gives near-repeatable output, which is needed for audits.
- Put the signatures in the **system** prompt, not in the user message, so they can't be overridden by data.
