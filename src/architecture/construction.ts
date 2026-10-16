import { produce } from 'immer';
import { furnitureCatalog, parseProject, resolvedWalls, roomWalls, wallOpenings, openingOnWall, deleteSelection, uid, type Furniture, type FurnitureKind, type Point, type Project, type Room, type Selection } from './model';

export type PlacementSettings = { rotation: number; elevation: number; allowOverlap: boolean; template: Furniture | null };
export type RoomBlueprint = { room: Room; furniture: Furniture[]; lights: Project['lights']; walls: Project['walls']; openings: Project['openings']; measurements:Project['measurements'] };
export const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;
export function placementItem(project: Project, levelId: string, kind: FurnitureKind, assetId: string | undefined, point: Point, settings: PlacementSettings): Furniture {
  const template = settings.template;
  const asset = assetId ? project.assets.find(a => a.id === assetId) : undefined;
  const base = template ?? furnitureCatalog.find(f => f.kind === kind) ?? furnitureCatalog[0];
  return { ...base, ...(asset ? { kind: 'custom' as const, assetId: asset.id, name: asset.name, color: template?.color??'#ffffff', ...(!template?asset.dimensions:{}) } : {}), id: 'placement-preview', levelId, ...point, rotation: normalizeAngle(settings.rotation), elevation: settings.elevation };
}
type Rect = Point & { width: number; depth: number; rotation: number };
export function corners(rect: Rect): Point[] {
  const a = rect.rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:rect.x+c*x*rect.width/2-s*y*rect.depth/2,y:rect.y+s*x*rect.width/2+c*y*rect.depth/2}));
}
export function rectanglesIntersect(a: Rect, b: Rect, margin = .005) {
  const pa = corners(a), pb = corners(b);
  for (const angle of [a.rotation,b.rotation]) for (const offset of [0,90]) {
    const radians = (angle+offset)*Math.PI/180, x=Math.cos(radians),y=Math.sin(radians);
    const aa=pa.map(p=>p.x*x+p.y*y),bb=pb.map(p=>p.x*x+p.y*y);
    if (Math.min(Math.max(...aa),Math.max(...bb))-Math.max(Math.min(...aa),Math.min(...bb))<=margin) return false;
  }
  return true;
}
type Obstacle = Rect & { id: string; name: string; elevation: number; height: number };
const indices = new WeakMap<Project, Map<string, { cells: Map<string,Obstacle[]>; large: Obstacle[] }>>();
function cellRange(rect: Rect) { const p=corners(rect);return {x0:Math.floor(Math.min(...p.map(v=>v.x))/4),x1:Math.floor(Math.max(...p.map(v=>v.x))/4),y0:Math.floor(Math.min(...p.map(v=>v.y))/4),y1:Math.floor(Math.max(...p.map(v=>v.y))/4)}; }
function obstacleIndex(project: Project, levelId: string) {
  let levels=Object.isFrozen(project)?indices.get(project):undefined;if(!levels){levels=new Map();if(Object.isFrozen(project))indices.set(project,levels);}let index=levels.get(levelId);if(index)return index;
  index={cells:new Map(),large:[]};
  const obstacles:Obstacle[]=project.furniture.filter(f=>f.levelId===levelId&&f.kind!=='rug');
  for(const wall of resolvedWalls(project,levelId))obstacles.push({id:wall.id,name:'muro',x:(wall.a.x+wall.b.x)/2,y:(wall.a.y+wall.b.y)/2,width:Math.hypot(wall.b.x-wall.a.x,wall.b.y-wall.a.y),depth:wall.thickness,rotation:Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x)*180/Math.PI,elevation:0,height:wall.height});
  for(const obstacle of obstacles){const r=cellRange(obstacle);if((r.x1-r.x0+1)*(r.y1-r.y0+1)>1024){index.large.push(obstacle);continue;}for(let x=r.x0;x<=r.x1;x++)for(let y=r.y0;y<=r.y1;y++){const key=`${x}:${y}`,list=index.cells.get(key)??[];list.push(obstacle);index.cells.set(key,list);}}
  levels.set(levelId,index);return index;
}
function insidePolygon(p:Point,polygon:Point[]) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {const a=polygon[i],b=polygon[j],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<.005)return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}
  return inside;
}
function crosses(a:Point,b:Point,c:Point,d:Point){const side=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);return side(a,b,c)*side(a,b,d)<-1e-10&&side(c,d,a)*side(c,d,b)<-1e-10;}
export function placementIssue(project:Project,item:Furniture,allowOverlap=false,ignoreId?:string):string|null {
  if(!Number.isFinite(item.x+item.y+item.elevation+item.rotation)||item.elevation<0)return 'La altura debe ser igual o mayor que cero.';
  if(project.site.enabled){const s=project.site,boundary=s.boundary.length>=3?s.boundary:corners({x:s.x,y:s.y,width:s.width,depth:s.depth,rotation:0}),points=corners(item);if(points.some(p=>!insidePolygon(p,boundary))||points.some((a,i)=>boundary.some((b,j)=>crosses(a,points[(i+1)%4],b,boundary[(j+1)%boundary.length]))))return 'La pieza queda fuera del lote.';}
  if(allowOverlap||item.kind==='rug')return null;
  const index=obstacleIndex(project,item.levelId),range=cellRange(item),candidates=new Set(index.large);
  if((range.x1-range.x0+1)*(range.y1-range.y0+1)>1024){for(const cell of index.cells.values())for(const obstacle of cell)candidates.add(obstacle);}else for(let x=range.x0;x<=range.x1;x++)for(let y=range.y0;y<=range.y1;y++)for(const obstacle of index.cells.get(`${x}:${y}`)??[])candidates.add(obstacle);
  for(const obstacle of candidates){if(obstacle.id===ignoreId||Math.min(item.elevation+item.height,obstacle.elevation+obstacle.height)-Math.max(item.elevation,obstacle.elevation)<=.005)continue;if(rectanglesIntersect(item,obstacle))return `Se cruza con ${obstacle.name}. Mueve la pieza o activa Superponer.`;}
  return null;
}
const contains=(room:Room,p:Point)=>p.x>=room.x&&p.x<room.x+room.width&&p.y>=room.y&&p.y<room.y+room.depth;
export function roomBlueprint(project:Project,id:string):RoomBlueprint {
  const room=project.rooms.find(r=>r.id===id);if(!room)throw Error('Selecciona una habitación.');
  const inside=(p:Point)=>contains(room,p),closed=(p:Point)=>p.x>=room.x-.001&&p.x<=room.x+room.width+.001&&p.y>=room.y-.001&&p.y<=room.y+room.depth+.001,walls=project.walls.filter(w=>w.levelId===room.levelId&&closed(w.a)&&closed(w.b));
  const openings:Project['openings']=project.openings.filter(o=>walls.some(w=>w.id===o.wallId));
  const resolved=resolvedWalls(project,room.levelId);
  const originals=new Map(project.openings.map(o=>[o.id,o]));
  for(const edge of roomWalls(room)){const shared=resolved.find(w=>w.aliases.includes(edge.id));if(!shared)continue;for(const opening of wallOpenings(project,shared)){const local=openingOnWall(project,originals.get(opening.id)!,edge);openings.push({id:opening.id,wallId:edge.id,kind:opening.kind,offset:local.offset,width:opening.width,height:opening.height,sill:opening.sill});}}
  return {room:{...room},furniture:project.furniture.filter(f=>f.levelId===room.levelId&&inside(f)),lights:project.lights.filter(l=>l.levelId===room.levelId&&inside(l)),walls,openings,measurements:project.measurements.filter(m=>m.levelId===room.levelId&&closed(m.a)&&closed(m.b))};
}
export function emptyRoomBlueprint(width:number,depth:number,name='Habitación'):RoomBlueprint {return {room:{id:'room-preview',levelId:'preview',name,x:-width/2,y:-depth/2,width,depth,height:2.8,thickness:.16,color:'#e9e4db',finish:'wood'},furniture:[],lights:[],walls:[],openings:[],measurements:[]};}
function rotatedPoint(p:Point,room:Room,center:Point,turns:number):Point {const a=turns*Math.PI/2,dx=p.x-room.x-room.width/2,dy=p.y-room.y-room.depth/2;return{x:center.x+Math.cos(a)*dx-Math.sin(a)*dy,y:center.y+Math.sin(a)*dx+Math.cos(a)*dy};}
export function roomStamp(blueprint:RoomBlueprint,point:Point,turns=0):Room {const swap=Math.abs(turns)%2===1,width=swap?blueprint.room.depth:blueprint.room.width,depth=swap?blueprint.room.width:blueprint.room.depth;return{...blueprint.room,x:point.x-width/2,y:point.y-depth/2,width,depth};}
export function roomPlacementIssue(project:Project,room:Room):string|null {
  if(project.rooms.some(r=>r.id!==room.id&&r.levelId===room.levelId&&Math.min(r.x+r.width,room.x+room.width)-Math.max(r.x,room.x)>.001&&Math.min(r.y+r.depth,room.y+room.depth)-Math.max(r.y,room.y)>.001))return 'Las habitaciones no pueden superponerse.';
  return placementIssue(project,{...room,x:room.x+room.width/2,y:room.y+room.depth/2,id:'room-preview',kind:'sofa',rotation:0,elevation:0},true);
}
export function stampRoom(project:Project,blueprint:RoomBlueprint,levelId:string,point:Point,turns=0) {
  const room={...roomStamp(blueprint,point,turns),id:uid(),levelId},ids=new Map<string,string>(),turn=((turns%4)+4)%4;
  for(let i=0;i<4;i++)ids.set(`${blueprint.room.id}:wall:${i}`,`${room.id}:wall:${(i+turn)%4}`);
  const move=(p:Point)=>rotatedPoint(p,blueprint.room,point,turn);
  const next=produce(project,p=>{p.rooms.push(room);for(const f of blueprint.furniture)p.furniture.push({...f,...move(f),id:uid(),levelId,rotation:normalizeAngle(f.rotation+turn*90)});for(const l of blueprint.lights)p.lights.push({...l,...move(l),target:{...l.target,...move(l.target)},id:uid(),levelId});for(const w of blueprint.walls){const id=uid();ids.set(w.id,id);p.walls.push({...w,id,levelId,a:move(w.a),b:move(w.b)});}for(const m of blueprint.measurements)p.measurements.push({...m,id:uid(),levelId,a:{...m.a,...move(m.a)},b:{...m.b,...move(m.b)}});for(const o of blueprint.openings){const wallId=ids.get(o.wallId);if(wallId)p.openings.push({...o,id:uid(),wallId});}});
  parseProject(next);return {project:next,room};
}
export function reshapeRoom(project:Project,id:string,patch:Partial<Pick<Room,'x'|'y'|'width'|'depth'>>,turns=0,contentsDelta?:Point) {
  const blueprint=roomBlueprint(project,id),old=blueprint.room,turn=((turns%4)+4)%4;
  const center={x:patch.x!==undefined?patch.x+(patch.width??old.width)/2:old.x+old.width/2,y:patch.y!==undefined?patch.y+(patch.depth??old.depth)/2:old.y+old.depth/2};
  const nextRoom={...old,...patch,...(turn?roomStamp(blueprint,center,turn):{})};
  const move=(p:Point)=>turn?rotatedPoint(p,old,center,turn):{x:p.x+(contentsDelta?.x??nextRoom.x-old.x),y:p.y+(contentsDelta?.y??nextRoom.y-old.y)};
  const resized=Math.abs(nextRoom.width-old.width)+Math.abs(nextRoom.depth-old.depth)>.00001;
  const outer=(wall:Project['walls'][number])=>Math.abs(wall.a.x-wall.b.x)<.00001&&[old.x,old.x+old.width].some(x=>Math.abs(wall.a.x-x)<.00001)||Math.abs(wall.a.y-wall.b.y)<.00001&&[old.y,old.y+old.depth].some(y=>Math.abs(wall.a.y-y)<.00001);
  const wallPoint=(point:Point,wall:Project['walls'][number])=>!turn&&old.walls===false&&resized&&outer(wall)?{x:nextRoom.x+(point.x-old.x)*nextRoom.width/old.width,y:nextRoom.y+(point.y-old.y)*nextRoom.depth/old.depth}:move(point);
  const ids=new Set(blueprint.furniture.map(f=>f.id)),lights=new Set(blueprint.lights.map(l=>l.id)),walls=new Set(blueprint.walls.map(w=>w.id));
  const next=produce(project,p=>{for(const o of blueprint.openings)if(project.openings.find(original=>original.id===o.id)?.wallId!==o.wallId)p.openings.push({...o,id:uid()});for(const m of p.measurements)if(blueprint.measurements.some(original=>original.id===m.id)){Object.assign(m.a,move(m.a));Object.assign(m.b,move(m.b));}Object.assign(p.rooms.find(r=>r.id===id)!,nextRoom);for(const f of p.furniture)if(ids.has(f.id))Object.assign(f,move(f),{rotation:normalizeAngle(f.rotation+turn*90)});for(const l of p.lights)if(lights.has(l.id)){Object.assign(l,move(l));Object.assign(l.target,move(l.target));}for(const w of p.walls)if(walls.has(w.id)){const original=blueprint.walls.find(old=>old.id===w.id)!;w.a=wallPoint(original.a,original);w.b=wallPoint(original.b,original);}for(const o of p.openings){if(walls.has(o.wallId)){const original=blueprint.walls.find(w=>w.id===o.wallId)!,current=p.walls.find(w=>w.id===o.wallId)!,oldLength=Math.hypot(original.b.x-original.a.x,original.b.y-original.a.y),length=Math.hypot(current.b.x-current.a.x,current.b.y-current.a.y);if(o.width>length)throw Error('La pared es más corta que una de sus puertas o ventanas.');o.offset=Math.max(o.width/2,Math.min(length-o.width/2,o.offset*length/oldLength));}const prefix=old.id+':wall:';if(o.wallId.startsWith(prefix)){const edge=(Number(o.wallId.slice(prefix.length))+turn)%4;o.wallId=prefix+edge;const length=edge%2?nextRoom.depth:nextRoom.width;if(o.width>length)throw Error('La pared es más corta que una de sus puertas o ventanas.');o.offset=Math.max(o.width/2,Math.min(length-o.width/2,o.offset));}}});
  parseProject(next);return next;
}
export function constrainedEnd(start:Point,end:Point,axis:boolean):Point {if(!axis)return end;const dx=end.x-start.x,dy=end.y-start.y,angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4,length=Math.hypot(dx,dy);return{x:start.x+Math.cos(angle)*length,y:start.y+Math.sin(angle)*length};}
export function demolish(project:Project,selection:Selection):Project {
  if(selection?.kind!=='wall')return deleteSelection(project,selection);
  const wall=resolvedWalls(project).find(w=>w.aliases.includes(selection.id));if(!wall?.roomId)return deleteSelection(project,selection);
  const affected=project.rooms.filter(r=>wall.aliases.some(a=>a.startsWith(r.id+':wall:'))),removed=new Set(wall.aliases),map=new Map<string,string>();
  const next=produce(project,p=>{for(const room of affected){p.rooms.find(r=>r.id===room.id)!.walls=false;for(const edge of roomWalls(room)){if(removed.has(edge.id))continue;const id=uid();map.set(edge.id,id);p.walls.push({id,levelId:edge.levelId,name:edge.name,a:edge.a,b:edge.b,height:edge.height,thickness:edge.thickness,color:edge.color,finish:edge.finish});}}p.openings=p.openings.filter(o=>!removed.has(o.wallId));for(const opening of p.openings)opening.wallId=map.get(opening.wallId)??opening.wallId;});
  parseProject(next);return next;
}
