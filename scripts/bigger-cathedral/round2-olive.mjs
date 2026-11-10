// Branches and individually drawn lanceolate leaves from the approved centre concept.
// No circular crown blobs. All geometry is absolute, with the root at (210,440).
const ink='#39472d';
const P=(d,fill='none',stroke=ink,w=2.3)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const f=v=>+v.toFixed(2);
export function oliveSVGBody(){
 let s=`<ellipse cx="210" cy="440" rx="57" ry="10" fill="${ink}" opacity=".16" data-contact-shadow="olive"/>`;
 // Gnarled open trunk, with forked limbs visible between the leaf sprays.
 s+=P('M180 437Q199 416 196 388Q179 361 190 335Q201 313 184 291L143 254L120 227L130 213L163 239L194 253L183 218L169 184L183 178L205 215L217 247L228 205L246 173L259 180L244 218L239 259L272 243L294 211L309 218L290 257L254 281Q229 299 227 326Q225 345 218 360Q209 380 224 402L243 438L222 431L211 414L202 439L193 432Z','#a48249');
 s+=P('M194 429Q208 404 202 382Q191 363 204 340Q219 319 209 294Q202 277 185 267M211 329Q217 294 241 278M206 287Q221 272 224 248M191 258L160 244','none','#705c37',3);
 s+=P('M215 410Q203 389 214 363M200 333Q211 314 202 296','none','#c5a365',3);
 // Each spray has its own hand-placed base and tips; opposite leaves alternate.
 const sprays=[
 [147,249,[[91,220],[99,195],[118,201],[131,178],[151,199],[164,222]]],
 [127,214,[[68,188],[69,160],[93,167],[100,139],[119,164],[132,188]]],
 [168,197,[[129,157],[129,126],[153,140],[161,106],[178,136],[190,161]]],
 [199,231,[[174,184],[187,160],[206,175],[218,151],[222,189],[217,212]]],
 [219,172,[[186,123],[195,95],[213,113],[230,83],[241,116],[241,144]]],
 [250,198,[[236,151],[250,125],[265,145],[280,113],[286,151],[276,180]]],
 [272,249,[[264,214],[282,192],[298,205],[317,179],[320,216],[300,239]]],
 [301,218,[[311,170],[329,150],[340,177],[365,168],[352,198],[328,218]]],
 [281,273,[[305,247],[338,239],[335,261],[363,273],[332,283],[303,281]]],
 [157,268,[[111,254],[91,239],[83,260],[63,277],[96,282],[127,276]]],
 [181,226,[[153,207],[144,182],[172,188],[180,158],[193,189]]],
 [235,247,[[239,221],[255,207],[264,230],[285,226],[267,252]]],
 ];
 let count=0;
 for(const [i,[bx,by,tips]]of sprays.entries()){
  s+=P(`M${bx} ${by}Q${f((bx+tips[2][0])/2)} ${f((by+tips[2][1])/2)} ${tips[2][0]} ${tips[2][1]}`,'none',ink,3);
  for(const [j,[tx,ty]]of tips.entries()){
   const ax=bx+(tx-bx)*.24,ay=by+(ty-by)*.24,dx=tx-ax,dy=ty-ay,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len,wide=8+(j%3)*1.7;
   const p=(u,v)=>`${f(ax+dx*u+nx*v)} ${f(ay+dy*u+ny*v)}`;
   s+=`<g data-olive-leaf="${++count}">`+P(`M${p(0,0)}C${p(.28,-wide)} ${p(.73,-wide)} ${p(1,0)}C${p(.72,wide)} ${p(.26,wide)} ${p(0,0)}Z`,['#879843','#a8af50','#697f38','#96a64b'][(i+j)%4]);
   s+=P(`M${p(.07,0)}Q${p(.48,-1)} ${p(.88,0)}`,'none',j%2?'#c0c274':'#536c34',1.35)+'</g>';
  }
 }
 // The olives are small, dark ovals on short stems, not an extra canopy texture.
 for(const [x,y]of [[106,219],[158,245],[188,197],[238,186],[275,250],[320,234],[221,219],[151,172]])s+=P(`M${x} ${y-5}v6`,'none',ink,1.3)+`<ellipse cx="${x}" cy="${y+3}" rx="3.5" ry="5.5" fill="#53633a" stroke="${ink}" stroke-width="1.3"/>`;
 return s;
}
