#!/usr/bin/env bash
# Pre-push lint gate (Phases 7–10 standing rule).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> ruff"
docker compose run --rm api ruff check app tests

echo "==> frontend lint + test"
docker compose run --rm frontend sh -c "npm run lint && npm test"

echo "==> backend pytest"
docker compose run --rm api pytest -q

echo "Lint gate passed."
