"""Rebuild the unsigned local asset. No push, publish, network, or account operation."""
from pathlib import Path
import subprocess, sys, shutil, json
here=Path(__file__).resolve().parent
subprocess.run([sys.executable,str(here/'plaza.py')],check=True)
subprocess.run(['rive',str(here),'--verify'],check=True)
result=subprocess.run(['rive','inspect',str(here),'--summary'],check=True,capture_output=True,text=True)
report=json.loads(result.stdout)
if report.get('problems'):
    raise SystemExit(json.dumps(report['problems'],indent=2))
subprocess.run(['rive',str(here),'--once'],check=True)
shutil.copyfile(here/'build'/'ducky-land.riv',here/'web'/'ducky-land.riv')
print('Local unsigned asset ready:',here/'web'/'ducky-land.riv')
