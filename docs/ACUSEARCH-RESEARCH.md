# AcuSearch — measurement-first rescue research

AcuSearch is the **post-landslide research component** of HIMGAURAV. It is intentionally separated from the early-warning workflow.

## Why it exists

Professional Urban Search and Rescue already uses proven technologies such as:

- canine search,
- seismic/acoustic geostereophones,
- UWB life-detection radar,
- thermal/search cameras,
- RECCO-type passive reflectors.

Those tools are valuable, but the specific case of a person buried in **water-saturated landslide soil, clay and mud** is different from structural rubble or snow.

The project therefore does **not** start by claiming a new victim detector. It starts with a narrower question:

> Can low-cost phone-originated signals such as Wi-Fi, Bluetooth or audible sound remain detectable through realistic landslide soil at useful burial depths and distances?

## The research gap

The strongest defensible gap is a **measurement gap**.

Published rescue and ranging work is largely validated in:
- structural rubble,
- walls,
- snow,
- open training environments.

HIMGAURAV/AcuSearch does not assume those ranges carry over to saturated monsoon soil.

Wet, conductive soil is a difficult propagation medium. Therefore the first responsible step is to characterise the link budget before building a rescue claim around it.

## What the AcuSearch Lab actually does

The web app provides a structured experiment workspace for:

- **Wi-Fi 2.4 GHz**
- **Bluetooth LE**
- **Audible acoustic tone**
- **Wired contact microphone / piezo control**

For each trial the operator can record:

- burial depth,
- soil condition,
- lateral distance,
- detected / not detected,
- RSSI or approximate browser dBFS where relevant,
- replicate number,
- field notes.

Prepared burial-depth protocol points include:
- 0 m control,
- 0.3 m,
- 0.6 m,
- 1.0 m,
- 1.5 m,
- optional extended 2.0 m testing.

Soil conditions:
- dry,
- damp,
- saturated.

## Acoustic test bench

The browser can generate low-level 1 kHz, 2 kHz or 3 kHz sine tones with Web Audio.

A microphone meter can report approximate browser **dBFS** and peak level when the browser grants microphone permission.

This is useful for repeatable comparison, but it is **not calibrated SPL instrumentation**.

## Results

AcuSearch visualises:

- detected / not-detected outcomes vs distance,
- modality filters,
- soil-condition filters,
- burial-depth filters,
- furthest observed detection,
- protocol coverage,
- CSV export and re-import.

The interface deliberately says **furthest observed detection**, not “maximum detection range”.

A single successful detection at one distance is an experimental observation, not a validated field capability.

## Minimum experimental protocol

A practical low-cost protocol is:

1. Use representative local soil.
2. Test dry, damp and saturated states.
3. Repeat each modality at multiple burial depths.
4. Move the receiver laterally through fixed distance steps.
5. Record signal level or detectability.
6. Repeat trials.
7. Keep an unburied control case.
8. Compare modalities under the same conditions.

A failed result is still useful. If a modality becomes unusable in saturated soil at realistic depth, AcuSearch should record that honestly rather than hide it.

## What AcuSearch does NOT claim

AcuSearch currently does **not** claim:

- survivor detection,
- a validated phone detection range in landslide mud,
- rescue probability,
- automatic victim localisation,
- an AI victim classifier,
- replacement of UWB radar, geostereophones, canine teams or trained USAR personnel.

## How AcuSearch fits HIMGAURAV

Before a landslide:

`Satellite EO → rainfall intelligence → slope IoT → evidence state → multilingual alert preparation`

After an incident:

`professional rescue response + AcuSearch research → soil/RF/acoustic measurements → evidence for or against a future low-cost victim-location concept`

## One-sentence explanation

> **AcuSearch tests whether Wi-Fi, Bluetooth or sound from an ordinary phone can physically survive realistic wet landslide burial before anyone claims that a phone-based survivor-location system will work.**

## Research principle

**Truth over impressiveness. A negative experiment is still a valid result.**
