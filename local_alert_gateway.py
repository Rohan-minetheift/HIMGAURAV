#!/usr/bin/env python3
"""Minimal local HIMGAURAV alert-gateway receiver.

This is a development/test receiver for the optional LOCAL_GATEWAY_WEBHOOK_URL.
It does NOT represent NDMA/SACHET and it does not drive life-safety hardware.
It proves the actual HTTP handoff path, records packets, and returns an ACK.

Run:
    python tools/local_alert_gateway.py

Then in .env:
    LOCAL_GATEWAY_WEBHOOK_URL=http://127.0.0.1:8899/himgaurav-alert
    LOCAL_GATEWAY_WEBHOOK_TOKEN=change-me   # optional

If GATEWAY_TOKEN is set for this receiver, use the same value above.
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from datetime import datetime, timezone
import json
import os

HOST = os.environ.get("GATEWAY_HOST", "127.0.0.1")
PORT = int(os.environ.get("GATEWAY_PORT", "8899"))
TOKEN = os.environ.get("GATEWAY_TOKEN", "").strip()
LOG = Path(os.environ.get("GATEWAY_LOG", "alerts-received.jsonl"))

class Handler(BaseHTTPRequestHandler):
    server_version = "HIMGAURAV-LocalGateway/1.0"

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/himgaurav-alert":
            return self._json(404, {"ok": False, "error": "route not found"})
        if TOKEN:
            auth = self.headers.get("Authorization", "")
            if auth != f"Bearer {TOKEN}":
                return self._json(401, {"ok": False, "error": "invalid token"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n <= 0 or n > 512_000:
                raise ValueError("invalid body size")
            packet = json.loads(self.rfile.read(n).decode("utf-8"))
        except Exception as exc:
            return self._json(400, {"ok": False, "error": str(exc)})

        record = {
            "received_at": datetime.now(timezone.utc).isoformat(),
            "prototype_header": self.headers.get("X-HIMGAURAV-Prototype"),
            "packet": packet,
        }
        with LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

        return self._json(200, {
            "ok": True,
            "ack": "RECEIVED",
            "received_at": record["received_at"],
            "kind": packet.get("kind"),
            "site": (packet.get("site") or {}).get("name"),
            "state": packet.get("state"),
            "test": bool(packet.get("test")),
        })

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

if __name__ == "__main__":
    print(f"HIMGAURAV local alert gateway: http://{HOST}:{PORT}/himgaurav-alert")
    print(f"Logging accepted packets to: {LOG.resolve()}")
    if not TOKEN:
        print("Development mode: no GATEWAY_TOKEN configured.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
