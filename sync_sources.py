"""Read-only snapshots of the independent sessions. Never copy their Ducky rig."""
from pathlib import Path
import hashlib
import json
import shutil
from datetime import datetime

ROOT = Path(__file__).resolve().parent
NAMES = ['world', 'activities', 'multiplayer', 'life', 'onboard', 'mobile', 'crowd', 'assets']
state = {}
for name in NAMES:
    source = ROOT.parent / ('codex-' + name)
    target = ROOT / 'incoming' / name
    target.mkdir(parents=True, exist_ok=True)
    files = []
    for path in source.rglob('*'):
        if not path.is_file() or any(part in {'node_modules', '.deps', '.tools', 'build', 'preview', 'shots', '__pycache__', '.git'} for part in path.relative_to(source).parts):
            continue
        if path.name in {'codex.log', 'gen.py', 'scene.rml', 'plaza.rml', 'rive.js', 'rive.wasm', 'rive_fallback.wasm'} or path.suffix in {'.riv', '.log'}:
            continue
        rel = path.relative_to(source)
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
        files.append(str(rel))
    report = source / 'REPORT.md'
    state[name] = {'report': report.exists(), 'files': files}
    if name == 'crowd':
        rig = (source / 'rive/gen.py').read_text()
        (target / 'poses.py').write_text(rig[rig.index('SIT = merge('):rig.index('SLEEP = merge(')])
    if name == 'assets' and (source/'assets').exists():
        shutil.copytree(source/'assets',ROOT/'assets',dirs_exist_ok=True)
    if name == 'activities':
        shutil.copy2(source/'rive/plaza.rml',target/'plaza.rml.reference')
    print(name, 'REPORT' if report.exists() else 'active / report missing', len(files), 'source files')
canonical = ROOT.parent / 'rive'
for name in ['gen.py', 'drip_style.py']:
    shutil.copy2(canonical / name, ROOT / 'rive' / name)
for name in ['morph.py']:
    if (canonical/name).exists():
        shutil.copy2(canonical/name, ROOT/'rive'/name)
spin=ROOT.parent/'duck-spin'
if spin.exists():
    shutil.copytree(spin,ROOT/'duck-spin',dirs_exist_ok=True)
state['canonicalRig'] = hashlib.sha256((canonical / 'gen.py').read_bytes()).hexdigest()
state['checkedAt'] = datetime.now().astimezone().isoformat()
(ROOT / 'incoming' / 'state.json').write_text(json.dumps(state, indent=2))
