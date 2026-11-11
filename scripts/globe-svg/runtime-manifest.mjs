// Provenance is for build verification, not gameplay. The browser only needs
// the preview URL, cache key and dimensions; keep source-file lists out of JS.
export function runtimeManifest(manifest){
 return Object.fromEntries(Object.entries(manifest).map(([id,{src,sha256,width,height}])=>[id,{src,sha256,width,height}]));
}
