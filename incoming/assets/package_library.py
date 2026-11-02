#!/usr/bin/env python3
"""Package the portable vector handoff, not the unrelated copied plaza project."""
from pathlib import Path
import zipfile,json,hashlib
root=Path(__file__).resolve().parent
files=[]
for folder in ['assets','rml','sheets','pipeline-five','pipeline-all']:
    for p in (root/folder).rglob('*'):
        if not p.is_file():continue
        if folder=='sheets' and p.suffix!='.png':continue
        files.append(p)
files.append(root/'REPORT.md')
files.extend((root/'qa').glob('*.json'))
target=root/'ducky-land-assets.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=8) as z:
    for p in sorted(set(files)):z.write(p,p.relative_to(root))
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    svgs=[n for n in z.namelist() if n.startswith('assets/') and n.endswith('.svg')]
    assert len(svgs)==203,len(svgs)
print(json.dumps({'archive':str(target),'bytes':target.stat().st_size,'svg_assets':len(svgs),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()},indent=2))
