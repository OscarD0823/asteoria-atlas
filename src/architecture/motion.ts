import * as T from 'three';

export const easeMotion=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
export class MotionValue {
  private start=0; private from:number; private to:number; private duration=0;
  constructor(public value:number){this.from=this.to=value;}
  get target(){return this.to;}
  get active(){return this.duration>0;}
  retarget(target:number,time:number,duration=480){this.update(time);if(target===this.to)return;this.from=this.value;this.to=target;this.start=time;this.duration=duration;if(duration<=0)this.finish();}
  update(time:number){if(!this.active)return false;const t=Math.max(0,(time-this.start)/this.duration);this.value=T.MathUtils.lerp(this.from,this.to,easeMotion(t));if(t>=1)this.finish();return true;}
  finish(){this.value=this.from=this.to;this.duration=0;}
}

type CameraPose={position:T.Vector3;quaternion:T.Quaternion;fov:number;target:T.Vector3};
export class CameraMotion {
  private from:CameraPose|null=null;private goal:CameraPose|null=null;private started=0;private duration=0;
  get active(){return this.goal!==null;}
  start(camera:T.PerspectiveCamera,target:T.Vector3,goal:CameraPose,time:number,duration=620){
    this.from={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov,target:target.clone()};
    this.goal={position:goal.position.clone(),quaternion:goal.quaternion.clone(),fov:goal.fov,target:goal.target.clone()};this.started=time;this.duration=duration;
  }
  update(camera:T.PerspectiveCamera,target:T.Vector3,time:number){
    if(!this.goal||!this.from)return false;const progress=this.duration<=0?1:Math.max(0,(time-this.started)/this.duration),t=easeMotion(progress);
    camera.position.lerpVectors(this.from.position,this.goal.position,t);camera.quaternion.slerpQuaternions(this.from.quaternion,this.goal.quaternion,t);camera.fov=T.MathUtils.lerp(this.from.fov,this.goal.fov,t);target.lerpVectors(this.from.target,this.goal.target,t);camera.updateProjectionMatrix();
    if(progress>=1){this.goal=this.from=null;}return true;
  }
  finish(camera:T.PerspectiveCamera,target:T.Vector3){if(this.goal)this.update(camera,target,this.started+this.duration);}
  cancel(){this.goal=this.from=null;}
}

export function lookRotation(position:T.Vector3,target:T.Vector3){return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(position,target,new T.Vector3(0,1,0)));}

export type ModelActuator={node:T.Object3D;closedPosition:T.Vector3;openPosition:T.Vector3;closedScale:T.Vector3;openScale:T.Vector3;closedRotation:T.Quaternion;openRotation:T.Quaternion};
export function actuateModel(root:T.Object3D,open:number){for(const a of (root.userData.actuators??[]) as ModelActuator[]){a.node.position.lerpVectors(a.closedPosition,a.openPosition,open);a.node.scale.lerpVectors(a.closedScale,a.openScale,open);a.node.quaternion.slerpQuaternions(a.closedRotation,a.openRotation,open);}}
