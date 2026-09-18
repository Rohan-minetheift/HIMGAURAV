# HIMGAURAV — Alerting research & design rationale

Research checked for the current prototype build. This note explains why the Alert Centre is built around CAP, geo-targeting, multilingual message blocks, operator review, local channels and an authority handoff rather than a fake “send public alert” button.

## 1. India's real public-warning architecture

### NDMA SACHET

Official portal: https://sachet.ndma.gov.in/

NDMA describes SACHET as a CAP-based Integrated Alert System for pan-India near-real-time, geo-targeted, multilingual alerting. This is the relevant national architecture for an Indian disaster-warning project.

The public SACHET mobile experience includes location/subscription-based alerts and multilingual presentation/read-out. HIMGAURAV therefore treats multilingual output as an operational requirement, not decoration.

### C-DOT CAP Integrated Alert System

Official product page: https://www.cdot.in/cdotweb/web/product_page.php?catId=9&lang=en&pId=49

C-DOT describes the national platform as geo-intelligent, multilingual, multi-hazard and multi-media, with dissemination technologies including SMS, Cell Broadcast, mobile app, TV, radio, social media, RSS, browser notification and satellite.

HIMGAURAV mirrors that architecture at prototype scale:

`evidence → readiness gate → multilingual CAP draft → local/test channels → authorised authority handoff`

It does not claim access to government telecom rails.

### Cell Broadcast

Government information:
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2256706
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2257499
- https://www.pib.gov.in/PressReleasePage.aspx?PRID=2290380

India's Cell Broadcast rollout/testing is integrated with the CAP/SACHET ecosystem and is intended for near-real-time, geo-targeted multilingual emergency messaging. That does not imply that an unauthorised student web app can publish to Cell Broadcast.

### Read-only official CAP feed

SACHET's agency integration guide requires ETag-aware CAP XML consumption. HIMGAURAV supports an optional read-only connector when an agency-provided identifier/feed URL is configured. It is deliberately separate from HIMGAURAV state and cannot publish alerts.

Official guide: https://sachet.ndma.gov.in/docs/Integration_Guide_For_Agencies.pdf

## 2. Common Alerting Protocol (CAP 1.2)

ITU reference: https://www.itu.int/rec/T-REC-X.1303bis-201403-I/en

CAP is a general all-hazard warning-message format designed so one consistent alert can be carried over different warning systems. CAP supports multiple language-specific information blocks and geographic target areas including circles/polygons.

HIMGAURAV exports CAP 1.2 because it is an interoperability artefact that a real downstream system can inspect, validate or transform.

HIMGAURAV deliberately uses:
- Draft status for LIVE research workflow,
- Exercise status for DEMO/drills,
- one information block per generated language,
- a geo-target circle,
- evidence parameters and data age,
- review/provenance metadata.

It does not create an Actual public-warning lifecycle claim by itself.

## 3. Multilingual architecture

The working core uses local structured templates for English plus the 22 Scheduled Languages of India. This avoids making the basic alert workflow dependent on an external translation API.

Operator-reviewed wording is kept separate from generated template wording. RTL layouts are used where appropriate.

Optional cloud translation/TTS services may be integrated later through the server side, but they must never be required for the core alert workflow or expose secret credentials in browser JavaScript.

## 4. Readiness Gate + geo-target preview

A visually impressive alert button is dangerous if it ignores evidence quality. HIMGAURAV therefore adds an explicit Alert Readiness Gate.

Before escalating the workflow it checks:
1. LIVE vs DEMO provenance.
2. Whether the selected coordinate is an actual monitored slope or only a regional context point.
3. Rainfall-data freshness.
4. Whether WATCH/WARNING screening is actually present.
5. Whether WARNING has same-slope sensor corroboration.
6. Whether a valid language/message block exists.

The geo-target preview uses a CAP-compatible operator-selected circle. This is a communication targeting geometry, not a geotechnical run-out model.

## 5. Last-mile redundancy in this research build

The prototype exposes several channels because a warning chain should not be equated with one UI pop-up:
- browser notification on the operator computer,
- multilingual speech when a matching device voice exists,
- drill siren pattern,
- CAP file export,
- optional agency/test webhook,
- optional local LoRa/siren gateway webhook,
- external official SACHET / Cell Broadcast handoff.

Government public-warning channels remain external and authorised.

## 6. What is deliberately NOT implemented or claimed

- No direct NDMA/SACHET publishing credential.
- No direct telecom Cell Broadcast transmission.
- No automatic public alert based only on model rainfall.
- No unreviewed translation claimed as official wording.
- No geo-radius claimed as a landslide run-out zone.
- No satellite image automatically converted into a warning without a validated image-change/deformation model.
- No one-node student prototype described as a certified life-safety system.

These are intentional scientific and operational boundaries, not missing cosmetic features.
