// Every crossing uses a source-coordinate Honeywood span. No affine fitting.
import {execFileSync} from 'node:child_process';
execFileSync(process.env.PAGEPOND_PYTHON ?? 'python3',['scripts/pagepond-bridges/build.py'],{stdio:'inherit'});
