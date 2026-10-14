import { bounds, distance, resolvedWalls, wallOpenings, type Project } from './model';
const xml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export const meters = (value: number) => value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
export function planSvg(project: Project, levelId: string) {
  const box = bounds(project, levelId), level = project.levels.find(l => l.id === levelId)!;
  const rooms = project.rooms.filter(r => r.levelId === levelId).map(r => `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.depth}" fill="${r.color}"/><text x="${r.x + r.width / 2}" y="${r.y + r.depth / 2}" text-anchor="middle" font-size=".2">${xml(r.name)} · ${meters(r.width * r.depth)} m²</text>`).join('');
  const furniture = project.furniture.filter(f => f.levelId === levelId).map(f => `<g transform="translate(${f.x},${f.y}) rotate(${f.rotation})"><rect x="${-f.width / 2}" y="${-f.depth / 2}" width="${f.width}" height="${f.depth}" rx=".05" fill="${f.color}" stroke="#666" stroke-width=".025"/><title>${xml(f.name)}</title></g>`).join('');
  const walls = resolvedWalls(project, levelId).map(w => {
    const angle = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180 / Math.PI;
    return `<g transform="translate(${w.a.x},${w.a.y}) rotate(${angle})"><path d="M0 0H${distance(w.a, w.b)}" stroke="#454856" stroke-width="${w.thickness}"/>${wallOpenings(project, w).map(o => `<rect x="${o.offset - o.width / 2}" y="${-w.thickness / 2 - .01}" width="${o.width}" height="${w.thickness + .02}" fill="white"/>${o.kind === 'window' ? `<path d="M${o.offset - o.width / 2} 0h${o.width}" stroke="#638e9f" stroke-width=".06"/>` : `<path d="M${o.offset - o.width / 2} 0v${-o.width}A${o.width} ${o.width} 0 0 1 ${o.offset + o.width / 2} 0" fill="none" stroke="#82765e" stroke-width=".025"/>`}`).join('')}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${Math.round(1200 * box.height / box.width)}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}"><title>${xml(project.name)} · ${xml(level.name)}</title><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="white"/><g font-family="Arial,sans-serif" fill="#394154">${rooms}${furniture}${walls}<text x="${box.x + .25}" y="${box.y + .4}" font-size=".24" font-weight="bold">${xml(project.name)} · ${xml(level.name)} · Prisma Arquitectura</text><path d="M${box.x + .3} ${box.y + box.height - .5}h2m-2 -.06v.12m1 -.12v.12m1 -.12v.12" stroke="#394154" stroke-width=".025"/><text x="${box.x + .3}" y="${box.y + box.height - .25}" font-size=".16">0                       1                       2 m</text></g></svg>`;
}
export function measurementsCsv(project: Project) {
  // Quote every field and neutralize names that spreadsheets might execute.
  const quote = (value: string | number) => '"' + String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  const rows = [['Planta', 'Espacio', 'Ancho (m)', 'Fondo (m)', 'Área (m²)', 'Perímetro (m)', 'Altura (m)'], ...project.rooms.map(r => [project.levels.find(l => l.id === r.levelId)!.name, r.name, r.width, r.depth, r.width * r.depth, 2 * (r.width + r.depth), r.height])];
  return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n');
}
export function download(data: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function filename(project: Project) { return project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'proyecto'; }
