#!/usr/bin/env bash
set -euo pipefail

if [ -f /etc/icu-stats/icu-stats.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /etc/icu-stats/icu-stats.env
  set +a
fi

cd /opt/icu-stats
exec /opt/icu-stats/icu-stats "$@"
