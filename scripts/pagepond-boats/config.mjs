export const paperboatMoorings = [
  {id: 'hamlet-paperboat-paperboat-mid', x: 8313, y: 6920, turn: Math.PI},
  {id: 'hamlet-paperboat-paperboat-east', x: 8724, y: 6950, turn: Math.PI},
  {id: 'hamlet-paperboat-paperboat-west', x: 8214, y: 6975, turn: Math.PI}
];
export const retiredBoatIds = new Set(paperboatMoorings.map(b => b.id));
