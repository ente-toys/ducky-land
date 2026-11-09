// Input normalisation only. Geometry and paint are resolved in compile.mjs.
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
const parser=new DOMParser(),serializer=new XMLSerializer();
export const num=n=>String(Math.round(n*1000)/1000);
export const parse=text=>parser.parseFromString(text,'image/svg+xml').documentElement;
export const serialize=root=>serializer.serializeToString(root);
export function inline(svg){
 const root=parse(svg);
 for(const image of Array.from(root.getElementsByTagName('image'))){
  const href=image.getAttribute('href')||image.getAttribute('xlink:href');
  if(!href.startsWith('data:image/svg+xml;base64,'))throw Error('Raster or external image in vector source');
  const nested=inline(Buffer.from(href.split(',')[1],'base64').toString());
  for(const key of ['x','y','width','height','transform','opacity','clip-path','mask','preserveAspectRatio'])if(image.hasAttribute(key))nested.setAttribute(key,image.getAttribute(key));
  image.parentNode.replaceChild(nested,image);
 }
 return root;
}
