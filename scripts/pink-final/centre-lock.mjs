export const centre={x:4000,y:2850,rx:930,ry:760};
export const inCentre=(x,y,margin=0)=>((x-centre.x)/(centre.rx+margin))**2+((y-centre.y)/(centre.ry+margin))**2<=1;
export const centreClip='<ellipse cx="4000" cy="2850" rx="930" ry="760"/>';
