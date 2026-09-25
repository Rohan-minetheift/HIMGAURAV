# External data-source audit

This note explains why each external source appears in the redesigned HIMGAURAV interface and what it is **not** allowed to imply.

## Open-Meteo

**Use:** modelled precipitation history, current precipitation, forecast precipitation and model soil moisture at monitored coordinates.

**Why:** no frontend secret is required, multiple coordinates are supported in one request, and the service exposes the hourly variables needed to keep today-to-now rainfall separate from future rainfall. The app prefers the local same-origin gateway and falls back to the official public endpoint.

**Limit:** numerical weather-model grid values, not a local rain gauge. Mountain precipitation can vary sharply over short distances, so the application keeps the location and provenance visible.

## USGS FDSN Event Web Service

**Use:** recent regional earthquake catalogue.

**Why:** stable public web service and useful regional context.

**Limit:** no catalogue event is interpreted as evidence that a particular slope is moving. It never enters the state engine.

## NASA EOSDIS GIBS

**Use:** actual dated MODIS Terra true-colour Earth-observation layer through WMS.

**Why:** a real EO image service with standard geospatial interfaces; avoids fake satellite illustrations.

**Limit:** optical imagery can be cloud-obscured and is not a landslide-detection result. Layer date is exposed in map attribution/toast and is not called real-time.

## RainViewer

**Use:** latest available recent-past weather-radar frame as an optional overlay.

**Why:** lightweight public tile API suitable for a browser prototype.

**Limit:** coverage is not guaranteed at a Himachal location; missing pixels are not “zero rainfall.” Public radar frames are recent/past imagery, so the UI does not label them a forecast.

## OpenStreetMap / OpenTopoMap

**Use:** streets/settlements and topographic context. The full GIS view uses Leaflet; if the GIS library genuinely cannot load, the app falls back to an actual OpenStreetMap embed rather than an invented map.

**Why:** strong geographic orientation and open ecosystem.

**Limit:** public tile endpoints are suitable for light demonstration traffic, not unrestricted production load. A serious deployment should use compliant hosted tiles or self-hosting and preserve attribution.

## Copernicus Data Space / Sentinel Hub

**Use in this package:** documented integration path only.

**Why:** Sentinel-1/2 are scientifically valuable, but authenticated APIs and processing configuration make direct “just add a frontend tile URL” integration misleading.

**Architecture:** keep OAuth/client credentials on a backend/proxy; request processed imagery/products there; return short-lived/public-safe products to the browser. `.env.example` contains placeholders only.

## GSI / Bhukosh / Bhuvan

**Use:** authoritative Indian landslide/geoscience/satellite reference systems linked from the System section and source register.

**Why not scraped directly:** availability, authentication, CORS and layer licensing need to be checked per production integration. The prototype does not bypass these controls or imitate their datasets.

## ThingSpeak

**Use:** actual field-node telemetry from a public ThingSpeak channel, or a private read-only channel through the local server-side `.env` key.

**Why:** fits the existing ESP32/cloud prototype path and can be read directly for public channels.

**Limit:** cloud telemetry latency and a single sensor are not a life-safety path. A real slope deployment needs multiple nodes, local processing, resilient power/radio and a local siren independent of internet availability.


## Local data gateway

`serve.py` exposes only a small allow-listed set of same-origin routes for Open-Meteo, USGS, RainViewer, ThingSpeak and the Leaflet library. It is **not** a general-purpose open proxy. This improves reliability when browsers enforce CORS or block a particular CDN, while preserving direct-official-endpoint fallbacks where appropriate. Private ThingSpeak read keys can remain server-side.
