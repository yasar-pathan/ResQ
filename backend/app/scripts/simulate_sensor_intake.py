"""Post a simulated sensor intake incident (F-03 demo)."""

from __future__ import annotations

import argparse
import os
import sys
import uuid

import httpx

DEFAULT_BASE = os.environ.get("API_BASE_URL", "http://localhost:8000")
DEFAULT_EMAIL = os.environ.get("DISPATCHER_EMAIL", "dispatcher@rescuegrid.dev")
DEFAULT_PASSWORD = os.environ.get("DISPATCHER_PASSWORD", "ChangeMeOps123!")


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulate sensor incident intake")
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--latitude", type=float, default=19.076)
    parser.add_argument("--longitude", type=float, default=72.8777)
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    with httpx.Client(timeout=30.0) as client:
        login = client.post(
            f"{base}/auth/login",
            json={"email": args.email, "password": args.password},
        )
        login.raise_for_status()
        token = login.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        payload = {
            "category": "fire",
            "description": "Simulated sensor heat anomaly — automated intake demo",
            "location": {"latitude": args.latitude, "longitude": args.longitude},
            "source": "sensor",
            "is_anonymous": False,
            "idempotency_key": f"sensor-{uuid.uuid4().hex}",
        }
        resp = client.post(f"{base}/incidents", json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()["data"]
        print(f"Created sensor incident {data['tracking_ref']} (status={data['status']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
