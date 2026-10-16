import test from 'node:test';
import assert from 'node:assert/strict';
import { freeze, produce } from 'immer';
import * as T from 'three';
import 'fake-indexeddb/auto';
import { benchmarkBuilding, repeatLevel } from '../src/architecture/buildings';
import { furnitureCatalog } from '../src/architecture/catalog';
import { modelFactory } from '../src/architecture/procedural-models';
import { furnitureInstances } from '../src/architecture/scene-instances';
import { emptyProject, demoProject, makeFurniture, parseProject, resolvedWalls, wallOpenings } from '../src/architecture/model';
import { transformProject, canWalkAt } from '../src/architecture/interactions';
import { editHistory } from '../src/architecture/history';
import { decodeFloats, encodeFloats, defaultSite } from '../src/architecture/project-extras';
import { parseAsc, parseHgt, parseXyz, terrainHeight, toGeographic, toLocal, polygonArea } from '../src/architecture/terrain';
import { parseDxf } from '../src/architecture/import-dxf';
import { planDxf, footprint } from '../src/architecture/plan-dxf';
import { extrudedGeometry, meshAsset } from '../src/architecture/model-import';
import { loadInitialProject, storeProject, listStoredProjects, getStoredProject } from '../src/architecture/project-store';
import { saveProject, STORAGE_KEY } from '../src/architecture/storage';
import { checkGltf, imageSize } from '../src/architecture/import-guards';
test('los GLTF de entrada no pueden referenciar blobs ajenos aunque exista un archivo con el mismo nombre',async()=>{const local=new File([new Uint8Array(24)],'texture.png');await assert.rejects(checkGltf(JSON.stringify({asset:{version:'2.0'},images:[{uri:'blob:prisma-architecture://app/texture.png'}]}),[local]),/blob/);});

test('el LOD reduce el detalle de una escena densa según su presupuesto',()=>{
 const p=emptyProject(),items=Array.from({length:1000},()=>makeFurniture('sofa',p.levels[0].id,{x:4,y:4})),group=new T.Group(),objects=new Map<string,T.Object3D>(),batch=furnitureInstances(group,objects),camera=new T.PerspectiveCamera();camera.position.set(0,1.65,0);batch.sync(items,[]);batch.visibility(camera,'eco');const eco=batch.stats().visibleTriangles;assert.ok(eco<=250000);batch.visibility(camera,'balanced');const balanced=batch.stats().visibleTriangles;assert.ok(balanced<=900000);assert.ok(balanced>eco);assert.equal(batch.stats().instances,1000);batch.dispose();
});
test('glTF rechaza tamaños excesivos antes de decodificar imágenes',async()=>{
 const bytes=new Uint8Array(24),view=new DataView(bytes.buffer);bytes.set([137,80,78,71]);view.setUint32(16,8192);view.setUint32(20,8192);assert.deepEqual(imageSize(bytes),{width:8192,height:8192});const base64=btoa(String.fromCharCode(...bytes));await assert.rejects(checkGltf(JSON.stringify({asset:{version:'2.0'},images:[{uri:`data:image/png;base64,${base64}`}]}),[]),/2048/);await assert.rejects(checkGltf(JSON.stringify({asset:{version:'2.0'},nodes:new Array(10001).fill({})}),[]),/10000/);assert.throws(()=>imageSize(new Uint8Array(32)),/incompatible/);
});

