import {memo} from 'react';
import {mapOf} from './island-maps.js';
import homePaths from './paths.json';

const pathOf = points => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ');

// Static terrain is shared with the playable island and memoized independently
// of the moving minimap, so walking only moves three existing SVG groups.
export default memo(function MinimapTerrain({id, scale}) {
  const map = mapOf(id);
  const world = map.world;
  const coast = pathOf(map.walk.coast) + 'Z';
  const paths = world.paths ?? homePaths.filter(line => !(line[0][0] === 3940 && line[0][1] === 3260));
  const pink = world.theme === 'pink';
  const trees = (world.props ?? []).filter(prop => /tree|palm|willow/i.test(prop.name));
  const landmarks = (world.props ?? []).filter(prop => /barn|windmill|library|lighthouse|house|cafe|museum|tower|pavilion|fountain/i.test(prop.name));
  const plaza = world.zones?.plaza;
  const clip = `minimap-land-${id}`;
  return <g transform={`scale(${scale}) translate(${-map.width / 2} ${-map.height / 2})`}>
    <defs><clipPath id={clip}><path d={coast}/>{world.islets?.map(([x, y, rx, ry], index) => <ellipse key={index} cx={x} cy={y} rx={rx} ry={ry}/>)}</clipPath></defs>
    <g fill="none" strokeLinejoin="round">
      <path d={coast} stroke="#78c3d1" strokeWidth="440" opacity=".35"/>
      <path d={coast} stroke="#a5d9d8" strokeWidth="230" opacity=".6"/>
    </g>
    <g fill={pink ? '#95bd62' : '#8bb552'} stroke="#f5dfa0" strokeWidth="125" strokeLinejoin="round">
      <path d={coast}/>
      {world.islets?.map(([x, y, rx, ry], index) => <ellipse key={index} cx={x} cy={y} rx={rx} ry={ry}/>)}
    </g>
    <g clipPath={`url(#${clip})`}>
      <g fill="none" stroke="#f6e5b7" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((points, index) => <path key={index} d={pathOf(points)} strokeWidth={world.pathWidths?.[index] ?? 150}/>)}
      </g>
      {plaza && <ellipse cx={plaza.x} cy={plaza.y} rx={plaza.rx ?? 650} ry={plaza.ry ?? 490} fill={pink ? '#f4d5ce' : '#e9d5a1'} stroke="#c5ae7d" strokeWidth="35"/>}
      <g fill="#6ebccb" stroke="#d9e7bc" strokeWidth="70">
        {world.water?.map((pond, index) => pond.poly
          ? <path key={index} d={pathOf(pond.poly) + 'Z'}/>
          : <ellipse key={index} cx={pond.x} cy={pond.y} rx={pond.rx} ry={pond.ry}/>)}
      </g>
      <g stroke="#4c843e" strokeWidth="25">
        {trees.map((tree, index) => <circle key={index} cx={tree.x} cy={tree.y - 75} r={Math.max(85, Math.min(150, (tree.width ?? 240) * (tree.scale ?? 1) * .42))}
          fill={/pink|cherry|blossom/i.test(tree.name) ? '#e7a0bd' : index % 3 ? '#518b42' : '#6c9d47'}/>)}
      </g>
      {landmarks.map((prop, index) => /fountain/i.test(prop.name)
        ? <circle key={index} cx={prop.x} cy={prop.y} r="160" fill="#73bfd0" stroke="#fff2c7" strokeWidth="55"/>
        : <g key={index} transform={`translate(${prop.x} ${prop.y - 80})`}>
          <rect x="-150" y="-100" width="300" height="230" rx="35" fill="#f6e8bb" stroke="#8c7351" strokeWidth="30"/>
          <path d="M-185,-60 L0,-220 L185,-60Z" fill={pink ? '#cd82a6' : '#b77b48'}/>
        </g>)}
    </g>
    <g stroke="#9a743e" strokeWidth="90" strokeLinecap="butt">
      {map.walk.walkways?.map((pier, index) => <path key={index} d={pathOf([pier.a, pier.b])} strokeWidth={pier.w ?? 90}/>)}
      {world.bridges?.map((bridge, index) => <path key={index} d={`M${bridge.x - bridge.w / 2},${bridge.y}h${bridge.w}`} strokeWidth={bridge.h ?? 90}/>)}
    </g>
  </g>;
});
