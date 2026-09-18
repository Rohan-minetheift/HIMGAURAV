# HIMGAURAV system architecture

HIMGAURAV is organised as an evidence-fusion research platform rather than a single prediction model.

## Core flow

~~~mermaid
flowchart TD
  A["Satellite / Earth Observation"] --> E["Evidence layer"]
  B["Rainfall history + forecast"] --> E
  C["Ground IoT nodes"] --> E
  D["Local reports"] --> E

  E --> S["Site screening state"]
  S --> X["NORMAL / MONITOR / WATCH / WARNING / NO DATA"]
  X --> AL["Multilingual Alert Centre"]
  AL --> CAP["CAP 1.2 Draft / Exercise"]
  AL --> LOCAL["Browser / voice / local gateway"]
  CAP --> OFFICIAL["Authorised external dissemination"]

  INCIDENT["Post-event incident"] --> ACU["AcuSearch research"]
  ACU --> RF["Wi-Fi / BLE / acoustic / wired-control experiments"]
~~~

## Satellite layer

Satellite products provide regional context and dated observations. They are never treated as a continuous live camera and do not automatically raise the operational state.

## Weather layer

Open-Meteo model rainfall provides history and forecast context. The state engine applies the published intensity-duration screening relation used by the audited prototype. Model rainfall is not represented as a local rain gauge.

## Ground layer

A field node may report inclination, soil moisture, rainfall input, battery and radio-link health. Only the currently defined sustained same-slope inclination anomaly is allowed to corroborate WATCH into WARNING.

## Alert layer

The Alert Centre converts the current evidence state into structured local messages, multilingual templates and CAP export. It does not claim direct NDMA/SACHET or telecom publishing authority.

## AcuSearch layer

AcuSearch is deliberately separated from early warning. It is a measurement-first post-event research workspace for testing whether low-cost phone/RF/acoustic signals survive realistic landslide soil.

## Data provenance

The UI distinguishes LIVE, SENSOR, MODEL/FORECAST, DERIVED, RECENT, REFERENCE, CACHED, DEMO/SIMULATED, EXPERIMENTAL and NO DATA. The system must never reinterpret missing telemetry as safety.
