"""Final canonical rig pull, followed by native verification and build."""
from pathlib import Path
import shutil
import subprocess
import hashlib
import json
from datetime import datetime
ROOT=Path(__file__).resolve().parent
source=ROOT.parent/'rive'
for name in ['gen.py','morph.py']:
    shutil.copy2(source/name,ROOT/'rive'/name)
shutil.copytree(ROOT.parent/'duck-spin',ROOT/'duck-spin',dirs_exist_ok=True)
state={'pulledAt':datetime.now().astimezone().isoformat(),'source':'../rive/gen.py','sha256':hashlib.sha256((source/'gen.py').read_bytes()).hexdigest(),'sourceModified':datetime.fromtimestamp((source/'gen.py').stat().st_mtime).astimezone().isoformat()}
(ROOT/'qa/canonical-rig.json').write_text(json.dumps(state,indent=2))
python='/opt/homebrew/bin/python3.14'
for command,log in [([python,'rive/extend_rig.py'],None),([python,'rive/layout_stage.py'],None),(['rive','rive','--verify'],'verify.log'),(['rive','inspect','rive','--summary'],'inspect.json'),(['rive','rive','--once'],'build.log')]:
    result=subprocess.run(command,cwd=ROOT,text=True,capture_output=True)
    if log:(ROOT/'qa'/log).write_text(result.stdout+result.stderr)
    else:print(result.stdout,end='',flush=True)
    if result.returncode:print(result.stderr);result.check_returncode()
shutil.copy2(ROOT/'rive/build/ducky-land.riv',ROOT/'rive/web/ducky-land.riv')
print('Final canonical rig pulled and compiled:',state['sha256'],flush=True)
