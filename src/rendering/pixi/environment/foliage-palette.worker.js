import {foliageColour} from './plant-contact.js';

self.onmessage=async({data:{id,src}})=>{
  let colour=0x63ae45;
  try {
    const response=await fetch(src);
    if (response.ok) colour=foliageColour(await response.text());
  } catch {}
  self.postMessage({id,colour});
};
