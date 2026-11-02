#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
mkdir -p shots exports rive/web/fonts
python3 rive/plaza.py
python3 rive/join.py
rive rive --verify
rive inspect rive --summary > shots/rive-inspect.json
python3 - <<'PY'
import json
data=json.load(open('shots/rive-inspect.json'))
errors=[p for p in data['problems'] if p['severity']=='error']
assert not errors,errors
print('Rive inspect:',len(errors),'errors,',len(data['problems']),'total problems')
PY
rive rive --once
cp rive/build/ducky-land.riv rive/web/ducky-land.riv
node --check rive/web/core.js
node --check rive/web/app.js
node check-core.cjs
