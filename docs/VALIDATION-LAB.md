# HIMGAURAV v8 — Field Validation Laboratory Protocol

This document defines what may be called **tested**, **calibrated**, **compared**, or **validated** in HIMGAURAV. It is deliberately stricter than a hackathon demo checklist.

## 1. Validation is split into four independent questions

Do not collapse these into one claim such as “the landslide system is 95% accurate”.

1. **Instrument metrology** — does each sensor measure its intended physical quantity against a traceable/reference measurement?
2. **Telemetry reliability** — does the ESP32/LoRa/ThingSpeak path deliver timestamps and samples reliably under the intended field geometry?
3. **Cross-source consistency** — do local rainfall observations, IMD station data and gridded/model/satellite rainfall describe the same event once time windows and spatial scale are aligned?
4. **Hazard-method evaluation** — does the warning logic behave sensibly on known historical event/non-event data? This requires a historical dataset; one live month or one landslide cannot establish predictive accuracy.

The Validation workspace keeps these categories separate.

---

## 2. Mandatory traceability for every test

Before collecting calibration data, record:

- campaign/test ID,
- node serial/ID,
- firmware/build version,
- operator,
- exact coordinates,
- sensor model and wiring/ADC path,
- reference instrument and its model/resolution/calibration certificate if available,
- timestamp/time-zone source,
- ambient/test temperature,
- mounting/exposure geometry,
- soil source/texture notes,
- any reset, dropout, battery or communications event.

Raw values should be preserved. Do not keep only converted percentages.

Recommended file naming:

`YYYYMMDD_SITE_NODE_PROTOCOL_REPLICATE.csv`

Example:

`20260922_JNGEC_HG-NODE-01_TILT_R01.csv`

---

## 3. Test site: safe Sundernagar validation location

A campus or permissioned nearby **stable, accessible cut slope/soil test plot** is suitable for instrument validation. It is not necessary—and is unsafe—to stand on an active landslide crown/toe during rain.

The app defaults to a JNGEC Sundernagar coordinate for controlled tests and uses **IMD Sundernagar station 42079** as the nearby official meteorological reference. IMD/WIS2 lists station 42079 as an operational fixed land station at about 875 m elevation.

Do not state that the campus test slope is a landslide-prone site unless supported by a geological assessment.

---

# CAL-01 — MPU6500 inclination / tilt

## Objective

Quantify static inclination error, bias, repeatability, baseline noise and drift of the complete node—not merely the MEMS chip datasheet.

## Equipment

- HIMGAURAV node fixed in the same enclosure/mounting orientation intended for field use.
- A digital inclinometer/reference level with known resolution; record model and stated accuracy.
- Rigid non-flexing fixture.
- Optional thermometer for temperature-drift tests.

## Procedure A — static multi-angle calibration

Use at least 7–11 reference positions spanning the realistic slope-motion range. A useful controlled series is:

`-10°, -5°, -2°, -1°, 0°, +1°, +2°, +5°, +10°`

At each position:

1. Set the reference fixture.
2. Wait a fixed settling period (e.g. 20–60 s).
3. Log at least 30–60 sensor samples rather than one reading.
4. Record the mean and standard deviation.
5. Repeat the complete angle sequence at least three times.
6. Repeat the sequence in reverse order to expose hysteresis/mounting effects.

## Procedure B — baseline noise

Keep the fixture completely stationary for at least 1–6 h; ideally include a day/night temperature change.

Report:

- mean tilt,
- standard deviation,
- peak-to-peak noise,
- 95th/99th percentile absolute deviation,
- apparent drift per hour,
- temperature correlation if temperature is logged.

## Procedure C — known-motion challenge

Create a controlled step change (e.g. 0.5°, 1°, 2°) and verify:

- detected amplitude,
- detection delay,
- whether the sustained-anomaly rule triggers,
- whether the state clears correctly after recovery.

This validates software behaviour. It does **not** validate that the same angular change predicts real slope failure.

## Required metrics

- bias = mean(node − reference),
- MAE,
- RMSE,
- R² for the calibration relation,
- repeatability standard deviation,
- baseline-noise distribution,
- drift.

Do not impose a universal pass/fail angle from literature unless your deployment requirement defines one.

---

# CAL-02 — capacitive soil-moisture sensor

## Objective

Convert raw ADC/voltage into a soil-specific water-content relationship and quantify error on samples not used to fit the curve.

Low-cost capacitive probes are strongly affected by soil texture, bulk density, salinity, temperature, probe-to-soil contact and electronics. A dry/wet two-point mapping is not sufficient for research-grade claims.

## Reference method

Use the **gravimetric water-content method** on soil from the actual installation location.

For a sample:

- wet mass = `M_wet`
- oven-dry mass = `M_dry`

Gravimetric water content:

`GWC = (M_wet − M_dry) / M_dry`

If the sample volume `V` is known and water density is approximated as 1 g/cm³, an experimental volumetric estimate is:

