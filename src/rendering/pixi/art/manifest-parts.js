// One stable manifest object preserves density plans as lazy shards arrive.
export function createManifestParts(url,{fetchJSON=async url=>{
  const response=await fetch(url);
  if(!response.ok)throw Error(`Art manifest HTTP ${response.status}`);
  return response.json();
}}={}) {
  const manifest={},pending=new Map();let catalog;
  const merge=url=>{
    if(!pending.has(url))pending.set(url,fetchJSON(url).then(part=>{Object.assign(manifest,part);return manifest;}).catch(error=>{pending.delete(url);throw error;}));
    return pending.get(url);
  };
  return async (sources=[],islandURL)=>{
    if(!url)return manifest;
    if(islandURL)return merge(islandURL);
    if(sources.every(src=>manifest[src]))return manifest;
    catalog??=fetchJSON(url).catch(error=>{catalog=undefined;throw error;});
    const data=await catalog;
    const urls=new Set(sources.filter(src=>!manifest[src]).map(src=>data.parts[src.slice(0,src.lastIndexOf('/')+1)]).filter(Boolean));
    await Promise.all([...urls].map(merge));return manifest;
  };
}
