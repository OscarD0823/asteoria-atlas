import type { Point } from './model';
import type { Heightfield, Site } from './project-extras';
export const EARTH=6378137;
export function toLocal(lon:number,lat:number,site:Pick<Site,'latitude'|'longitude'>):Point{return{x:(lon-site.longitude)*Math.PI/180*EARTH*Math.cos(site.latitude*Math.PI/180),y:-(lat-site.latitude)*Math.PI/180*EARTH};}
export function toGeographic(p:Point,site:Pick<Site,'latitude'|'longitude'>){return{longitude:site.longitude+p.x/(EARTH*Math.cos(site.latitude*Math.PI/180))*180/Math.PI,latitude:site.latitude-p.y/EARTH*180/Math.PI};}
export function terrainHeight(site:Site,p:Point){
 if(!site.enabled)return 0;let height=site.baseElevation+(p.x-site.x)*site.slopeX+(p.y-site.y)*site.slopeZ;
 const h=site.heightfield;if(h){const x=Math.max(0,Math.min(h.columns-1,(p.x-site.x+site.width/2)/site.width*(h.columns-1))),y=Math.max(0,Math.min(h.rows-1,(p.y-site.y+site.depth/2)/site.depth*(h.rows-1))),x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,h.columns-1),y1=Math.min(y0+1,h.rows-1),fx=x-x0,fy=y-y0;const a=h.values[y0*h.columns+x0]*(1-fx)+h.values[y0*h.columns+x1]*fx,b=h.values[y1*h.columns+x0]*(1-fx)+h.values[y1*h.columns+x1]*fx;height+=a*(1-fy)+b*fy;}
 return height;
}
function field(values:number[],columns:number,rows:number,width:number,depth:number,source:string):Heightfield{const valid=values.filter(Number.isFinite);if(!valid.length)throw Error('El archivo no contiene alturas válidas.');const datum=Math.min(...valid),fallback=valid.reduce((n,v)=>n+v,0)/valid.length;return{columns,rows,width,depth,datum,source,values:values.map(v=>(Number.isFinite(v)?v:fallback)-datum)};}
export function parseAsc(text:string,source='Terreno ASC'){
 const lines=text.trim().split(/\r?\n/),header:Record<string,number>={};let i=0;while(i<lines.length&&/^[a-z_]+\s+/i.test(lines[i])){const [name,value]=lines[i].trim().split(/\s+/);header[name.toLowerCase()]=Number(value);i++;}
 const width=header.ncols,height=header.nrows,size=header.cellsize;if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width*height>16_800_000||!Number.isFinite(size)||size<=0)throw Error('ASC requiere ncols, nrows y cellsize válidos; máximo 16 millones de muestras.');
 const data=lines.slice(i).join(' ').trim().split(/\s+/);if(data.length!==width*height)throw Error('El número de alturas ASC no coincide con ncols × nrows.');
 const columns=Math.min(width,129),rows=Math.min(height,129),values:number[]=[];for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const n=Number(data[Math.round(y*(height-1)/(rows-1))*width+Math.round(x*(width-1)/(columns-1))]);values.push(n===header.nodata_value?NaN:n);}
 let widthM=(width-1)*size,depthM=(height-1)*size,latitude:number|undefined,longitude:number|undefined;
 const xll=header.xllcorner??header.xllcenter,yll=header.yllcorner??header.yllcenter;
 if(size<.01&&Math.abs(xll)<180&&Math.abs(yll)<85){latitude=yll+(header.yllcorner===undefined?0:size/2)+depthM/2;longitude=xll+(header.xllcorner===undefined?0:size/2)+widthM/2;widthM*=Math.PI/180*EARTH*Math.cos(latitude*Math.PI/180);depthM*=Math.PI/180*EARTH;}
 return{heightfield:field(values,columns,rows,widthM,depthM,source),latitude,longitude};
}
export function parseXyz(text:string,source='Terreno XYZ'){
 const points=text.trim().split(/\r?\n/).map(line=>line.trim().split(/[;,\s]+/).map(Number)).filter(row=>row.length>=3&&row.slice(0,3).every(Number.isFinite));if(points.length<4||points.length>100000)throw Error('XYZ/CSV necesita entre 4 y 100000 puntos X, Z, altura en metros.');
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);if(maxX-minX<.01||maxY-minY<.01)throw Error('Los puntos deben cubrir una superficie.');
 const columns=Math.min(65,Math.max(2,Math.ceil(Math.sqrt(points.length)))),rows=columns,values=new Array<number>(columns*rows).fill(NaN),buckets=new Map<string,number[]>();
 for(const p of points){const x=Math.round((p[0]-minX)/(maxX-minX)*(columns-1)),y=Math.round((maxY-p[1])/(maxY-minY)*(rows-1)),index=y*columns+x,list=buckets.get(String(index))??[];list.push(p[2]);buckets.set(String(index),list);}
 for(const [key,list]of buckets)values[Number(key)]=list.reduce((n,v)=>n+v,0)/list.length;
 const samples=[...buckets.keys()].map(Number);for(let i=0;i<values.length;i++)if(!Number.isFinite(values[i])){let nearest=samples[0],distance=Infinity;for(const index of samples){const d=(index%columns-i%columns)**2+(Math.floor(index/columns)-Math.floor(i/columns))**2;if(d<distance){nearest=index;distance=d;}}values[i]=values[nearest];}
 return{heightfield:field(values,columns,rows,maxX-minX,maxY-minY,source),origin:{x:(minX+maxX)/2,y:(minY+maxY)/2}};
}
export function parseHgt(buffer:ArrayBuffer,name:string,site?:Pick<Site,'latitude'|'longitude'|'width'|'depth'>){
 const count=Math.sqrt(buffer.byteLength/2),match=/([NS])(\d{2})([EW])(\d{3})/i.exec(name);if(![1201,3601].includes(count)||!match)throw Error('HGT debe ser SRTM 1201/3601 y llevar un nombre como N04W075.hgt.');
 const south=Number(match[2])*(match[1].toUpperCase()==='N'?1:-1),west=Number(match[4])*(match[3].toUpperCase()==='E'?1:-1),inside=site&&site.latitude>south&&site.latitude<south+1&&site.longitude>west&&site.longitude<west+1,latitude=inside?site.latitude:south+.5,longitude=inside?site.longitude:west+.5,width=site?.width??1000,depth=site?.depth??1000,view=new DataView(buffer),values:number[]=[];
 const columns=129,rows=129,metresLat=Math.PI/180*EARTH,metresLon=metresLat*Math.cos(latitude*Math.PI/180);
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const lon=longitude+(x/(columns-1)-.5)*width/metresLon,lat=latitude-(y/(rows-1)-.5)*depth/metresLat,col=Math.max(0,Math.min(count-1,Math.round((lon-west)*(count-1)))),row=Math.max(0,Math.min(count-1,Math.round((south+1-lat)*(count-1)))),h=view.getInt16((row*count+col)*2,false);values.push(h===-32768?NaN:h);}
 return{heightfield:field(values,columns,rows,width,depth,name),latitude,longitude};
}
export function parseLotGeoJson(text:string,site:Site):Point[]{const data=JSON.parse(text),geometry=data.type==='FeatureCollection'?data.features?.[0]?.geometry:data.type==='Feature'?data.geometry:data;const coordinates=geometry?.type==='Polygon'?geometry.coordinates?.[0]:geometry?.type==='MultiPolygon'?geometry.coordinates?.[0]?.[0]:null;if(!Array.isArray(coordinates)||coordinates.length<4||coordinates.length>512)throw Error('GeoJSON debe contener un polígono de lote con hasta 512 vértices.');return coordinates.slice(0,-1).map((p:number[])=>{if(!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>85)throw Error('El lote debe usar longitud/latitud WGS84.');return toLocal(p[0],p[1],site);});}
export function polygonArea(points:Point[]){return Math.abs(points.reduce((n,p,i)=>{const q=points[(i+1)%points.length];return n+p.x*q.y-q.x*p.y;},0)/2);}
