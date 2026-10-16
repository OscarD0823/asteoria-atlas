import test from 'node:test';
import assert from 'node:assert/strict';
import { freeze } from 'immer';
import * as T from 'three';
import { demoProject, emptyProject, environmentPreset, makeFurniture, parseProject, resolvedWalls } from '../src/architecture/model';
import { canWalkAt } from '../src/architecture/interactions';
import { actionLabel, fixtureLight, furnitureAction, lightRange, toggleWalkObject } from '../src/architecture/walk-actions';
import { furnitureInstances } from '../src/architecture/scene-instances';
import { pathSnapshot } from '../src/architecture/path-render';

test('opening states survive save and control both cached and uncached walking collisions',()=>{
  const p=demoProject(),o=p.openings.find(o=>o.kind==='door')!,wall=resolvedWalls(p).find(w=>w.aliases.includes(o.wallId))!,length=Math.hypot(wall.b.x-wall.a.x,wall.b.y-wall.a.y),point={x:wall.a.x+(wall.b.x-wall.a.x)*o.offset/length,y:wall.a.y+(wall.b.y-wall.a.y)*o.offset/length};
  p.furniture=[];o.open=false;assert.equal(canWalkAt(p,wall.levelId,point),false);assert.equal(canWalkAt(freeze(structuredClone(p),true),wall.levelId,point),false);
  const opened=toggleWalkObject(p,{kind:'opening',id:o.id});assert.equal(opened.openings.find(x=>x.id===o.id)?.open,true);assert.equal(parseProject(opened).openings.find(x=>x.id===o.id)?.open,true);assert.equal(canWalkAt(opened,wall.levelId,point),true);assert.equal(o.open,false);
});
test('legacy door projects keep their previously passable doorway and windows start closed',()=>{const p=demoProject();assert.match(actionLabel(p,{kind:'opening',id:p.openings[0].id}),/^Cerrar/);const w=p.openings.find(o=>o.kind==='window')!;assert.match(actionLabel(p,{kind:'opening',id:w.id}),/^Abrir/);});
test('catalog lamp has a bounded local source controlled by its switch and follows furniture placement',()=>{
 const p=emptyProject(),f=makeFurniture('floor-lamp',p.levels[0].id,{x:2,y:3});f.elevation=.4;f.lightPower=220;f.lightRange=2.5;p.furniture.push(f);
 assert.equal(fixtureLight(f)?.enabled,false);const on=toggleWalkObject(p,{kind:'furniture',id:f.id}),lamp=fixtureLight(on.furniture[0])!;assert.equal(lamp.enabled,true);assert.equal(lamp.power,220);assert.equal(lightRange(lamp),2.5);assert(Math.abs(lamp.x-f.x)<f.width/2);assert(lamp.x!==f.x,'emitter stays outside the opaque pole');assert(lamp.elevation>.4);assert.equal(environmentPreset('night').sunIntensity,0);
 const restored=parseProject(on).furniture[0];assert.equal(restored.on,true);assert.equal(restored.lightPower,220);assert.equal(restored.lightRange,2.5);
});
test('invalid interaction, light range and perspective fields cannot enter persisted projects',()=>{
 const p=demoProject();p.furniture[0].on='yes' as unknown as boolean;assert.throws(()=>parseProject(p));delete p.furniture[0].on;p.lights[0].range=-1;assert.throws(()=>parseProject(p));delete p.lights[0].range;p.environment.fieldOfView=140;assert.throws(()=>parseProject(p));
});
test('finish colors and wall surface types survive round trip for generated and explicit walls',()=>{const p=demoProject();p.rooms[0].wallColor='#b3a28f';p.rooms[0].wallFinish='wood';const parsed=parseProject(p);assert.equal(resolvedWalls(parsed).find(w=>w.roomId===p.rooms[0].id)?.finish,'wood');assert.equal(parsed.rooms[0].wallColor,'#b3a28f');});
test('walkthrough actions distinguish rest, appliances, storage and passive inspection',()=>{const p=emptyProject(),f=makeFurniture('bed',p.levels[0].id,{x:0,y:0});assert.equal(furnitureAction(f),'bed');assert.equal(furnitureAction({...f,kind:'chair'}),'seat');assert.equal(furnitureAction({...f,kind:'tv'}),'switch');assert.equal(furnitureAction({...f,kind:'fridge'}),'open');assert.equal(furnitureAction({...f,kind:'column'}),'inspect');});
test('functional variants preserve their origin and their material surface data through instancing',()=>{
 const p=emptyProject(),f=makeFurniture('tv',p.levels[0].id,{x:2,y:1}),parent=new T.Group(),objects=new Map(),batch=furnitureInstances(parent,objects);
 batch.sync([f],[]);const original=objects.get('furniture:'+f.id)!.position.clone();batch.sync([{...f,on:true}],[]);assert.deepEqual(objects.get('furniture:'+f.id)!.position,original);
 const meshes:T.InstancedMesh[]=[];batch.group.traverse(o=>{if(o instanceof T.InstancedMesh&&o.geometry.getAttribute('surface'))meshes.push(o);});assert(meshes.some(m=>Array.from(m.geometry.getAttribute('surface').array).some(v=>v===.6||Math.abs(v-.6)<1e-5)));batch.dispose();
});
test('physical render expands instance colors without disposing geometry used by the walking scene',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry(),mesh=new T.InstancedMesh(geometry,material,2);mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(2,0,0));mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(5,0,0));mesh.setColorAt(0,new T.Color('#e3a080'));scene.add(mesh);
 let disposed=false;geometry.addEventListener('dispose',()=>{disposed=true;});const snapshot=pathSnapshot(scene);assert.equal(snapshot.triangles,24);assert.equal(snapshot.scene.children.length,2);snapshot.dispose();assert.equal(disposed,false);geometry.dispose();material.dispose();mesh.dispose();
});
test('physical render rejects dense scenes before expanding their instance buffers',()=>{const scene=new T.Scene(),g=new T.BoxGeometry(),m=new T.MeshStandardMaterial(),mesh=new T.InstancedMesh(g,m,110000);scene.add(mesh);assert.throws(()=>pathSnapshot(scene),/triángulos/);mesh.dispose();g.dispose();m.dispose();});
