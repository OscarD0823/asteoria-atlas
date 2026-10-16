import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { CameraMotion, MotionValue, actuateModel, easeMotion } from '../src/architecture/motion';
import { modelFactory } from '../src/architecture/procedural-models';
import { furnitureInstances } from '../src/architecture/scene-instances';
import { emptyProject, makeFurniture } from '../src/architecture/model';

test('motion reaches exact endpoints without overshoot and can reverse from its current value',()=>{
 const value=new MotionValue(0);value.retarget(1,0,600);value.update(150);const before=value.value;assert(before>0&&before<.5);value.retarget(0,150,400);assert.equal(value.value,before);value.update(250);assert(value.value<before&&value.value>0);value.update(550);assert.equal(value.value,0);assert.equal(value.active,false);assert.equal(easeMotion(-1),0);assert.equal(easeMotion(2),1);
});
test('camera interpolates position, perspective and quaternion, including a reversal mid-flight',()=>{
 const camera=new T.PerspectiveCamera(40),target=new T.Vector3(),motion=new CameraMotion(),goal={position:new T.Vector3(10,2,0),quaternion:new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI*.8),fov:65,target:new T.Vector3(2,0,0)};
 motion.start(camera,target,goal,0,600);motion.update(camera,target,300);assert(Math.abs(camera.position.x-5)<1e-9);assert.equal(camera.fov,52.5);assert(Math.abs(camera.quaternion.length()-1)<1e-9);
 const current=camera.position.clone();motion.start(camera,target,{...goal,position:new T.Vector3(),quaternion:new T.Quaternion(),fov:40},300,400);motion.update(camera,target,300);assert(camera.position.equals(current));motion.finish(camera,target);assert(camera.position.equals(new T.Vector3()));assert.equal(camera.fov,40);assert.equal(motion.active,false);
});
test('zero-duration motion honours reduced-motion preferences',()=>{const value=new MotionValue(0);value.retarget(1,10,0);assert.equal(value.value,1);assert.equal(value.active,false);});
test('cabinet, fridge, oven, washer, gate and curtains have actual articulated intermediate poses',()=>{
 const p=emptyProject(),factory=modelFactory();for(const kind of ['cabinet','fridge','oven','washer','gate','curtain'] as const){const f=makeFurniture(kind,p.levels[0].id,{x:0,y:0}),object=factory.create(f),actuators=object.userData.actuators;assert(actuators.length>0,kind);actuateModel(object,.5);for(const a of actuators){assert(a.node.position.toArray().every(Number.isFinite));assert(a.node.scale.toArray().every(Number.isFinite));assert(a.node.quaternion.angleTo(a.closedRotation)>0||a.node.position.distanceTo(a.closedPosition)>0||a.node.scale.distanceTo(a.closedScale)>0,kind);if(kind!=='curtain')assert(a.node.scale.equals(a.closedScale),'rigid doors do not shrink while turning');}}
 factory.dispose();
});
test('temporary animated furniture hides only its own instance and releases its private materials',()=>{
 const p=emptyProject(),f=makeFurniture('fridge',p.levels[0].id,{x:2,y:3}),other={...f,id:'other',x:5},objects=new Map(),parent=new T.Group(),batches=furnitureInstances(parent,objects);batches.sync([f,other],[]);
 const pose=batches.detailed({...f,open:true},[]);pose.update(.5,1);batches.setHidden(f.id,true);const mesh=batches.group.children.find(o=>o instanceof T.InstancedMesh&&o.userData.furnitureIds.includes(f.id)) as T.InstancedMesh,matrix=new T.Matrix4();mesh.getMatrixAt(mesh.userData.furnitureIds.indexOf(f.id),matrix);assert.equal(matrix.determinant(),0);
 let disposed=0;pose.root.traverse(o=>{if(o instanceof T.Mesh)(o.material as T.Material).addEventListener('dispose',()=>disposed++);});pose.dispose();assert(disposed>0);batches.setHidden(f.id,false);mesh.getMatrixAt(mesh.userData.furnitureIds.indexOf(f.id),matrix);assert(matrix.determinant()>0);batches.dispose();
});
