#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="${IMAGE_NAME:-icu-stats-oel8-binary-builder}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/release/oel8-binary}"

mkdir -p "$OUT_DIR"

echo "Building OEL8.2 binary in Docker..."
docker build -f "$ROOT_DIR/Dockerfile.oel8" -t "$IMAGE_NAME" "$ROOT_DIR"

container="$(docker create "$IMAGE_NAME")"
cleanup() {
  docker rm "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

rm -rf "$OUT_DIR"/*
docker cp "$container:/out/." "$OUT_DIR"
chmod +x "$OUT_DIR/icu-stats" "$OUT_DIR/run.sh"

echo
echo "Generated package:"
ls -la "$OUT_DIR"
echo
echo "Next:"
echo "  cd $OUT_DIR"
echo "  cp .env.example .env"
echo "  vi .env"
echo "  ./run.sh"
