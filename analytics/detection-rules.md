# Nura Detection Rules (canonical)

These are the rules the zone gateway uses to decide a light's state. The dashboard simulation (`frontend/assets/js/dashboard.js`, functions `runPings`, `detect` and `reconcile`) and `docs/Nebo.md` both implement this file. If you change a rule here, change it in both places.

> **Design principle:** rules decide, AI explains. The LLM never decides whether a light is out. It only explains the likely cause and writes the repair instructions.

## Terms

| Term | Meaning |
|---|---|
| Street chain | Ordered list of lights `L0 … Ln` on one street. Each light knows only its left (`Lk-1`) and right (`Lk+1`) neighbour. |
| Ping | Every 60 s, `Lk` sends a short LoRa/ESP-NOW frame to each neighbour. Success means an ACK is received. Links are treated as symmetric: `A→B` fails ⇔ `B→A` fails. |
| Heartbeat (HB) | The telemetry packet each light sends to the zone gateway every 60 s. |
| Live neighbour | A neighbour whose own heartbeat reached the gateway this cycle. Only a live neighbour's failed ping counts as evidence. |
| Confirmation | A condition must hold for **3 consecutive cycles** (≈3 min) before an incident opens. This stops one lost packet from dispatching a fixer. |

## Rules

| ID | State | Condition (all evaluated per cycle) | Action |
|---|---|---|---|
| **R1** | **OUTAGE** | `Lk` has two live neighbours, **and** both fail to ping `Lk`, **and** `Lk` heartbeat is missing | Open outage, run AI diagnosis, email the fixer |
| **R2** | **LINK FAULT** | Both ends of a link send heartbeats, but the ping between them fails | Advisory only, no dispatch. Escalate if open for more than 24 h |
| **R3** | **OUTAGE (edge / partial)** | Every *live* neighbour fails to ping `Lk` (one neighbour at a street end, or one neighbour already dead) **and** `Lk` heartbeat is missing | Same as R1 |
| **R4** | **LAMP FAULT** | `Lk` heartbeat OK, it is night, `lamp_cmd = on`, **and** the photodiode *blink test* shows no light from the lamp (Δlux < 5, see Nebo.md §3.4). `load_ma < 50` corroborates (the 12 V lamp draws ≈ 780 mA when lit), but the photodiode stays the deciding signal | Open lamp fault, email a 10-minute swap guide |
| **R5** | **SEGMENT OUTAGE** | Two or more *adjacent* lights on the same street meet R1 or R3 in the same cycle | One URGENT incident with a safety-first playbook (likely vandalism or conflict damage) |

### Why R1 alone isn't enough (see Nebo.md §12)

The original rule is "A can't ping B **and** C can't ping B ⇒ B is out". It has three blind spots:

1. **Street ends** have one neighbour, so the rule can never fire. R3 uses the gateway heartbeat instead.
2. **Both links obstructed** (for example, trucks parked on both sides) makes R1 fire although B is alive. Requiring a missing heartbeat prevents that false dispatch. With the heartbeat present, it becomes 2 × R2.
3. **Dead neighbour.** If A is also dead, A's ping failure means nothing, which is why only *live* neighbours count.

## Truth table (middle light B, neighbours A and C)

| A live? | C live? | A→B | C→B | B heartbeat | Result |
|---|---|---|---|---|---|
| ✓ | ✓ | ✓ | ✓ | ✓ | OK |
| ✓ | ✓ | ✗ | ✓ | ✓ | R2 link fault A↔B |
| ✓ | ✓ | ✗ | ✗ | ✓ | R2 × 2 (B alive, both links blocked) |
| ✓ | ✓ | ✗ | ✗ | ✗ | **R1 outage B** |
| ✗ | ✓ | – | ✗ | ✗ | **R3 outage B** (with A also out → R5 segment) |
| ✗ | ✗ | – | – | ✗ | **R3 outage B** (heartbeat only, low confidence; part of R5 segment) |
| ✓ | ✓ | ✓ | ✓ | ✓ + lux < 5 at night | **R4 lamp fault B** |

`–` = not evidence (the pinger is itself silent).

## Day / night

The panel is the dusk/dawn sensor. `panel_v > 8 V` means day and `panel_v < 2 V` means night, with 10 minutes of hysteresis. R4 is evaluated only at night. By day the lamp is off, and a dark photodiode is normal.

## Resolution

An incident closes automatically when its condition is false for 3 consecutive cycles. For an outage, both live neighbours must ping the light again and its heartbeat must return.
