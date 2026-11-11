export const OUTFIT_OPTIONS = Object.freeze({
  cap: [1, 3, 4, 5, 6, 7, 8, 10],
  shades: [1, 2],
  acc: [1, 4, 6],
  shoes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
});

export function validOutfit(outfit) {
  return outfit && typeof outfit === 'object' && !Array.isArray(outfit)
    && Object.keys(outfit).length === 4
    && Object.entries(OUTFIT_OPTIONS).every(([slot, options]) =>
      outfit[slot] === 0 || options.includes(outfit[slot]));
}

export function sameOutfit(a, b) {
  return Boolean(a && b && Object.keys(OUTFIT_OPTIONS).every(slot => a[slot] === b[slot]));
}

export function randomOutfit(current, random = Math.random) {
  const outfit = Object.fromEntries(Object.entries(OUTFIT_OPTIONS).map(([slot, options]) => {
    if (slot === 'acc') return [slot, 0];   // boss 11 Nov: accessories removed
    const choices = slot === 'shades' ? [0, ...options] : options;
    return [slot, choices[Math.floor(random() * choices.length)]];
  }));
  if (sameOutfit(current, outfit)) {
    const caps = OUTFIT_OPTIONS.cap;
    outfit.cap = caps[(caps.indexOf(outfit.cap) + 1) % caps.length];
  }
  return outfit;
}
