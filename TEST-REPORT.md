# HIMGAURAV v7.0 — AcuSearch Lab test report

## Build under test

`7.0-acusearch-lab`

Expected header badge: **v7.0 · ACUSEARCH LAB**  
Expected AcuSearch route: `http://127.0.0.1:8807/#rescue`

## Static validation — PASS

- `node --check app.js` — PASS.
- `node --check alert-locales.js` — PASS.
- `python3 -m py_compile serve.py` — PASS.
- HTML parsed successfully with BeautifulSoup.
- 275 unique element IDs; **0 duplicate IDs**.
- 228 direct JavaScript `$('#id')` references checked against the HTML; **0 missing IDs**.
- `view-rescue`, `rescueTitle`, logger controls, acoustic-bench controls, filter controls and results containers are present.
- `docs/ACUSEARCH-RESEARCH.md` is packaged with the application.

## Local server — PASS

The v7 local gateway was started on port **8807**.

- `/` returned HTTP 200.
- `/api/health` returned `ok: true`.
- `/api/health` identified `build: 7.0-acusearch-lab`.
- Server header identified `HIMGAURAV/7.0`.

The dedicated port is intentional so old 8795/8796/8797 development servers cannot be mistaken for this build.

## AcuSearch implementation checks

The source implementation was checked for the following real/local functions:

- measurement logger with modality, depth, moisture, lateral distance, outcome, metric, replicate and note;
- separate Wi-Fi, BLE, audible and wired-control modalities;
- filterable results table;
- observed-distance SVG chart;
- protocol coverage matrix;
- CSV export;
- CSV re-import parser compatible with HIMGAURAV AcuSearch export columns;
- Web Audio 1/2/3 kHz sine-tone source with low adjustable gain;
- `getUserMedia()` microphone capture with echo cancellation, noise suppression and AGC requested off;
- approximate RMS-to-dBFS browser meter;
- microphone peak hold;
- one-click copying of the live dBFS value into the experiment log;
- explicit cleanup of oscillator/microphone tracks on stop and page unload.

## Important execution-environment limitation

The managed Chromium available in this build environment blocks navigation to both localhost and local `file://` pages with an organisation policy page. Therefore I could not truthfully perform the final click-through of microphone permission, Web Audio playback and browser download interactions in Chromium here.

Those features use standard browser APIs and passed JavaScript syntax/DOM-reference checks, but they must be click-tested on the target laptop after launch. The application itself exposes failures instead of substituting fake readings.

Recommended target-machine check:

1. Start `START-HIMGAURAV.bat`.
2. Open AcuSearch.
3. Start a 2 kHz tone at the default low output level and stop it.
4. Click **Start microphone**, grant permission, verify dBFS changes with sound, then stop it.
5. Log one dry control trial and one saturated trial.
6. Verify the results chart/table and coverage matrix update.
7. Export CSV, clear local data, re-import the CSV, and verify the rows return.

## Scientific boundary preserved

AcuSearch does **not** produce:

- survivor detections,
- phone-in-mud range claims,
- rescue probability,
- AI victim classifications,
- a false statement that Wi-Fi/BLE/UWB has been validated in saturated landslide soil.

The workspace implements the measurement gap described in `docs/ACUSEARCH-RESEARCH.md`: record a link budget first, then decide whether a phone-based method is physically viable.
