#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-icu-stats-oel8-binary-builder}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/release/oel8-binary}"

mkdir -p "$OUT_DIR"

docker build -f "$ROOT_DIR/Dockerfile.oel8" -t "$IMAGE_NAME" "$ROOT_DIR"

container="$(docker create "$IMAGE_NAME")"
trap 'docker rm "$container" >/dev/null 2>&1 || true' EXIT
docker cp "$container:/out/." "$OUT_DIR"

chmod +x "$OUT_DIR/icu-stats" "$OUT_DIR/run.sh"
echo "OEL 8.2 binary package generated: $OUT_DIR"
ls -la "$OUT_DIR"
