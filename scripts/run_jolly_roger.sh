#!/bin/bash

set -e

if [ -n "${MONGO_URL+set}" ]; then
    export MONGO_URL="$(sneaker download mongo -)"
fi
exec bash $METEORD_DIR/run_app.sh