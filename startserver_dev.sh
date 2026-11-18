#!/bin/sh
set -eu

ENV_FILE="$(dirname "$0")/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env — copy .env.example to .env and fill it in." >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

PORT="${DEV_PORT:-$PORT}"
ENVIRONMENT="${DEV_ENVIRONMENT:-dev}"
export PORT ENVIRONMENT

node server_staging.js
