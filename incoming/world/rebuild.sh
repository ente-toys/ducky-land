#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 rive/world.py
rive rive --verify > rive/verify.log 2>&1
rive inspect rive --summary > rive/inspect.log 2>&1
rive rive --once > rive/build.log 2>&1
cp rive/build/ducky-land.riv rive/web/ducky-land.riv
