import {Sprite} from 'pixi.js';
import {mapFor} from '../../../world/island-maps.js';
import {uploadIsland} from './island-preparation.js';

export function createLandingPreviews(ground, renderer, {acquire, release}) {
  const entries = new Map();

  function remove(id, entry) {
    entries.delete(id);
    entry.sprite?.destroy();
    release(entry.src);
  }

  return {
    prepare(id) {
      if (entries.has(id)) return;
      const entry = {src: `/pixi-art/globe/${id}-ground.svg`};
      entries.set(id, entry);
      const cancelled = () => entries.get(id) !== entry;
      void (async () => {
        try {
          const texture = await acquire(entry.src);
          if (cancelled()) return;
          // A single low-resolution texture can upload even while the player moves.
          await uploadIsland(renderer, [], {sources:[texture.source], cancelled,
            yieldFrame: () => new Promise(requestAnimationFrame)});
          if (cancelled()) return;
          const map = mapFor(id);
          const sprite = new Sprite({texture, label:'Landing terrain preview', visible:false});
          sprite.position.set(map.origin.x, map.origin.y);
          sprite.width = map.width;
          sprite.height = map.height;
          ground.addChildAt(sprite, 0);
          entry.sprite = sprite;
        } catch (error) {
          if (cancelled()) return;
          // Leave the detailed load running. A failed preview can retry on a later voyage.
          console.warn(`Landing preview for ${id} failed`, error);
        }
      })();
    },
    ready(id) {return Boolean(entries.get(id)?.sprite);},
    show(id) {
      for (const [key, entry] of entries) if (entry.sprite) entry.sprite.visible = key === id;
    },
    retain(current, destination) {
      for (const [id, entry] of entries) if (id !== current && id !== destination) remove(id, entry);
    },
  };
}
