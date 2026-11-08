// Authored front gardens and shared greens. Every placement belongs to a household or workplace.
const oval=(x,y,rx,ry)=>`M${x-rx} ${y}q${rx*.12} ${-ry*1.12} ${rx} ${-ry}q${rx*1.12} ${-ry*.06} ${rx} ${ry}q${-rx*.08} ${ry*1.12} ${-rx} ${ry}q${-rx*1.08} ${ry*.04} ${-rx} ${-ry}Z`;
export function denseGround(communities){
 let s='';
 for(const c of communities){
  const [x,y]=c.point;
  s+=`<path d="${oval(x,y,330,230)}" fill="#B2CB56" stroke="#6A9137" stroke-width="7"/><path d="${oval(x,y,245,145)}" fill="#C3D274" stroke="#D0D989" stroke-width="5"/>`;
  for(const [i,[hx,hy]]of c.homes.entries()){
   s+=`<path d="${oval(hx,hy+100,270,170)}" fill="${i%2?'#ACC64F':'#A0BF45'}" stroke="#789D39" stroke-width="5"/>`;
   // Kitchen beds sit beside the gate. A narrow path leaves the middle clear.
   for(const side of [-1,1]){const bx=hx+side*174-48,by=hy+103;s+=`<path d="M${bx} ${by}h96l12 63h-112Z" fill="#8E8850" stroke="#638334" stroke-width="4"/><path d="M${bx+14} ${by+22}h69m-65 22h70" stroke="${c.id==='fern'?'#62A143':c.id==='mill'?'#D9CB72':'#AFC96A'}" stroke-width="11" stroke-dasharray="8 12"/>`;}
   s+=`<path d="M${hx-33} ${hy+22}q-15 63 8 155h53q-24-87 4-155Z" fill="#E1D496" stroke="#C4BB79" stroke-width="3"/>`;
  }
 }
 // The former north mill track is now an orchard pocket with shaped growing strips.
 for(const [x,y,w]of [[1240,-1100,440],[1310,-920,480],[1400,-740,430]])s+=`<path d="M${x} ${y}q${w/2} -23 ${w} 10l-12 63q-${w/2} -20 -${w} -5Z" fill="#8F9850" stroke="#68843B" stroke-width="5"/><path d="M${x+28} ${y+27}h${w-55}" stroke="#D7CC77" stroke-width="14" stroke-dasharray="5 17"/>`;
 // East of Reedwater, the freed house plot becomes the weavers' reed allotment.
 for(const [x,y]of [[9500,2050],[9570,2180]])s+=`<path d="M${x} ${y}h310l-15 83h-310Z" fill="#B1BC6D" stroke="#728B46" stroke-width="5"/><path d="M${x+30} ${y+55}l12-40m35 40l10-40m35 40l12-40m35 40l11-40m35 40l12-40m35 40l11-40" stroke="#789548" stroke-width="9"/>`;
 return s;
}
export function composeDense({prop,svg,communities}){
 const well=svg('shared-pump',170,210,`<ellipse cx="86" cy="174" rx="73" ry="25" fill="#C7C087"/><path d="M28 160v-38q58-30 116 0v38q-58 32-116 0Z" fill="#D3C98C"/><ellipse cx="86" cy="122" rx="58" ry="20" fill="#7DBFC1"/><path d="M87 118V36q0-17 18-17h20v20h-22v78M99 47l44 10v19h-22" fill="#77A27B" stroke-width="6"/><path d="M89 50L63 34M60 24v30" stroke="#AA8550" stroke-width="10"/><path d="M38 150h32m34 12h29" stroke="#A69D69" stroke-width="4"/>`);
 const fence=svg('shared-garden-fence',500,180,`<path d="M12 155V53m75 102V43m75 112V50m176 105V47m75 108V39m75 116V52 M10 80h155m-155 40h155m170-40h155m-155 40h155" stroke="#AA8D55" stroke-width="10" fill="none"/><path d="M176 135q26-31 49-6m45 3q23-33 49-12" stroke="#699841" stroke-width="15" fill="none"/>`);
 const clothes=svg('shared-washing-line',460,180,`<path d="M22 165V22m416 143V22" stroke="#987A45" stroke-width="10"/><path d="M22 33q208 63 416 0" fill="none" stroke-width="4"/><path d="M69 47l-12 63h55l5-51M160 64v62h49V71M255 71l-7 70h62l-7-72M352 59v63h42V48" fill="#F5E5BB" stroke-width="3"/><path d="M165 72h38v49h-38M253 78h50v54h-50" fill="#BBD9BC" stroke="none"/>`);
 const bench='reuse/street--bench-wood.svg',lamp='reuse/street--lamp-lantern.svg';
 // The clear middle of each green remains the route and meeting space.
 for(const [c,x,y]of [['fern',-1120,2740],['mill',3320,-410],['reed',8450,2740],['fish',3660,6190]]){
  prop('dense-'+c+'-pump',well,x,y,140,175,21,c);
  prop('dense-'+c+'-bench',bench,x+285,y+80,205,140,22,c);
  prop('dense-'+c+'-lamp',lamp,x-145,y+75,55,230,0,c);
 }
 // Shared fences make adjacent yards a continuous neighbourhood edge, with open middle gates.
 for(const [i,[x,y,c]]of [[-1160,3290,'fern'],[-680,3340,'fern'],[3150,-980,'mill'],[3300,325,'mill'],[8340,2410,'reed'],[8900,3260,'reed'],[3290,5970,'fish'],[4710,6030,'fish']].entries())prop('dense-fence-'+i,fence,x,y,480,145,0,c);
 for(const [i,[x,y,c]]of [[-1180,2980,'fern'],[3500,-840,'mill'],[8440,3120,'reed'],[3550,6600,'fish']].entries())prop('dense-laundry-'+i,clothes,x,y,390,155,0,c);
 // Extra garden furniture and planted boundaries attach to individual front yards, never a scatter.
 for(const c of communities)for(const [i,[x,y,id]]of c.homes.entries()){
  prop('dense-'+id+'-hedge','reuse/bush-'+(i%4+1)+'.svg',x-245,y+112,135,88,0,c.id);
  prop('dense-'+id+'-flowers','reuse/flower-'+(i%3+1)+'.svg',x+235,y+135,95,65,0,c.id);
 }
 for(const [i,[x,y,w,h]]of [[1350,-1080,310,375],[1850,-1010,285,350],[1750,-500,300,365]].entries())prop('dense-mill-orchard-'+i,'community/orchard-tree.svg',x,y,w,h,32,'mill');
}
