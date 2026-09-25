<!-- HIMGAURAV repository overview -->
<p align="center">
  <img src="assets/himgaurav-mark.svg" width="88" alt="HIMGAURAV logo">
</p>

<h1 align="center">HIMGAURAV</h1>

<p align="center">
  <strong>Satellite–IoT Integrated Landslide Intelligence, Early Warning & Rescue Research Platform</strong><br>
  Built for Himalayan terrain · Himachal Pradesh, India
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-7.0-0D4853">
  <img alt="Status" src="https://img.shields.io/badge/status-research%20prototype-D85A2A">
  <img alt="Region" src="https://img.shields.io/badge/region-Himachal%20Pradesh-2E7D32">
  <img alt="Data truth" src="https://img.shields.io/badge/data-no%20fake%20live%20values-334155">
</p>

---

## What is HIMGAURAV?

**HIMGAURAV** is a research prototype for landslide monitoring and decision support that combines **Earth observation, rainfall intelligence, field IoT sensing, geospatial analysis, multilingual alert preparation, and post-event rescue research** in one transparent platform.

The idea is simple:

> **Observe broadly with satellites, understand the trigger with weather, verify locally with sensors, and present the evidence together before a decision is made.**

HIMGAURAV is intentionally not an opaque “AI risk percentage” dashboard. Each visible value carries its provenance, and missing data is allowed to remain missing.

---

## Why this project exists

Himalayan landslide monitoring is difficult because no single data source is enough.

- **Satellite imagery** covers large areas but is not a continuous slope sensor.
- **Weather models** provide valuable rainfall context but are not local rain gauges.
- **Field sensors** provide local ground truth but only where hardware is installed.
- **Warnings** need evidence, clear language, geo-targeting, and authorised dissemination.
- **Post-event rescue** has a different problem entirely: finding people in saturated debris is still poorly characterised for low-cost phone-based methods.

HIMGAURAV brings those layers into one evidence-first workflow.

---

## System architecture

~~~mermaid
flowchart LR
    EO["Satellite / Earth Observation"] --> FUSION["HIMGAURAV Evidence Layer"]
    WX["Rainfall history + forecast"] --> FUSION
    IOT["ESP32 / LoRa field nodes"] --> FUSION
    REPORTS["Local reports"] --> FUSION

    FUSION --> STATE["NORMAL · MONITOR · WATCH · WARNING"]
    STATE --> ALERT["Multilingual Alert Centre"]
    ALERT --> LOCAL["Browser / Voice / Local Gateway"]
    ALERT --> CAP["CAP 1.2 Draft / Exercise"]
    CAP --> AUTH["Authorised external warning infrastructure"]

    INCIDENT["Post-event incident"] --> ACU["AcuSearch research lab"]
    ACU --> TEST["RF / acoustic soil-pit experiments"]
~~~

Detailed architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Main workspaces

| Workspace | What it does | Data status |
|---|---|---|
| **Command** | Geospatial situation view, monitored sites, state, rainfall, map overlays and evidence inspection | Live / model / derived / reference |
| **Satellite** | Dated Earth-observation imagery around monitored locations | Real dated EO imagery |
| **Nodes** | ESP32 / ThingSpeak telemetry, inclination, soil moisture, rainfall input, battery and RSSI | Sensor when connected |
| **Events** | Chronological record of state changes, source updates and operator actions | Session / local log |
| **Alerts** | 23-language alert composition, readiness gate, CAP export, local notification and drill outputs | Local + configurable connectors |
| **AcuSearch** | Measurement-first rescue research for phone/RF/acoustic propagation through landslide soil | Experimental |
| **System** | Methods, sources, limitations, provenance and integration status | Reference |

---

## 1. Geospatial Command Centre

The Command screen is the operational overview.

It brings together:

- monitored slope location,
- current screening state,
- rainfall accumulation,
- rainfall threshold evidence,
- field-node availability,
- satellite / terrain context,
- radar and seismic overlays when actually available,
- forecast trend,
- local reports,
- evidence age and provenance.

Generic town or district coordinates remain **REGIONAL context points** and are not allowed to become slope WATCH/WARNING states.

---

## 2. Satellite Intelligence

The Satellite workspace is an independent Earth-observation layer rather than a decorative map.

Current prototype support includes real dated products such as:

