import {context} from 'esbuild';

// Retain esbuild's dependency graph so edits to imported walking JSON refresh
// the authoritative room, not just the separately served artwork.
export const createTravelCompiler=(options,onBundle)=>context({
  ...options,bundle:true,format:'esm',write:false,
  plugins:[...(options.plugins??[]),{
    name:'reload-travel-room',
    setup(build) {
      build.onEnd(async result=>{
        if(!result.errors.length)await onBundle(result.outputFiles[0].text);
      });
    },
  }],
});
