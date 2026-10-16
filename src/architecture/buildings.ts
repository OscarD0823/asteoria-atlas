import { produce } from 'immer';
import { emptyProject, makeFurniture, parseProject, uid, type Project } from './model';
import { furnitureCatalog } from './catalog';
export function repeatLevel(project:Project,levelId:string,count:number,spacing:number){
 if(!Number.isInteger(count)||count<1||count>199||spacing<2||spacing>10)throw Error('Elige entre 1 y 199 pisos adicionales y una separación de 2 a 10 m.');
 if(project.levels.length+count>200)throw Error('Esta versión permite hasta 200 pisos.');
 const source=project.levels.find(l=>l.id===levelId);if(!source)throw Error('La planta de origen no existe.');
 const next=produce(project,draft=>{for(let i=1;i<=count;i++){const id=uid(),roomMap=new Map<string,string>(),wallMap=new Map<string,string>();draft.levels.push({id,name:`Piso ${project.levels.length+i}`,elevation:source.elevation+i*spacing});
 for(const r of project.rooms.filter(r=>r.levelId===levelId)){const newId=uid();roomMap.set(r.id,newId);draft.rooms.push({...r,id:newId,levelId:id});for(let e=0;e<4;e++)wallMap.set(`${r.id}:wall:${e}`,`${newId}:wall:${e}`);}
 for(const w of project.walls.filter(w=>w.levelId===levelId)){const newId=uid();wallMap.set(w.id,newId);draft.walls.push({...w,id:newId,levelId:id});}
 for(const o of project.openings){const wallId=wallMap.get(o.wallId);if(wallId)draft.openings.push({...o,id:uid(),wallId});}
 for(const f of project.furniture.filter(f=>f.levelId===levelId))draft.furniture.push({...f,id:uid(),levelId:id});
 for(const l of project.lights.filter(l=>l.levelId===levelId))draft.lights.push({...l,id:uid(),levelId:id});
 }});parseProject(next);return next;
}
export function benchmarkBuilding(floors=100,objectsPerFloor=400){
 const p=emptyProject();p.name=`Prueba · ${floors} pisos / ${floors*objectsPerFloor} objetos`;const id=p.levels[0].id,columns=Math.ceil(Math.sqrt(objectsPerFloor));
 p.rooms=[{id:uid(),levelId:id,name:'Planta de ensayo',x:0,y:0,width:columns*2.5+6,depth:columns*2.5+6,height:3,thickness:.2,color:'#ddd9d0',finish:'concrete'}];
 const usable=furnitureCatalog.filter(f=>f.width<2.5&&f.depth<2.5&&f.height<2.6&&!['curtain','rug'].includes(f.kind));
 for(let i=0;i<objectsPerFloor;i++)p.furniture.push(makeFurniture(usable[i%usable.length].kind,id,{x:4+i%columns*2.5,y:4+Math.floor(i/columns)*2.5}));
 return floors>1?repeatLevel(p,id,floors-1,3.2):parseProject(p);
}
