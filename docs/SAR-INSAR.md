# HIMGAURAV v8 — Sentinel-1 SAR / InSAR + Alaska Satellite Facility workflow

This is the operational design for the Satellite workspace. It uses **real Sentinel-1 metadata and real ASF HyP3 processing** when configured. HIMGAURAV never synthesizes an interferogram or displacement map in the browser.

## 1. What “Alaska Satellite Facility automation” means

NASA's **Alaska Satellite Facility (ASF) DAAC** distributes Sentinel-1 SAR data and operates the HyP3 on-demand processing service.

HIMGAURAV uses three real ASF components:

1. **ASF SearchAPI** — discover Sentinel-1 IW SLC acquisitions intersecting a monitored site.
2. **ASF Baseline search** — obtain acquisition candidates compatible with a selected reference scene for interferometry.
3. **ASF HyP3** — submit a selected Sentinel-1 SLC pair for actual `INSAR_GAMMA` processing.

The old ASF subscription mechanism is not imitated. The app implements the current “subscription-like” pattern: periodically search for new acquisitions, find a compatible pair, and optionally submit processing.

By default the automation is **discovery-only**. It will not spend HyP3 credits automatically.

---

## 2. Current Sentinel-1 constellation context

As of 2026, **Sentinel-1C and Sentinel-1D** provide the operational constellation. Sentinel-1D data opened to users in April 2026, and Sentinel-1A ended operations on 30 June 2026 after overlap with the new units.

The app therefore searches by Sentinel-1 mission/platform rather than hard-coding only Sentinel-1A scene prefixes.

---

## 3. Why SLC rather than a normal satellite picture

Interferometry requires radar phase. Sentinel-1 **Single Look Complex (SLC)** products preserve complex amplitude and phase information. Standard optical imagery and ordinary SAR amplitude tiles do not contain the phase history needed for DInSAR.

For Himalayan slope work the app searches:

- platform: Sentinel-1,
- beam mode: IW,
- processing level: SLC,
- point intersection at the selected site,
- a user-selected time window.

---

## 4. Pair discovery

Two images are not automatically a valid InSAR pair merely because both cover the same point.

Pair quality depends on:

- same/compatible acquisition geometry,
- relative orbit / track,
- temporal baseline,
- perpendicular baseline,
- surface coherence,
- snow/vegetation/moisture change,
- atmospheric conditions.

HIMGAURAV first selects a real SLC scene, then calls the **ASF baseline service** for pair candidates. That service is used instead of inventing a pair locally from dates alone.

The UI exposes the chosen reference and secondary granule IDs before any processing request is sent.

---

## 5. Real processing through HyP3

HyP3 processing requires NASA Earthdata authentication. The token is kept in server-side `.env` as:

`EARTHDATA_TOKEN=...`

It must never be embedded in `index.html`, JavaScript or GitHub.

When authenticated, HIMGAURAV submits a real HyP3 job:

- job type: `INSAR_GAMMA`,
- granules: selected reference + secondary ESA granule IDs,
- looks: `20x4` or `10x2`,
- optional look vectors,
- incidence map,
- optional displacement maps.

HyP3 returns actual processed products. Default InSAR outputs include amplitude, coherence and unwrapped phase; optional products include displacement and look/incidence maps depending on submission parameters.

HyP3 processing consumes account credits. The app therefore requires an explicit confirmation before manual submission.

---

## 6. What a HyP3 displacement map means

A line-of-sight (LOS) displacement layer is derived from interferometric phase and is **relative** to the phase-unwrapping reference.

It is not “absolute GPS displacement”. Interpretation requires:

- a stable reference region,
- high coherence,
- awareness of radar look direction,
- geometry/terrain checks,
- atmospheric-error consideration,
- comparison across multiple dates where possible.

The optional vertical displacement product makes an assumption about deformation direction and should not be treated as a full 3-D slope-motion vector.

ASF itself recommends time-series approaches for stronger deformation interpretation than relying on one interferogram.

---

## 7. Himalayan/InSAR failure modes that must remain visible

### Temporal decorrelation

Vegetation, wet soil, agriculture, snowfall and rapid surface change can destroy phase coherence between acquisitions.

### Geometric decorrelation / baseline

A large perpendicular baseline can reduce interferometric quality.

### Layover and shadow

Steep Himalayan terrain can make slopes geometrically unobservable or ambiguous from a particular radar look direction.

### Atmosphere

Tropospheric water-vapour differences can appear as phase/displacement patterns.

### Rapid landslide failure

Fast movement can destroy coherence rather than produce a neat displacement gradient. InSAR is especially useful for slow deformation and retrospective analysis; it is not guaranteed to see the final rapid failure.

### Reference-point dependence

Unwrapped phase/displacement is relative. A poor or moving reference region can shift the interpretation.

Therefore HIMGAURAV does **not** automatically change NORMAL/MONITOR/WATCH/WARNING from one InSAR output.

---

## 8. Kotrupi historical benchmark

Kotrupi, Mandi is a useful research benchmark because the 13 August 2017 landslide has published Sentinel-1 DInSAR/MTInSAR analysis.

The app includes a historical preset:

1. target Kotrupi,
2. search the real ASF archive around 2017,
3. choose a reference SLC,
4. request baseline neighbours,
5. submit an actual pair to HyP3,
6. inspect coherence/unwrapped phase/displacement,
7. compare spatial patterns with published Kotrupi work.

A successful comparison means the workflow can reproduce a scientifically plausible deformation analysis at the documented location. It does **not** prove that the current real-time warning system predicts all landslides.

---

## 9. Automation modes

### Discovery-only — default and recommended

`ASF_AUTO_SUBMIT=0`

A scheduled run may:

- search recent SLCs,
- identify the newest acquisition,
- query baseline candidates,
- return the proposed pair,
- log that a candidate exists.

No HyP3 credits are consumed.

### Armed processing

`ASF_AUTO_SUBMIT=1`

Even then, the local API requires `confirm_submit=true` for a processing cycle. This two-key design prevents accidental credit consumption.

For unattended research automation, use `tools/asf_insar_watch.py` with explicit command flags and a protected Earthdata token.

---

## 10. Operational recommendation

For a research deployment:

- run acquisition discovery daily,
- process only when a new compatible scene appears,
- archive job ID, granule IDs and metadata,
- store products outside HyP3 before retention expires,
- inspect coherence before displacement,
- compare multiple interferograms/time-series,
- keep SAR evidence separate from warning state until a validated local deformation rule exists.

---

## 11. Authoritative references

- ASF Search API: https://docs.asf.alaska.edu/api/keywords/
- ASF Search API basics: https://docs.asf.alaska.edu/api/basics/
- ASF baseline search: https://docs.asf.alaska.edu/vertex/baseline/
- HyP3 API: https://hyp3-docs.asf.alaska.edu/using/api/
- HyP3 authentication: https://hyp3-docs.asf.alaska.edu/using/authentication/
- HyP3 InSAR product guide: https://hyp3-docs.asf.alaska.edu/guides/insar_product_guide/
- HyP3 credits: https://hyp3-docs.asf.alaska.edu/using/credits/
- Sentinel-1D data opening: https://sentinels.copernicus.eu/-/sentinel-1d-user-data-opening-from-17-april-2026
- Sentinel-1A end of operations: https://sentinels.copernicus.eu/web/sentinel/-/copernicus-sentinel%E2%80%911a-satellite-end-of-operations-after-12-years-of-service
- Kotrupi DInSAR/MTInSAR paper: https://www.sciencedirect.com/science/article/pii/S0273117721008917
