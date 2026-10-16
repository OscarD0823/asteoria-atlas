import { resolvedWalls, type Project, type Furniture, type Point } from './model';
export function footprint(project:Project,f:Furniture):Point[] { const asset=project.assets.find(a=>a.id===f.assetId),shape=asset&&asset.footprint.length>=3?asset.footprint:[{x:-.5,y:-.5},{x:.5,y:-.5},{x:.5,y:.5},{x:-.5,y:.5}],angle=f.rotation*Math.PI/180;return shape.map(p=>{const x=p.x*f.width,y=p.y*f.depth;return{x:f.x+Math.cos(angle)*x-Math.sin(angle)*y,y:f.y+Math.sin(angle)*x+Math.cos(angle)*y};}); }
export function planDxf(project:Project,levelId:string) {
 const records=['0','SECTION','2','HEADER','9','$INSUNITS','70','6','0','ENDSEC','0','SECTION','2','ENTITIES'];
 const line=(a:Point,b:Point,layer:string)=>records.push('0','LINE','8',layer,'10',String(a.x),'20',String(-a.y),'30','0','11',String(b.x),'21',String(-b.y),'31','0');
 for(const wall of resolvedWalls(project,levelId))line(wall.a,wall.b,'MUROS');
 for(const f of project.furniture.filter(f=>f.levelId===levelId)){const points=footprint(project,f);for(let i=0;i<points.length;i++)line(points[i],points[(i+1)%points.length],f.kind==='custom'?'MODELOS_3D_HUELLA':'MOBILIARIO');}
 for(const ref of project.underlays.filter(r=>r.levelId===levelId)){const points=[{x:ref.x,y:ref.y},{x:ref.x+ref.width,y:ref.y},{x:ref.x+ref.width,y:ref.y+ref.depth},{x:ref.x,y:ref.y+ref.depth}];for(let i=0;i<4;i++)line(points[i],points[(i+1)%4],'REFERENCIAS');}
 records.push('0','ENDSEC','0','EOF');return records.join('\n')+'\n';
}
