# External data-source audit

This note explains why each external source appears in HIMGAURAV and what it is not allowed to imply.

## Open-Meteo

**Use:** modelled precipitation history, current precipitation, forecast precipitation and model soil moisture at monitored coordinates.

**Why:** no frontend secret is required and the service exposes the variables needed to keep today-to-now rainfall separate from future rainfall.

**Limit:** numerical weather-model grid values, not a local rain gauge. Mountain precipitation can vary sharply over short distances, so provenance stays visible.

## USGS FDSN Event Web Service

**Use:** recent regional earthquake catalogue.

**Why:** stable public web service and useful regional context.

**Limit:** no catalogue event is interpreted as evidence that a particular slope is moving. It never enters the state engine.

## NASA EOSDIS GIBS

**Use:** actual dated Earth-observation imagery.

**Why:** a real EO image service with standard geospatial interfaces; avoids fake satellite illustrations.

**Limit:** optical imagery can be cloud-obscured and is not a landslide-detection result. Layer date is exposed and is not called real-time.

## RainViewer

**Use:** latest available recent-past weather-radar frame as an optional overlay.

**Why:** lightweight public tile API suitable for a browser prototype.

**Limit:** coverage is not guaranteed at a Himachal location; missing pixels are not “zero rainfall.” Public radar frames are recent/past imagery, so the UI does not label them a forecast.

## OpenStreetMap / OpenTopoMap

**Use:** streets, settlements and topographic context.

**Why:** strong geographic orientation and open ecosystem.

**Limit:** public tile endpoints are suitable for light demonstration traffic, not unrestricted production load. A serious deployment should use compliant hosted tiles or self-hosting and preserve attribution.

## Copernicus Data Space / Sentinel Hub

**Use in this package:** documented integration path only.

**Why:** Sentinel-1/2 are scientifically valuable, but authenticated APIs and processing configuration make direct “just add a frontend tile URL” integration misleading.

**Architecture:** keep OAuth/client credentials on a backend/proxy; request processed imagery/products there; return short-lived/public-safe products to the browser.

## GSI / Bhukosh / Bhuvan

**Use:** authoritative Indian landslide/geoscience/satellite reference systems linked from the System section and source register.

**Why not scraped directly:** availability, authentication, CORS and layer licensing need to be checked per production integration. The prototype does not bypass these controls or imitate their datasets.

## ThingSpeak

**Use:** actual field-node telemetry from a public ThingSpeak channel, or a private read-only channel through the server-side environment key.

**Why:** fits the ESP32/cloud prototype path and can be read directly for public channels.

**Limit:** cloud telemetry latency and a single sensor are not a life-safety path. A real slope deployment needs multiple nodes, local processing, resilient power/radio and a local siren independent of internet availability.

## Local data gateway

`serve.py` exposes only a small allow-listed set of same-origin routes for external services and static dependencies. It is not a general-purpose open proxy. Private integration keys can remain server-side.
