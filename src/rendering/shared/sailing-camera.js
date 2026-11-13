// All gameplay charts share north-up axes, including while docking.
export function createSailingCamera(){
 const basis={a:1,b:0,c:0,d:1};
 return {basis,active:false,update(){this.active=true;return basis;}};
}
