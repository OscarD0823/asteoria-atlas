import { Trash2 } from 'lucide-react';
import Numeric from './NumberField';
import type { Project } from './model';
export default function ReferencePanel({project,levelId,onChange}:{project:Project;levelId:string;onChange:(f:(p:Project)=>void)=>boolean}) {
 const references=project.underlays.filter(r=>r.levelId===levelId);if(!references.length)return null;
 return <div className="pa-references"><h3>Planos de referencia</h3>{references.map(ref=><article key={ref.id}><b>{ref.name}</b><Numeric label={`X de ${ref.name}`} value={ref.x} onChange={v=>onChange(p=>{p.underlays.find(r=>r.id===ref.id)!.x=v;})}/><Numeric label={`Z de ${ref.name}`} value={ref.y} onChange={v=>onChange(p=>{p.underlays.find(r=>r.id===ref.id)!.y=v;})}/><Numeric label={`Ancho de ${ref.name}`} value={ref.width} onChange={v=>onChange(p=>{const r=p.underlays.find(r=>r.id===ref.id)!;r.depth*=v/r.width;r.width=v;})}/><label>Opacidad<input type="range" min="0" max="1" step=".05" value={ref.opacity} onChange={e=>onChange(p=>{p.underlays.find(r=>r.id===ref.id)!.opacity=Number(e.target.value);})}/></label><button aria-label={`Quitar referencia ${ref.name}`} onClick={()=>onChange(p=>{p.underlays=p.underlays.filter(r=>r.id!==ref.id);})}><Trash2 size={13}/> Quitar referencia</button></article>)}</div>;
}
