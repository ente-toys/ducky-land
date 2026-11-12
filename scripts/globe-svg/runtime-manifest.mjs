export function runtimeManifest(manifest){
 return Object.fromEntries(Object.entries(manifest).map(([id,{src,sha256,width,height}])=>[id,{src,sha256,width,height}]));
}
