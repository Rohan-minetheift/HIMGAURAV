# HIMGAURAV v7.0 — Satellite + IoT + Working Alerts + AcuSearch Lab

**Build check:** the header must show **`v7.0 · ACUSEARCH LAB`** and the left rail must show:

`Command → Satellite → Nodes → Events → Alerts → AcuSearch → System`

Direct AcuSearch Lab: `http://127.0.0.1:8807/#rescue`  
Direct Alert Centre: `http://127.0.0.1:8807/#alerts`

HIMGAURAV is a research prototype for **Satellite–IoT integrated landslide screening, field sensing and last-mile alert preparation for Himachal Pradesh**. v7 keeps the existing data-truth rules: no fake live readings, no synthetic satellite images, no fabricated public-warning connection, and no opaque “AI landslide probability”.

## Start it correctly

### Windows

1. Extract the ZIP into a new folder.
2. Double-click **`START-HIMGAURAV.bat`**.
3. The browser opens the v7 AcuSearch Lab at `http://127.0.0.1:8807/#rescue`.

### macOS / Linux

```bash
./start-himgaurav.sh
```

or:

```bash
python3 serve.py
```

Do **not** rely on double-clicking `index.html` for LIVE operation. `serve.py` is intentionally part of the application: it keeps private credentials out of browser JavaScript and provides same-origin adapters for the live integrations.

---

## Working AcuSearch research lab

AcuSearch is implemented as a **measurement-first rescue research workspace**, not a victim detector. The attached first-principles dossier identifies the real gap as a missing link-budget characterisation for phone-band RF and acoustic signals in water-saturated landslide soil. The application therefore measures and records what can actually be tested instead of inventing a rescue range.

### What works locally

- **Soil-pit experiment logger** for Wi-Fi, BLE, 1–3 kHz audible tone and a wired contact-microphone/piezo control.
- Fixed burial-depth protocol points at 0, 0.3, 0.6, 1.0, 1.5 and 2.0 m.
- Dry, damp and saturated-soil conditions.
- Lateral distance, detected / no-signal outcome, replicate number, optional RSSI or browser dBFS metric and field notes.
- **Working acoustic test bench** using Web Audio: 1, 2 or 3 kHz sine tone plus adjustable low output level.
- **Working microphone meter** using browser microphone permission on localhost. It reports approximate dBFS and peak level; it is not calibrated SPL.
- One-click transfer of the current microphone dBFS reading into the experiment log.
- Filterable detection-vs-distance chart, trial summary and protocol-coverage matrix.
- CSV export and re-import of AcuSearch measurements.
- All measurements remain local in browser storage unless the operator exports them.
- A field-reality panel keeps proven USAR methods separate from the unverified phone-in-saturated-soil hypothesis.
- The full research rationale is packaged at `docs/ACUSEARCH-RESEARCH.md`.

### What AcuSearch deliberately does **not** claim

- no survivor detection,
- no phone detection range in landslide mud,
- no UWB / Wi-Fi / BLE range extrapolated from rubble,
- no rescue probability,
- no AI victim classifier,
- no claim that a negative trial means all rescue technology fails.

The result can legitimately be **“this modality is unusable under the tested soil condition.”** That is a valid research result and is stronger than a fabricated demo.

---

## What v7 retains in the Alert Centre

The v5 alert page depended too heavily on an optional cloud translation connector. That meant the language selector could look complete while translation failed on a normal machine with no credentials. v6 removes that dependency from the core workflow.

### 1. 23 languages now work locally

The alert composer includes **English + all 22 Scheduled Languages of India** as built-in operational templates. Selecting a language immediately produces a localized alert from the current HIMGAURAV evidence state. No BHASHINI key, external translation API, login, or network request is required.

The local template engine translates the structured alert parts that HIMGAURAV actually controls:

- state-specific headline,
- rainfall-threshold situation wording,
- ground-confirmation wording,
- decision-support disclaimer,
- protective action.

Dynamic site names, threshold ratios and durations are inserted locally. Urdu, Kashmiri and Sindhi fields switch to right-to-left layout automatically.

These templates are **prototype operational translations, not certified government wording**. The operator can edit any language and press **Save reviewed edits**; reviewed text is marked separately and is preserved in the multilingual CAP package.