- **HLS Sentinel-2 surface reflectance**,
- **Suomi NPP VIIRS true colour**,
- **VIIRS false colour**,
- **MODIS Terra true colour**.

The interface exposes the image date, product identity, monitored-site position and acquisition limitations.

**Sentinel-1 / InSAR is not fabricated.** It remains a future/authenticated processing path until an actual deformation workflow exists.

---

## 3. Rainfall intelligence

Rainfall is treated as a trigger-screening input, not as proof that a landslide will occur.

The prototype retains the published Shimla intensity–duration relation used by the audited build:

~~~text
I = 7.20 × D^-0.26
~~~

Durations evaluated:

**1, 2, 3, 5, 7 and 10 days**

The application also keeps a 30-day antecedent rainfall reference.

### Screening states

| State | Meaning |
|---|---|
| **NORMAL** | Tested rainfall durations remain below the screening threshold |
| **MONITOR** | Rainfall has entered the historical threshold band |
| **WATCH** | Stronger rainfall evidence / antecedent condition deserves close inspection |
| **WARNING** | WATCH plus sustained same-slope inclination anomaly from a connected field node |
| **NO DATA** | Rainfall is unavailable, too stale or too incomplete |
| **REGIONAL** | Geographic context only; not treated as an instrumented slope |

A threshold exceedance is a **screening condition, not a deterministic landslide prediction**.

---

## 4. Field IoT nodes

The field-node concept is designed around:

- **ESP32**
- **MPU6500 / inclination sensing**
- **capacitive soil moisture**
- **rainfall input**
- **LoRa SX1278 communication**
- **ThingSpeak / cloud telemetry**
- **battery and RSSI / link health**

A typical path is:

~~~text
Slope sensors → ESP32 → LoRa → Gateway ESP32 → Internet / ThingSpeak → HIMGAURAV
~~~

Only the currently defined sustained inclination anomaly is permitted to corroborate WATCH into WARNING. Soil moisture, rainfall detector, RSSI and battery remain visible evidence/health channels rather than being silently converted into an unvalidated risk score.

---

## 5. Multilingual Alert Centre

The Alert Centre is designed around a simple rule:

> A visible READY feature must actually execute on the operator device.

### Working local features

- English + **all 22 Scheduled Languages of India** using local structured alert templates
- right-to-left handling for Urdu, Kashmiri and Sindhi
- one-click **23-language alert pack**
- operator editing and review state
- citizen-facing live preview
- browser notification
- browser/OS speech only when a matching voice exists
- local drill siren
- structured JSON export
- **CAP 1.2 XML export**
- operator-selected 1 / 3 / 5 / 10 km communication circle
- alert audit trail

### Alert Readiness Gate

Before stronger warning language is prepared, the interface visibly checks:

1. LIVE vs DEMO provenance
2. operational slope vs regional context
3. rainfall freshness
4. WATCH / WARNING evidence state
5. same-slope sensor corroboration
6. language/message availability

The communication radius is **not** presented as a landslide run-out model.

Official NDMA SACHET / telecom Cell Broadcast remains external authorised infrastructure; this repository does not contain or claim government publishing credentials.

---

## 6. AcuSearch

**AcuSearch is the post-landslide research component of HIMGAURAV.**

It does **not** claim that a browser can already locate a buried survivor.

The research question comes first:

> Can Wi-Fi, Bluetooth or audible phone signals remain detectable through realistic dry, damp and water-saturated landslide soil at useful depths and distances?

The working AcuSearch Lab includes:

- soil-pit experiment logger,
- Wi-Fi / BLE / acoustic / wired-control modalities,
- burial depth and soil-condition protocol,
- detected / not-detected outcomes,
- optional RSSI or browser dBFS measurement,
- Web Audio 1–3 kHz tone generator,
- browser microphone meter,
- detection-vs-distance visualisation,
- protocol coverage matrix,
- CSV export and import.

Results are reported as **observations from tested conditions**, never as an invented victim-detection range.

Research dossier: [docs/ACUSEARCH-RESEARCH.md](docs/ACUSEARCH-RESEARCH.md)

---

## Data-truth contract

HIMGAURAV deliberately separates different kinds of information.

