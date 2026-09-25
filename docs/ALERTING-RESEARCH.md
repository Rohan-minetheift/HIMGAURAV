# HIMGAURAV v5 — Alerting research & design rationale

Research checked on **18 Sep 2026**. This document explains why the new Alert Centre is built around CAP, geo-targeting, multilingual message blocks, operator review, local channels and an authority handoff rather than a fake “send public alert” button.

## 1. India's real public-warning architecture

### NDMA SACHET

Official portal: https://sachet.ndma.gov.in/

NDMA describes SACHET as a **CAP-based Integrated Alert System** for pan-India near-real-time, geo-targeted, multilingual alerting. This is the relevant national architecture for an Indian disaster-warning project.

The public SACHET mobile experience includes location/subscription-based alerts and multilingual presentation/read-out. HIMGAURAV therefore treats multilingual output as an operational requirement, not decoration.

### C-DOT CAP Integrated Alert System

Official product page: https://www.cdot.in/cdotweb/web/product_page.php?catId=9&lang=en&pId=49

C-DOT describes the national platform as geo-intelligent, multilingual, multi-hazard and multi-media, with dissemination technologies including **SMS, Cell Broadcast, mobile app, TV, radio, social media, RSS, browser notification and satellite**.

HIMGAURAV mirrors that architecture at prototype scale:

`evidence → readiness gate → multilingual CAP draft → local/test channels → authorised authority handoff`

It does not claim access to government telecom rails.

### Cell Broadcast

Official 2026 government information:

- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2256706
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2257499
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2290380

India's 2026 Cell Broadcast rollout/testing is integrated with the CAP/SACHET ecosystem and is intended for near-real-time, geo-targeted multilingual emergency messaging. That does **not** imply that an unauthorised student web app can publish to Cell Broadcast.

### Read-only official CAP feed

SACHET's agency integration guide requires ETag-aware CAP XML consumption (`200` for new/changed content and `304 Not Modified` to reuse cached XML). v5 implements an optional read-only connector that follows this rule when an agency-provided identifier/feed URL is configured. It is deliberately separate from HIMGAURAV state and cannot publish alerts.

Official guide: https://sachet.ndma.gov.in/docs/Integration_Guide_For_Agencies.pdf

## 2. Common Alerting Protocol (CAP 1.2)

ITU reference: https://www.itu.int/rec/T-REC-X.1303bis-201403-I/en

CAP is a general all-hazard warning-message format designed so one consistent alert can be carried over different warning systems. CAP supports multiple language-specific information blocks and geographic target areas including circles/polygons.

HIMGAURAV exports CAP 1.2 because it is an interoperability artefact that a real downstream system can inspect, validate or transform. It is superior to a proprietary JSON-only “alert” object for authority handoff.

HIMGAURAV deliberately uses:

- `Draft` status for LIVE research workflow,
- `Exercise` status for DEMO/drills,
- one `<info>` block per saved language,
- a geo-target circle,
- translation provenance,
- evidence parameters and data age.

It does not create an `Actual` public-warning lifecycle claim by itself.

## 3. Multilingual architecture — BHASHINI

Official developer documentation:

- https://bhashini-developer-portal-dev.bhashini.co.in/docs/api/overview
- https://bhashini-developer-portal-dev.bhashini.co.in/docs/api/playground
- https://dibd-bhashini.gitbook.io/bhashini-apis/available-models-for-usage

BHASHINI/Dhruva provides authenticated translation and TTS pipelines for Indian languages. The inference API key belongs server-side, so HIMGAURAV calls it through `serve.py` rather than exposing the token in JavaScript.

The language selector covers English plus the **22 Scheduled Languages**. The default translation service in `.env.example` is `bhashini/iiith/nmt-all` because the published BHASHINI model catalogue lists broad source/target support including the scheduled-language set. The service remains configurable because model availability can change.

Machine translation is not treated as authority-approved wording. The UI marks its provenance and expects operator review before external handoff.

For voice, HIMGAURAV can request BHASHINI TTS (`Bhashini/IITM/TTS` by default) and falls back to browser speech synthesis if the connector is unavailable. Browser voice availability is device-dependent.

## 4. The extra advancement: Readiness Gate + geo-target preview

A visually impressive alert button is dangerous if it ignores evidence quality. v5 therefore adds an explicit **Alert Readiness Gate**.

Before escalating the workflow it checks:

1. LIVE vs DEMO provenance.
2. Whether the selected coordinate is an actual monitored slope or only a regional context point.
3. Rainfall-data freshness.
4. Whether WATCH/WARNING screening is actually present.
5. Whether WARNING has same-slope sensor corroboration.
6. Whether a message/language block exists and where its translation came from.
7. Whether a real connector exists or public dissemination is still external.

The geo-target preview uses a CAP-compatible operator-selected circle. This is a **communication targeting geometry**, not a geotechnical run-out model. That distinction prevents a simple UI radius from being mistaken for hazard physics.

## 5. Last-mile redundancy in this research build

v5 exposes several channels because a warning chain should not be mentally equated with one UI pop-up:

- browser notification on the operator computer,
- multilingual speech / local audio,
- drill siren pattern,
- CAP file export,
- optional agency/test webhook,
- optional local LoRa/siren gateway webhook,
- external official SACHET / Cell Broadcast handoff.

Only the first five are directly under this prototype's control. Government public-warning channels remain external and authorised.

## 6. What is deliberately NOT implemented or claimed

- No direct NDMA/SACHET publishing credential.
- No direct telecom Cell Broadcast transmission.
- No automatic public alert based only on Open-Meteo rainfall.
- No unreviewed machine translation claimed as official wording.
- No geo-radius claimed as a landslide run-out zone.
- No satellite image automatically converted into a warning without a validated image-change/deformation model.
- No one-node student prototype described as a certified life-safety system.

These are intentional scientific/operational boundaries, not missing cosmetic features.
