import * as T from 'three';
import type { Project } from './model';
import { terrainHeight } from './terrain';
import type { Site } from './project-extras';
export function terrainMesh(site:Site){
 const g=new T.Group(),resolution=site.heightfield?128:24,geo=new T.PlaneGeometry(site.width,site.depth,resolution,resolution);geo.rotateX(-Math.PI/2);const p=geo.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i)+site.x,z=p.getZ(i)+site.y;p.setXYZ(i,x,terrainHeight(site,{x,y:z}),z);}geo.computeVertexNormals();
 const colors={grass:'#8eaa7c',sand:'#cfbb94',urban:'#a6aba5',snow:'#e6edf0'},material=new T.MeshStandardMaterial({color:colors[site.landscape],roughness:.96}),mesh=new T.Mesh(geo,material);mesh.receiveShadow=true;g.add(mesh);
 if(site.boundary.length>2){const points=site.boundary.map(p=>new T.Vector3(p.x,terrainHeight(site,p)+.08,p.y));points.push(points[0].clone());g.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:'#e4c56b'})));}
 return g;
}
export function buildingShells(project:Project,activeId:string){
 const g=new T.Group(),geometry=new T.BoxGeometry(1,1,1),walls=new T.MeshStandardMaterial({color:'#b6c7cc',roughness:.34,metalness:.18}),floors=new T.MeshStandardMaterial({color:'#d4d5cf',roughness:.8}),rooms=project.rooms.filter(r=>r.levelId!==activeId),panels=new T.InstancedMesh(geometry,walls,rooms.length*4),slabs=new T.InstancedMesh(geometry,floors,rooms.length),matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),levels=new Map(project.levels.map(l=>[l.id,l.elevation]));
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#d0d6d5';ctx.fillRect(0,0,128,128);ctx.fillStyle='#72909b';for(let x=8;x<128;x+=32)for(let y=12;y<128;y+=64){ctx.fillRect(x,y,23,38);ctx.fillStyle='#a5bac0';ctx.fillRect(x+1,y+2,3,34);ctx.fillStyle='#72909b';}const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;walls.map=texture;
 panels.userData.levelIds=rooms.flatMap(r=>[r.levelId,r.levelId,r.levelId,r.levelId]);slabs.userData.levelIds=rooms.map(r=>r.levelId);
 for(let i=0;i<rooms.length;i++){const r=rooms[i],e=levels.get(r.levelId)??0;position.set(r.x+r.width/2,e-.07,r.y+r.depth/2);scale.set(r.width,.14,r.depth);matrix.compose(position,rotation,scale);slabs.setMatrixAt(i,matrix);
  for(let side=0;side<4;side++){position.set(side%2?r.x+(side===1?r.width:0):r.x+r.width/2,e+r.height/2,side%2?r.y+r.depth/2:r.y+(side===2?r.depth:0));scale.set(side%2?.12:r.width,r.height,side%2?r.depth:.12);matrix.compose(position,rotation,scale);panels.setMatrixAt(i*4+side,matrix);}}
 panels.instanceMatrix.needsUpdate=slabs.instanceMatrix.needsUpdate=true;panels.castShadow=false;slabs.castShadow=false;g.add(panels,slabs);return g;
}
