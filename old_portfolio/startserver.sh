#!/bin/sh
set -eu

ENV_FILE="$(dirname "$0")/../.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env — copy .env.example to .env and fill it in." >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

npm run dev:server
