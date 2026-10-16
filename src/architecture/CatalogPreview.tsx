import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { modelFactory } from './procedural-models';
import type { Furniture } from './model';
type Item=Pick<Furniture,'kind'|'width'|'depth'|'height'|'color'|'name'>;
const cache=new Map<string,string>();let render:((f:Item)=>string)|undefined;
function renderer() {
 if(render)return render;const canvas=document.createElement('canvas'),engine=new T.WebGLRenderer({canvas,alpha:true,antialias:true});engine.setSize(180,140);engine.setPixelRatio(1);engine.outputColorSpace=T.SRGBColorSpace;engine.toneMapping=T.ACESFilmicToneMapping;const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,180/140,.01,1000),ambient=new T.HemisphereLight('#ffffff','#a6adba',2),sun=new T.DirectionalLight('#fff6e9',3),factory=modelFactory();sun.position.set(5,8,6);scene.add(ambient,sun);const pmrem=new T.PMREMGenerator(engine),room=new RoomEnvironment(),env=pmrem.fromScene(room,.1);scene.environment=env.texture;scene.environmentIntensity=.32;ambient.intensity=.6;engine.toneMappingExposure=.75;room.dispose();pmrem.dispose();
 render=f=>{const object=factory.create({...f,id:'thumbnail',levelId:'thumbnail',x:0,y:0,elevation:0,rotation:0});scene.add(object);const box=new T.Box3().setFromObject(object),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());camera.position.copy(center).add(new T.Vector3(1.1,.8,1.3).normalize().multiplyScalar(size.length()*1.85));camera.lookAt(center);engine.render(scene,camera);const data=canvas.toDataURL('image/png');scene.remove(object);return data;};window.addEventListener('pagehide',()=>{factory.dispose();env.dispose();engine.dispose();render=undefined;},{once:true});return render;
}
export default function CatalogPreview({item}:{item:Item}) {
 const ref=useRef<HTMLDivElement>(null),[data,setData]=useState(cache.get(item.kind)??'');
 useEffect(()=>{if(cache.has(item.kind)){setData(cache.get(item.kind)!);return;}let cancelled=false,id=0;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();id=requestAnimationFrame(()=>{if(cancelled)return;try{const data=renderer()(item);cache.set(item.kind,data);setData(data);}catch{}});}});observer.observe(ref.current!);return()=>{cancelled=true;cancelAnimationFrame(id);observer.disconnect();};},[item]);
 return <div ref={ref} className="pa-catalog-model">{data?<img src={data} alt="" loading="lazy"/>:<span>{item.name.slice(0,1)}</span>}</div>;
}
