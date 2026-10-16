import FormatGuide from './FormatGuide';
import { useEffect, useState } from 'react';
import { Vector3 } from 'three';
import { Upload, X } from 'lucide-react';
import { produce } from 'immer';
import { bounds, uid, type Project } from './model';
import { drawingShapes, extrudedGeometry, importModelFiles, meshAsset, rasterShapes, type ImportedDrawing } from './model-import';
export default function ImportDialog({project,levelId,onApply,onClose,onError}:{project:Project;levelId:string;onApply:(p:Project)=>boolean;onClose:()=>void;onError:(e:unknown)=>void}) {
 const [data,setData]=useState<ImportedDrawing|null>(null),[busy,setBusy]=useState(false),[width,setWidth]=useState(10),[height,setHeight]=useState(2.8),[mode,setMode]=useState<'reference'|'walls'|'volume'>('volume'),[threshold,setThreshold]=useState(170),[error,setError]=useState('');
 useEffect(()=>()=>data?.geometry?.dispose(),[data]);
 async function load(files:File[]) { setBusy(true);setError('');try{const parsed=await importModelFiles(files);setData(parsed);setWidth(Math.round(parsed.width*1000)/1000||10);setHeight(Math.round(parsed.height*1000)/1000);setMode(parsed.image?'reference':parsed.geometry?'volume':'walls');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);} }
 async function apply() {
  if(!data)return;setBusy(true);setError('');try{
   if(!Number.isFinite(width)||width<.01||width>10000||!Number.isFinite(height)||height<.01||height>1000)throw Error('Ancho de 1 cm a 10 km y altura de 1 cm a 1000 m.');
   const frame=bounds(project,levelId),cx=frame.x+frame.width/2,cy=frame.y+frame.height/2,depth=width*data.depth/Math.max(.001,data.width);
   let next:Project;
   if(mode==='reference'&&data.image){next=produce(project,p=>{p.underlays.push({id:uid(),name:data.name,levelId,image:data.image!,x:cx-width/2,y:cy-depth/2,width,depth,opacity:.55});});}
   else if(mode==='walls') {
    const lines=data.drawing?[...data.drawing.lines,...data.drawing.loops.flatMap(loop=>loop.map((a,i)=>({a,b:loop[(i+1)%loop.length]})))]:data.shapes!.flatMap(s=>[s,...s.holes].flatMap(path=>{const points=path.getPoints(8);return points.slice(0,-1).map((a,i)=>({a,b:points[i+1]}));}));
    if(lines.length>5000)throw Error('Simplifica el plano a menos de 5000 tramos.');const all=lines.flatMap(l=>[l.a,l.b]),minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y)),scale=width/Math.max(.001,maxX-minX),point=(p:{x:number;y:number})=>({x:cx+(p.x-(minX+maxX)/2)*scale,y:cy+(p.y-(minY+maxY)/2)*scale});
    next=produce(project,p=>{for(const line of lines){const a=point(line.a),b=point(line.b);if(Math.hypot(b.x-a.x,b.y-a.y)<.01)continue;p.walls.push({id:uid(),name:data.name,levelId,a,b,height,thickness:.16,color:'#e6e2da'});}});
   } else {
    let geometry=data.geometry,temporary=false,actualHeight=height;
    if(!geometry){if(data.drawing&&!data.drawing.loops.length)throw Error('Para extruir un DXF necesitas polilíneas cerradas. Usa la opción Muros para segmentos abiertos.');const shapes=data.image?(await rasterShapes(data.image,threshold)).shapes:data.shapes??drawingShapes(data.drawing!);geometry=extrudedGeometry(shapes,height);temporary=true;}
    geometry.computeBoundingBox();const size=geometry.boundingBox!.getSize(new Vector3());actualHeight=data.geometry?height:height;
    const asset=meshAsset(geometry,data.name,data.texture);if(temporary)geometry.dispose();const realDepth=data.geometry?depth:width*size.z/Math.max(.001,size.x);
    asset.dimensions={width,depth:Math.max(.01,realDepth),height:actualHeight};next=produce(project,p=>{p.assets.push(asset);p.furniture.push({id:uid(),levelId,name:data.name,kind:'custom',assetId:asset.id,x:cx,y:cy,elevation:0,rotation:0,width,depth:Math.max(.01,realDepth),height:actualHeight,color:'#ffffff'});});
   }
   if(onApply(next))onClose();
  }catch(e){setError(e instanceof Error?e.message:String(e));onError(e);}finally{setBusy(false);}
 }
 return <div className="pa-modal-backdrop"><section className="pa-modal pa-import-dialog" role="dialog" aria-modal="true" aria-label="Importar plano o modelo"><div className="pa-modal-header"><h2>De archivo a espacio.</h2><button aria-label="Cerrar importación" onClick={onClose}><X size={18}/></button></div><p>SVG · DXF ASCII · PDF · PNG/JPG/WebP/BMP/GIF/AVIF · GLB/GLTF · OBJ · STL · PLY</p><label className="pa-import-drop"><Upload size={28}/><b>{busy?'Procesando…':'Seleccionar archivos'}</b><span>Hasta 32 MB por archivo. Para GLTF incluye sus .bin y texturas.</span><input type="file" multiple aria-label="Archivos para importar" disabled={busy} accept=".svg,.dxf,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.avif,.glb,.gltf,.obj,.stl,.ply,.bin" onChange={e=>{void load([...e.target.files??[]]);e.target.value='';}}/></label>
 <FormatGuide/>
 {data&&<><h3>{data.name}</h3>{data.image&&<img className="pa-import-preview" src={data.image} alt="Plano que se va a importar"/>}<div className="pa-import-fields"><label>Ancho real (m)<input aria-label="Ancho de importación" type="number" min=".01" step=".01" value={width} onChange={e=>{const value=Number(e.target.value);setWidth(value);if(data.geometry)setHeight(value*data.height/Math.max(.001,data.width));}}/></label><label>Altura (m)<input aria-label="Altura de importación" type="number" min=".01" step=".01" value={height} onChange={e=>setHeight(Number(e.target.value))}/></label><label>Convertir a<select aria-label="Conversión de importación" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>{data.image&&<option value="reference">Referencia para trazar</option>}{!data.image&&!data.geometry&&<option value="walls">Muros desde contornos</option>}<option value="volume">{data.geometry?'Objeto 3D editable':data.image?'Silueta extruida':'Volumen extruido'}</option></select></label>{data.image&&mode==='volume'&&<label>Umbral de zonas oscuras<input type="range" min="30" max="245" value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/></label>}</div>{data.warnings.map((w,i)=><p key={i} className="pa-note">{w}</p>)}<p className="pa-note">Los planos 2D necesitan una altura y una escala. Revisa el resultado: la conversión no interpreta automáticamente habitaciones, puertas ni estructura.</p><button className="pa-primary" disabled={busy} onClick={()=>void apply()}>{busy?'Convirtiendo…':'Añadir al proyecto'}</button></>}{error&&<p role="alert" className="paw-error">{error}</p>}</section></div>;
}
