# HIMGAURAV v8.0 — Validation + Sentinel-1 SAR/InSAR Lab test report

## Build

`8.0-validation-sar-lab`

Default local URL: `http://127.0.0.1:8818/#validation`

## What was tested in this build environment

### Static / syntax checks — PASS

- `node --check app.js`
- `node --check alert-locales.js`
- `node --check validation-lab.js`
- `python -m py_compile serve.py`
- `python -m py_compile tools/asf_insar_watch.py`
- `python -m py_compile tools/local_alert_gateway.py`
- `npm test`

### HTML / DOM integrity — PASS

- 368 HTML IDs found
- 368 unique IDs
- 0 duplicate IDs
- 318 direct JavaScript `#id` references checked
- 0 missing direct ID references
- 0 missing local files referenced by `index.html`

### Local server — PASS

The v8 server was started on port 8818.

- `/` → HTTP 200
- `/api/health` → HTTP 200
- `docs/VALIDATION-LAB.md` → served correctly
- `docs/SAR-INSAR.md` → served correctly
- health endpoint identifies build `8.0-validation-sar-lab`
- with no Earthdata token configured, `/api/hyp3/status` returns configured=false rather than pretending processing is available

### Upstream failure handling — PASS in this environment

This execution container blocks external DNS/network access. Calls to official IMD and ASF endpoints therefore returned upstream network errors. The local gateway converted them into API error responses rather than substituting random/simulated measurements.

This validates the failure path, **not** the external services themselves.

## What could NOT be truthfully end-to-end tested here

Because outbound DNS/network access is blocked in this container, this report does **not** claim an end-to-end live transaction with:

- IMD API,
- NASA ASF SearchAPI,
- ASF baseline service,
- ASF HyP3,
- Open-Meteo,
- ThingSpeak,
- USGS,
- RainViewer,
- NASA GIBS.

Those services were researched against their current official documentation and the application routes were implemented to their documented request structures. They must still be exercised on the user's normal internet-connected machine.

## Sentinel-1 / HyP3 safeguards checked in code

- Search requests Sentinel-1 dataset, IW beam mode and SLC products.
- Pair candidates come from the ASF baseline endpoint.
- HyP3 uses `INSAR_GAMMA` with real ESA granule IDs.
- Earlier/later acquisition ordering is normalised server-side when acquisition time can be parsed from the granule IDs.
- displacement maps are optional real HyP3 outputs, not generated browser values.
- Earthdata token is read server-side from `EARTHDATA_TOKEN` only.
- manual job submission requires UI confirmation.
- automation defaults to discovery-only.
- automated submission requires `ASF_AUTO_SUBMIT=1` **and** explicit submit confirmation.

## Validation Lab behaviour checked in code

- session metadata is persisted locally and included in evidence export.
- tilt calibration calculates bias, MAE, RMSE and R².
- soil calibration calculates gravimetric water content and an experimental volumetric water-content estimate from mass difference / known volume.
- binary rain mode never creates rainfall millimetres.
- tipping-bucket calibration uses collector area + applied volume + tip count to estimate mm/tip.
- LoRa tests calculate PDR from sent/received packets and retain RSSI/SNR/distance.
- live comparison records keep IMD/model/node provenance separate.
- comparison UI explicitly warns that accumulation windows must be aligned before publication.
- historical Kotrupi evaluation is labelled a retrospective method benchmark rather than predictive validation.

## Browser smoke-test limitation

A Chromium headless smoke test was attempted. The container's Chromium environment did not complete navigation/dump reliably because of sandbox/system-service/network restrictions, so this report does not claim a full click-through browser automation pass.

The build therefore has strong static/runtime-server validation but should receive a final click-through on the actual presentation laptop after external services and the user's ThingSpeak node are configured.

## Required real-machine acceptance test

Before presenting v8, run these on an internet-connected computer:

1. Open `/#validation` and save a QA/QC session.
2. Connect the real ThingSpeak node.
3. Run **Live comparison** and confirm IMD 42079, Open-Meteo and ASF each show either real timestamped data or a clear unavailable state.
4. Open `/#satellite` → JNGEC target → Search ASF acquisitions.
5. Confirm returned scene IDs resolve in ASF Vertex.
6. Select a scene → Find compatible pairs.
7. If Earthdata/HyP3 is configured, submit one deliberately chosen pair and verify the same job appears in the ASF HyP3 account.
8. Wait for completion and download the real product ZIP/GeoTIFFs.
9. Record one tilt calibration series and one soil-moisture calibration series.
10. Verify binary rain mode never reports mm.
11. Export the validation evidence pack and reopen its JSON.
12. Test node power-off / network-off and confirm the UI changes to stale/offline rather than NORMAL.

## Result

**Local build integrity: PASS.**

**External live-service end-to-end validation: REQUIRED on an internet-connected machine.**

This distinction is intentional; the project must not claim a live test that was not actually executed.
