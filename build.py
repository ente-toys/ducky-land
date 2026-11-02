"""Rebuild the integrated native scene from accepted source snapshots."""
from pathlib import Path
import subprocess
import sys
import shutil

ROOT = Path(__file__).resolve().parent
RIVE = ROOT / 'rive'
QA = ROOT / 'qa'
QA.mkdir(exist_ok=True)
PYTHON = '/opt/homebrew/bin/python3.14'

def run(*args, log=None):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if log:
        (QA / log).write_text(result.stdout + result.stderr)
    else:
        print(result.stdout, end='')
        print(result.stderr, end='')
    result.check_returncode()

if '--sync' in sys.argv:
    run(PYTHON, str(ROOT / 'sync_sources.py'))
# Every rebuild starts with the authoritative rig, even without a full lane sync.
for filename in ['gen.py','morph.py']:
    canonical=ROOT.parent/'rive'/filename
    if canonical.exists():
        shutil.copy2(canonical,RIVE/filename)
if (ROOT.parent/'duck-spin').exists():
    shutil.copytree(ROOT.parent/'duck-spin',ROOT/'duck-spin',dirs_exist_ok=True)
world = ROOT / 'incoming/world/rive'
if (world / 'world.py').exists():
    shutil.copy2(world / 'world.py', RIVE / 'world.py')
    # Keep one style kit. Island builders extend the measured canonical kit.
    base = (ROOT.parent / 'rive/drip_style.py').read_text()
    extension = (world / 'drip_style.py').read_text().split('# Island kit.', 1)[1]
    (RIVE / 'drip_style.py').write_text(base + '\n# Island kit.' + extension)
    if (RIVE / 'plaza.rml').exists():
        (RIVE / 'plaza.rml').rename(ROOT / 'incoming/plaza-baseline.rml.reference')
    (RIVE / 'rive.yaml').write_text('name: ducky-land\nmain: Island Overview\n')
    run(PYTHON, str(RIVE / 'world.py'))
else:
    run(PYTHON, str(RIVE / 'plaza.py'))
if (ROOT / 'incoming/life/rive/emotes.py').exists():
    join = ROOT / 'incoming/onboard/rive/join.py'
    if join.exists():
        shutil.copy2(join, RIVE / 'join.py')
        run(PYTHON, str(RIVE / 'join.py'))
    run(PYTHON, str(RIVE / 'features.py'))
    if (ROOT/'incoming/activities/plaza.rml.reference').exists():
        run(PYTHON,str(RIVE/'import_activity_cards.py'))
    run(PYTHON, str(RIVE / 'extend_rig.py'))
run(PYTHON,str(RIVE/'layout_stage.py'))
run('rive', str(RIVE), '--verify', log='verify.log')
run('rive', 'inspect', str(RIVE), '--summary', log='inspect.json')
run('rive', str(RIVE), '--once', log='build.log')
shutil.copy2(RIVE / 'build/ducky-land.riv', RIVE / 'web/ducky-land.riv')
print('Built unsigned native scene:', (RIVE / 'web/ducky-land.riv').stat().st_size, 'bytes')
