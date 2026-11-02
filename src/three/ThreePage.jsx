import {useEffect,useRef,useState} from 'react';
import {IslandEngine} from './engine.js';
import './three.css';
export default function ThreePage(){const host=useRef(null),[error,setError]=useState(null);useEffect(()=>{const engine=new IslandEngine({onError:setError});engine.mount(host.current);return()=>engine.dispose();},[]);return <main className="three-page"><div className="three-host" ref={host}/>{error&&<div className="three-error" role="alert"><p>The 3D island could not be displayed.</p><button onClick={()=>location.reload()}>Try again</button><a href="/">Open the original island</a></div>}</main>;}