`VWC ≈ (M_wet − M_dry) / V`

A better VWC calculation also uses measured bulk density; document the method used.

## Sample preparation

1. Collect representative soil from the deployment site.
2. Remove unusually large stones/organic debris only if this is part of a documented preparation protocol.
3. Prepare a moisture gradient from oven/air-dry to near-saturation.
4. Use at least 6–10 moisture levels.
5. Prepare independent replicates at each level.
6. Keep packing/bulk density as consistent as possible—or deliberately vary it and document the effect.
7. Insert the probe consistently and avoid air gaps.
8. Record temperature if possible.

## Calibration versus validation split

Do **not** fit and evaluate the equation on the exact same samples.

Recommended:

- 70% of samples for calibration,
- 30% held out for validation,

or use replicate-based cross-validation when sample numbers are small.

Report calibration and validation error separately.

## Required metrics

- raw/voltage versus reference VWC scatter plot,
- selected calibration equation,
- R²,
- validation MAE,
- validation RMSE,
- bias,
- residual plot,
- range of soil moisture actually tested.

Published low-cost capacitive-sensor results may be used only as context. Soil-specific published R² values are **not** acceptance thresholds for your soil.

---

# CAL-03 — rainfall and rain detection

## First decide what sensor you actually have

### Wet/dry rain plate

A resistive/capacitive rain board can validate:

- onset of wetting,
- wet/dry state,
- response/recovery time.

It does **not** measure rainfall depth in millimetres without a physically validated collection model. HIMGAURAV therefore never converts a binary rain board into mm.

### Tipping-bucket or manual gauge

Use this if you want local rainfall in millimetres.

For a tipping bucket with collector area `A` in cm², applied water `V` in mL and `N` tips:

`mm per tip = 10 × V / (A × N)`

This is a calibration estimate; dynamic intensity errors still need testing.

## Controlled tipping-bucket calibration

Test at several flow rates, because tipping mechanisms can under-catch at high intensity.

For each flow rate:

1. Measure a known water volume with a graduated cylinder or calibrated balance.
2. Deliver it evenly to the collector over a measured duration.
3. Record number of tips and timestamps.
4. Repeat at least three times.
5. Compare expected depth and measured depth.

Report:

- mm/tip,
- bias by intensity,
- repeatability,
- missed/double-tip behaviour.

## Field exposure

Follow WMO precipitation-measurement guidance as closely as feasible. Record:

- collector height,
- nearby obstacles,
- slope/roof effects,
- wind exposure,
- levelling,
- splash/bounce risk.

A gauge beside a building or tree should not be described as a WMO-standard reference unless it satisfies the exposure requirements.

---

# LIVE-01 — node ↔ IMD Sundernagar ↔ Open-Meteo comparison

## Why time-window alignment matters

IMD city rainfall for Sundernagar is commonly reported over a fixed 24 h observation window (e.g. 0830 IST to 0830 IST). A rolling “last 24 h” from your node or Open-Meteo is not automatically the same interval.

Before calculating error:

1. choose one exact start/end time,
2. aggregate every source over that same interval,
3. document missing samples,
4. preserve each source’s provenance and spatial scale.

## Sources

- **Node gauge** — point observation at your exact test site.
- **IMD 42079** — nearby official fixed station; still a different point and elevation/exposure.
- **Open-Meteo** — numerical weather-model grid, not ground truth.
- Optional **GPM IMERG** — satellite precipitation grid, useful as regional context, not point truth.

## Metrics after enough rainy periods

For matched intervals:

- MAE,
- RMSE,
- mean bias,
- correlation/R²,
- event detection (rain/no rain),
- cumulative rainfall difference.

Keep scatter plots and time-series plots. Do not judge the system from one storm.

---

# NET-01 — LoRa / telemetry reliability

## Objective

Measure whether samples reach the gateway/cloud under the actual terrain and enclosure conditions.

## Controlled route test

At each test point record:

- GPS/known distance,
- line-of-sight / partial obstruction / building / slope obstruction,
- transmitter height,
- receiver height,
- antenna orientation,
- spreading factor/bandwidth/coding rate/transmit power,
- sent packets,
- received packets,
- RSSI,
- SNR,
- end-to-end latency if available,
- battery voltage.

Packet Delivery Ratio:

`PDR = received / sent × 100%`

Use a fixed packet count, preferably 100+ per condition, and repeat the route.

## Failure/recovery tests

Also test:

- gateway power cycle,
- ESP32 reboot,
- temporary internet loss,
- ThingSpeak rejection/rate limit,
- LoRa outage,
- stale data handling,
- sequence-number gaps,
- duplicate packet handling.

A monitoring system must distinguish **offline** from **safe**.

---

# QA-01 — timestamp and data integrity

Verify:

- device clock source,
- gateway clock source,
- ThingSpeak timestamp behaviour,
- timezone conversion,
- sample cadence,
- duplicate timestamps,
- gaps,
- out-of-order samples,
- sensor warm-up after reset,
- local buffering if implemented.

