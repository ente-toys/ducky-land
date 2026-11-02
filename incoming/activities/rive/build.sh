#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 plaza.py
python3 activities.py
rive . --verify
rive inspect . --summary
rive . --once
cp build/ducky-land.riv web/ducky-land.riv
cp fonts/Gilroy-Black.ttf web/Gilroy-Black.ttf
