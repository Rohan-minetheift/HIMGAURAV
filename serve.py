from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime, timedelta, timezone
import json
import mimetypes
import os
import re
import time
import xml.etree.ElementTree as ET
import ssl

# Bypass SSL verification errors for local Windows Python environments
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
BUILD = "8.0-validation-sar-lab"
PORT = int(os.environ.get("PORT", "8818"))


def load_env(path: Path):
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env(ROOT / ".env")

CACHE = {}
RAW_CACHE = {}
SACHET_CACHE = {"url": None, "etag": None, "body": None, "fetched_at": 0.0}


def cached_bytes(urls, ttl=86400, timeout=4):
    now = time.time()
    key = tuple(urls)
    item = RAW_CACHE.get(key)
    if item and now - item[0] < ttl:
        return item[1]
    last = None
    for url in urls:
        try:
            req = Request(url, headers={"User-Agent": "HIMGAURAV/8.0 research-prototype"})
            with urlopen(req, timeout=timeout) as r:
                body = r.read()
            RAW_CACHE[key] = (now, body)
            return body
        except Exception as e:
            last = e
    raise last or RuntimeError("all vendor mirrors failed")


def cached_json(url, ttl=60, timeout=12):
    now = time.time()
    item = CACHE.get(url)
    if item and now - item[0] < ttl:
        return item[1], True
    req = Request(url, headers={
        "User-Agent": "HIMGAURAV/8.0 research-prototype",
        "Accept": "application/json",
    })
    with urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read().decode("utf-8"))
    CACHE[url] = (now, data)
    return data, False


def auth_json(url, token, method="GET", payload=None, timeout=20):
    headers = {
        "User-Agent": "HIMGAURAV/8.0 research-prototype",
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method=method)
    with urlopen(req, timeout=timeout) as r:
        raw = r.read().decode("utf-8", errors="replace")
        return json.loads(raw) if raw.strip() else {}


def asf_scene_id(feature):
    if not isinstance(feature, dict):
        return ""
    props = feature.get("properties") or {}
    for key in ("sceneName", "granuleName", "fileID", "fileName", "productName", "name"):
        value = props.get(key)
        if value:
            return str(value)
    return str(feature.get("id") or "")


def asf_scene_time(feature):
    props = (feature or {}).get("properties") or {}
    for key in ("startTime", "start", "sceneDate", "acquisitionDate", "stopTime"):
        value = props.get(key)
        if value:
            return str(value)
    return ""


def asf_search(lat, lon, start, end, max_results=24):
    params = {
        "dataset": "SENTINEL-1",
        "processingLevel": "SLC",
        "beamMode": "IW",
        "intersectsWith": f"POINT({lon} {lat})",
        "start": start,
        "end": end,
        "maxResults": str(max(1, min(100, int(max_results)))),
        "output": "geojson",
    }
    url = "https://api.daac.asf.alaska.edu/services/search/param?" + urlencode(params)
    data, cached = cached_json(url, ttl=300, timeout=20)
    return data, cached, url


def asf_baseline(reference, max_results=60):
    params = {"reference": reference, "output": "geojson", "maxResults": str(max(1, min(200, int(max_results))))}
    url = "https://api.daac.asf.alaska.edu/services/search/baseline?" + urlencode(params)
    data, cached = cached_json(url, ttl=300, timeout=20)
    return data, cached, url


def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def sentinel_granule_time(granule):
    """Best-effort acquisition time from an ESA Sentinel-1 granule name."""
    m = re.search(r"_(\d{8}T\d{6})_(?:\d{8}T\d{6})_", str(granule or ""))
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _local_name(tag):
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _child_text(node, name):
    if node is None:
        return ""
    for child in list(node):
        if _local_name(child.tag) == name:
            return (child.text or "").strip()
    return ""


def parse_cap_alerts(raw_xml):
    """Parse one CAP alert or a wrapper containing CAP alert elements.

    Returned content is intentionally a display/reference subset. The original
    CAP XML remains authoritative if a consuming agency needs every field.
    """
    root = ET.fromstring(raw_xml)
    alerts = [root] if _local_name(root.tag) == "alert" else [x for x in root.iter() if _local_name(x.tag) == "alert"]
    out = []
    for alert in alerts[:100]:
        item = {
            "identifier": _child_text(alert, "identifier"),
            "sender": _child_text(alert, "sender"),
            "sent": _child_text(alert, "sent"),
            "status": _child_text(alert, "status"),
            "msgType": _child_text(alert, "msgType"),
            "scope": _child_text(alert, "scope"),
            "infos": [],
        }
        for info in [x for x in list(alert) if _local_name(x.tag) == "info"]:
            info_obj = {
                "language": _child_text(info, "language") or "und",
                "event": _child_text(info, "event"),
                "urgency": _child_text(info, "urgency"),
                "severity": _child_text(info, "severity"),
                "certainty": _child_text(info, "certainty"),
                "headline": _child_text(info, "headline"),
                "description": _child_text(info, "description"),
                "instruction": _child_text(info, "instruction"),
                "effective": _child_text(info, "effective"),
                "expires": _child_text(info, "expires"),
                "areas": [],
            }
            for area in [x for x in list(info) if _local_name(x.tag) == "area"]:
                circles = [(x.text or "").strip() for x in list(area) if _local_name(x.tag) == "circle" and (x.text or "").strip()]
                polygons = [(x.text or "").strip() for x in list(area) if _local_name(x.tag) == "polygon" and (x.text or "").strip()]
                info_obj["areas"].append({
                    "areaDesc": _child_text(area, "areaDesc"),
                    "circles": circles,
                    "polygons": polygons,
                })
            item["infos"].append(info_obj)
        out.append(item)
    return out


