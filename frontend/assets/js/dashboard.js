'use strict';

/*
 * Nura dashboard: in-browser simulation of a zone gateway.
 *
 *  1. Each light pings only its left and right neighbour (same street chain).
 *  2. The gateway applies the detection rules (analytics/detection-rules.md).
 *     A condition must hold for CONFIRM_TICKS consecutive ticks before it opens an incident.
 *  3. A simulated "Ollama" step infers the likely cause from the light's last
 *     telemetry and writes a repair email for the zone's local fixer.
 *
 * Nothing leaves the browser. All DOM output uses textContent / createElement.
 */
(function () {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var TICK_MS = 2000;
  var CONFIRM_TICKS = 3;
  var AUTO_FAULT_EVERY = 14; // ticks, when random events are on
  var AUTO_REPAIR_AFTER = 30; // ticks an incident stays open before the fixer "repairs" it
  var MODEL = 'llama3.2:3b';
  var GATEWAY = 'GW-01';

  /* ------------------------------------------------------------------ *
   * Zones (illustrative locations)
   * ------------------------------------------------------------------ */
  var ZONES = {
    refugee: {
      id: 'refugee',
      title: 'Refugee zone',
      place: 'Mogadishu · IDP settlement, Block C',
      priority: 'HIGH',
      why: 'This route links shelters to the water point, latrines and the clinic tent. Women and children use it after dark.',
      fixer: { name: 'Block C maintenance committee', email: 'fixers.blockc@nura-city.example' },
      streets: [
        { id: 'RC-A', name: 'Water Point Road', from: [70, 100], to: [830, 100], n: 8 },
        { id: 'RC-B', name: 'Clinic Tent Lane', from: [70, 235], to: [610, 235], n: 6 },
        { id: 'RC-C', name: 'Latrine Path', from: [110, 370], to: [830, 330], n: 7 }
      ],
      pois: [
        { x: 790, y: 142, label: 'WATER POINT' },
        { x: 700, y: 262, label: 'CLINIC TENT' },
        { x: 780, y: 395, label: 'LATRINES' },
        { x: 70, y: 160, label: 'SHELTERS' }
      ],
      seed: 11
    },
    education: {
      id: 'education',
      title: 'Education zone',
      place: 'Omdurman · Al-Nour school corridor',
      priority: 'MEDIUM',
      why: 'Students walk this corridor before sunrise and after evening classes. Girls’ attendance drops when it is dark.',
      fixer: { name: 'Al-Nour parents’ committee', email: 'fixers.alnour@nura-city.example' },
      streets: [
        { id: 'ED-A', name: 'School Road', from: [60, 120], to: [840, 90], n: 9 },
        { id: 'ED-B', name: 'Girls’ School Lane', from: [120, 250], to: [760, 250], n: 7 },
        { id: 'ED-C', name: 'Quran Centre Street', from: [60, 380], to: [520, 380], n: 5 }
      ],
      pois: [
        { x: 790, y: 138, label: 'BOYS’ SCHOOL' },
        { x: 830, y: 282, label: 'GIRLS’ SCHOOL' },
        { x: 620, y: 392, label: 'QURAN CENTRE' },
        { x: 70, y: 180, label: 'SUUQ' }
      ],
      seed: 23
    },
    healthcare: {
      id: 'healthcare',
      title: 'Healthcare zone',
      place: 'Port Sudan · Clinic Avenue',
      priority: 'HIGH',
      why: 'This avenue is the night route to the maternity ward and the pharmacy. Emergencies can’t wait for daylight.',
      fixer: { name: 'Clinic Avenue fixers', email: 'fixers.clinicave@nura-city.example' },
      streets: [
        { id: 'HC-A', name: 'Clinic Avenue', from: [60, 95], to: [840, 95], n: 9 },
        { id: 'HC-B', name: 'Maternity Road', from: [60, 240], to: [700, 270], n: 7 },
        { id: 'HC-C', name: 'Pharmacy Lane', from: [300, 385], to: [840, 385], n: 6 }
      ],
      pois: [
        { x: 790, y: 142, label: 'HEALTH CENTRE' },
        { x: 790, y: 300, label: 'MATERNITY' },
        { x: 230, y: 370, label: 'PHARMACY' },
        { x: 60, y: 160, label: 'AMBULANCE BAY' }
      ],
      seed: 37
    }
  };

  /* ------------------------------------------------------------------ *
   * Fault catalogue: effect on the node + the telemetry it leaves behind
   * ------------------------------------------------------------------ */
  var FAULTS = {
    battery: { label: 'Battery worn out', effect: { power: false } },
    panel: { label: 'Solar panel damage', effect: { power: false } },
    controller: { label: 'Charge controller failure', effect: { power: false } },
    led: { label: 'LED lamp failure', effect: { lamp: false } },
    radio: { label: 'Sensor radio failure', effect: { radio: false } },
    vandal: { label: 'Vandalism / conflict damage', effect: { power: false, radio: false, lamp: false } },
    link: { label: 'Radio link obstruction', effect: {} }
  };
  var NODE_FAULTS = ['battery', 'panel', 'controller', 'led', 'radio'];

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */
  var rngState = 20260924;
  function rand() {
    rngState = (rngState * 16807) % 2147483647;
    return (rngState - 1) / 2147483646;
  }
  function between(a, b) {
    return a + rand() * (b - a);
  }
  function pick(arr) {
    return arr[Math.floor(rand() * arr.length)];
  }
  function round(n, d) {
    var p = Math.pow(10, d || 0);
    return Math.round(n * p) / p;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        e.setAttribute(k, String(attrs[k]));
      });
    }
    return e;
  }
  function $(id) {
    return document.getElementById(id);
  }

  /* ------------------------------------------------------------------ *
   * Simulated clock (starts 21:40 local, 1 simulated minute per tick)
   * ------------------------------------------------------------------ */
  var simMinutes = 21 * 60 + 40;
  var tickCount = 0;
  function clockText() {
    var m = simMinutes % (24 * 60);
    var h = Math.floor(m / 60);
    var mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function advanceClock() {
    simMinutes += 1;
    // keep the demo at night: 05:30 loops back to 19:00
    if (simMinutes % (24 * 60) === 5 * 60 + 30) simMinutes = 19 * 60;
  }
  function simIso() {
    return '2026-09-24T' + clockText() + ':00+02:00';
  }

  /* ------------------------------------------------------------------ *
   * Model
   * ------------------------------------------------------------------ */
  var state = {
    zones: {},
    active: 'refugee',
    selected: null,
    paused: false,
    incidents: {}, // key -> incident
    pending: {}, // key -> consecutive ticks observed
    activeIncident: null,
    typingTimer: null
  };

  function healthyHistory() {
    return {
      day_peak_panel_ma: [round(between(1350, 1560)), round(between(1350, 1560)), round(between(1350, 1560))],
      dawn_battery_pct: [round(between(72, 90)), round(between(72, 90)), round(between(72, 90))],
      battery_v_max: round(between(14.1, 14.4), 2),
      rssi_trend_dbm: [round(between(-100, -86)), round(between(-100, -86)), round(between(-100, -86))]
    };
  }

  function buildZone(z) {
    var zone = { def: z, streets: [] };
    z.streets.forEach(function (s) {
      var nodes = [];
      var links = [];
      for (var i = 0; i < s.n; i++) {
        var t = s.n === 1 ? 0 : i / (s.n - 1);
        var node = {
          id: s.id + '-' + (i + 1 < 10 ? '0' : '') + (i + 1),
          zone: z.id,
          street: s,
          idx: i,
          x: s.from[0] + (s.to[0] - s.from[0]) * t,
          y: s.from[1] + (s.to[1] - s.from[1]) * t,
          power: true,
          radio: true,
          lamp: true,
          fault: null,
          faultTick: null,
          battery: round(between(62, 96)),
          history: healthyHistory(),
          flags: { case_open: false, tilt_deg: round(between(0, 3)) },
          hb: true,
          seq: Math.floor(between(1000, 9000)),
          lastSeen: null,
          status: 'ok',
          pendingStatus: null
        };
        nodes.push(node);
        if (i > 0) links.push({ a: nodes[i - 1], b: node, blocked: false, ok: true, rssi: round(between(-100, -86)) });
      }
      zone.streets.push({ def: s, nodes: nodes, links: links });
    });
    return zone;
  }

  function allNodes(zone) {
    var out = [];
    zone.streets.forEach(function (s) {
      out = out.concat(s.nodes);
    });
    return out;
  }
  function findNode(id) {
    var found = null;
    Object.keys(state.zones).forEach(function (zid) {
      allNodes(state.zones[zid]).forEach(function (n) {
        if (n.id === id) found = n;
      });
    });
    return found;
  }

  /* Telemetry packet a node would send right now (INA3221 channels + photodiode). */
  function telemetry(node) {
    var night = true;
    var lampOn = node.lamp && node.power;
    return {
      node_id: node.id,
      zone_id: node.zone,
      street_id: node.street.id,
      ts: simIso(),
      seq: node.seq,
      panel_v: night ? round(between(0.2, 0.6), 2) : 18.4,
      panel_ma: 0,
      battery_v: round(11.2 + (node.battery / 100) * 2.2, 2),
      battery_pct: round(node.battery),
      battery_ma: lampOn ? -round(between(800, 880)) : -round(between(18, 26)),
      load_ma: lampOn ? round(between(740, 820)) : round(between(0, 5)),
      lamp_cmd: 'on',
      lamp_lux: lampOn ? round(between(150, 210)) : round(between(0.1, 0.8), 1),
      case_open: node.flags.case_open,
      tilt_deg: node.flags.tilt_deg,
      temp_c: round(between(27, 33)),
      ping: pingField(node),
      history: node.history
    };
  }

  function pingField(node) {
    var s = findStreet(node);
    var out = {};
    if (!s) return out;
    var left = node.idx > 0 ? s.links[node.idx - 1] : null;
    var right = node.idx < s.links.length ? s.links[node.idx] : null;
    if (left) out.left = { id: left.a.id, ok: left.ok, rssi_dbm: left.ok ? left.rssi : null };
    if (right) out.right = { id: right.b.id, ok: right.ok, rssi_dbm: right.ok ? right.rssi : null };
    return out;
  }

  /* Apply a fault: change the node's physical state and leave its telemetry signature. */
  function applyFault(node, type) {
    var f = FAULTS[type];
    if (!f || type === 'link') return;
    node.fault = type;
    node.faultTick = tickCount;
    if (f.effect.power === false) node.power = false;
    if (f.effect.radio === false) node.radio = false;
    if (f.effect.lamp === false) node.lamp = false;

    var h = node.history;
    if (type === 'battery') {
      h.dawn_battery_pct = [round(between(55, 68)), round(between(25, 35)), round(between(3, 7))];
      node.battery = h.dawn_battery_pct[2];
    } else if (type === 'panel') {
      h.day_peak_panel_ma = [round(between(1350, 1560)), 0, 0];
      h.dawn_battery_pct = [round(between(80, 90)), round(between(45, 55)), round(between(5, 10))];
      node.battery = h.dawn_battery_pct[2];
    } else if (type === 'controller') {
      h.battery_v_max = round(between(15.1, 15.6), 2);
    } else if (type === 'led') {
      node.battery = 99;
      h.dawn_battery_pct = [98, 99, 99];
    } else if (type === 'radio') {
      h.rssi_trend_dbm = [round(between(-98, -92)), round(between(-110, -105)), round(between(-123, -119))];
    } else if (type === 'vandal') {
      node.flags.case_open = true;
      node.flags.tilt_deg = round(between(28, 55));
    }
    // the gateway keeps the last packet it received before the node went silent
    node.lastPacket = telemetry(node);
    if (type !== 'led') node.lastPacket.lamp_lux = round(between(150, 200));
    if (type === 'vandal') node.lastPacket.load_ma = 0;
  }

  function repairNode(node) {
    node.power = true;
    node.radio = true;
    node.lamp = true;
    node.fault = null;
    node.faultTick = null;
    node.battery = round(between(70, 92));
    node.history = healthyHistory();
    node.flags = { case_open: false, tilt_deg: round(between(0, 3)) };
    node.lastPacket = null;
  }

  function breakRandom(zone, type) {
    if (type === 'auto') type = rand() < 0.12 ? 'link' : rand() < 0.08 ? 'vandal' : pick(NODE_FAULTS);
    if (type === 'link') {
      var candidates = [];
      zone.streets.forEach(function (s) {
        s.links.forEach(function (l) {
          if (!l.blocked && l.a.hb && l.b.hb) candidates.push(l);
        });
      });
      if (!candidates.length) return null;
      var link = pick(candidates);
      blockLink(link);
      return link.a.id + '↔' + link.b.id;
    }
    if (type === 'vandal') {
      // conflict damage usually hits neighbouring poles together
      var street = pick(zone.streets);
      var healthy = street.nodes.filter(function (n) {
        return !n.fault;
      });
      if (healthy.length < 2) return null;
      var start = Math.floor(rand() * (street.nodes.length - 1));
      var hit = [street.nodes[start], street.nodes[start + 1]];
      hit.forEach(function (n) {
        applyFault(n, 'vandal');
      });
      return hit[0].id + ' + ' + hit[1].id;
    }
    var ok = allNodes(zone).filter(function (n) {
      return !n.fault;
    });
    if (!ok.length) return null;
    var node = pick(ok);
    applyFault(node, type);
    return node.id;
  }

  function blockLink(link) {
    link.blocked = true;
    link.rssi = round(between(-128, -124));
    link.blockedTick = tickCount;
  }

  /* ------------------------------------------------------------------ *
   * Detection (mirrors analytics/detection-rules.md)
   * ------------------------------------------------------------------ */
  function runPings(zone) {
    zone.streets.forEach(function (s) {
      s.nodes.forEach(function (n) {
        n.hb = n.power && n.radio;
        if (n.hb) {
          n.lastSeen = clockText();
          n.seq += 1;
          if (n.lamp) n.battery = Math.max(20, round(n.battery - between(0, 0.25), 1));
        }
      });
      s.links.forEach(function (l) {
        l.ok = l.a.hb && l.b.hb && !l.blocked;
      });
    });
  }

  function detect(zone) {
    var observed = []; // {key, type, nodes, street, rule}
    zone.streets.forEach(function (s) {
      var outIdx = [];
      s.nodes.forEach(function (n, i) {
        var left = i > 0 ? s.links[i - 1] : null;
        var right = i < s.links.length ? s.links[i] : null;
        var nbLinks = [left, right].filter(Boolean);
        var aliveNb = nbLinks.filter(function (l) {
          return (l.a === n ? l.b : l.a).hb;
        });
        var failed = aliveNb.filter(function (l) {
          return !l.ok;
        });
        var bothSidesFail = aliveNb.length === 2 && failed.length === 2;
        var rule = null;

        if (!n.hb && failed.length === aliveNb.length) {
          if (bothSidesFail) rule = 'R1 both neighbours fail';
          else if (nbLinks.length === 1) rule = 'R3 street end: neighbour fails + heartbeat missed';
          else if (aliveNb.length === 1) rule = 'R3 one live neighbour fails + heartbeat missed';
          else rule = 'R3 no live neighbours + heartbeat missed';
          outIdx.push(i);
          n.rule = rule;
        } else if (n.hb && !n.lamp) {
          observed.push({ key: 'lamp:' + n.id, type: 'lamp', nodes: [n], street: s.def, rule: 'R4 heartbeat OK, photodiode dark at night' });
        }
      });

      // group consecutive OUT nodes: 1 => outage, 2+ => segment (R5)
      var groups = [];
      outIdx.forEach(function (i) {
        var g = groups[groups.length - 1];
        if (g && g[g.length - 1] === i - 1) g.push(i);
        else groups.push([i]);
      });
      groups.forEach(function (g) {
        var nodes = g.map(function (i) {
          return s.nodes[i];
        });
        if (nodes.length === 1) {
          observed.push({ key: 'out:' + nodes[0].id, type: 'out', nodes: nodes, street: s.def, rule: nodes[0].rule });
        } else {
          observed.push({
            key: 'seg:' + nodes.map(function (n) {
              return n.id;
            }).join(','),
            type: 'segment',
            nodes: nodes,
            street: s.def,
            rule: 'R5 ' + nodes.length + ' adjacent lights out'
          });
        }
      });

      // R2 link fault: both ends alive (heartbeat) but they can't reach each other
      s.links.forEach(function (l) {
        if (l.a.hb && l.b.hb && !l.ok) {
          observed.push({ key: 'link:' + l.a.id + '|' + l.b.id, type: 'link', nodes: [l.a, l.b], link: l, street: s.def, rule: 'R2 one side fails, both heartbeats OK' });
        }
      });
    });
    return observed;
  }

  function reconcile(zone) {
    var observed = detect(zone);
    var seen = {};

    // per-node display status is derived from confirmed incidents
    allNodes(zone).forEach(function (n) {
      n.status = 'ok';
      n.pendingStatus = null;
    });

    observed.forEach(function (o) {
      seen[o.key] = true;
      if (state.incidents[o.key]) return;
      state.pending[o.key] = (state.pending[o.key] || 0) + 1;
      if (state.pending[o.key] >= CONFIRM_TICKS) {
        delete state.pending[o.key];
        openIncident(zone, o);
      } else {
        o.nodes.forEach(function (n) {
          if (o.type !== 'link') n.pendingStatus = state.pending[o.key];
        });
      }
    });

    Object.keys(state.pending).forEach(function (k) {
      if (!seen[k] && belongsTo(k, zone)) delete state.pending[k];
    });

    Object.keys(state.incidents).forEach(function (k) {
      var inc = state.incidents[k];
      if (inc.zone !== zone.def.id) return;
      if (!seen[k]) {
        // R-resolution: condition must be clear for CONFIRM_TICKS cycles
        inc.clearTicks = (inc.clearTicks || 0) + 1;
        if (inc.clearTicks >= CONFIRM_TICKS) {
          resolveIncident(inc);
          return;
        }
      } else {
        inc.clearTicks = 0;
      }
      inc.nodes.forEach(function (n) {
        if (inc.type === 'out' || inc.type === 'segment') n.status = 'out';
        else if (inc.type === 'lamp') n.status = 'lamp';
      });
    });
  }

  function belongsTo(key, zone) {
    var ids = key.slice(key.indexOf(':') + 1).split(/[,|]/);
    var prefix = zone.streets.map(function (s) {
      return s.def.id;
    });
    return prefix.some(function (p) {
      return ids[0].indexOf(p) === 0;
    });
  }

  /* ------------------------------------------------------------------ *
   * Incidents
   * ------------------------------------------------------------------ */
  function openIncident(zone, o) {
    var inc = {
      key: o.key,
      type: o.type,
      zone: zone.def.id,
      nodes: o.nodes,
      link: o.link || null,
      street: o.street,
      rule: o.rule,
      openedAt: clockText(),
      openedTick: tickCount
    };
    inc.diagnosis = diagnose(zone, inc);
    inc.email = composeEmail(zone, inc);
    inc.prompt = buildPrompt(zone, inc);
    state.incidents[o.key] = inc;

    var lvl = inc.type === 'link' ? 'warn' : 'crit';
    var what =
      inc.type === 'out'
        ? 'OUTAGE ' + inc.nodes[0].id
        : inc.type === 'segment'
        ? 'SEGMENT OUTAGE ' + idList(inc.nodes)
        : inc.type === 'lamp'
        ? 'LAMP FAULT ' + inc.nodes[0].id
        : 'LINK FAULT ' + inc.nodes[0].id + '↔' + inc.nodes[1].id;
    log(zone.def.id, lvl, what + ' on ' + inc.street.name + ' (' + inc.rule + ')');
    log(zone.def.id, 'ai', MODEL + ' → ' + inc.diagnosis.likely_cause_label + ' (' + Math.round(inc.diagnosis.confidence * 100) + '%). ' + (inc.type === 'link' ? 'Advisory' : 'Repair email') + ' sent to ' + zone.def.fixer.name + '.');

    if (zone.def.id === state.active && (!state.activeIncident || !state.incidents[state.activeIncident] || inc.type !== 'link')) {
      state.activeIncident = inc.key;
      showIncident(inc, true);
    }
  }

  function resolveIncident(inc) {
    delete state.incidents[inc.key];
    log(inc.zone, 'ok', 'RESOLVED ' + idList(inc.nodes) + ': neighbours can reach it again. Incident closed automatically.');
    if (state.activeIncident === inc.key) {
      state.activeIncident = null;
      var next = zoneIncidents(state.active)[0];
      if (next) {
        state.activeIncident = next.key;
        showIncident(next, false);
      } else clearAi();
    }
  }

  function zoneIncidents(zid) {
    var order = { segment: 0, out: 1, lamp: 2, link: 3 };
    return Object.keys(state.incidents)
      .map(function (k) {
        return state.incidents[k];
      })
      .filter(function (i) {
        return i.zone === zid;
      })
      .sort(function (a, b) {
        return order[a.type] - order[b.type] || a.openedTick - b.openedTick;
      });
  }

  function idList(nodes) {
    return nodes
      .map(function (n) {
        return n.id;
      })
      .join(', ');
  }

  /* ------------------------------------------------------------------ *
   * Simulated Ollama: infer the cause from telemetry only (never from the
   * simulator's hidden fault field), then write the repair email.
   * ------------------------------------------------------------------ */
  function diagnose(zone, inc) {
    var n = inc.nodes[0];
    var p = n.lastPacket || telemetry(n);
    var h = p.history;
    var ev = [];
    var cause = 'unknown';
    var conf = 0.5;

    if (inc.type === 'link') {
      cause = 'link';
      conf = 0.8;
      ev.push('Both ' + inc.nodes[0].id + ' and ' + inc.nodes[1].id + ' still send heartbeats to the gateway.');
      ev.push('Signal between them fell to ' + inc.link.rssi + ' dBm (normal ≈ −90 dBm). Their other links are healthy.');
    } else if (inc.type === 'segment' || p.case_open || p.tilt_deg > 20) {
      cause = 'vandal';
      conf = p.case_open ? 0.86 : 0.7;
      ev.push(inc.nodes.length + ' neighbouring lights went silent within the same minute.');
      if (p.case_open) ev.push('Tamper switch on ' + n.id + ' reported the case open just before silence.');
      if (p.tilt_deg > 20) ev.push('Tilt sensor on ' + n.id + ' reported ' + p.tilt_deg + '° (normal < 3°).');
    } else if (inc.type === 'lamp' || (n.hb && p.lamp_lux < 5)) {
      cause = 'led';
      conf = 0.9;
      ev.push('Node still answers: heartbeat and both neighbour pings OK.');
      ev.push('Lamp is commanded ON but the photodiode reads ' + p.lamp_lux + ' lux (normal ≈ 180).');
      ev.push('LED load current ' + p.load_ma + ' mA (normal ≈ 780 mA); battery ' + p.battery_pct + '% and not draining.');
    } else if (h.battery_v_max > 14.8) {
      cause = 'controller';
      conf = 0.78;
      ev.push('Battery voltage peaked at ' + h.battery_v_max + ' V (safe max 14.6 V): the controller is over-charging.');
      ev.push('Panel current was normal (' + h.day_peak_panel_ma.join(' / ') + ' mA daily peaks).');
    } else if (h.day_peak_panel_ma[1] === 0 && h.day_peak_panel_ma[2] === 0) {
      cause = 'panel';
      conf = 0.88;
      ev.push('Panel current in full sun: ' + h.day_peak_panel_ma.join(' → ') + ' mA over 3 days. No charging for 2 days.');
      ev.push('Battery at dawn: ' + h.dawn_battery_pct.join('% → ') + '%. It drained because nothing refilled it.');
    } else if (h.dawn_battery_pct[0] - h.dawn_battery_pct[2] > 40) {
      cause = 'battery';
      conf = 0.84;
      ev.push('Panel charged normally (' + h.day_peak_panel_ma.join(' / ') + ' mA peaks), but the battery fell ' + h.dawn_battery_pct.join('% → ') + '% at dawn.');
      ev.push('Last battery voltage ' + p.battery_v + ' V. The battery no longer holds a charge (capacity fade).');
    } else if (h.rssi_trend_dbm[2] < -115) {
      cause = 'radio';
      conf = 0.74;
      ev.push('Power readings were normal right up to silence (battery ' + p.battery_pct + '%).');
      ev.push('Radio signal weakened over 3 days: ' + h.rssi_trend_dbm.join(' → ') + ' dBm. Likely antenna or radio module.');
      ev.push('The lamp is probably still lit.');
    } else {
      ev.push('No clear signature in the last telemetry. On-site check needed.');
    }

    var severity = inc.type === 'segment' ? 'URGENT' : inc.type === 'link' ? 'LOW' : inc.type === 'lamp' ? 'MEDIUM' : zone.def.priority;
    return {
      incident: inc.type,
      node_ids: inc.nodes.map(function (x) {
        return x.id;
      }),
      rule: inc.rule,
      likely_cause: cause,
      likely_cause_label: cause === 'unknown' ? 'Unknown cause' : FAULTS[cause].label,
      confidence: conf,
      severity: severity,
      evidence: ev,
      dispatch: inc.type !== 'link'
    };
  }

  var PLAYBOOK = {
    battery: {
      time: '30–45 min',
      tools: ['Multimeter', 'T20 security (pin-Torx) bit', '10 mm spanner', 'Insulated gloves', '3 m ladder + a helper to hold it', 'Head torch'],
      parts: ['12 V 12 Ah LiFePO₄ battery (city stock)', 'Spare 10 A blade fuse'],
      steps: [
        'Pull the 10 A inline fuse on the battery cable. This isolates the system before you touch any wire.',
        'Open the electronics bay (4 × T20 security screws).',
        'Measure the battery with the multimeter. Below 11.5 V after a sunny day confirms a worn battery.',
        'Disconnect battery NEGATIVE (black) first, then POSITIVE (red).',
        'Fit the new battery: connect POSITIVE first, then NEGATIVE.',
        'Refit the fuse. The controller’s BAT light should come on.',
        'Check the rubber gasket is seated, close the bay, and wait 2 minutes for the light to rejoin.'
      ],
      safety: ['Never short the battery terminals. LiFePO₄ can deliver very high current.', 'Carry the old battery back for recycling. Do not burn or bury it.']
    },
    panel: {
      time: '30 min (daylight only)',
      tools: ['Multimeter', 'Soft cloth + clean water', '10 mm spanner', '3 m ladder + a helper', 'Gloves'],
      parts: ['30 W 12 V solar panel (only if cracked)', 'Spare PV cable with connector'],
      steps: [
        'Do this in daylight. From the ground, look at the panel for cracks, bullet or stone damage, sand or bird droppings.',
        'Pull the inline fuse on the panel cable.',
        'Clean the panel with water and a soft cloth. Do not use detergent and do not scrape.',
        'At the controller’s PV terminals, measure the panel voltage. Expect 18–22 V in sun.',
        'If it reads under 5 V, check the panel connector. Re-seat it or replace the cable.',
        'If the glass is cracked or the voltage is still low, swap the panel (it is held by 4 corner brackets with M6 bolts).',
        'Refit the fuse. The battery needs one sunny day to recharge, and the light should return tonight.'
      ],
      safety: ['A panel in sun is always live. Cover it with a cloth before unplugging.']
    },
    controller: {
      time: '30 min',
      tools: ['Multimeter', 'Small flat screwdriver', 'T20 security bit', 'Phone camera', '3 m ladder + a helper'],
      parts: ['MPPT charge controller matching the 30 W kit (city stock)', 'Cable ferrules'],
      steps: [
        'Pull the battery fuse to isolate the system.',
        'Open the bay. Look and smell for burn marks or swollen parts on the controller.',
        'PHOTOGRAPH the wiring before you disconnect anything (PV, BAT, LOAD).',
        'Disconnect the panel first, then the load, then the battery.',
        'Fit the new controller: connect the BATTERY first, then the panel, then the load.',
        'Refit the fuse. The battery should read 13.0–14.4 V while charging, and never above 14.6 V.',
        'Close the bay and check the gasket.'
      ],
      safety: ['Over-charged batteries can swell. If the battery case is bulging, do not reuse it. Replace it as well.']
    },
    led: {
      time: '10 min',
      tools: ['10 mm spanner', '3 m ladder + a helper', 'Head torch', 'Gloves'],
      parts: ['1 × 10 W 12 V IP65 LED lamp with M12 plug (city stock)'],
      steps: [
        'Good news: the light’s sensor and power are working. Only the lamp failed.',
        'Pull the 2 A lamp fuse in the electronics bay, so the plug is dead before you touch it.',
        'At the lamp mount, unscrew the M12 plug’s locking ring and pull the plug out.',
        'Undo the 2 × M6 bolts and lift the old lamp off its pad.',
        'Bolt the new lamp on, push its M12 plug in until it clicks, and hand-tighten the locking ring.',
        'Refit the lamp fuse. Cover the photodiode window with your hand for 10 seconds, and the lamp should switch on.',
        'Bring the old lamp back to the workshop for testing.'
      ],
      safety: ['Do not look straight into the LED at full brightness.', 'Keep the plug cap dry and check its O-ring is seated before you push it in.']
    },
    radio: {
      time: '15 min',
      tools: ['T20 security bit', '3 m ladder + a helper', 'Phone'],
      parts: ['Spare node board (pre-flashed ESP32-LoRa)', 'Spare 868/915 MHz antenna'],
      steps: [
        'This light is probably still ON. Only its sensor radio stopped talking.',
        'Tonight, from the ground: is the lamp lit? Reply LIT or DARK so the gateway can update the record.',
        'In daylight, open the bay and check the antenna is screwed on tight and not bent or broken.',
        'Press the RESET button on the node board once. Within 2 minutes its LED should blink purple (joined).',
        'No blink? Swap the node board. It unplugs from its header, and the new one arrives pre-flashed.',
        'Close the bay and check the gasket.'
      ],
      safety: ['Never power the radio without its antenna connected. It can damage the module.']
    },
    vandal: {
      time: '1–2 h',
      tools: ['Phone camera', 'Multimeter', 'T20 security bit', '13 mm spanner (pole clamp)', '3 m ladder + a helper'],
      parts: ['Replacement node kits as needed', 'Security screws', 'Spare 10 A fuses'],
      steps: [
        'SAFETY FIRST. Do not go alone or at night. Confirm with the neighbourhood committee that the street is safe.',
        'From a distance, photograph each affected pole.',
        'Reply with the status of each light: STANDING, DAMAGED or MISSING.',
        'Standing poles: re-seat the case, tighten the 3-prong clamp, and check the battery fuse and voltage.',
        'Damaged or missing nodes: the city team will issue replacement kits within 48 h.',
        'Do not touch loose or hanging cables until the fuse has been pulled.'
      ],
      safety: ['Your safety matters more than the light. Leave immediately if the area is not calm.', 'Report any unexploded objects to the authorities. Never touch them.']
    },
    link: {
      time: 'No visit needed yet',
      tools: [],
      parts: [],
      steps: [
        'No repair visit is needed yet. Both lights are working and reporting to the gateway.',
        'Common causes: a new wall, a parked truck or container, a tree branch, or an antenna knocked sideways.',
        'If this is still open in 24 hours, next time you pass, check the antenna points straight up on both poles.'
      ],
      safety: []
    },
    unknown: {
      time: '30 min',
      tools: ['Multimeter', 'T20 security bit', '3 m ladder + a helper', 'Phone camera'],
      parts: ['Spare node board', 'Spare 10 A fuse'],
      steps: ['Visit in daylight and photograph the pole.', 'Check the fuse, battery voltage and antenna.', 'Reply with what you find so the gateway can learn from it.'],
      safety: ['Pull the fuse before touching any wiring.']
    }
  };

  function composeEmail(zone, inc) {
    var d = inc.diagnosis;
    var z = zone.def;
    var n = inc.nodes[0];
    var play = PLAYBOOK[d.likely_cause] || PLAYBOOK.unknown;
    var s = n.street;
    var ids = idList(inc.nodes);
    var subject, opening;

    if (inc.type === 'link') {
      subject = '[Nura · LOW] Advisory: lights ' + inc.nodes[0].id + ' and ' + inc.nodes[1].id + ' can’t reach each other on ' + s.name;
      opening =
        'Lights ' + inc.nodes[0].id + ' and ' + inc.nodes[1].id + ' on ' + s.name + ' are both lit and reporting, but since ' + inc.openedAt +
        ' they can no longer ping each other. This is a link fault, not an outage.';
    } else if (inc.type === 'segment') {
      subject = '[Nura · URGENT] ' + inc.nodes.length + ' lights out together on ' + s.name + ' (' + ids + ')';
      opening = inc.nodes.length + ' neighbouring lights on ' + s.name + ' (' + ids + ') went dark at ' + inc.openedAt + '. Their neighbours lost contact with all of them at the same time.';
    } else if (inc.type === 'lamp') {
      subject = '[Nura · MEDIUM] Lamp dark on light ' + n.id + ', ' + s.name + ': 10-minute fix';
      opening = 'Light ' + n.id + ' on ' + s.name + ' is still talking to its neighbours, but its lamp has been dark since ' + inc.openedAt + '.';
    } else {
      var nb = neighbourIds(n);
      subject = '[Nura · ' + d.severity + '] Light ' + n.id + ' out on ' + s.name + ': likely ' + d.likely_cause_label.toLowerCase();
      opening =
        'Light ' + n.id + ' on ' + s.name + ' stopped responding at ' + inc.openedAt + '. ' +
        (nb.length === 2
          ? 'Its neighbours ' + nb[0] + ' and ' + nb[1] + ' both lost contact with it, which confirms an outage and rules out a radio glitch.'
          : 'Its only neighbour ' + (nb[0] || '') + ' lost contact with it and its gateway heartbeat is missing, which confirms an outage.');
    }

    var lines = [];
    lines.push('Salaam ' + z.fixer.name + ',');
    lines.push('');
    lines.push(opening);
    lines.push('');
    lines.push('Why it matters: ' + z.why);
    lines.push('');
    lines.push('Likely cause (' + Math.round(d.confidence * 100) + '% confidence): ' + d.likely_cause_label);
    lines.push('What the data shows:');
    d.evidence.forEach(function (e) {
      lines.push('  • ' + e);
    });
    if (play.tools.length) {
      lines.push('');
      lines.push('Tools to bring:');
      play.tools.forEach(function (t) {
        lines.push('  • ' + t);
      });
    }
    if (play.parts.length) {
      lines.push('');
      lines.push('Parts to bring:');
      play.parts.forEach(function (t) {
        lines.push('  • ' + t);
      });
    }
    lines.push('');
    lines.push((inc.type === 'link' ? 'What to do' : 'Step-by-step fix') + ' (about ' + play.time + '):');
    play.steps.forEach(function (st, i) {
      lines.push('  ' + (i + 1) + '. ' + st);
    });
    if (play.safety.length) {
      lines.push('');
      lines.push('Safety:');
      play.safety.forEach(function (t) {
        lines.push('  • ' + t);
      });
    }
    lines.push('');
    if (inc.type !== 'link') {
      lines.push(
        'When you finish, the neighbouring lights will check ' + (inc.nodes.length > 1 ? 'these lights' : n.id) +
          ' again automatically, and this incident closes by itself once they can reach it. If a pole is beyond repair, reply "REPLACE ' + n.id + '".'
      );
      lines.push('');
    }
    lines.push('Jazakum Allahu khayran,');
    lines.push('Nura gateway ' + GATEWAY + ' · ' + z.place);
    lines.push('Written offline by ' + MODEL + '. Rules decided the outage; the model explained it.');

    return {
      to: z.fixer.name + ' <' + z.fixer.email + '>',
      from: 'Nura ' + GATEWAY + ' <gateway-' + GATEWAY.toLowerCase() + '@nura-city.example>',
      subject: subject,
      body: lines.join('\n')
    };
  }

  function neighbourIds(n) {
    var s = findStreet(n);
    var out = [];
    if (n.idx > 0) out.push(s.nodes[n.idx - 1].id);
    if (n.idx < s.nodes.length - 1) out.push(s.nodes[n.idx + 1].id);
    return out;
  }
  function findStreet(n) {
    var zone = state.zones[n.zone];
    for (var i = 0; i < zone.streets.length; i++) if (zone.streets[i].def === n.street) return zone.streets[i];
    return null;
  }

  function buildPrompt(zone, inc) {
    var n = inc.nodes[0];
    var packet = n.lastPacket || telemetry(n);
    var ctx = {
      incident: inc.type,
      rule_fired: inc.rule,
      zone: { id: zone.def.id, place: zone.def.place, priority: zone.def.priority },
      street: n.street.name,
      nodes: inc.nodes.map(function (x) {
        return x.id;
      }),
      last_telemetry: packet
    };
    return [
      'SYSTEM: You are Nura, a maintenance assistant on an offline street-light gateway.',
      'The outage has ALREADY been confirmed by deterministic rules. Do not question it.',
      'Using ONLY the telemetry below, return JSON with keys: likely_cause (one of battery|panel|controller|led|radio|vandal|link|unknown),',
      'confidence (0-1), evidence (array of short strings citing numbers from the data).',
      'Never invent readings. If unsure, use "unknown".',
      '',
      'USER:',
      JSON.stringify(ctx, null, 2)
    ].join('\n');
  }

  /* ------------------------------------------------------------------ *
   * Rendering: map
   * ------------------------------------------------------------------ */
  var mapRefs = { nodes: {}, links: [] };

  function renderMap(zone) {
    var map = $('map');
    map.replaceChildren();
    mapRefs = { nodes: {}, links: [] };

    var defs = svg('defs');
    var grad = svg('radialGradient', { id: 'haloGrad' });
    [
      ['0', '#ffffff', '0.85'],
      ['0.25', '#c4b5fd', '0.45'],
      ['1', '#8b5cf6', '0']
    ].forEach(function (s) {
      grad.appendChild(svg('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] }));
    });
    defs.appendChild(grad);
    map.appendChild(defs);

    // buildings (seeded so each zone looks the same every visit)
    var saved = rngState;
    rngState = zone.def.seed * 7919;
    var bgroup = svg('g', { 'aria-hidden': 'true' });
    for (var i = 0; i < 46; i++) {
      var w = between(26, 70);
      var h = between(18, 40);
      var x = between(20, 880 - w);
      var y = between(20, 420 - h);
      if (nearStreet(zone, x, y, w, h)) continue;
      bgroup.appendChild(svg('rect', { x: round(x, 1), y: round(y, 1), width: round(w, 1), height: round(h, 1), class: 'map-building' }));
    }
    rngState = saved;
    map.appendChild(bgroup);

    var streetsG = svg('g', { 'aria-hidden': 'true' });
    zone.streets.forEach(function (s) {
      var d = s.def;
      streetsG.appendChild(svg('line', { x1: d.from[0], y1: d.from[1], x2: d.to[0], y2: d.to[1], class: 'map-street' }));
      var label = svg('text', { x: d.from[0], y: d.from[1] + 34, class: 'map-street-label' });
      label.textContent = d.name + ' · ' + d.id;
      streetsG.appendChild(label);
    });
    zone.def.pois.forEach(function (p) {
      var t = svg('text', { x: p.x, y: p.y, class: 'map-poi', 'text-anchor': 'middle' });
      t.textContent = '◆ ' + p.label;
      streetsG.appendChild(t);
    });
    map.appendChild(streetsG);

    var linksG = svg('g');
    zone.streets.forEach(function (s) {
      s.links.forEach(function (l) {
        var ln = svg('line', { x1: l.a.x, y1: l.a.y - 26, x2: l.b.x, y2: l.b.y - 26, class: 'map-link' });
        var hit = svg('line', { x1: l.a.x, y1: l.a.y - 26, x2: l.b.x, y2: l.b.y - 26, class: 'map-link-hit' });
        var title = svg('title');
        title.textContent = 'Link ' + l.a.id + ' ↔ ' + l.b.id + '. Click to obstruct or clear.';
        hit.appendChild(title);
        hit.addEventListener('click', function () {
          toggleLink(zone, l);
        });
        linksG.appendChild(ln);
        linksG.appendChild(hit);
        mapRefs.links.push({ link: l, line: ln });
      });
    });
    map.appendChild(linksG);

    var nodesG = svg('g');
    allNodes(zone).forEach(function (n) {
      var g = svg('g', { class: 'map-node', tabindex: '0', role: 'button', transform: 'translate(' + round(n.x, 1) + ' ' + round(n.y - 26, 1) + ')' });
      g.appendChild(svg('circle', { r: 30, class: 'node-halo' }));
      g.appendChild(svg('line', { x1: 0, y1: 8, x2: 0, y2: 26, stroke: '#2a2438', 'stroke-width': 3 }));
      g.appendChild(svg('circle', { r: 13, class: 'node-ring' }));
      g.appendChild(svg('circle', { r: 8, class: 'node-core' }));
      var glyph = svg('text', { class: 'node-glyph', 'text-anchor': 'middle', y: 3.5 });
      g.appendChild(glyph);
      var label = svg('text', { class: 'node-label', 'text-anchor': 'middle', y: -18 });
      label.textContent = n.id.slice(-4);
      g.appendChild(label);
      g.addEventListener('click', function () {
        selectNode(n);
      });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectNode(n);
        }
      });
      nodesG.appendChild(g);
      mapRefs.nodes[n.id] = { g: g, glyph: glyph };
    });
    map.appendChild(nodesG);
  }

  function nearStreet(zone, x, y, w, h) {
    return zone.streets.some(function (s) {
      var d = s.def;
      var cx = x + w / 2;
      var minX = Math.min(d.from[0], d.to[0]) - 40;
      var maxX = Math.max(d.from[0], d.to[0]) + 40;
      if (cx < minX || cx > maxX) return false;
      var t = (cx - d.from[0]) / (d.to[0] - d.from[0] || 1);
      var sy = d.from[1] + (d.to[1] - d.from[1]) * Math.max(0, Math.min(1, t));
      return y < sy + 44 && y + h > sy - 62;
    }) || zone.def.pois.some(function (p) {
      return Math.abs(x + w / 2 - p.x) < 70 && Math.abs(y + h / 2 - p.y) < 24;
    });
  }

  function statusText(n) {
    if (n.status === 'out') return 'Outage';
    if (n.status === 'lamp') return 'Lamp fault';
    if (n.pendingStatus) return 'Confirming ' + n.pendingStatus + '/' + CONFIRM_TICKS;
    return 'On';
  }

  function updateMap(zone, pinged) {
    allNodes(zone).forEach(function (n) {
      var ref = mapRefs.nodes[n.id];
      if (!ref) return;
      ref.g.classList.toggle('is-out', n.status === 'out');
      ref.g.classList.toggle('is-lamp', n.status === 'lamp');
      ref.g.classList.toggle('is-unknown', n.status === 'ok' && !!n.pendingStatus);
      ref.g.classList.toggle('is-selected', state.selected === n);
      ref.glyph.textContent = n.status === 'out' ? '✕' : n.status === 'lamp' ? '!' : n.pendingStatus ? '?' : '';
      ref.g.setAttribute('aria-label', 'Light ' + n.id + ', ' + n.street.name + ': ' + statusText(n));
    });
    mapRefs.links.forEach(function (r) {
      var l = r.link;
      var bothAlive = l.a.hb && l.b.hb;
      r.line.classList.toggle('is-broken', bothAlive && !l.ok);
      r.line.classList.toggle('is-dead', !bothAlive);
      r.line.classList.remove('is-pinging');
      if (pinged && l.ok) {
        // restart the CSS animation
        void r.line.getBoundingClientRect();
        r.line.classList.add('is-pinging');
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Rendering: KPIs, tabs, inspector, incidents, table, log
   * ------------------------------------------------------------------ */
  function updateKpis(zone) {
    var nodes = allNodes(zone);
    var on = nodes.filter(function (n) {
      return n.status === 'ok' && n.hb && n.lamp;
    }).length;
    var incs = zoneIncidents(zone.def.id);
    var outs = 0,
      lamps = 0,
      links = 0;
    incs.forEach(function (i) {
      if (i.type === 'out' || i.type === 'segment') outs += i.nodes.length;
      else if (i.type === 'lamp') lamps += 1;
      else links += 1;
    });
    var reporting = nodes.filter(function (n) {
      return n.hb;
    });
    var avg = reporting.length
      ? reporting.reduce(function (a, n) {
          return a + n.battery;
        }, 0) / reporting.length
      : 0;
    $('kpi-online').textContent = String(on);
    $('kpi-online-sub').textContent = 'of ' + nodes.length + ' lights';
    $('kpi-out').textContent = String(outs);
    $('kpi-lamp').textContent = String(lamps);
    $('kpi-link').textContent = String(links);
    $('kpi-battery').textContent = Math.round(avg) + '%';
  }

  function updateBadges() {
    Object.keys(ZONES).forEach(function (zid) {
      var count = zoneIncidents(zid).filter(function (i) {
        return i.type !== 'link';
      }).length;
      var b = document.querySelector('[data-badge="' + zid + '"]');
      if (!b) return;
      b.textContent = String(count);
      b.classList.toggle('is-alert', count > 0);
    });
  }

  function updateInspector() {
    var n = state.selected;
    var dl = $('inspector');
    var empty = $('inspector-empty');
    $('break-selected-btn').disabled = !n;
    $('repair-selected-btn').disabled = !n;
    if (!n) {
      dl.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    dl.hidden = false;
    var s = findStreet(n);
    var left = n.idx > 0 ? s.links[n.idx - 1] : null;
    var right = n.idx < s.links.length ? s.links[n.idx] : null;
    var p = n.hb ? telemetry(n) : n.lastPacket;
    var rows = [
      ['Light', n.id],
      ['Street', n.street.name],
      ['Status', statusText(n)],
      ['Heartbeat', n.hb ? 'OK · ' + n.lastSeen : 'Missed · last ' + (n.lastSeen || 'n/a')],
      ['Left ping', left ? pingText(left, n) : 'Street end'],
      ['Right ping', right ? pingText(right, n) : 'Street end'],
      ['Battery', p ? p.battery_pct + '% · ' + p.battery_v + ' V' : 'n/a'],
      ['Lamp load', p ? p.load_ma + ' mA' : 'n/a'],
      ['Photodiode', p ? p.lamp_lux + ' lux' : 'n/a'],
      ['Panel', p ? p.panel_v + ' V (night)' : 'n/a'],
      ['Case', p ? (p.case_open ? 'OPEN' : 'Closed') + ' · tilt ' + p.tilt_deg + '°' : 'n/a'],
      ['Sun peak 3 d', n.history.day_peak_panel_ma.join(' / ') + ' mA']
    ];
    dl.replaceChildren();
    rows.forEach(function (r) {
      var d = el('div');
      d.appendChild(el('dt', null, r[0]));
      d.appendChild(el('dd', null, r[1]));
      dl.appendChild(d);
    });
  }

  function pingText(link, from) {
    var other = link.a === from ? link.b : link.a;
    if (link.ok) return '✓ ' + other.id + ' · ' + link.rssi + ' dBm';
    if (!other.hb) return other.id + ' silent';
    return '✕ ' + other.id + ' no reply';
  }

  function renderIncidents() {
    var list = $('incidents');
    var incs = zoneIncidents(state.active);
    list.replaceChildren();
    $('incidents-empty').hidden = incs.length > 0;
    $('incident-count').textContent = incs.length + ' open';
    incs.forEach(function (inc) {
      var li = el('li');
      var b = el('button', 'incident' + (inc.key === state.activeIncident ? ' is-active' : ''));
      b.type = 'button';
      var cls = inc.type === 'link' ? 'st-warn' : inc.type === 'lamp' ? 'st-serious' : 'st-critical';
      var icon = el('span', 'status-icon ' + cls);
      icon.setAttribute('aria-hidden', 'true');
      if (inc.type === 'link') icon.appendChild(el('span', null, '~'));
      else icon.textContent = inc.type === 'lamp' ? '!' : '✕';
      var mid = el('span');
      var label = inc.type === 'out' ? 'Outage' : inc.type === 'segment' ? 'Segment outage' : inc.type === 'lamp' ? 'Lamp fault' : 'Link fault';
      mid.appendChild(el('span', 'incident__title', label + ' · ' + idList(inc.nodes)));
      mid.appendChild(el('span', 'incident__sub', inc.street.name + ' · since ' + inc.openedAt + ' · ' + inc.diagnosis.likely_cause_label));
      b.appendChild(icon);
      b.appendChild(mid);
      b.appendChild(el('span', 'incident__state', inc.diagnosis.severity));
      b.addEventListener('click', function () {
        state.activeIncident = inc.key;
        showIncident(inc, false);
        renderIncidents();
      });
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  function renderTable(zone) {
    var details = $('table-details');
    if (!details.open) return;
    var body = $('node-table');
    body.replaceChildren();
    zone.streets.forEach(function (s) {
      s.nodes.forEach(function (n, i) {
        var tr = el('tr');
        var p = n.hb ? telemetry(n) : n.lastPacket;
        [
          n.id,
          s.def.name,
          statusText(n),
          p ? p.battery_pct + '%' : 'n/a',
          n.history.day_peak_panel_ma[2] ? round(n.history.day_peak_panel_ma[2] * 0.0184, 1) : '0',
          i > 0 ? (s.links[i - 1].ok ? 'OK' : 'Fail') : 'End',
          i < s.links.length ? (s.links[i].ok ? 'OK' : 'Fail') : 'End',
          n.hb ? 'OK' : 'Missed'
        ].forEach(function (v, ci) {
          var td = el('td', ci === 3 || ci === 4 ? 'num' : null, v);
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    });
  }

  var logBuffer = [];
  function log(zid, lvl, msg) {
    logBuffer.unshift({ t: clockText(), zid: zid, lvl: lvl, msg: msg });
    if (logBuffer.length > 200) logBuffer.pop();
    if (zid === state.active) prependLog(logBuffer[0]);
  }
  function prependLog(entry) {
    var ol = $('log');
    var li = el('li');
    li.appendChild(el('time', null, entry.t));
    li.appendChild(el('span', 'lvl lvl-' + entry.lvl, entry.lvl === 'ai' ? 'AI' : entry.lvl === 'crit' ? 'ALERT' : entry.lvl === 'warn' ? 'WARN' : 'OK'));
    li.appendChild(el('span', null, entry.msg));
    ol.insertBefore(li, ol.firstChild);
    while (ol.children.length > 60) ol.removeChild(ol.lastChild);
  }
  function renderLog() {
    var ol = $('log');
    ol.replaceChildren();
    logBuffer
      .filter(function (e) {
        return e.zid === state.active;
      })
      .slice(0, 60)
      .reverse()
      .forEach(prependLog);
  }

  /* ------------------------------------------------------------------ *
   * AI panel
   * ------------------------------------------------------------------ */
  function clearAi() {
    stopTyping();
    $('ai-empty').hidden = false;
    $('email').hidden = true;
    $('diag-details').hidden = true;
    $('prompt-details').hidden = true;
    $('ai-meta').replaceChildren();
  }

  function stopTyping() {
    if (state.typingTimer) {
      clearTimeout(state.typingTimer);
      state.typingTimer = null;
    }
    $('email-body').classList.remove('is-typing');
  }

  function showIncident(inc, animate) {
    stopTyping();
    $('ai-empty').hidden = true;
    $('email').hidden = false;
    $('diag-details').hidden = false;
    $('prompt-details').hidden = false;

    var meta = $('ai-meta');
    meta.replaceChildren();
    meta.appendChild(el('span', 'tag tag--purple', MODEL));
    meta.appendChild(el('span', 'tag', inc.diagnosis.severity));
    meta.appendChild(el('span', 'tag', Math.round(inc.diagnosis.confidence * 100) + '% · ' + inc.diagnosis.likely_cause_label));

    $('email-to').textContent = inc.email.to;
    $('email-from').textContent = inc.email.from;
    $('email-subject').textContent = inc.email.subject;
    $('diag-json').textContent = JSON.stringify(inc.diagnosis, null, 2);
    $('prompt-text').textContent = inc.prompt;

    var body = $('email-body');
    var text = inc.email.body;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduce) {
      body.textContent = text;
      return;
    }
    body.textContent = '';
    body.classList.add('is-typing');
    var i = 0;
    function step() {
      i = Math.min(text.length, i + 6);
      body.textContent = text.slice(0, i);
      if (i < text.length) state.typingTimer = setTimeout(step, 14);
      else stopTyping();
    }
    step();
  }

  /* ------------------------------------------------------------------ *
   * Interaction
   * ------------------------------------------------------------------ */
  function selectNode(n) {
    state.selected = state.selected === n ? null : n;
    updateMap(state.zones[state.active], false);
    updateInspector();
    var inc = zoneIncidents(state.active).filter(function (i) {
      return i.nodes.indexOf(n) !== -1;
    })[0];
    if (inc && state.selected) {
      state.activeIncident = inc.key;
      showIncident(inc, false);
      renderIncidents();
    }
  }

  function toggleLink(zone, l) {
    if (l.blocked) {
      l.blocked = false;
      l.rssi = round(between(-100, -86));
      log(zone.def.id, 'ok', 'Operator cleared obstruction on ' + l.a.id + '↔' + l.b.id + '.');
    } else {
      blockLink(l);
      log(zone.def.id, 'warn', 'Simulated obstruction on link ' + l.a.id + '↔' + l.b.id + '.');
    }
    refresh(false);
  }

  function selectZone(zid) {
    state.active = zid;
    state.selected = null;
    document.querySelectorAll('.tab').forEach(function (t) {
      var on = t.getAttribute('data-zone') === zid;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on) $('zone-panel').setAttribute('aria-labelledby', t.id);
    });
    var z = state.zones[zid];
    $('zone-title').textContent = z.def.title;
    $('zone-sub').textContent = z.def.place + ' · fixer: ' + z.def.fixer.name;
    renderMap(z);
    renderLog();
    var first = zoneIncidents(zid)[0];
    state.activeIncident = first ? first.key : null;
    if (first) showIncident(first, false);
    else clearAi();
    refresh(false);
  }

  function refresh(pinged) {
    var z = state.zones[state.active];
    updateMap(z, pinged);
    updateKpis(z);
    updateBadges();
    updateInspector();
    renderIncidents();
    renderTable(z);
    $('clock').textContent = 'Local ' + clockText();
  }

  function tick() {
    if (state.paused || document.hidden) return;
    tickCount += 1;
    advanceClock();
    var auto = $('auto-events').checked;
    Object.keys(state.zones).forEach(function (zid) {
      var zone = state.zones[zid];
      if (auto) autoEvents(zone);
      runPings(zone);
      reconcile(zone);
    });
    refresh(true);
  }

  function autoEvents(zone) {
    // the local fixer "completes" old repairs
    zoneIncidents(zone.def.id).forEach(function (inc) {
      if (tickCount - inc.openedTick < AUTO_REPAIR_AFTER) return;
      if (inc.type === 'link') {
        inc.link.blocked = false;
        inc.link.rssi = round(between(-100, -86));
        log(zone.def.id, 'ok', 'Obstruction between ' + inc.nodes[0].id + ' and ' + inc.nodes[1].id + ' cleared.');
      } else {
        inc.nodes.forEach(repairNode);
        log(zone.def.id, 'ok', zone.def.fixer.name + ' reports ' + idList(inc.nodes) + ' repaired. Waiting for neighbour confirmation…');
      }
    });
    // occasional spontaneous fault, staggered per zone
    var offset = { refugee: 0, education: 5, healthcare: 10 }[zone.def.id] || 0;
    if ((tickCount + offset) % AUTO_FAULT_EVERY === 0 && rand() < 0.75) {
      var open = zoneIncidents(zone.def.id).length;
      if (open < 4) {
        var what = breakRandom(zone, 'auto');
        if (what) log(zone.def.id, 'warn', 'Anomaly: ' + what + ' stopped behaving normally. Checking neighbours…');
      }
    }
  }

  function bindUi() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        selectZone(t.getAttribute('data-zone'));
      });
      t.addEventListener('keydown', function (e) {
        var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var next = tabs[(i + dir + tabs.length) % tabs.length];
        next.focus();
        selectZone(next.getAttribute('data-zone'));
      });
    });

    $('break-btn').addEventListener('click', function () {
      var zone = state.zones[state.active];
      var type = $('fault-type').value;
      var what = breakRandom(zone, type);
      if (what) log(zone.def.id, 'warn', 'Operator simulated ' + (type === 'auto' ? 'a random fault' : FAULTS[type].label.toLowerCase()) + ' on ' + what + '.');
      else log(zone.def.id, 'warn', 'No healthy target left for that fault.');
      refresh(false);
    });

    $('repair-all-btn').addEventListener('click', function () {
      var zone = state.zones[state.active];
      allNodes(zone).forEach(repairNode);
      zone.streets.forEach(function (s) {
        s.links.forEach(function (l) {
          l.blocked = false;
        });
      });
      log(zone.def.id, 'ok', 'Operator: all lights and links in zone repaired. Neighbours re-checking…');
      refresh(false);
    });

    $('break-selected-btn').addEventListener('click', function () {
      var n = state.selected;
      if (!n) return;
      var type = $('fault-type').value;
      var zone = state.zones[state.active];
      if (type === 'link') {
        var s = findStreet(n);
        var l = s.links[n.idx] || s.links[n.idx - 1];
        if (l) blockLink(l);
        log(zone.def.id, 'warn', 'Operator obstructed a link at ' + n.id + '.');
      } else {
        if (type === 'auto') type = pick(NODE_FAULTS);
        applyFault(n, type);
        log(zone.def.id, 'warn', 'Operator simulated ' + FAULTS[type].label.toLowerCase() + ' on ' + n.id + '.');
      }
      refresh(false);
    });

    $('repair-selected-btn').addEventListener('click', function () {
      var n = state.selected;
      if (!n) return;
      repairNode(n);
      var s = findStreet(n);
      if (s.links[n.idx]) s.links[n.idx].blocked = false;
      if (s.links[n.idx - 1]) s.links[n.idx - 1].blocked = false;
      log(n.zone, 'ok', 'Operator repaired ' + n.id + '. Neighbours re-checking…');
      refresh(false);
    });

    $('pause-btn').addEventListener('click', function () {
      state.paused = !state.paused;
      $('pause-btn').setAttribute('aria-pressed', state.paused ? 'true' : 'false');
      $('pause-btn').textContent = state.paused ? 'Resume' : 'Pause';
    });

    $('table-details').addEventListener('toggle', function () {
      renderTable(state.zones[state.active]);
    });
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  function init() {
    Object.keys(ZONES).forEach(function (zid) {
      state.zones[zid] = buildZone(ZONES[zid]);
    });

    // seed a realistic starting picture in each zone
    var r = state.zones.refugee;
    applyFault(r.streets[0].nodes[3], 'panel');
    blockLink(r.streets[2].links[2]);
    var e = state.zones.education;
    applyFault(e.streets[1].nodes[4], 'led');
    applyFault(e.streets[0].nodes[8], 'battery');
    var h = state.zones.healthcare;
    applyFault(h.streets[1].nodes[2], 'vandal');
    applyFault(h.streets[1].nodes[3], 'vandal');
    applyFault(h.streets[0].nodes[5], 'radio');

    Object.keys(state.zones).forEach(function (zid) {
      log(zid, 'ok', 'Gateway ' + GATEWAY + ' online. ' + allNodes(state.zones[zid]).length + ' lights registered, ' + MODEL + ' loaded (offline).');
    });
    // warm-up ticks so the seeded faults are confirmed before first paint
    for (var i = 0; i < CONFIRM_TICKS; i++) {
      tickCount += 1;
      Object.keys(state.zones).forEach(function (zid) {
        runPings(state.zones[zid]);
        reconcile(state.zones[zid]);
      });
    }

    bindUi();
    var fromHash = window.location.hash.slice(1);
    selectZone(Object.prototype.hasOwnProperty.call(ZONES, fromHash) ? fromHash : 'refugee');
    setInterval(tick, TICK_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
