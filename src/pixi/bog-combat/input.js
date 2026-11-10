const shootKey=e=>e.code==='Space'||e.code==='KeyJ'||e.key===' '||e.key?.toLowerCase()==='j';
const guarded=e=>e.defaultPrevented||e.isComposing||e.metaKey||e.ctrlKey||e.altKey||e.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target?.tagName??'');

// Capture only combat's controls. WASD/arrows, Shift, emotes, camera and all
// other island controls keep flowing to the island engine's existing listeners.
export function bindCombatInput(canvas,{onFire=()=>{},onLeave=()=>{},keyboard=globalThis.window,document=globalThis.document}={}) {
  const keys=new Set(),removers=[];let pointer=false;
  const listen=(target,event,fn,options)=>{target.addEventListener(event,fn,options);removers.push(()=>target.removeEventListener(event,fn,options));};
  const update=()=>onFire(pointer||keys.size>0);
  const clear=()=>{keys.clear();pointer=false;update();};
  listen(keyboard,'keydown',e=>{
    if(guarded(e))return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();clear();onLeave();return;}
    if(!shootKey(e))return;
    e.preventDefault();e.stopImmediatePropagation();keys.add(e.code||e.key);update();
  },true);
  listen(keyboard,'keyup',e=>{if(shootKey(e)){keys.delete(e.code||e.key);update();}},true);
  listen(canvas,'pointerdown',e=>{
    if(e.button!==0||e.pointerType==='touch'||guarded(e))return;
    e.preventDefault();e.stopImmediatePropagation();canvas.focus({preventScroll:true});pointer=true;update();
  },true);
  const release=e=>{if(e.type==='pointerup'&&e.button!==0)return;pointer=false;update();};
  listen(keyboard,'pointerup',release,true);listen(keyboard,'pointercancel',release,true);
  listen(canvas,'pointerleave',release);listen(canvas,'lostpointercapture',release);
  listen(keyboard,'blur',clear);listen(document,'visibilitychange',clear);
  return ()=>{clear();removers.forEach(remove=>remove());};
}
