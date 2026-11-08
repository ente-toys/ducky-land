// Rebuild from the fixed shore, then replay the five approved handwritten SVG kits.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const run=(exe,args)=>execFileSync(exe,args,{stdio:'inherit'});
writeFileSync('scripts/bigger-pink/layout.json',execFileSync('git',['show','7c2a28ec:scripts/bigger-pink/layout.json']));
run('python3',['scripts/pink-final/review-roads.py']);
run('node',['scripts/pink-fix/shore-apply.mjs']);
run('python3',['scripts/pink-hamlets/place.py']);
run('python3',['scripts/pink-hamlets-b/apply.py']);
run('python3',['scripts/pink-hamlets-b/refine.py']);
run('node',['scripts/pink-hamlets/sleepers.mjs']);
run('node',['scripts/pink-final/finish.mjs']);
run('node',['scripts/pink-final/union-paths.mjs']);
run('node',['scripts/pink-final/restore-centre.mjs']);
