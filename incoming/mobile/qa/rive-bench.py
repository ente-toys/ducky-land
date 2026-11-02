#!/usr/bin/env python3
"""Populate 13 animated Duckies before CLI bench/screenshot, not an empty scene."""
from pathlib import Path
import math
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
failures = 0
for lite in (False, True):
    crowd = 6 if lite else 13
    project = ROOT / ('rive-lite' if lite else 'rive')
    data = []
    for i in range(crowd):
        angle = 2 * math.pi * i / crowd
        x, y = 800 + 390 * math.cos(angle), 640 + 225 * math.sin(angle)
        for key, value in dict(x=round(x), y=round(y), cap=(i%13)+1, city=i%4, action=(i%3)+1, isPlayer=int(i==0), name=f'duck{i}').items():
            data.append(f'--data=slot{i}/{key}={value}')
    tag = 'lite' if lite else '13-duckies'
    for width, height in ((375,812),(390,844),(412,915),(768,1024)):
        scale = width/620 if width<600 else min(width/1200,height/950)
        camera = [f'--data=cameraX={width/2-800*scale}',f'--data=cameraY={height/2-500*scale}',f'--data=zoom={scale}',f'--data=controlX={width-109}',f'--data=controlY={height-36}']
        common = ['rive',str(project),'--artboard=Plaza',f'--viewport={width}x{height}','--fit=layout',*camera,*data]
        bench = subprocess.run([*common,'--bench=600'],cwd=ROOT,text=True,capture_output=True)
        (ROOT/'qa'/f'rive-bench-{tag}-{width}.txt').write_text(bench.stdout+bench.stderr)
        print(tag,width,'bench exit',bench.returncode,flush=True)
        failures += bench.returncode != 0
        shot = subprocess.run([*common,f'--screenshot={ROOT}/shots/rive-{tag}-{width}.png','--advance=90'],cwd=ROOT,text=True,capture_output=True)
        (ROOT/'qa'/f'rive-capture-{tag}-{width}.txt').write_text(shot.stdout+shot.stderr)
        print(tag,width,'capture exit',shot.returncode,flush=True)
        failures += shot.returncode != 0
sys.exit(1 if failures else 0)
