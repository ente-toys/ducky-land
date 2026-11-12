import {context} from 'esbuild';

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
