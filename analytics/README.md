# analytics/

The data contract and metrics behind the Nura dashboard.

| File | Purpose |
|---|---|
| [detection-rules.md](detection-rules.md) | **Canonical** outage / link / lamp / segment rules and truth table. The gateway and the dashboard both implement this. |
| [telemetry-schema.json](telemetry-schema.json) | JSON Schema (draft 2020-12) for the 60-second packet each light sends. |
| [sample-telemetry.json](sample-telemetry.json) | Four example packets: a healthy light, a failing panel (last packet before silence), a dead LED, and a vandalised light. |

## Dashboard KPIs

| KPI | Definition | Why it matters |
|---|---|---|
| **Lights on** | Lights with heartbeat OK, lamp OK and no open incident ÷ total lights in zone | The number a city council reports |
| **Outages** | Lights inside open R1/R3/R5 incidents | What's driving dispatch |
| **Lamp faults** | Open R4 incidents | Cheapest fix (10-minute swap). Track separately so they don't inflate outage figures |
| **Link faults** | Open R2 incidents | Radio health. A spike points to interference or new obstructions, not broken lights |
| **Avg battery** | Mean `battery_pct` of reporting lights | Early warning for a cloudy spell or ageing batteries |

## Metrics to add once real data exists

- **MTTR (mean time to repair):** time from incident open to auto-close, per zone and per cause. The target is under 24 h.
- **Diagnosis accuracy:** the AI's `likely_cause` against what the fixer actually replaced (captured from the reply email). This is the key number for tuning prompts. See [`ai/05-diagnosis-pipeline.md`](../ai/05-diagnosis-pipeline.md).
- **Lit-hours %:** hours lit at night ÷ hours of darkness, per street. This is the real impact metric.
- **Battery health curve:** `dawn_battery_pct` against panel energy harvested, so batteries are replaced *before* they fail.
- **Vandalism heat map:** R5 segment incidents by location and time, shared with the neighbourhood committee, not with armed actors.

## Validate the sample data

```bash
npx ajv-cli validate --spec=draft2020 -c ajv-formats -s analytics/telemetry-schema.json -d analytics/sample-telemetry.json
```

The sample file is an array, so validate it item by item or wrap the schema in `{"type":"array","items":{"$ref":...}}`. A Python snippet that does this is in `ai/03-sensor-data-schema.md`.