test('el catálogo completo genera modelos finitos con geometrías compartidas',()=>{
 assert.ok(furnitureCatalog.length>=85);const factory=modelFactory(),geometryIds=new Set<number>();
 for(const item of furnitureCatalog){const f=makeFurniture(item.kind,'floor',{x:0,y:0}),model=factory.create(f),b=new T.Box3().setFromObject(model),size=b.getSize(new T.Vector3());assert.ok(!b.isEmpty(),item.kind);assert.ok([size.x,size.y,size.z].every(n=>Number.isFinite(n)&&n>0),item.kind);model.traverse(o=>{if(o instanceof T.Mesh)geometryIds.add(o.geometry.id);});}
 assert.ok(geometryIds.size<=6);factory.dispose();
});
test('cada modelo 3D usa exactamente el ancho, fondo y altura del catálogo',()=>{
 const p=emptyProject(),items=furnitureCatalog.map((f,i)=>makeFurniture(f.kind,p.levels[0].id,{x:i*20,y:0})),group=new T.Group(),objects=new Map<string,T.Object3D>(),batch=furnitureInstances(group,objects);batch.sync(items,[]);for(const mesh of group.children[0].children)if(mesh instanceof T.InstancedMesh&&mesh.geometry.getAttribute('color')){mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox!;assert.ok(Math.abs(b.min.x+.5)<1e-6);assert.ok(Math.abs(b.max.x-.5)<1e-6);assert.ok(Math.abs(b.min.z+.5)<1e-6);assert.ok(Math.abs(b.max.z-.5)<1e-6);assert.ok(Math.abs(b.min.y)<1e-6);assert.ok(Math.abs(b.max.y-1)<1e-6);}batch.dispose();
});
test('100 plantas guardan 40 000 objetos con identidades y alturas válidas',()=>{
 const project=benchmarkBuilding();assert.equal(project.levels.length,100);assert.equal(project.furniture.length,40000);assert.equal(new Set(project.furniture.map(f=>f.id)).size,40000);assert.equal(project.levels[99].elevation,316.8);assert.equal(parseProject(project).furniture.length,40000);assert.ok(Buffer.byteLength(JSON.stringify(project))<24*1024*1024);
});
test('repetir una planta remapea las puertas y ventanas de sus muros',()=>{
 const initial=demoProject(),next=repeatLevel(initial,initial.levels[0].id,2,3.2);assert.equal(next.openings.length,initial.openings.length*3);assert.doesNotThrow(()=>parseProject(next));const walls=resolvedWalls(next,next.levels[2].id);assert.ok(walls.flatMap(w=>wallOpenings(next,w)).length>0);assert.throws(()=>repeatLevel(initial,'missing',1,3),/no existe/);assert.throws(()=>repeatLevel(initial,initial.levels[0].id,200,3),/199/);
});
test('las ediciones y el historial comparten todos los elementos que no cambian',()=>{
 const p=benchmarkBuilding(4,100),f=p.furniture[0],next=transformProject(p,{kind:'furniture',id:f.id},{x:f.x+1,y:f.y,elevation:0,rotation:0,scaleX:1,scaleY:1,scaleZ:1});assert.equal(next.rooms,p.rooms);assert.equal(next.furniture[1],p.furniture[1]);assert.notEqual(next.furniture[0],p.furniture[0]);let history={past:[] as typeof p[],present:p,future:[] as typeof p[]};for(let i=0;i<100;i++)history=editHistory(history,produce(history.present,d=>{d.furniture[0].x+=.01;}));assert.equal(history.past.length,80);assert.equal(history.past[0].rooms,p.rooms);assert.equal(history.past[0].furniture[1],p.furniture[1]);
});
test('las instancias reutilizan buffers y actualizan el objeto movido',()=>{
 const p=benchmarkBuilding(1,400),group=new T.Group(),objects=new Map<string,T.Object3D>(),batch=furnitureInstances(group,objects);batch.sync(p.furniture,p.assets);const stats=batch.stats();assert.equal(stats.instances,400);assert.ok(stats.geometryBytes<64*1024*1024);const proxy=objects.get(`furniture:${p.furniture[0].id}`)!;const instanceMeshes=group.children[0].children.filter(o=>o instanceof T.InstancedMesh),ids=instanceMeshes.map(o=>o.id);const next=p.furniture.map((f,i)=>i?f:{...f,x:f.x+.1});batch.sync(next,p.assets);assert.equal(objects.get(`furniture:${next[0].id}`),proxy);assert.equal(proxy.position.x,next[0].x);assert.deepEqual(group.children[0].children.filter(o=>o instanceof T.InstancedMesh).map(o=>o.id),ids);assert.equal(batch.stats().geometryBytes,stats.geometryBytes);batch.dispose();
});
test('el índice de colisiones conserva puertas transitables y muebles girados',()=>{
 const p=demoProject(),frozen=freeze(structuredClone(p),true),level=p.levels[0].id;for(let x=-1;x<11;x+=.37)for(let y=-1;y<10;y+=.43)assert.equal(canWalkAt(frozen,level,{x,y}),canWalkAt(p,level,{x,y}),`punto ${x},${y}`);
});
test('el índice maneja muros gigantes sin crear millones de celdas',()=>{
 const p=emptyProject(),level=p.levels[0].id;p.walls.push({id:'large',name:'Large',levelId:level,a:{x:-1e6,y:-1e6},b:{x:1e6,y:1e6},height:3,thickness:2,color:'#ffffff'});const frozen=freeze(p,true);assert.equal(canWalkAt(frozen,level,{x:0,y:0}),false);assert.equal(canWalkAt(frozen,level,{x:0,y:5}),true);
});
test('DXF métrico exportado vuelve a importar sus segmentos y huellas',()=>{
 const p=demoProject(),drawing=parseDxf(planDxf(p,p.levels[0].id));assert.equal(drawing.unit,1);assert.equal(drawing.lines.length,resolvedWalls(p).length+p.furniture.length*4);assert.throws(()=>parseDxf('AutoCAD Binary DXF'),/binario/);
});
test('ASC conserva alturas del norte al sur, cota y distancia entre muestras',()=>{
 const data=parseAsc('ncols 2\nnrows 2\nxllcorner 0\nyllcorner 0\ncellsize 10\nNODATA_value -9999\n110 120\n100 130');assert.equal(data.heightfield.datum,100);assert.deepEqual(data.heightfield.values,[10,20,0,30]);const site={...defaultSite(),enabled:true,width:data.heightfield.width,depth:data.heightfield.depth,baseElevation:0,heightfield:data.heightfield};assert.equal(terrainHeight(site,{x:-site.width/2,y:-site.depth/2}),10);assert.equal(terrainHeight(site,{x:0,y:0}),15);assert.equal(terrainHeight(site,{x:site.width/2,y:site.depth/2}),30);
});
test('XYZ y CSV topográfico usan altura y orientación norte correctas',()=>{
 const data=parseXyz('X;Norte;Altura\n0;0;10\n10;0;20\n0;10;30\n10;10;40');assert.equal(data.heightfield.datum,10);assert.deepEqual(data.heightfield.values,[20,30,0,10]);assert.equal(data.heightfield.width,10);assert.throws(()=>parseXyz('0 0 1\n0 0 2\n0 0 3\n0 0 4'),/superficie/);
});
test('HGT recorta un lote y conserva la georreferencia sin almacenar la región entera',()=>{
 const buffer=new ArrayBuffer(1201*1201*2),view=new DataView(buffer);for(let i=0;i<1201*1201;i++)view.setInt16(i*2,120,false);const site={...defaultSite(),latitude:4.5,longitude:-74.5,width:100,depth:80},result=parseHgt(buffer,'N04W075.hgt',site);assert.equal(result.heightfield.width,100);assert.equal(result.heightfield.depth,80);assert.equal(result.heightfield.values.length,129*129);assert.equal(result.heightfield.datum,120);assert.equal(result.latitude,4.5);
});
test('coordenadas del lote mantienen metros, área y recorrido inverso',()=>{
 const site=defaultSite(),p={x:32.4,y:-45.8},g=toGeographic(p,site),local=toLocal(g.longitude,g.latitude,site);assert.ok(Math.abs(local.x-p.x)<1e-8);assert.ok(Math.abs(local.y-p.y)<1e-8);assert.equal(polygonArea([{x:0,y:0},{x:20,y:0},{x:20,y:10},{x:0,y:10}]),200);
});
test('extruir un plano conserva el eje vertical, la orientación y los huecos',()=>{
 const shape=new T.Shape([new T.Vector2(0,0),new T.Vector2(4,0),new T.Vector2(4,3),new T.Vector2(0,3)]);shape.holes.push(new T.Path([new T.Vector2(1,1),new T.Vector2(1,2),new T.Vector2(3,2),new T.Vector2(3,1)]));const geometry=extrudedGeometry([shape],2);geometry.computeBoundingBox();const b=geometry.boundingBox!;assert.ok(Math.abs(b.min.y)<1e-5);assert.ok(Math.abs(b.max.y-2)<1e-5);assert.ok(Math.abs(b.min.z)<1e-5);assert.equal(b.max.z,3);const a=geometry.getAttribute('position');let volume=0;for(let i=0;i<a.count;i+=3){const v=(n:number)=>new T.Vector3(a.getX(n),a.getY(n),a.getZ(n));volume+=v(i).dot(v(i+1).cross(v(i+2)))/6;}assert.ok(Math.abs(Math.abs(volume)-20)<1e-5);geometry.dispose();
});
test('un modelo normalizado vuelve a guardar y exporta su huella girada',()=>{
 const geometry=new T.BoxGeometry(4,2,3),asset=meshAsset(geometry,'Caja'),p=emptyProject(),f={...makeFurniture('sofa',p.levels[0].id,{x:5,y:6}),kind:'custom' as const,assetId:asset.id,width:4,height:2,depth:3,rotation:90};p.assets.push(asset);p.furniture.push(f);const roundtrip=parseProject(JSON.parse(JSON.stringify(p)));assert.equal(roundtrip.assets[0].triangles,12);const data=decodeFloats(asset.positions);assert.ok([...data].every(Number.isFinite));assert.equal(footprint(p,f).length,4);assert.ok(planDxf(p,p.levels[0].id).includes('MODELOS_3D_HUELLA'));geometry.dispose();
});
test('no acepta geometrías, colores ni texturas corruptas dentro del proyecto',()=>{
 const geometry=new T.BoxGeometry(1,1,1),asset=meshAsset(geometry,'Caja'),p=emptyProject();p.assets.push(asset);assert.doesNotThrow(()=>parseProject(p));p.assets=[{...asset,positions:encodeFloats(new Float32Array(asset.vertices*3).fill(NaN))}];assert.throws(()=>parseProject(p),/Vértices/);p.assets=[{...asset,colors:encodeFloats(new Float32Array(asset.vertices*3).fill(Infinity))}];assert.throws(()=>parseProject(p),/Colores/);p.assets=[{...asset,texture:'https://example.com/texture.jpg'}];assert.throws(()=>parseProject(p),/imagen/);geometry.dispose();
});
test('IndexedDB migra proyectos anteriores y lista solo resúmenes de proyectos grandes',async()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}},old=demoProject();saveProject(storage,'legacy',old);Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});const initial=await loadInitialProject();assert.equal(initial.id,'legacy');assert.equal(initial.project.rooms.length,4);assert.ok(values.has(STORAGE_KEY));const large=benchmarkBuilding(100,400);await storeProject('large',large);const records=await listStoredProjects(),summary=records.find(r=>r.id==='large')!;assert.equal(summary.objectCount,40000);assert.equal(summary.floors,100);assert.ok(!('project'in summary));const loaded=await getStoredProject('large');assert.equal(loaded.furniture.length,40000);assert.ok(Object.isFrozen(loaded.furniture));assert.equal((await getStoredProject('legacy')).rooms.length,4);
});
