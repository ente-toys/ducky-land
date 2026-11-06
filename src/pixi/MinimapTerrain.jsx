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
  const shrubs = (world.props ?? []).filter(prop => /bush|hedge|flower.*bed/i.test(prop.name));
  const stalls = (world.props ?? []).filter(prop => /stall|cart|bench/i.test(prop.name));
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
      {plaza && <g fill="none" stroke="#c5ae7d" strokeWidth="18" opacity=".8">
        <ellipse cx={plaza.x} cy={plaza.y} rx={(plaza.rx ?? 650) * .78} ry={(plaza.ry ?? 490) * .78}/>
        {Array.from({length: 12}, (_, index) => {
          const a = index * Math.PI / 6;
          return <path key={index} d={`M${plaza.x + Math.cos(a) * (plaza.rx ?? 650) * .35},${plaza.y + Math.sin(a) * (plaza.ry ?? 490) * .35}L${plaza.x + Math.cos(a) * (plaza.rx ?? 650)},${plaza.y + Math.sin(a) * (plaza.ry ?? 490)}`}/>;
        })}
      </g>}
      <g fill="#6ebccb" stroke="#d9e7bc" strokeWidth="70">
        {world.water?.map((pond, index) => pond.poly
          ? <path key={index} d={pathOf(pond.poly) + 'Z'}/>
          : <ellipse key={index} cx={pond.x} cy={pond.y} rx={pond.rx} ry={pond.ry}/>)}
      </g>
      <g fill="#65984c" stroke="#4f813d" strokeWidth="18">
        {shrubs.map((prop, index) => <ellipse key={index} cx={prop.x} cy={prop.y} rx="85" ry="65"/>)}
      </g>
      {trees.map((tree, index) => {
        const radius = Math.max(85, Math.min(150, (tree.width ?? 240) * (tree.scale ?? 1) * .42));
        const blossom = /pink|cherry|blossom/i.test(tree.name);
        return <g key={index} transform={`translate(${tree.x} ${tree.y - 75})`}>
          <ellipse cx="35" cy="60" rx={radius} ry={radius * .65} fill="#3b6639" opacity=".25"/>
          <circle r={radius} fill={blossom ? '#e7a0bd' : '#518b42'} stroke={blossom ? '#c4779b' : '#3e7338'} strokeWidth="20"/>
          <circle cx={-radius * .28} cy={-radius * .25} r={radius * .65} fill={blossom ? '#f3b4ce' : '#73a653'}/>
          <circle cx={radius * .4} cy={radius * .2} r={radius * .43} fill={blossom ? '#ec9cbe' : '#63994a'}/>
        </g>;
      })}
      {stalls.map((prop, index) => /bench/i.test(prop.name)
        ? <path key={index} d={`M${prop.x - 90},${prop.y}h180`} stroke="#a57d4f" strokeWidth="45"/>
        : <g key={index} transform={`translate(${prop.x} ${prop.y})`}>
          <rect x="-115" y="-85" width="230" height="150" rx="18" fill="#b48b58"/>
          <path d="M-130,-85h260" stroke={pink ? '#d984ac' : '#ddaa55'} strokeWidth="100"/>
          <path d="M-85,-85h40m45,0h40m45,0h40" stroke="#fff0c8" strokeWidth="100"/>
        </g>)}
      {landmarks.map((prop, index) => /fountain/i.test(prop.name)
        ? <circle key={index} cx={prop.x} cy={prop.y} r="160" fill="#73bfd0" stroke="#fff2c7" strokeWidth="55"/>
        : <g key={index} transform={`translate(${prop.x} ${prop.y - 80})`}>
          <rect x="-150" y="-100" width="300" height="230" rx="35" fill="#f6e8bb" stroke="#8c7351" strokeWidth="30"/>
          <path d="M-185,-60 L0,-220 L185,-60Z" fill={pink ? '#cd82a6' : '#b77b48'}/>
          <path d="M-90,-65L0,-150L90,-65" fill="none" stroke={pink ? '#e5aac5' : '#d7a069'} strokeWidth="20"/>
          <rect x="-30" y="30" width="60" height="100" fill="#94714d"/>
          <path d="M-110,0h45m85,0h45" stroke="#88bbcb" strokeWidth="45"/>
          {/windmill/i.test(prop.name) && <path d="M-210,-250L210,30M-210,30L210,-250" stroke="#fff0c8" strokeWidth="40"/>}
        </g>)}
    </g>
    <g stroke="#9a743e" strokeWidth="90" strokeLinecap="butt">
      {map.walk.walkways?.map((pier, index) => <path key={index} d={pathOf([pier.a, pier.b])} strokeWidth={pier.w ?? 90}/>)}
      {world.bridges?.map((bridge, index) => <path key={index} d={`M${bridge.x - bridge.w / 2},${bridge.y}h${bridge.w}`} strokeWidth={bridge.h ?? 90}/>)}
    </g>
    <g fill="none" stroke="#dfbe82" strokeDasharray="12 48" opacity=".85">
      {map.walk.walkways?.map((pier, index) => <path key={index} d={pathOf([pier.a, pier.b])} strokeWidth={(pier.w ?? 90) * .8}/>)}
    </g>
  </g>;
});
