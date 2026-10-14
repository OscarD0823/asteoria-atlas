import { useEffect, useRef, useState } from 'react';
import { bounds, distance, distance3, snapPoint, resolvedWalls, wallOpenings, type Furniture, type Point, type Project, type Selection } from './model';
import { meters } from './exports';
import { dimensionText, type DisplayUnit } from './units';
export type Tool = 'select' | 'room' | 'wall' | 'door' | 'window' | 'furniture' | 'pan' | 'light' | 'measure';
export function FurnitureSymbol({ item: f }: { item: Pick<Furniture, 'kind' | 'width' | 'depth' | 'color'> }) {
  const { width: w, depth: d, kind } = f;
  return <g stroke="#3b48485c" strokeWidth={.025}>
    {kind === 'plant' ? <><circle r={w / 2} fill={f.color}/><path d={`M${-w / 3} 0h${w * 2 / 3}M0 ${-w / 3}v${w * 2 / 3}`} fill="none" stroke="#ffffff88"/></> : <>
      <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={.06} fill={f.color}/>
      {['sofa', 'armchair'].includes(kind) && <><rect x={-w / 2 + .1} y={-d / 2 + .18} width={w - .2} height={d - .27} rx={.05} fill="#ffffff35"/><path d={`M${-w / 2 + .12} ${-d / 2 + .18}h${w - .24}`} fill="none"/>{kind === 'sofa' && <path d={`M0 ${-d / 2 + .2}v${d - .3}`} fill="none"/>}</>}
      {kind === 'bed' && <><rect x={-w / 2 + .08} y={-d / 2 + .1} width={w - .16} height={d * .23} rx={.04} fill="#fff8"/><path d={`M${-w / 2 + .02} ${-d / 2 + d * .4}h${w - .04}`} strokeWidth={.04}/></>}
      {kind === 'cabinet' && <path d={`M0 ${-d / 2}v${d}`} fill="none"/>}
      {kind === 'counter' && <><rect x={w * .12} y={-d * .3} width={w * .22} height={d * .6} rx={.05} fill="#ffffffaa"/><circle cx={-w * .22} cy={0} r={d * .22} fill="#47525a"/></>}
    </>}
  </g>;
}
type Props = { project: Project; levelId: string; selection: Selection; tool: Tool; snap: boolean; snapStep: number; unit: DisplayUnit; showDimensions: boolean; pending: Point | null; resetKey: number; onSelect: (s: Selection) => void; onPoint: (p: Point) => void; onMoveFurniture: (id: string, p: Point) => void; onCursor: (p: Point) => void };
export default function Plan(props: Props) {
  const { project, levelId, selection, tool, snap, snapStep, unit, showDimensions, pending, onSelect, onPoint, onMoveFurniture, onCursor } = props;
  const svg = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState(() => bounds(project, levelId)), [cursor, setCursor] = useState<Point | null>(null), [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const drag = useRef<{ id?: string; start: Point; item?: Point; frame: typeof frame; client: Point; moved: boolean } | null>(null);
  const [viewport, setViewport] = useState({ width: 600, height: 600 });
  useEffect(() => { const observer = new ResizeObserver(entries => { const r = entries[0].contentRect; setViewport({ width: r.width, height: r.height }); }); observer.observe(svg.current!); return () => observer.disconnect(); }, []);
  const pxPerMeter = Math.min(viewport.width / frame.width, viewport.height / frame.height);
  const rulerLength = [.001, .002, .005, .01, .02, .05, .1, .2, .5, 1, 2, 5, 10, 20, 50].filter(v => v * pxPerMeter <= 90).at(-1) ?? .001;
  useEffect(() => { setFrame(bounds(project, levelId)); setPreview(null); }, [levelId, props.resetKey]);
  useEffect(() => {
    const element = svg.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const matrix = element.getScreenCTM(); if (!matrix) return;
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const ratio = event.deltaY > 0 ? 1.12 : 1 / 1.12;
      setFrame(old => {
        if (old.width * ratio < 2 || old.width * ratio > 400) return old;
        return { x: p.x - (p.x - old.x) * ratio, y: p.y - (p.y - old.y) * ratio, width: old.width * ratio, height: old.height * ratio };
      });
    };
    element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel);
  }, []);
  function point(event: { clientX: number; clientY: number }, snapping = true): Point {
    const matrix = svg.current?.getScreenCTM(); if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return snapPoint({ x: p.x, y: p.y }, snapping && snap, snapStep);
  }
  function choose(event: React.PointerEvent, kind: NonNullable<Selection>['kind'], id: string, item?: Furniture) {
    if (tool !== 'select' || event.button !== 0) return;
    event.stopPropagation(); onSelect({ kind, id });
    if (item) {
      svg.current!.setPointerCapture(event.pointerId);
      drag.current = { id, item, start: point(event, false), frame, client: { x: event.clientX, y: event.clientY }, moved: false };
    }
  }
  const selected = (kind: string, id: string) => selection?.kind === kind && selection.id === id;
  const walls = resolvedWalls(project, levelId);
  return <><svg ref={svg} className={`pa-plan pa-tool-${tool}`} aria-label="Plano editable en metros" viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`} onContextMenu={e => e.preventDefault()}
    onPointerDown={e => {
      if (tool === 'pan' || e.button === 1) {
        e.preventDefault(); svg.current!.setPointerCapture(e.pointerId);
        drag.current = { start: point(e, false), frame, client: { x: e.clientX, y: e.clientY }, moved: false }; return;
      }
      if (e.button !== 0) return;
      if (tool === 'select') onSelect(null); else onPoint(point(e));
    }}
    onPointerMove={e => {
      const p = point(e), raw = point(e, false); setCursor(p); onCursor(p);
      const d = drag.current; if (!d) return;
      if (Math.hypot(e.clientX - d.client.x, e.clientY - d.client.y) > 3) d.moved = true;
      if (d.id && d.item) setPreview({ id: d.id, ...snapPoint({ x: d.item.x + raw.x - d.start.x, y: d.item.y + raw.y - d.start.y }, snap, snapStep) });
      else {
        const scale = svg.current!.getScreenCTM()!.a;
        setFrame({ ...d.frame, x: d.frame.x - (e.clientX - d.client.x) / scale, y: d.frame.y - (e.clientY - d.client.y) / scale });
      }
    }}
    onPointerUp={e => {
      const d = drag.current; if (d?.id && d.item && d.moved) {
        const raw = point(e, false); onMoveFurniture(d.id, snapPoint({ x: d.item.x + raw.x - d.start.x, y: d.item.y + raw.y - d.start.y }, snap, snapStep));
      }
      drag.current = null; setPreview(null);
    }} onPointerCancel={() => { drag.current = null; setPreview(null); }}>
    <defs><pattern id="pa-dots" width={1} height={1} patternUnits="userSpaceOnUse"><circle cx={0} cy={0} r={.016} fill="#afb5bf"/><path d="M.5 0v1M0 .5h1" stroke="#e9ebee" strokeWidth={.012}/></pattern></defs>
    <rect x={frame.x - 500} y={frame.y - 500} width={frame.width + 1000} height={frame.height + 1000} fill="#f9fafb"/>
    <rect x={frame.x - 500} y={frame.y - 500} width={frame.width + 1000} height={frame.height + 1000} fill="url(#pa-dots)"/>
    {project.rooms.filter(r => r.levelId === levelId).map(r => <g key={r.id} onPointerDown={e => choose(e, 'room', r.id)}>
      <rect x={r.x} y={r.y} width={r.width} height={r.depth} fill={r.color} stroke={selected('room', r.id) ? '#7562ce' : 'transparent'} strokeWidth={.06}/>
      <text x={r.x + r.width - .35} y={r.y + r.depth - .6} textAnchor="end" fontSize={.26} fontWeight={600} fill="#47505d">{r.name}</text>
      <text x={r.x + r.width - .35} y={r.y + r.depth - .3} textAnchor="end" fontSize={.2} fill="#7c8390">{meters(r.width * r.depth)} m²</text>
      {showDimensions && <g fill="#87909f" fontSize={.18} textAnchor="middle"><text x={r.x + r.width / 2} y={r.y + .22}>{dimensionText(r.width, unit)}</text><text transform={`translate(${r.x + .3} ${r.y + r.depth / 2}) rotate(-90)`}>{dimensionText(r.depth, unit)}</text></g>}
    </g>)}
    {walls.map(w => <g key={w.id} onPointerDown={e => choose(e, 'wall', w.id)}>
      <path d={`M${w.a.x} ${w.a.y}L${w.b.x} ${w.b.y}`} stroke={selected('wall', w.id) ? '#7562ce' : '#525864'} strokeWidth={w.thickness} strokeLinecap="square"/>
      <path d={`M${w.a.x} ${w.a.y}L${w.b.x} ${w.b.y}`} stroke="transparent" strokeWidth={Math.max(.25, w.thickness)}/>
      <g transform={`translate(${w.a.x} ${w.a.y}) rotate(${Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180 / Math.PI})`}>
        {wallOpenings(project, w).map(o => <g key={o.id} onPointerDown={e => choose(e, 'opening', o.id)} stroke={selected('opening', o.id) ? '#7562ce' : o.kind === 'door' ? '#ac9272' : '#638e9f'}>
          <rect x={o.offset - o.width / 2} y={-w.thickness / 2 - .015} width={o.width} height={w.thickness + .03} fill="#f9fafb" stroke="none"/>
          {o.kind === 'window' ? <><path d={`M${o.offset - o.width / 2} -.035h${o.width}M${o.offset - o.width / 2} .035h${o.width}`} strokeWidth={.025}/><rect x={o.offset - o.width / 2} y={-.16} width={o.width} height={.32} fill="transparent" stroke="none"/></> : <><path d={`M${o.offset - o.width / 2} 0v${-o.width}A${o.width} ${o.width} 0 0 1 ${o.offset + o.width / 2} 0`} fill="none" strokeWidth={.025}/><path d={`M${o.offset - o.width / 2} 0h${o.width}`} strokeWidth={.09} opacity={.4}/></>}
        </g>)}
      </g>
    </g>)}
    {project.furniture.filter(f => f.levelId === levelId).map(original => {
      const f = preview?.id === original.id ? { ...original, ...preview } : original;
      return <g key={f.id} transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`} onPointerDown={e => choose(e, 'furniture', f.id, original)} className="pa-furniture-plan">
        <title>{f.name}</title><FurnitureSymbol item={f}/>
        {selected('furniture', f.id) && <rect x={-f.width / 2 - .08} y={-f.depth / 2 - .08} width={f.width + .16} height={f.depth + .16} fill="none" stroke="#7562ce" strokeWidth={.035} strokeDasharray=".08 .04"/>}
      </g>;
    })}
    {project.lights.filter(l => l.levelId === levelId).map(l => <g key={l.id} transform={`translate(${l.x} ${l.y})`} onPointerDown={e => choose(e, 'light', l.id)}><circle r={.15} fill={l.enabled ? '#ffedb8' : '#e0e1e7'} stroke={selected('light', l.id) ? '#7562ce' : '#c9a057'} strokeWidth={.03}/><path d="M-.07 0H.07M0 -.07V.07" stroke="#b69253" strokeWidth={.025}/></g>)}
    {showDimensions && project.measurements.filter(m => m.levelId === levelId).map(m => <g key={m.id} onPointerDown={e => choose(e, 'measurement', m.id)} stroke={selected('measurement', m.id) ? '#6249bb' : '#a080c5'}><path d={`M${m.a.x} ${m.a.y}L${m.b.x} ${m.b.y}`} strokeWidth={.035}/><circle cx={m.a.x} cy={m.a.y} r={.05} fill="#fff" strokeWidth={.025}/><circle cx={m.b.x} cy={m.b.y} r={.05} fill="#fff" strokeWidth={.025}/><text x={(m.a.x + m.b.x) / 2} y={(m.a.y + m.b.y) / 2 - .15} fontSize={.2} textAnchor="middle" stroke="none" fill="#725790">{dimensionText(distance3(m.a, m.b), unit)}</text></g>)}
    {pending && cursor && <g pointerEvents="none" stroke="#7562ce" strokeWidth={.04} strokeDasharray=".12 .08" fill="#7562ce19">
      {tool === 'room' ? <rect x={Math.min(pending.x, cursor.x)} y={Math.min(pending.y, cursor.y)} width={Math.abs(cursor.x - pending.x)} height={Math.abs(cursor.y - pending.y)}/> : <path d={`M${pending.x} ${pending.y}L${cursor.x} ${cursor.y}`}/>}
      <circle cx={pending.x} cy={pending.y} r={.07} fill="#7562ce"/>
      <text x={(pending.x + cursor.x) / 2} y={(pending.y + cursor.y) / 2 - .2} stroke="none" fill="#7562ce" fontSize={.17}>{tool === 'room' ? `${meters(Math.abs(cursor.x - pending.x))} × ${meters(Math.abs(cursor.y - pending.y))} m` : `${meters(distance(pending, cursor))} m`}</text>
    </g>}
  </svg><svg className="pa-scale-ruler" width="160" height="32" aria-label={`Escala de referencia ${dimensionText(rulerLength, unit)}`}><path d={`M5 11h${rulerLength * pxPerMeter}M5 6v10M${5 + rulerLength * pxPerMeter} 6v10`} fill="none" stroke="#84909f" strokeWidth="1"/><text x="5" y="28" fontSize="10" fill="#84909f">0</text><text x={5 + rulerLength * pxPerMeter} y="28" textAnchor="end" fontSize="10" fill="#84909f">{dimensionText(rulerLength, unit)}</text></svg></>;
}
