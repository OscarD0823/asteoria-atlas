import type { Point } from './model';
export type MeshAsset = { id: string; name: string; positions: string; colors?: string; uv?: string; texture?: string; vertices: number; triangles: number; footprint: Point[]; dimensions?: {width:number;depth:number;height:number} };
export type Underlay = { id: string; levelId: string; name: string; image: string; x: number; y: number; width: number; depth: number; opacity: number };
export type Heightfield = { columns: number; rows: number; values: number[]; width: number; depth: number; datum: number; source: string };
export type Site = { enabled: boolean; width: number; depth: number; x: number; y: number; baseElevation: number; slopeX: number; slopeZ: number; landscape: 'grass'|'sand'|'urban'|'snow'; latitude: number; longitude: number; mapZoom: number; mapEnabled: boolean; boundary: Point[]; heightfield: Heightfield|null };
export function defaultSite(): Site { return {enabled:false,width:40,depth:40,x:0,y:0,baseElevation:-.15,slopeX:0,slopeZ:0,landscape:'grass',latitude:4.711,longitude:-74.0721,mapZoom:18,mapEnabled:false,boundary:[],heightfield:null}; }
export function encodeFloats(array: Float32Array) { return encodeBytes(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)); }
export function encodeBytes(bytes: Uint8Array) { let text=''; for(let i=0;i<bytes.length;i+=16384) text+=String.fromCharCode(...bytes.subarray(i,i+16384)); return btoa(text); }
export function decodeBytes(text:string) { const raw=atob(text), bytes=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i); return bytes; }
export function decodeFloats(text:string) { const bytes=decodeBytes(text); if(bytes.length%4) throw Error('Datos de geometría inválidos.'); return new Float32Array(bytes.buffer); }
const validatedAssets = new WeakSet<object>();
export function parseExtras(input:Record<string,unknown>,levelIds:Set<string>,modern:boolean) {
 const fail=(s:string):never=>{throw Error(s);};
 const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail('Datos de terreno o modelo inválidos.');
 const number=(v:unknown,min=-1e6,max=1e6)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:fail('Medida de terreno o modelo fuera de rango.');
 const text=(v:unknown,max=200)=>typeof v==='string'&&v.length>0&&v.length<=max?v:fail('Nombre o contenido del modelo inválido.');
 const list=(v:unknown,max=512):unknown[]=>Array.isArray(v)&&v.length<=max?v:fail('Demasiados elementos de terreno o modelos.');
 const point=(v:unknown):Point=>{const o=record(v);return{x:number(o.x),y:number(o.y)};};
 const image=(v:unknown)=>{const s=text(v,8*1024*1024);if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s))fail('La imagen debe estar incluida en el proyecto.');return s;};
 const assets:MeshAsset[]=modern?list(input.assets,128).map(v=>{
  const o=record(v); if(Object.isFrozen(o)&&validatedAssets.has(o))return o as MeshAsset;
  const vertices=number(o.vertices,3,600000),triangles=number(o.triangles,1,200000),positions=text(o.positions,12*1024*1024);
  if(vertices!==triangles*3||!Number.isInteger(vertices))fail('El modelo excede el presupuesto de triángulos o tiene un tamaño incompatible.');
  const floats=decodeFloats(positions);if(floats.length!==vertices*3||floats.some(n=>!Number.isFinite(n)||Math.abs(n)>4))fail('Vértices normalizados inválidos.');
  const colors=o.colors===undefined?undefined:text(o.colors,12*1024*1024); if(colors){const data=decodeFloats(colors);if(data.length!==vertices*3||data.some(n=>!Number.isFinite(n)||n<0||n>1))fail('Colores del modelo inválidos.');}
  const uv=o.uv===undefined?undefined:text(o.uv,8*1024*1024);if(uv){const data=decodeFloats(uv);if(data.length!==vertices*2||data.some(n=>!Number.isFinite(n)||Math.abs(n)>100))fail('Coordenadas de textura inválidas.');}
  const dimensions=o.dimensions?record(o.dimensions):null;
  const asset={id:text(o.id),name:text(o.name),positions,vertices,triangles,footprint:list(o.footprint,256).map(point),...(dimensions?{dimensions:{width:number(dimensions.width,.001,1e4),depth:number(dimensions.depth,.001,1e4),height:number(dimensions.height,.001,1000)}}:{}),...(colors?{colors}:{}),...(uv?{uv}:{}),...(o.texture?{texture:image(o.texture)}:{})};validatedAssets.add(asset);validatedAssets.add(o);return asset;
 }):[];
 const underlays:Underlay[]=modern?list(input.underlays,32).map(v=>{const o=record(v),levelId=text(o.levelId);if(!levelIds.has(levelId))fail('El plano de referencia apunta a una planta inexistente.');return{id:text(o.id),levelId,name:text(o.name),image:image(o.image),x:number(o.x),y:number(o.y),width:number(o.width,.001,1e4),depth:number(o.depth,.001,1e4),opacity:number(o.opacity,0,1)};}):[];
 const o=modern?record(input.site):defaultSite();const landscapes=['grass','sand','urban','snow'];if(!landscapes.includes(String(o.landscape)))fail('Paisaje desconocido.');
 let heightfield:Heightfield|null=null;if(o.heightfield){const h=record(o.heightfield),columns=number(h.columns,2,129),rows=number(h.rows,2,129),values=list(h.values,129*129).map(v=>number(v,-10000,10000));if(!Number.isInteger(columns)||!Number.isInteger(rows)||values.length!==columns*rows)fail('La malla de alturas no tiene las dimensiones indicadas.');heightfield={columns,rows,values,width:number(h.width,.01,1e5),depth:number(h.depth,.01,1e5),datum:number(h.datum,-10000,10000),source:text(h.source)};}
 if(typeof o.enabled!=='boolean'||typeof o.mapEnabled!=='boolean')fail('Estado de terreno inválido.');
 const site:Site={enabled:o.enabled as boolean,mapEnabled:o.mapEnabled as boolean,width:number(o.width,.1,1e5),depth:number(o.depth,.1,1e5),x:number(o.x),y:number(o.y),baseElevation:number(o.baseElevation,-10000,10000),slopeX:number(o.slopeX,-2,2),slopeZ:number(o.slopeZ,-2,2),landscape:o.landscape as Site['landscape'],latitude:number(o.latitude,-85,85),longitude:number(o.longitude,-180,180),mapZoom:number(o.mapZoom,2,20),boundary:list(o.boundary,512).map(point),heightfield};
 if(assets.reduce((n,a)=>n+a.positions.length+(a.colors?.length??0)+(a.uv?.length??0)+(a.texture?.length??0),0)>64*1024*1024)fail('Los modelos importados superan el presupuesto de 64 MB del proyecto. Simplifica algunos modelos.');
 if(underlays.reduce((n,u)=>n+u.image.length,0)>32*1024*1024)fail('Las referencias superan el presupuesto de 32 MB del proyecto.');
 if(!Number.isInteger(site.mapZoom))fail('El nivel de zoom del mapa debe ser entero.');
 return{assets,underlays,site};
}
