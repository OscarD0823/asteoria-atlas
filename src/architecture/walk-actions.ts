import { produce } from 'immer';
import { type Furniture, type Opening, type Project, type SceneLight, type Selection } from './model';

export type WalkAction = 'bed' | 'seat' | 'switch' | 'open' | 'inspect';
export const lampKinds = new Set(['table-lamp','floor-lamp','pendant','wall-lamp','spot-fixture','led-strip']);
const seats = new Set(['sofa','sofa-l','sofa-leather','armchair','recliner','chair','office-chair','stool','bench','lounge','swing']);
const containers = new Set(['cabinet','dresser','nightstand','counter','island','vanity','fridge','fridge-small','oven','microwave','dishwasher','washer','dryer','gate','curtain','grill']);
const powered = new Set(['tv','tv-large','screen','cinema','speaker','soundbar','projector','computer','hood','coffee-machine','toaster','air-conditioner','ceiling-fan','radiator','shower','sink','toilet','bathtub','pool','pool-round','hot-tub']);
export function furnitureAction(f: Furniture): WalkAction {
  if (f.kind.startsWith('bed') || f.kind==='bunk-bed') return 'bed';
  if (seats.has(f.kind)) return 'seat';
  if (lampKinds.has(f.kind) || powered.has(f.kind)) return 'switch';
  if (containers.has(f.kind)) return 'open';
  return 'inspect';
}
export const openingIsOpen = (o: Opening) => o.open ?? o.kind==='door';
export function actionLabel(project: Project, selection: NonNullable<Selection>) {
  if(selection.kind==='opening'){const o=project.openings.find(o=>o.id===selection.id)!;return `${openingIsOpen(o)?'Cerrar':'Abrir'} ${o.kind==='door'?'puerta':'ventana'}`;}
  if(selection.kind==='light'){const l=project.lights.find(l=>l.id===selection.id);return l?`${l.enabled?'Apagar':'Encender'} ${l.name}`:'';}
  if(selection.kind!=='furniture')return '';
  const f=project.furniture.find(f=>f.id===selection.id)!;switch(furnitureAction(f)){
    case 'bed':return `Acostarse · ${f.name}`;case 'seat':return `Sentarse · ${f.name}`;
    case 'switch':return `${f.on?'Apagar':'Encender'} ${f.name}`;
    case 'open':return `${f.open?'Cerrar':'Abrir'} ${f.name}`;
    default:return `Examinar · ${f.name} · ${f.width.toFixed(2)} × ${f.depth.toFixed(2)} × ${f.height.toFixed(2)} m`;
  }
}
export function toggleWalkObject(project: Project, selection: NonNullable<Selection>) {
  return produce(project,p=>{
    if(selection.kind==='opening'){const o=p.openings.find(o=>o.id===selection.id);if(o)o.open=!openingIsOpen(o);}
    if(selection.kind==='light'){const l=p.lights.find(l=>l.id===selection.id);if(l)l.enabled=!l.enabled;}
    if(selection.kind==='furniture'){const f=p.furniture.find(f=>f.id===selection.id);if(f){const action=furnitureAction(f);if(action==='switch')f.on=!f.on;else if(action==='open')f.open=!f.open;}}
  });
}
export function fixtureLight(f: Furniture): SceneLight | null {
  if(!lampKinds.has(f.kind))return null;
  const standing=f.kind==='floor-lamp'||f.kind==='table-lamp',spot=f.kind==='spot-fixture';
  // Place the emitter below the diffuser and outside the pole or solid housing, which otherwise shadows its own source.
  const localX=standing?Math.max(.03,f.width*.14):0,localZ=standing||f.kind==='pendant'?0:f.depth/2+.04,angle=-f.rotation*Math.PI/180;
  const x=f.x+Math.cos(angle)*localX+Math.sin(angle)*localZ,y=f.y-Math.sin(angle)*localX+Math.cos(angle)*localZ,elevation=f.elevation+(standing?f.height*.72:f.kind==='pendant'?-.015:f.height*.5);
  return {id:`fixture:${f.id}`,levelId:f.levelId,name:f.name,kind:spot?'spot':'point',x,y,elevation,power:f.lightPower??(f.kind==='table-lamp'?220:f.kind==='led-strip'?350:470),range:f.lightRange??(f.kind==='table-lamp'||f.kind==='led-strip'?2:4),color:'#ffe0ae',enabled:!!f.on,shadows:true,width:.2,depth:.2,angle:35,target:{x,y,elevation:Math.max(0,elevation-2)}};
}
// Point and spot lights retain inverse-square decay. A finite influence radius is a real-time budget control.
export function lightRange(light: SceneLight) { return light.range??Math.min(18,Math.max(1,Math.sqrt(light.power/40))); }
