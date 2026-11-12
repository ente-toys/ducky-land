import contract from './home-prop-contract.json' with {type:'json'};
export const isHomeGroundCloth=prop=>prop.groundCloth===true||contract[prop.src]?.cloth===true;

export function homeGroundCloth(prop) {
  if (!isHomeGroundCloth(prop)) return prop;
  const {footprint, ...cloth} = prop;
  return {...cloth, groundCloth: true, contact: false, noShadow: true};
}
export function homeClothFlat(prop) {
  const width = prop.width * prop.scale, height = prop.height * prop.scale;
  return {...prop, x: prop.x - prop.anchor.x * width, y: prop.y - prop.anchor.y * height,
    width, height, scale: 1, topLeft: true};
}
