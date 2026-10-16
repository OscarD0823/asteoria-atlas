import { projectPoint, resolvedWalls, wallOpenings, type Furniture, type Point, type Project, type ResolvedWall } from './model';
type Collider={wall?:ResolvedWall;doors?:ReturnType<typeof wallOpenings>;furniture?:Furniture};
const cache=new WeakMap<Project,Map<string,Map<string,Collider[]>>>(),cell=4;
function index(project:Project,levelId:string){
 let levels=cache.get(project);if(!levels){levels=new Map();cache.set(project,levels);}let cells=levels.get(levelId);if(cells)return cells;cells=new Map();levels.set(levelId,cells);
 const put=(a:Point,b:Point,c:Collider)=>{const margin=(c.wall?.thickness??0)/2+.5,minX=Math.floor((a.x-margin)/cell),maxX=Math.floor((b.x+margin)/cell),minY=Math.floor((a.y-margin)/cell),maxY=Math.floor((b.y+margin)/cell);if((maxX-minX+1)*(maxY-minY+1)>1024){const global=cells!.get('*')??[];global.push(c);cells!.set('*',global);return;}for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){const key=`${x}:${y}`,items=cells!.get(key)??[];items.push(c);cells!.set(key,items);}};
 for(const wall of resolvedWalls(project,levelId))put({x:Math.min(wall.a.x,wall.b.x),y:Math.min(wall.a.y,wall.b.y)},{x:Math.max(wall.a.x,wall.b.x),y:Math.max(wall.a.y,wall.b.y)},{wall,doors:wallOpenings(project,wall)});
 for(const f of project.furniture)if(f.levelId===levelId&&!['rug','curtain','led-strip'].includes(f.kind)){const r=Math.hypot(f.width,f.depth)/2;put({x:f.x-r,y:f.y-r},{x:f.x+r,y:f.y+r},{furniture:f});}
 return cells;
}
export function indexedCanWalk(project:Project,levelId:string,p:Point,radius=.18){
 const cells=index(project,levelId),candidates=[...(cells.get(`${Math.floor(p.x/cell)}:${Math.floor(p.y/cell)}`)??[]),...(cells.get('*')??[])];
 for(const c of candidates){if(c.wall){const wall=c.wall,nearest=projectPoint(p,wall);if(nearest.distance>=wall.thickness/2+radius)continue;if(!c.doors!.some(o=>o.kind==='door'&&o.height>=project.environment.eyeHeight+.05&&Math.abs(nearest.offset-o.offset)<=o.width/2-radius))return false;}
  if(c.furniture){const f=c.furniture;if(f.elevation>=project.environment.eyeHeight+.15)continue;const a=f.rotation*Math.PI/180,dx=p.x-f.x,dy=p.y-f.y,x=Math.cos(a)*dx+Math.sin(a)*dy,y=-Math.sin(a)*dx+Math.cos(a)*dy;if(Math.abs(x)<f.width/2+radius&&Math.abs(y)<f.depth/2+radius)return false;}}
 return true;
}
