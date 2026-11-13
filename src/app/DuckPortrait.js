import {useEffect, useState} from 'react';
import {outfitKey, prepareDuckPortrait} from '../rendering/pixi/duck-portrait.js';

export function useDuckPortrait(outfit) {
  const [src, setSrc] = useState(null);
  const key = outfitKey(outfit);
  useEffect(() => {
    if (!key) return;
    let live = true;
    prepareDuckPortrait(outfit).then(url => {if (live) setSrc(url);}).catch(() => {});
    return () => {live = false;};
  }, [key]);
  return src;
}