For each outage experiment, record the exact start/end time and expected UI behaviour.

---

# SAR-01 — Sentinel-1 / InSAR validation

See `docs/SAR-INSAR.md` for the full workflow.

The minimum defensible SAR test is:

1. discover actual Sentinel-1 IW SLC acquisitions at the target using NASA ASF metadata,
2. obtain an ASF baseline-compatible pair,
3. submit the pair to ASF HyP3 when an Earthdata token is configured,
4. examine amplitude, coherence and unwrapped phase/displacement products,
5. select a stable high-coherence reference region before interpreting displacement,
6. inspect layover/shadow and vegetation-decorrelation limitations,
7. compare spatial patterns against a published historical case such as Kotrupi,
8. do not turn a single interferogram into an automatic warning state.

A time series is much stronger than one interferogram for deformation claims.

---

# HIST-01 — historical warning-method evaluation

A single known landslide is a **case study**, not a predictive validation dataset.

To estimate warning performance, assemble many historical days/events containing:

- landslide occurrence/non-occurrence,
- time/location quality,
- rainfall data with consistent temporal resolution,
- missing-data flags,
- threshold output.

Only then calculate a confusion matrix:

- True Positive (TP),
- False Positive (FP),
- False Negative (FN),
- True Negative (TN).

Useful metrics:

- Probability of Detection `POD = TP / (TP + FN)`
- False Alarm Ratio `FAR = FP / (TP + FP)`
- Critical Success Index `CSI = TP / (TP + FP + FN)`
- precision/recall,
- lead time distribution.

Do not call the Shimla threshold “validated for Sundernagar” until a local historical evaluation supports that statement.

---

# Historical Kotrupi SAR benchmark

Kotrupi (Mandi) failed on 13 August 2017 and has published Sentinel-1 DInSAR/MTInSAR analysis. Use it as a reproducible retrospective benchmark:

1. set the SAR target to **Kotrupi 2017**,
2. search the ASF archive over a pre/post-event window,
3. use ASF baseline search to identify compatible SLC pairs,
4. process with HyP3,
5. record acquisition dates, orbit direction, relative orbit, temporal/perpendicular baseline and coherence,
6. compare the affected spatial area and deformation pattern with the published study,
7. explicitly state differences in processing software, reference point, DEM, filtering and acquisition pair.

One paper reports a displacement range for its chosen DInSAR processing, but HIMGAURAV must not use that numeric range as a hard expected output because InSAR displacement is relative to processing/reference choices and scene pair.

---

# What judges can legitimately be shown

A strong evidence package contains:

1. **Tilt calibration plot** — reference angle vs node; bias/MAE/RMSE/repeatability.
2. **Soil calibration plot** — raw sensor vs independent VWC; held-out error.
3. **Rain gauge calibration** — expected vs measured depth at several flow rates.
4. **Matched rainfall comparison** — local gauge vs IMD 42079 vs model for identical time windows.
5. **LoRa field reliability map/table** — PDR/RSSI/SNR by distance/terrain.
6. **Uptime/outage test** — how quickly the UI declares stale/offline data.
7. **Real ASF Sentinel-1 acquisition list** for the site.
8. **Real HyP3 job and downloadable GeoTIFF product** when Earthdata auth is configured.
9. **Kotrupi historical replay** with published comparison.
10. **Raw data + protocol + firmware version** so another team could reproduce the test.

The correct sentence is:

> “We calibrated and field-tested the sensing/communications chain against independent references, compared live rainfall with official and model sources using matched windows, and evaluated the satellite workflow retrospectively on a documented landslide. We do not claim a predictive accuracy that our dataset cannot support.”

---

# Primary references used to design this protocol

- WMO, *Guide to Instruments and Methods of Observation (WMO-No. 8)*, precipitation measurement and calibration/validation guidance: https://community.wmo.int/site/knowledge-hub/programmes-and-initiatives/instruments-and-methods-of-observation-programme-imop/guide-instruments-and-methods-of-observation-wmo-no-8
- IMD Current Weather API reference: https://api.imd.gov.in/public/api_reference.html
- IMD/WIS2 station catalogue, Sundernagar 42079: https://wis2box.imd.gov.in/oapi/collections/stations/items?f=html
- Soil-specific low-cost capacitive calibration example: https://pmc.ncbi.nlm.nih.gov/articles/PMC13364378/
- IoT-based geotechnical monitoring in the Darjeeling Himalayas: https://www.mdpi.com/1424-8220/20/9/2611
- NASA ASF Search API: https://docs.asf.alaska.edu/api/keywords/
- ASF HyP3 InSAR Product Guide: https://hyp3-docs.asf.alaska.edu/guides/insar_product_guide/
- ASF HyP3 API: https://hyp3-docs.asf.alaska.edu/using/api/
- Published Kotrupi Sentinel-1 DInSAR/MTInSAR case: https://www.sciencedirect.com/science/article/pii/S0273117721008917
