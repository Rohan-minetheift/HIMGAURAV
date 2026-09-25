#!/usr/bin/env python3
"""HIMGAURAV ASF Sentinel-1 discovery / HyP3 processing helper.

Default behaviour is SAFE: discovery only, no HyP3 credits consumed.
To submit, the operator must provide BOTH --submit and --yes and have
EARTHDATA_TOKEN configured in the environment.

This script is for research automation, not an operational public warning path.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ASF_SEARCH = "https://api.daac.asf.alaska.edu/services/search/param"
ASF_BASELINE = "https://api.daac.asf.alaska.edu/services/search/baseline"
HYP3_JOBS = "https://hyp3-api.asf.alaska.edu/jobs"
UA = "HIMGAURAV/8.0 validation-sar-research"


def get_json(url: str, token: str | None = None, timeout: int = 30):
    headers = {"Accept": "application/json", "User-Agent": UA}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with urlopen(Request(url, headers=headers), timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def post_json(url: str, payload: dict, token: str, timeout: int = 30):
    body = json.dumps(payload).encode("utf-8")
    req = Request(url, data=body, method="POST", headers={
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "User-Agent": UA,
    })
    with urlopen(req, timeout=timeout) as r:
        raw = r.read().decode("utf-8")
        return json.loads(raw) if raw.strip() else {}


def scene_id(feature: dict) -> str:
    p = feature.get("properties") or {}
    for k in ("sceneName", "granuleName", "fileID", "fileName", "productName", "name"):
        if p.get(k):
            return str(p[k])
    return str(feature.get("id") or "")


def scene_time(feature: dict) -> str:
    p = feature.get("properties") or {}
    for k in ("startTime", "start", "sceneDate", "acquisitionDate", "stopTime"):
        if p.get(k):
            return str(p[k])
    return ""


def dt(value: str):
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def discover(lat: float, lon: float, days: int):
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    q = {
        "dataset": "SENTINEL-1",
        "processingLevel": "SLC",
        "beamMode": "IW",
        "intersectsWith": f"POINT({lon} {lat})",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "maxResults": "20",
        "output": "geojson",
    }
    result = get_json(ASF_SEARCH + "?" + urlencode(q))
    feats = list(result.get("features") or [])
    feats.sort(key=scene_time, reverse=True)
    if not feats:
        return None
    newest = feats[0]
    ref = scene_id(newest)
    b = get_json(ASF_BASELINE + "?" + urlencode({"reference": ref, "output": "geojson", "maxResults": "100"}))
    candidates = [f for f in (b.get("features") or []) if scene_id(f) and scene_id(f) != ref]
    if not candidates:
        return {"latest": ref, "latest_time": scene_time(newest), "pair": None}
    nt = dt(scene_time(newest))
    older = []
    for f in candidates:
        t = dt(scene_time(f))
        if nt and t and t < nt:
            older.append(((nt - t).total_seconds(), f))
    secondary = min(older, key=lambda x: x[0])[1] if older else candidates[0]
    return {
        "latest": ref,
        "latest_time": scene_time(newest),
        "pair": {
            "reference": scene_id(secondary),
            "reference_time": scene_time(secondary),
            "secondary": ref,
            "secondary_time": scene_time(newest),
        },
    }


def main():
    ap = argparse.ArgumentParser(description="Discover new Sentinel-1 IW SLC pairs at ASF; optionally submit real HyP3 InSAR processing.")
    ap.add_argument("--lat", type=float, default=31.5333)
    ap.add_argument("--lon", type=float, default=76.8833)
    ap.add_argument("--days", type=int, default=120)
    ap.add_argument("--submit", action="store_true", help="request HyP3 submission (still requires --yes)")
    ap.add_argument("--yes", action="store_true", help="explicit confirmation that processing credits may be consumed")
    ap.add_argument("--looks", choices=("20x4", "10x2"), default="20x4")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if not (-90 <= args.lat <= 90 and -180 <= args.lon <= 180):
        ap.error("invalid coordinates")

    result = discover(args.lat, args.lon, max(1, min(730, args.days)))
    out = {"queried_at": datetime.now(timezone.utc).isoformat(), "lat": args.lat, "lon": args.lon, "discovery": result, "submitted": False}
    if not result:
        out["message"] = "No Sentinel-1 IW SLC acquisition found in the search window."
    elif not result.get("pair"):
        out["message"] = "A scene was found but ASF baseline search returned no candidate pair."
    else:
        out["message"] = "Real ASF baseline-compatible pair discovered."
        if args.submit:
            if not args.yes:
                raise SystemExit("Refusing to submit: add --yes to confirm HyP3 credit use.")
            token = os.environ.get("EARTHDATA_TOKEN", "").strip()
            if not token:
                raise SystemExit("EARTHDATA_TOKEN is not configured.")
            pair = result["pair"]
            job = {
                "name": f"HIMGAURAV-watch-{int(datetime.now().timestamp())}",
                "job_type": "INSAR_GAMMA",
                "job_parameters": {
                    "granules": [pair["reference"], pair["secondary"]],
                    "looks": args.looks,
                    "include_displacement_maps": True,
                    "include_inc_map": True,
                    "include_look_vectors": True,
                },
            }
            out["hyp3"] = post_json(HYP3_JOBS, {"jobs": [job]}, token)
            out["submitted"] = True
            out["message"] += " HyP3 job submitted."

    if args.json:
        print(json.dumps(out, indent=2, ensure_ascii=False))
    else:
        print(out["message"])
        if result:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        if out["submitted"]:
            print(json.dumps(out.get("hyp3"), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
