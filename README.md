# HIMGAURAV v8 — Validation + SAR/InSAR Lab

Real-time landslide monitoring and satellite SAR validation platform for Himachal Pradesh.

## Features
- **Live Hazard Intelligence** — Geocode any location, pull real earthquake (USGS), NASA EONET events, and rainfall data in a radius
- **Sentinel-1 SAR Lab** — Live ASF scene search with Leaflet footprint map (Esri Topo basemap)
- **HyP3 InSAR Processing** — Submit and monitor INSAR_GAMMA jobs, overlay color-phase results on map automatically
- **Validation Lab** — Cross-source comparison: field node vs USGS seismic vs Open-Meteo vs ASF Sentinel-1
- **Kotrupi Stepper** — Interactive 2014 Kotrupi landslide case study

## Running locally
```
python serve.py
```
Or double-click `START_SERVER.bat` — it auto-kills ghost processes and starts cleanly.

Open: http://127.0.0.1:8818

## Requirements
- Python 3.10+
- Earthdata account (for ASF/HyP3 — token set in `.env`)

## .env keys
```
EARTHDATA_TOKEN=your_token_here
PORT=8818
```
