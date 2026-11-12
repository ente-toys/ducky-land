import {RULES} from './rules.js';
export default function DodgePip({self,time=0}){
  const left=Math.max(0,(self?.dodgeReadyAt??0)-time),ready=left<=0;
  return <span role="status" aria-label={ready?'Dodge hop ready':`Dodge hop ready in ${left.toFixed(1)} seconds`} title="Q to dodge hop" style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,marginLeft:8}}>
    <span aria-hidden="true" style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:ready?'#08c225':'#837b91',border:'1px solid #232323',opacity:ready?1:.45+.55*(1-left/RULES.dodgeCooldown)}}/>
    Q {ready?'HOP':`${left.toFixed(1)}s`}
  </span>;
}