def fetch_sachet_cap(url, timeout=15):
    """Fetch an authorised/read-only SACHET CAP document using mandatory ETag caching."""
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "sachet.ndma.gov.in":
        raise ValueError("SACHET CAP feed URL must use https://sachet.ndma.gov.in")
    headers = {
        "User-Agent": "HIMGAURAV/8.0 research-prototype",
        "Accept": "application/xml,text/xml;q=0.9,*/*;q=0.1",
    }
    if SACHET_CACHE.get("url") == url and SACHET_CACHE.get("etag"):
        headers["If-None-Match"] = SACHET_CACHE["etag"]
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=timeout) as r:
            body = r.read()
            etag = r.headers.get("ETag")
            SACHET_CACHE.update(url=url, etag=etag, body=body, fetched_at=time.time())
            return body, False, etag
    except HTTPError as e:
        if e.code == 304 and SACHET_CACHE.get("url") == url and SACHET_CACHE.get("body"):
            SACHET_CACHE["fetched_at"] = time.time()
            return SACHET_CACHE["body"], True, SACHET_CACHE.get("etag")
        raise


class Handler(SimpleHTTPRequestHandler):
    server_version = "HIMGAURAV/8.0"

    def _json(self, payload, status=200, cache_control="no-store"):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache_control)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _raw(self, body, content_type, status=200, cache_control="public, max-age=86400"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache_control)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _api_error(self, message, status=502, source=None):
        self._json({"ok": False, "error": message, "source": source}, status=status)

    def _read_json_body(self, limit=131072):
        try:
            size = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            size = 0
        if size <= 0:
            return {}
        if size > limit:
            raise ValueError("request body too large")
        raw = self.rfile.read(size)
        return json.loads(raw.decode("utf-8"))

    def _post_json_upstream(self, url, payload, headers=None, timeout=15):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        h = {"User-Agent": "HIMGAURAV/8.0 research-prototype", "Content-Type": "application/json", "Accept": "application/json"}
        if headers:
            h.update(headers)
        req = Request(url, data=body, headers=h, method="POST")
        with urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", errors="replace")
            ctype = r.headers.get("Content-Type", "")
            if "json" in ctype.lower() or raw.lstrip().startswith(("{", "[")):
                return json.loads(raw)
            return {"raw": raw[:4000]}

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return self._api_error("POST route not found", 404)
        try:
            payload = self._read_json_body()

            if parsed.path == "/api/translate":
                key = os.environ.get("BHASHINI_INFERENCE_API_KEY", "").strip()
                if not key:
                    return self._api_error("BHASHINI_INFERENCE_API_KEY is not configured", 503, "BHASHINI")
                source = str(payload.get("sourceLanguage") or "en").strip()
                target = str(payload.get("targetLanguage") or "").strip()
                texts = payload.get("texts") or []
                if not target or not isinstance(texts, list) or not texts or len(texts) > 8:
                    return self._api_error("targetLanguage and 1-8 texts are required", 400, "BHASHINI")
                texts = [str(x)[:1800] for x in texts]
                service_id = os.environ.get("BHASHINI_TRANSLATION_SERVICE_ID", "bhashini/iiith/nmt-all").strip()
                req_payload = {
                    "pipelineTasks": [{
                        "taskType": "translation",
                        "config": {
                            "language": {"sourceLanguage": source, "targetLanguage": target},
                            "serviceId": service_id,
                        },
                    }],
                    "inputData": {"input": [{"source": x} for x in texts]},
                }
                data = self._post_json_upstream(
                    "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
                    req_payload,
                    headers={"Authorization": key, "Accept": "*/*"},
                    timeout=20,
                )
                out = (((data or {}).get("pipelineResponse") or [{}])[0].get("output") or [])
                translations = [str(x.get("target") or "") for x in out if isinstance(x, dict)]
                if len(translations) != len(texts):
                    return self._api_error("BHASHINI returned an incomplete translation response", 502, "BHASHINI")
                return self._json({"ok": True, "source": "BHASHINI Dhruva", "translations": translations, "service_id": service_id})

            if parsed.path == "/api/tts":
                key = os.environ.get("BHASHINI_INFERENCE_API_KEY", "").strip()
                if not key:
                    return self._api_error("BHASHINI_INFERENCE_API_KEY is not configured", 503, "BHASHINI")
                language = str(payload.get("language") or "").strip()
                text = str(payload.get("text") or "").strip()
                gender = str(payload.get("gender") or "female").strip().lower()
                if not language or not text:
                    return self._api_error("language and text are required", 400, "BHASHINI")
                if len(text) > 1800:
                    return self._api_error("text is too long for alert speech", 400, "BHASHINI")
                if gender not in ("female", "male"):
                    gender = "female"
                service_id = os.environ.get("BHASHINI_TTS_SERVICE_ID", "Bhashini/IITM/TTS").strip()
                req_payload = {
                    "pipelineTasks": [{
                        "taskType": "tts",
                        "config": {
                            "language": {"sourceLanguage": language},
                            "serviceId": service_id,
                            "gender": gender,
                        },
                    }],
                    "inputData": {"input": [{"source": text}]},
                }
                data = self._post_json_upstream(
                    "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
                    req_payload,
                    headers={"Authorization": key, "Accept": "*/*"},
                    timeout=25,
                )

                def find_audio(obj):
                    if isinstance(obj, dict):
                        val = obj.get("audioContent")
                        if isinstance(val, str) and len(val) > 64:
                            return val
                        for value in obj.values():
                            hit = find_audio(value)
                            if hit:
                                return hit
                    elif isinstance(obj, list):
                        for value in obj:
                            hit = find_audio(value)
                            if hit:
                                return hit
                    return None

                audio = find_audio(data)
                if not audio:
                    return self._api_error("BHASHINI returned no audio payload", 502, "BHASHINI")
                return self._json({
                    "ok": True,
                    "source": "BHASHINI Dhruva TTS",
                    "audio_content": audio,
                    "mime": "audio/wav",
                    "service_id": service_id,
                })

            if parsed.path == "/api/hyp3/submit":
                token = os.environ.get("EARTHDATA_TOKEN", "").strip()
                if not token:
                    return self._api_error("EARTHDATA_TOKEN is not configured; create a NASA Earthdata token and keep it server-side", 503, "ASF HyP3")
                reference = str(payload.get("reference") or "").strip()
                secondary = str(payload.get("secondary") or "").strip()
                if not reference.startswith("S1") or not secondary.startswith("S1") or reference == secondary:
                    return self._api_error("two distinct Sentinel-1 ESA granule IDs are required", 400, "ASF HyP3")
                # HyP3 InSAR products use the earlier acquisition as reference and the later one as secondary.
                rt, st = sentinel_granule_time(reference), sentinel_granule_time(secondary)
                reordered = False
                if rt and st and rt > st:
                    reference, secondary = secondary, reference
                    reordered = True
                looks = str(payload.get("looks") or "20x4")
                if looks not in ("20x4", "10x2"):
                    looks = "20x4"
                name = str(payload.get("name") or f"HIMGAURAV-{int(time.time())}")[:80]
                job = {
                    "name": name,
                    "job_type": "INSAR_GAMMA",
                    "job_parameters": {
                        "granules": [reference, secondary],
                        "looks": looks,
                        "include_displacement_maps": bool(payload.get("include_displacement_maps", True)),
                        "include_look_vectors": bool(payload.get("include_look_vectors", False)),
                        "include_inc_map": True,
                        "apply_water_mask": bool(payload.get("apply_water_mask", False)),
                    },
                }
                data = auth_json("https://hyp3-api.asf.alaska.edu/jobs", token, method="POST", payload={"jobs": [job]}, timeout=30)
                return self._json({"ok": True, "source": "ASF HyP3", "submitted": True, "ordered_pair": {"reference": reference, "secondary": secondary, "reordered": reordered}, "data": data})

            if parsed.path == "/api/asf/automation":
                lat = float(payload.get("lat"))
                lon = float(payload.get("lon"))
                lookback = max(24, min(730, int(payload.get("lookback_days") or 120)))
                end = datetime.now(timezone.utc)
                start = end - timedelta(days=lookback)
                search, _, _ = asf_search(lat, lon, start.isoformat(), end.isoformat(), 12)
                feats = list((search or {}).get("features") or [])
                if not feats:
                    return self._json({"ok": True, "source": "ASF SearchAPI", "pair": None, "submitted": False, "message": "No Sentinel-1 IW SLC acquisition found in the requested lookback window."})
                feats.sort(key=lambda f: asf_scene_time(f), reverse=True)
                newest = feats[0]
                newest_id = asf_scene_id(newest)
                baseline, _, _ = asf_baseline(newest_id, 80)
                candidates = [f for f in (baseline or {}).get("features", []) if asf_scene_id(f) and asf_scene_id(f) != newest_id]
                if not candidates:
                    return self._json({"ok": True, "source": "ASF SearchAPI", "pair": None, "submitted": False, "message": "A recent scene was found, but ASF returned no baseline neighbour for it."})
                # Prefer the temporally closest older acquisition. ASF baseline search already constrains pair geometry.
                newest_t = parse_dt(asf_scene_time(newest))
                ranked = []
                for f in candidates:
                    t = parse_dt(asf_scene_time(f))
                    if newest_t and t and t < newest_t:
                        ranked.append(((newest_t - t).total_seconds(), f))
                candidate = min(ranked, key=lambda x: x[0])[1] if ranked else candidates[0]
                older_id = asf_scene_id(candidate)
                older_t = asf_scene_time(candidate)
                pair = {"reference": older_id, "secondary": newest_id, "reference_time": older_t, "secondary_time": asf_scene_time(newest)}
                submitted = False
                result = None
                allow = os.environ.get("ASF_AUTO_SUBMIT", "0").strip().lower() in ("1", "true", "yes")
                confirm = bool(payload.get("confirm_submit"))
                token = os.environ.get("EARTHDATA_TOKEN", "").strip()
                if allow and confirm and token:
                    job = {"name": f"HIMGAURAV-auto-{int(time.time())}", "job_type": "INSAR_GAMMA", "job_parameters": {"granules": [older_id, newest_id], "looks": "20x4", "include_displacement_maps": True, "include_inc_map": True}}
                    result = auth_json("https://hyp3-api.asf.alaska.edu/jobs", token, method="POST", payload={"jobs": [job]}, timeout=30)
                    submitted = True
                msg = "Compatible pair discovered from ASF archive."
                if allow and not confirm:
                    msg += " Auto-submit is armed server-side, but this cycle was discovery-only because explicit confirmation was not supplied."
                elif not allow:
                    msg += " ASF_AUTO_SUBMIT is off, so no processing credits were consumed."
                return self._json({"ok": True, "source": "ASF SearchAPI + baseline", "pair": pair, "submitted": submitted, "hyp3": result, "message": msg})

            if parsed.path in ("/api/alert/webhook", "/api/alert/local-gateway"):
                env_name = "ALERT_WEBHOOK_URL" if parsed.path.endswith("webhook") else "LOCAL_GATEWAY_WEBHOOK_URL"
                token_name = "ALERT_WEBHOOK_TOKEN" if parsed.path.endswith("webhook") else "LOCAL_GATEWAY_WEBHOOK_TOKEN"
                target = os.environ.get(env_name, "").strip()
                if not target:
                    return self._api_error(f"{env_name} is not configured", 503, "HIMGAURAV connector")
                u = urlparse(target)
                if u.scheme not in ("http", "https") or not u.netloc:
                    return self._api_error(f"{env_name} must be an http(s) URL", 500, "HIMGAURAV connector")
                headers = {"X-HIMGAURAV-Prototype": "true"}
                token = os.environ.get(token_name, "").strip()
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                response = self._post_json_upstream(target, payload, headers=headers, timeout=12)
                return self._json({"ok": True, "source": "configured webhook", "accepted": True, "upstream": response})

            return self._api_error("unknown API route", 404)
        except HTTPError as e:
            return self._api_error(f"upstream HTTP {e.code}", 502)
        except URLError as e:
            return self._api_error(f"upstream network error: {getattr(e, 'reason', e)}", 502)
        except ValueError as e:
            return self._api_error(str(e), 400)
        except TimeoutError:
            return self._api_error("upstream timeout", 504)
        except Exception as e:
            return self._api_error(f"gateway error: {type(e).__name__}: {e}", 500)

    def do_GET(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return super().do_GET()

        qs = parse_qs(parsed.query)
        try:
            if parsed.path == "/api/vendor/leaflet.js":
                body = cached_bytes([
                    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
                    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
                    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js",
                ])
                return self._raw(body, "application/javascript; charset=utf-8")

            if parsed.path == "/api/vendor/leaflet.css":
                body = cached_bytes([
                    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
                    "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
                    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css",
                ])
                return self._raw(body, "text/css; charset=utf-8")

            if parsed.path == "/api/health":
                return self._json({
                    "ok": True,
                    "server": "HIMGAURAV local data gateway",
                    "build": BUILD,
                    "time_utc": datetime.now(timezone.utc).isoformat(),
                    "private_thingspeak_key_configured": bool(os.environ.get("THINGSPEAK_READ_KEY")),
                    "bhashini_configured": bool(os.environ.get("BHASHINI_INFERENCE_API_KEY")),
                    "bhashini_tts_configured": bool(os.environ.get("BHASHINI_INFERENCE_API_KEY")),
                    "alert_webhook_configured": bool(os.environ.get("ALERT_WEBHOOK_URL")),
                    "local_gateway_configured": bool(os.environ.get("LOCAL_GATEWAY_WEBHOOK_URL")),
                    "sachet_feed_configured": bool(os.environ.get("SACHET_CAP_FEED_URL") or os.environ.get("SACHET_CAP_IDENTIFIER")),
                    "earthdata_token_configured": bool(os.environ.get("EARTHDATA_TOKEN")),
                    "asf_auto_submit": os.environ.get("ASF_AUTO_SUBMIT", "0").strip().lower() in ("1", "true", "yes"),
                    "public_warning_access": False,
                })

            if parsed.path == "/api/official-alerts":
                feed_url = os.environ.get("SACHET_CAP_FEED_URL", "").strip()
                identifier = os.environ.get("SACHET_CAP_IDENTIFIER", "").strip()
                if not feed_url and identifier:
                    feed_url = "https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?" + urlencode({"identifier": identifier})
                if not feed_url:
                    return self._api_error("SACHET CAP feed is not configured; use only an agency-provided identifier/feed URL", 503, "NDMA SACHET")
                body, cached, etag = fetch_sachet_cap(feed_url)
                try:
                    alerts = parse_cap_alerts(body)
                except ET.ParseError as e:
                    return self._api_error(f"SACHET returned invalid CAP XML: {e}", 502, "NDMA SACHET")
                return self._json({
                    "ok": True,
                    "source": "NDMA SACHET CAP feed",
                    "read_only": True,
                    "cached_by_gateway": cached,
                    "etag_present": bool(etag),
                    "alerts": alerts,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                })

            if parsed.path == "/api/imd":
                station = (qs.get("station") or ["42079"])[0].strip()
                if not station.isdigit() or len(station) > 8:
                    return self._api_error("numeric IMD station id is required", 400, "IMD")
                url = "https://api.imd.gov.in/api/v1/current_wx?" + urlencode({"id": station})
                data, cached = cached_json(url, ttl=300, timeout=15)
                return self._json({"ok": True, "source": "India Meteorological Department current_wx", "station": station, "cached_by_gateway": cached, "data": data})

            if parsed.path == "/api/asf/search":
                try:
                    lat = float((qs.get("lat") or [""])[0]); lon = float((qs.get("lon") or [""])[0])
                except ValueError:
                    return self._api_error("lat and lon are required", 400, "ASF SearchAPI")
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    return self._api_error("invalid coordinates", 400, "ASF SearchAPI")
                try:
                    max_results = int((qs.get("max") or ["24"])[0])
                except ValueError:
                    max_results = 24
                start = (qs.get("start") or [""])[0].strip(); end = (qs.get("end") or [""])[0].strip()
                if not start or not end:
                    try: days = max(1, min(3650, int((qs.get("days") or ["180"])[0])))
                    except ValueError: days = 180
                    end_dt = datetime.now(timezone.utc); start_dt = end_dt - timedelta(days=days)
                    start, end = start_dt.isoformat(), end_dt.isoformat()
                data, cached, url = asf_search(lat, lon, start, end, max_results)
                return self._json({"ok": True, "source": "NASA ASF SearchAPI", "cached_by_gateway": cached, "query": {"lat": lat, "lon": lon, "start": start, "end": end, "processingLevel": "SLC", "beamMode": "IW"}, "data": data})

            if parsed.path == "/api/asf/baseline":
                reference = (qs.get("reference") or [""])[0].strip()
                if not reference.startswith("S1") or len(reference) > 180:
                    return self._api_error("valid Sentinel-1 reference granule id is required", 400, "ASF baseline")
                try: max_results = int((qs.get("max") or ["60"])[0])
                except ValueError: max_results = 60
                data, cached, url = asf_baseline(reference, max_results)
                return self._json({"ok": True, "source": "NASA ASF Baseline Search", "cached_by_gateway": cached, "reference": reference, "data": data})

            if parsed.path == "/api/hyp3/status":
                token = os.environ.get("EARTHDATA_TOKEN", "").strip()
                if not token:
                    return self._json({"ok": True, "source": "ASF HyP3", "configured": False, "auto_submit": False})
                user = auth_json("https://hyp3-api.asf.alaska.edu/user", token, timeout=15)
                costs = auth_json("https://hyp3-api.asf.alaska.edu/costs", token, timeout=15)
                return self._json({"ok": True, "source": "ASF HyP3", "configured": True, "auto_submit": os.environ.get("ASF_AUTO_SUBMIT", "0").strip().lower() in ("1", "true", "yes"), "user": user, "costs": costs})

            if parsed.path == "/api/hyp3/jobs":
                token = os.environ.get("EARTHDATA_TOKEN", "").strip()
                if not token:
                    return self._api_error("EARTHDATA_TOKEN is not configured", 503, "ASF HyP3")
                try: limit = max(1, min(100, int((qs.get("limit") or ["40"])[0])))
                except ValueError: limit = 40
                data = auth_json("https://hyp3-api.asf.alaska.edu/jobs?" + urlencode({"limit": str(limit)}), token, timeout=20)
                return self._json({"ok": True, "source": "ASF HyP3", "jobs": data.get("jobs", []), "next": data.get("next")})

            if parsed.path == "/api/weather":
                lat = (qs.get("lat") or qs.get("latitude") or [""])[0]
                lon = (qs.get("lon") or qs.get("longitude") or [""])[0]
                if not lat or not lon:
                    return self._api_error("latitude and longitude are required", 400, "Open-Meteo")
                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "daily": "precipitation_sum",
                    "hourly": "precipitation,soil_moisture_0_to_7cm,soil_moisture_7_to_28cm",
                    "current": "temperature_2m,relative_humidity_2m,precipitation",
                    "past_days": "31",
                    "forecast_days": "7",
                    "timezone": "Asia/Kolkata",
                }
                url = "https://api.open-meteo.com/v1/forecast?" + urlencode(params, safe=",")
                data, cached = cached_json(url, ttl=300)
                self.send_header if False else None
                return self._json({"ok": True, "source": "Open-Meteo", "cached_by_gateway": cached, "data": data})

            if parsed.path == "/api/quakes":
                start = (datetime.now(timezone.utc) - timedelta(days=90)).date().isoformat()
                params = {
                    "format": "geojson", "starttime": start,
                    "minlatitude": "29.8", "maxlatitude": "33.6",
                    "minlongitude": "75.0", "maxlongitude": "79.6",
                    "minmagnitude": "2.5", "orderby": "time", "limit": "60",
                }
                url = "https://earthquake.usgs.gov/fdsnws/event/1/query?" + urlencode(params)
                data, cached = cached_json(url, ttl=300)
                return self._json({"ok": True, "source": "USGS FDSN", "cached_by_gateway": cached, "data": data})

            if parsed.path == "/api/radar":
                url = "https://api.rainviewer.com/public/weather-maps.json"
                data, cached = cached_json(url, ttl=120)
                return self._json({"ok": True, "source": "RainViewer", "cached_by_gateway": cached, "data": data})

            if parsed.path == "/api/thingspeak":
                channel = (qs.get("channel") or [""])[0].strip()
                if not channel.isdigit():
                    return self._api_error("numeric channel is required", 400, "ThingSpeak")
                try:
                    results = max(1, min(8000, int((qs.get("results") or ["200"])[0])))
                except ValueError:
                    results = 200
                params = {"results": str(results)}
                configured_channel = os.environ.get("THINGSPEAK_CHANNEL_ID", "").strip()
                read_key = os.environ.get("THINGSPEAK_READ_KEY", "").strip()
                if read_key and (not configured_channel or configured_channel == channel):
                    params["api_key"] = read_key
                url = f"https://api.thingspeak.com/channels/{channel}/feeds.json?" + urlencode(params)
                data, cached = cached_json(url, ttl=15)
                return self._json({"ok": True, "source": "ThingSpeak", "cached_by_gateway": cached, "data": data})


            # ------------------------------------------------------------------ #
            #  LOCATION HAZARD INTELLIGENCE — all real upstream data, no fabrication
            # ------------------------------------------------------------------ #

            if parsed.path == "/api/geocode":
                q = (qs.get("q") or [""])[0].strip()
                if not q:
                    return self._api_error("q (location name) is required", 400, "Nominatim")
                params = {
                    "q": q, "format": "json", "limit": "5",
                    "addressdetails": "1", "extratags": "1",
                    "accept-language": "en",
                }
                url = "https://nominatim.openstreetmap.org/search?" + urlencode(params)
                req = Request(url, headers={
                    "User-Agent": "HIMGAURAV/8.0 hazard-intelligence",
                    "Accept": "application/json",
                })
                with urlopen(req, timeout=10) as r:
                    data = json.loads(r.read().decode("utf-8"))
                return self._json({"ok": True, "source": "OpenStreetMap Nominatim", "results": data})

            if parsed.path == "/api/hazard/quakes":
                try:
                    lat = float((qs.get("lat") or [""])[0])
                    lon = float((qs.get("lon") or [""])[0])
                except (ValueError, IndexError):
                    return self._api_error("lat and lon required", 400, "USGS FDSN")
                try:
                    radius_km = min(500, max(10, int((qs.get("radius") or ["200"])[0])))
                    days = min(730, max(7, int((qs.get("days") or ["365"])[0])))
                    min_mag = float((qs.get("minmag") or ["2.5"])[0])
                except (ValueError, IndexError):
                    radius_km, days, min_mag = 200, 365, 2.5
                start = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
                params = {
                    "format": "geojson",
                    "starttime": start,
                    "latitude": str(lat), "longitude": str(lon),
                    "maxradiuskm": str(radius_km),
                    "minmagnitude": str(min_mag),
                    "orderby": "magnitude",
                    "limit": "100",
                }
                url = "https://earthquake.usgs.gov/fdsnws/event/1/query?" + urlencode(params)
                data, cached = cached_json(url, ttl=600, timeout=20)
                features = (data or {}).get("features", [])
                events = [
                    {
                        "time": f.get("properties", {}).get("time"),
                        "mag": f.get("properties", {}).get("mag"),
                        "place": f.get("properties", {}).get("place"),
                        "depth_km": (f.get("geometry", {}).get("coordinates") or [None, None, None])[2],
                        "url": f.get("properties", {}).get("url"),
                    }
                    for f in features[:50]
                ]
                mags = [e["mag"] for e in events if isinstance(e["mag"], (int, float))]
                return self._json({
                    "ok": True, "source": "USGS Earthquake Hazards Program",
                    "cached_by_gateway": cached,
                    "query": {"lat": lat, "lon": lon, "radius_km": radius_km, "days": days, "min_magnitude": min_mag},
                    "count": len(events),
                    "max_magnitude": max(mags, default=None),
                    "mean_magnitude": round(sum(mags) / len(mags), 2) if mags else None,
                    "events": events,
                })

            if parsed.path == "/api/hazard/events":
                # NASA EONET — real natural event catalogue (landslides, floods, volcanoes, severe storms)
                try:
                    lat = float((qs.get("lat") or [""])[0])
                    lon = float((qs.get("lon") or [""])[0])
                    radius_km = min(500, max(10, int((qs.get("radius") or ["300"])[0])))
                    days = min(1825, max(30, int((qs.get("days") or ["730"])[0])))
                except (ValueError, IndexError):
                    return self._api_error("lat, lon required", 400, "NASA EONET")
                categories = "landslides,severeStorms,floods,volcanoes"
                url = (
                    "https://eonet.gsfc.nasa.gov/api/v3/events?status=all"
                    f"&days={days}&categories={categories}&limit=200"
                )
                data, cached = cached_json(url, ttl=3600, timeout=20)
                events_raw = (data or {}).get("events", [])

                def haversine_km(la1, lo1, la2, lo2):
                    import math
                    R = 6371
                    dlat = math.radians(la2 - la1); dlon = math.radians(lo2 - lo1)
                    a = math.sin(dlat/2)**2 + math.cos(math.radians(la1))*math.cos(math.radians(la2))*math.sin(dlon/2)**2
                    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

                nearby = []
                for ev in events_raw:
                    for geom in (ev.get("geometry") or []):
                        coords = geom.get("coordinates") or []
                        if not coords:
                            continue
                        # Handle all GeoJSON geometry types safely:
                        # Point:      coords = [lon, lat]
                        # LineString/MultiPoint: coords = [[lon,lat], ...]
                        # Polygon:    coords = [[[lon,lat], ...]]  (ring of rings)
                        try:
                            first = coords[0]
                            if isinstance(first, (int, float)):
                                # Point geometry — direct [lon, lat]
                                elo, ela = float(coords[0]), float(coords[1])
                            elif isinstance(first, list) and isinstance(first[0], list):
                                # Polygon — coords is [ring], ring is [[lon,lat],...]
                                # Use centroid of the outer ring
                                ring = first
                                elo = sum(p[0] for p in ring) / len(ring)
                                ela = sum(p[1] for p in ring) / len(ring)
                            elif isinstance(first, list) and isinstance(first[0], (int, float)):
                                # LineString / MultiPoint — use first coordinate pair
                                elo, ela = float(first[0]), float(first[1])
                            else:
                                continue
                        except (IndexError, TypeError, ZeroDivisionError):
                            continue
                        dist = haversine_km(lat, lon, ela, elo)
                        if dist <= radius_km:
                            nearby.append({
                                "title": ev.get("title"),
                                "category": (ev.get("categories") or [{}])[0].get("title"),
                                "distance_km": round(dist, 1),
                                "date": geom.get("date"),
                                "closed": ev.get("closed"),
                                "link": (ev.get("sources") or [{}])[0].get("url"),
                            })
                            break
                nearby.sort(key=lambda x: x.get("distance_km", 999))
                return self._json({
                    "ok": True, "source": "NASA EONET Natural Events",
                    "cached_by_gateway": cached,
                    "query": {"lat": lat, "lon": lon, "radius_km": radius_km, "days": days},
                    "count": len(nearby),
                    "events": nearby[:40],
                })

            if parsed.path == "/api/hazard/reports":
                # ReliefWeb — real humanitarian/disaster reports, free public API
                try:
                    lat = float((qs.get("lat") or [""])[0])
                    lon = float((qs.get("lon") or [""])[0])
                except (ValueError, IndexError):
                    return self._api_error("lat, lon required", 400, "ReliefWeb")
                q_label = (qs.get("label") or ["India"])[0].strip()[:80]
                # Search for landslide reports near this location in India
                payload_bytes = json.dumps({
                    "query": {"value": f"landslide OR flood OR disaster {q_label}", "operator": "AND"},
                    "filter": {"field": "country.name", "value": "India"},
                    "sort": ["date:desc"],
                    "limit": 20,
                    "fields": {"include": ["title", "date", "source", "url", "body-html", "primary_country", "disaster_type"]},
                }, ensure_ascii=False).encode("utf-8")
                req = Request(
                    "https://api.reliefweb.int/v2/reports?appname=HIMGAURAV",
                    data=payload_bytes,
                    headers={"User-Agent": "HIMGAURAV/8.0", "Content-Type": "application/json", "Accept": "application/json"},
                    method="POST",
                )
                with urlopen(req, timeout=15) as r:
                    rw_data = json.loads(r.read().decode("utf-8"))
                items = rw_data.get("data") or []
                reports = [
                    {
                        "title": it.get("fields", {}).get("title"),
                        "date": (it.get("fields", {}).get("date") or {}).get("created"),
                        "source": [(s.get("name") if isinstance(s, dict) else s) for s in (it.get("fields", {}).get("source") or [])],
                        "url": it.get("fields", {}).get("url"),
                        "type": [(t.get("name") if isinstance(t, dict) else t) for t in (it.get("fields", {}).get("disaster_type") or [])],
                    }
                    for it in items
                ]
                return self._json({
                    "ok": True, "source": "ReliefWeb (UN OCHA)",
                    "query_label": q_label,
                    "count": len(reports),
                    "reports": reports,
                })

            if parsed.path == "/api/hazard/rain":
                # Open-Meteo historical for any lat/lon — 90-day accumulated precipitation
                try:
                    lat = float((qs.get("lat") or [""])[0])
                    lon = float((qs.get("lon") or [""])[0])
                except (ValueError, IndexError):
                    return self._api_error("lat, lon required", 400, "Open-Meteo")
                end_dt = datetime.now(timezone.utc).date()
                start_dt = end_dt - timedelta(days=90)
                params = {
                    "latitude": str(lat), "longitude": str(lon),
                    "daily": "precipitation_sum,rain_sum",
                    "start_date": start_dt.isoformat(),
                    "end_date": end_dt.isoformat(),
                    "timezone": "Asia/Kolkata",
                }
                url = "https://archive-api.open-meteo.com/v1/archive?" + urlencode(params, safe=",")
                data, cached = cached_json(url, ttl=3600, timeout=20)
                daily = (data or {}).get("daily") or {}
                dates = daily.get("time") or []
                rain = [v for v in (daily.get("precipitation_sum") or []) if v is not None]
                total_90d = round(sum(rain), 1)
                recent_30d = round(sum(rain[-30:]), 1) if len(rain) >= 30 else round(sum(rain), 1)
                peak_day = max(rain, default=0)
                return self._json({
                    "ok": True, "source": "Open-Meteo ERA5 archive",
                    "cached_by_gateway": cached,
                    "query": {"lat": lat, "lon": lon},
                    "total_90day_mm": total_90d,
                    "recent_30day_mm": recent_30d,
                    "peak_day_mm": round(peak_day, 1),
                    "days_with_rain": sum(1 for v in rain if v > 1),
                    "daily": {"dates": dates[-30:], "rain_mm": [round(v, 1) for v in rain[-30:]]},
                })

            return self._api_error("unknown API route", 404)

        except HTTPError as e:
            return self._api_error(f"upstream HTTP {e.code}", 502)
        except URLError as e:
            return self._api_error(f"upstream network error: {getattr(e, 'reason', e)}", 502)
        except TimeoutError:
            return self._api_error("upstream timeout", 504)
        except Exception as e:
            return self._api_error(f"gateway error: {type(e).__name__}: {e}", 500)


mimetypes.add_type("application/javascript", ".js")

if __name__ == "__main__":
    print(f"HIMGAURAV {BUILD}: http://127.0.0.1:{PORT}", flush=True)
    print("Run through this local server for the most reliable LIVE mode and API proxying.", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
