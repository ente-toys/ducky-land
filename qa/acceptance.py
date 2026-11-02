from pathlib import Path
import json
import hashlib
import urllib.request
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
roots=[ET.parse(p).getroot() for p in (ROOT/'rive').glob('*.rml')]
artboards=[a for r in roots for a in r.findall('Artboard')]
ducks=[a for a in artboards if a.get('name')=='Ducky']
assert len(ducks)==1
assert not any(e.tag.startswith('Script') for r in roots for e in r.iter())
assert not any(e.get('name')=='Acc 6' for e in ducks[0].iter())
inspection=json.loads((ROOT/'qa/inspect.json').read_text());assert inspection['problems']==[]
reports={name:(ROOT.parent/('codex-'+name)/'REPORT.md').exists() for name in ['world','activities','multiplayer','life','onboard','mobile','crowd','assets']};assert all(reports.values())
runtime=(ROOT/'rive/web/ducky-land.riv').read_bytes();response=urllib.request.urlopen('http://127.0.0.1:8800/ducky-land.riv');served=response.read();assert runtime==served
assert response.headers['Cache-Control']=='no-store'
world=json.loads((ROOT/'rive/web/world.json').read_text());assert len(world['zones'])==7
assets=json.loads((ROOT/'rive/web/asset-library.json').read_text());assert len(assets)>=150
for file in ['index.html','game.js','integration.js','ui.js','controls.js','crowd.js','crowd-brain.mjs','life.js','activities.js','network.js','assets.js','rive.js','rive.wasm','rive_fallback.wasm','audio/quack.wav','audio/pop.wav','audio/splash.wav','audio/step.wav']:
    r=urllib.request.urlopen('http://127.0.0.1:8800/'+file);assert r.status==200
result={'reports':reports,'oneDuckyArtboard':True,'scripts':0,'forbiddenAccessoryImported':False,'riveInspectorProblems':0,'nativeArtboards':len(artboards),'nativeSVGAssets':len(assets),'runtimeBytes':len(runtime),'runtimeSHA256':hashlib.sha256(runtime).hexdigest(),'servedBytesMatch':True,'noStore':True,'zones':list(world['zones']),'softwareChecks':json.loads((ROOT/'qa/software-results.json').read_text()),'canonicalRig':json.loads((ROOT/'qa/canonical-rig.json').read_text()),'headlessBrowser':'blocked, see browser-blocked.txt'}
(ROOT/'qa/acceptance.json').write_text(json.dumps(result,indent=2))
print(json.dumps({k:v for k,v in result.items() if k not in ['softwareChecks','canonicalRig']},indent=2))