### 2. One-click 23-language alert pack

**Build 23-language pack** generates every language block from the same current evidence state. The Language Coverage panel shows which languages are:

- not yet generated,
- generated from the local template,
- operator-reviewed.

Only generated language blocks are placed into CAP export, so the file never pretends that an unavailable translation exists.

### 3. Alert preview that shows what a person will actually read

The Alert Centre now has a dedicated live preview card. It updates while the operator:

- changes language,
- edits text,
- changes the target radius,
- switches sites,
- regenerates from current evidence.

The preview carries the actual HIMGAURAV state and is separate from the scientific evidence panel so the operator can judge both the evidence and the public-facing wording.

### 4. Capability-aware local outputs

The main alert page only presents core features that can genuinely execute on the operator device:

- **Browser notification** — uses the browser's real permission system on localhost.
- **Read aloud** — enabled only if the browser/OS has a matching voice for the selected language. If no voice is installed, the button is disabled and the interface says so.
- **Local drill siren** — Web Audio test pattern triggered by an operator click.
- **CAP 1.2 XML** — real local file export with multilingual `<info>` blocks and a geographic circle.
- **Copy alert text** — clipboard copy with a compatibility fallback.
- **Structured JSON** — downloadable machine-readable draft for testing/integration.

No feature is labelled READY merely because the UI has a button.

### 5. Evidence-to-alert readiness gate

The gate checks six visible conditions:

1. evidence mode is LIVE rather than scripted DEMO,
2. the selected point is an operational slope rather than a regional context point,
3. rainfall data is fresh enough,
4. the site has reached a screening level that justifies stronger wording,
5. an independent same-slope ground signal is or is not present,
6. the local language engine is available.

WATCH can therefore produce a screening draft while still showing that ground movement is unconfirmed. WARNING remains tied to the existing HIMGAURAV state logic rather than being created by the alert page.

### 6. Geo-targeting remains honest

The operator may select a 1, 3, 5 or 10 km communication circle and preview it on the Command map. The application explicitly labels this as an **operator-selected communication target**, not a landslide run-out or impact model.

### 7. Optional external connectors are hidden until real

Agency webhook, local gateway/LoRa bridge and read-only SACHET reference feed are moved into **Optional Integrations**. Their action cards stay hidden unless the local server reports that a real endpoint is configured in `.env`.

The core alert workflow does **not** depend on these connectors.

NDMA SACHET / telecom Cell Broadcast remains authoritative external infrastructure. HIMGAURAV does not claim publishing rights.

## Alert settings

Open **Alerts → Settings**. The panel controls:

- default language,
- default communication radius,
- browser speech rate,
- automatic internal-draft threshold,
- browser notification preference,
- automatic WARNING speech only when a matching voice actually exists,
- high-contrast presentation.

It also reports the current browser's notification and speech capabilities and shows optional connector status without pretending they are active.

## Optional external integrations

These are not required for the working v7 alert centre. Configure them only when you own or are authorised to use the endpoint.

### Controlled agency/test webhook

```env
ALERT_WEBHOOK_URL=https://your-authorised-endpoint.example/alerts
ALERT_WEBHOOK_TOKEN=optional-bearer-token
```

### Local siren / LoRa / Node-RED gateway

```env
LOCAL_GATEWAY_WEBHOOK_URL=http://127.0.0.1:8890/alert
LOCAL_GATEWAY_WEBHOOK_TOKEN=optional-token
```

The repository includes `tools/local_alert_gateway.py` for a local integration test.

### Read-only official SACHET reference

```env
SACHET_CAP_FEED_URL=https://authorised-or-provided-feed.example/cap.xml
```

or an agency-provided identifier supported by the local gateway. This is read-only and never changes HIMGAURAV's own slope state.

## Existing Satellite + IoT system retained

### Satellite Intelligence

The Satellite workspace retains actual dated NASA GIBS Earth-observation products:

- HLS Sentinel-2 surface reflectance (30 m),
- Suomi NPP VIIRS true colour,
- VIIRS false colour,
- MODIS Terra true colour.

