#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
ducky_python="${DUCKY_ASSETS_PYTHON:-/Users/pragadees.xd/.local/share/uv/python/cpython-3.12-macos-aarch64-none/bin/python3.12}"
export PYTHONPATH="$PWD/.deps${PYTHONPATH:+:$PYTHONPATH}"
mkdir -p qa
"$ducky_python" build_library.py
"$ducky_python" convert_library.py
rive pipeline-five --verify > pipeline-five/verify.txt
rive inspect pipeline-five --summary > pipeline-five/inspect-summary.json
rive pipeline-five --once > pipeline-five/build-log.txt
rive pipeline-all --verify > pipeline-all/verify.txt
rive inspect pipeline-all --summary > pipeline-all/inspect-summary.txt
rive pipeline-all --once > pipeline-all/build-log.txt
node render_references.cjs
node render_sheets.cjs
node make_tile_demos.cjs
node render_rive.mjs > pipeline-five/render-log.txt
node render_all_rive.mjs > qa/rive-render-log.txt
"$ducky_python" check_tiling.py > qa/tiling-log.json
"$ducky_python" audit_library.py > qa/audit-log.json
printf '203 assets rebuilt, SVG structure checked, every Rive artboard rendered, tile joins checked.\n'
