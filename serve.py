from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from datetime import datetime, timedelta, timezone
import json
import mimetypes
import os
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
BUILD = "7.0-acusearch-lab"
PORT = int(os.environ.get("PORT", "8807"))


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
            req = Request(url, headers={"User-Agent": "HIMGAURAV/7.0 research-prototype"})
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
        "User-Agent": "HIMGAURAV/7.0 research-prototype",
        "Accept": "application/json",
    })
    with urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read().decode("utf-8"))
    CACHE[url] = (now, data)
    return data, False


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
        "User-Agent": "HIMGAURAV/7.0 research-prototype",
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
    server_version = "HIMGAURAV/7.0"

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
        h = {"User-Agent": "HIMGAURAV/7.0 research-prototype", "Content-Type": "application/json", "Accept": "application/json"}
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

            if parsed.path == "/api/weather":
                lat = (qs.get("latitude") or [""])[0]
                lon = (qs.get("longitude") or [""])[0]
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
