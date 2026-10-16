import type { Point } from './model';
export type VectorDrawing={loops:Point[][];lines:{a:Point;b:Point}[];unit:number;warnings:string[]};
// ASCII DXF, independent of DOM and graphics. Binary DWG/DXF require a converter.
export function parseDxf(text:string):VectorDrawing{
 if(text.startsWith('AutoCAD Binary DXF'))throw Error('El DXF binario debe convertirse a DXF ASCII.');
 const rows=text.replace(/^\ufeff/,'').split(/\r?\n/),pairs:{code:number;value:string}[]=[];for(let i=0;i+1<rows.length;i+=2){const code=Number(rows[i].trim());if(!Number.isInteger(code))throw Error('Código de grupo DXF inválido.');pairs.push({code,value:rows[i+1].trim()});}if(pairs.length>600000)throw Error('El DXF tiene demasiadas entidades.');
 let unit=.001;for(let i=0;i<pairs.length-1;i++)if(pairs[i].value==='$INSUNITS'){const id=Number(pairs[i+1].value);unit=({1:.0254,2:.3048,4:.001,5:.01,6:1,7:1000} as Record<number,number>)[id]??.001;}
 const loops:Point[][]=[],lines:VectorDrawing['lines']=[],warnings:string[]=[],value=(chunk:typeof pairs,code:number,def=0)=>Number(chunk.find(p=>p.code===code)?.value??def),p=(chunk:typeof pairs,x:number,y:number)=>({x:value(chunk,x)*unit,y:-value(chunk,y)*unit});
 const entities:{type:string;chunk:typeof pairs}[]=[];for(let i=0;i<pairs.length;){if(pairs[i].code!==0){i++;continue;}const type=pairs[i++].value,start=i;while(i<pairs.length&&pairs[i].code!==0)i++;entities.push({type,chunk:pairs.slice(start,i)});}
 let section='';for(let i=0;i<entities.length;i++){const {type,chunk}=entities[i];if(type==='SECTION'){section=chunk.find(p=>p.code===2)?.value??'';continue;}if(type==='ENDSEC'){section='';continue;}if(section!=='ENTITIES')continue;
  if(type==='LINE'){lines.push({a:p(chunk,10,20),b:p(chunk,11,21)});}
  else if(type==='LWPOLYLINE'||type==='POLYLINE'){
   const points:Point[]=[];let closed=(value(chunk,70)&1)!==0;if(type==='LWPOLYLINE'){for(let j=0;j<chunk.length;j++)if(chunk[j].code===10){const yy=chunk.slice(j+1).find(p=>p.code===20);points.push({x:Number(chunk[j].value)*unit,y:-Number(yy?.value??0)*unit});if(chunk[j+2]?.code===42&&Number(chunk[j+2].value)!==0)warnings.push('Los arcos de polilínea se aproximan mediante segmentos.');}}else{while(entities[i+1]?.type==='VERTEX'){i++;points.push(p(entities[i].chunk,10,20));}}
   if(closed&&points.length>=3)loops.push(points);else for(let j=1;j<points.length;j++)lines.push({a:points[j-1],b:points[j]});
  }else if(type==='CIRCLE'||type==='ARC'){const center=p(chunk,10,20),radius=value(chunk,40)*unit,start=type==='ARC'?value(chunk,50)*Math.PI/180:0,end=type==='ARC'?value(chunk,51)*Math.PI/180:Math.PI*2,span=end>start?end-start:end+Math.PI*2-start,points=Array.from({length:65},(_,n)=>({x:center.x+Math.cos(start+span*n/64)*radius,y:center.y-Math.sin(start+span*n/64)*radius}));if(type==='CIRCLE')loops.push(points.slice(0,-1));else for(let j=1;j<points.length;j++)lines.push({a:points[j-1],b:points[j]});}
  else if(type==='SOLID'||type==='3DFACE')loops.push([p(chunk,10,20),p(chunk,11,21),p(chunk,12,22),p(chunk,13,23)]);
  else if(['INSERT','HATCH','SPLINE','ELLIPSE'].includes(type))warnings.push(`${type}: no convertido; explota o convierte esa entidad en polilíneas antes de importar.`);
 }
 if(!loops.length&&!lines.length)throw Error('No encontramos líneas ni contornos compatibles en ENTITIES.');if(loops.flat().length+lines.length*2>30000)throw Error('Simplifica el DXF a un máximo de 30000 vértices.');
 for(const point of [...loops.flat(),...lines.flatMap(l=>[l.a,l.b])])if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||Math.abs(point.x)>1e7||Math.abs(point.y)>1e7)throw Error('Coordenadas DXF inválidas.');
 return{loops,lines,unit,warnings:[...new Set(warnings)]};
}
