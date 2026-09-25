# 03 · What the model sees

Contract: [`analytics/telemetry-schema.json`](../analytics/telemetry-schema.json). Each light sends one packet every 60 s.

## Fields that matter for diagnosis

| Field | Sensor | Healthy (night) | Points to |
|---|---|---|---|
| `history.day_peak_panel_ma` | INA3221 ch1 | 1,350–1,560 mA each day (30 W panel) | `0, 0` ⇒ **panel** |
| `history.dawn_battery_pct` | INA3221 ch2 + voltage | Stable, 70–95% | Falls > 40 pts while panel OK ⇒ **battery** |
| `history.battery_v_max` | INA3221 ch2 | 14.1–14.4 V | > 14.8 V ⇒ **controller** |
| `lamp_lux` (blink Δ) | BPW34 | 150–210 | < 5 with heartbeat OK ⇒ **LED** |
| `load_ma` | INA3221 ch3 | 740–820 mA (10 W lamp at 100%) | < 50 while commanded on confirms **LED** |
| `history.rssi_trend_dbm` | LoRa radio | −85 to −100 | Falling to < −115 ⇒ **radio** |
| `case_open`, `tilt_deg` | Reed, tilt | false, < 3° | true / > 20° ⇒ **vandalism** |

## Compress before prompting

A 3 B model reads better from a small, labelled summary than from raw JSON. `nebo-ai` sends:

```json
{
  "incident": "out",
  "rule_fired": "R1 both neighbours fail",
  "zone": {"id": "refugee", "priority": "HIGH"},
  "street": "Water Point Road",
  "nodes": ["RC-A-04"],
  "last_telemetry": { "...": "last packet before silence, incl. history" }
}
```

## Validate incoming data (Python)

```python
import json, jsonschema
schema = json.load(open("analytics/telemetry-schema.json"))
validator = jsonschema.Draft202012Validator(schema)
for packet in json.load(open("analytics/sample-telemetry.json")):
    validator.validate(packet)
    print("valid", packet["node_id"])
```