| Label | Meaning |
|---|---|
| **LIVE** | Retrieved from a named source during the current session |
| **SENSOR** | Received from a connected field instrument |
| **MODEL / FORECAST** | Numerical weather-model information |
| **DERIVED** | Calculated by HIMGAURAV from stated inputs |
| **RECENT** | Real data that is not instantaneous |
| **REFERENCE** | Static cited scientific / system information |
| **CACHED** | Previously retrieved data retained with age visible |
| **DEMO / SIMULATED** | Scripted presentation scenario only |
| **EXPERIMENTAL** | Real method under research, not validated operational warning |
| **NO DATA** | Reliable data is currently unavailable |

**Missing data is never converted into “safe”.**

---

## External data and integration sources

| Source / service | Role |
|---|---|
| **Open-Meteo** | Modelled precipitation history, current conditions and forecast |
| **NASA EOSDIS GIBS** | Dated Earth-observation imagery |
| **USGS FDSN** | Regional earthquake catalogue context |
| **RainViewer** | Optional recent weather-radar overlay where available |
| **OpenStreetMap / OpenTopoMap** | Geographic / topographic context |
| **ThingSpeak** | Field-node telemetry |
| **Copernicus Data Space** | Documented Sentinel processing integration path |
| **NDMA SACHET / CAP ecosystem** | External authorised public-warning context |

Source audit: [docs/SOURCE-AUDIT.md](docs/SOURCE-AUDIT.md)

---

## Run locally

### Windows

~~~powershell
START-HIMGAURAV.bat
~~~

### macOS / Linux

~~~bash
./start-himgaurav.sh
~~~

or:

~~~bash
python3 serve.py
~~~

Then open:

**http://127.0.0.1:8807/**

Useful direct routes:

- Command: /#command
- Satellite: /#satellite
- Alerts: /#alerts
- AcuSearch: /#rescue

Do not rely on double-clicking index.html for the complete LIVE workflow because the local gateway provides same-origin API adapters and keeps private integration credentials out of browser JavaScript.

---

## Repository structure

~~~text
HIMGAURAV/
├── index.html
├── app.js
├── styles.css
├── alert-locales.js
├── map-loader.js
├── config.js
├── config.example.js
├── serve.py
├── package.json
├── assets/
│   └── himgaurav-mark.svg
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ACUSEARCH-RESEARCH.md
│   ├── ALERTING-RESEARCH.md
│   └── SOURCE-AUDIT.md
├── tools/
│   └── local_alert_gateway.py
├── .env.example
├── .gitignore
├── TEST-REPORT.md
└── README.md
~~~

---

## Configuration & secret handling

This repository is **public**.

Never commit:

- .env
- private ThingSpeak read/write keys
- webhook bearer tokens
- OAuth client secrets
- government / agency credentials
- personal API keys
- local alert receiver logs

Copy .env.example to .env on your own machine and fill only the integrations you actually use.

The repository intentionally contains placeholders only.

---

## GitHub → Vercel

The repository is now organised cleanly for source control.

The current v7 backend uses a local Python gateway for some API proxying and private configuration. Before treating a Vercel deployment as production-equivalent, those server routes should be converted to Vercel serverless /api/* functions and secrets should be added through **Vercel Environment Variables**, never committed to GitHub.

---

## Research and operational boundary

HIMGAURAV is a **research and decision-support prototype**, not a certified life-safety warning system.

A real deployment would require:

- calibrated site-specific instrumentation,
- multiple redundant slope nodes,
- validated local rainfall / geotechnical models,
- resilient power and communications,
- edge processing and local siren capability,
- trained operators,
- field trials,
- authority approval,
- integration with official disaster-warning infrastructure.

The project deliberately keeps those boundaries visible rather than hiding them behind impressive-looking graphics.

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [AcuSearch research dossier](docs/ACUSEARCH-RESEARCH.md)
- [Alerting research rationale](docs/ALERTING-RESEARCH.md)
- [External source audit](docs/SOURCE-AUDIT.md)
- [Validation / test report](TEST-REPORT.md)

---

## 30-second explanation

> **HIMGAURAV is a Satellite–IoT landslide intelligence platform for Himachal Pradesh. Satellite imagery provides wide-area context, rainfall analysis identifies triggering conditions, field nodes provide slope-level ground truth, and the dashboard fuses that evidence into transparent screening states and multilingual alert preparation. If a failure occurs, the AcuSearch module studies whether low-cost phone signals can physically propagate through saturated landslide soil before making any victim-location claim.**

---

<p align="center">
  <strong>Truth over impressiveness · Evidence over opaque scores · Function over decoration</strong>
</p>