Imagery is dated Earth observation, not a continuous live camera. Cloud/acquisition gaps remain visible. Sentinel-1/InSAR remains an authenticated/future processing integration rather than a fabricated displacement layer.

### Rainfall intelligence

Open-Meteo supplies numerical weather-model precipitation/history/forecast data. It is not presented as an IMD rain gauge. The existing Shimla intensity-duration screening relation is retained:

```text
I = 7.20 × D^-0.26
```

with 1, 2, 3, 5, 7 and 10-day durations and a 30-day / 110 mm antecedent reference.

### Site-state rules

For actual monitored slope points:

1. **NORMAL** — tested rainfall durations below the threshold curve.
2. **MONITOR** — rainfall enters the threshold band but not strongly.
3. **WATCH** — threshold exceedance plus peak ratio ≥ 2× or antecedent 30-day rainfall ≥ 110 mm.
4. **WARNING** — WATCH plus sustained same-slope inclination anomaly from a connected field node.
5. **NO DATA** — rainfall unavailable, too stale or too incomplete.

Generic town/district points remain **REGIONAL** context only and cannot become slope WATCH/WARNING.

### Ground node

ThingSpeak can carry real ESP32/field-node values for:

- inclination/tilt,
- capacitive soil moisture,
- rainfall detector/input,
- battery,
- RSSI/link metric.

Only the defined sustained inclination anomaly currently corroborates WATCH into WARNING. The other raw sensor fields are not silently turned into an unvalidated risk score.

---

## Connect a private ThingSpeak channel

In `.env`:

```env
THINGSPEAK_CHANNEL_ID=1234567
THINGSPEAK_READ_KEY=YOUR_PRIVATE_READ_KEY
```

Public ThingSpeak channels can be configured from the Nodes screen without a read key. Never put a ThingSpeak write key in frontend code.

---

## LIVE vs DEMO

**LIVE** uses actual available external services and connected telemetry. Failed or stale sources show failure/staleness rather than being replaced with random values.

**DEMO** is deterministic scripted data used to demonstrate state progression. Real radar/seismic evidence is removed/disabled in DEMO. Alert exports in DEMO use CAP **Exercise** lifecycle semantics.

---

## Files

- `index.html` — app shell including Satellite, Alerts and AcuSearch workspaces
- `styles.css` — responsive UI + alert accessibility states
- `app.js` — maps, satellite, LIVE/DEMO, sensor analysis, CAP composer, readiness gate, AcuSearch lab and audit
- `serve.py` — local server + restricted API/connector gateway
- `.env.example` — private server-side configuration template
- `config.js` / `config.example.js` — non-secret browser defaults
- `map-loader.js` — resilient Leaflet loader
- `docs/SOURCE-AUDIT.md` — existing source/integration audit
- `docs/ALERTING-RESEARCH.md` — alert-system research and rationale
- `docs/ACUSEARCH-RESEARCH.md` — first-principles survivor-location research dossier and experiment rationale
- `TEST-REPORT.md` — local validation results and limitations
- `legacy-audit.html` — untouched earlier audited prototype

---

## Safety / operational limitation

HIMGAURAV remains a **research and decision-support prototype**, not an authorised public-warning authority. Real operational warning requires validated local sensing, redundancy, calibrated site-specific models, trained operators, emergency procedures, reliable power/comms, authority approval, and integration with official dissemination infrastructure. v7 keeps that boundary visible in the product instead of hiding it.

## Prove the local last-mile handoff on your own laptop

A tiny real webhook receiver is included at `tools/local_alert_gateway.py` so you can demonstrate that the Alert Centre is actually sending a packet rather than changing a UI badge.

Terminal 1:

```bash
python tools/local_alert_gateway.py
```

In `.env`:

```env
LOCAL_GATEWAY_WEBHOOK_URL=http://127.0.0.1:8899/himgaurav-alert
```

Restart HIMGAURAV, open **Alerts**, and click **Send test packet**. The gateway returns an acknowledgement and appends the received packet to `alerts-received.jsonl`.

That receiver is a development bridge only. In a field deployment its endpoint would be replaced by an authenticated Node-RED / edge-computer / LoRa / siren controller workflow with hardware acknowledgement and fail-safe logic.
