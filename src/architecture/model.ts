export type Point = { x: number; y: number };
export type Point3 = Point & { elevation: number };
export type Finish = 'wood' | 'tile' | 'concrete';
export type Level = { id: string; name: string; elevation: number };
export type Room = { id: string; levelId: string; name: string; x: number; y: number; width: number; depth: number; height: number; thickness: number; color: string; finish: Finish };
export type Wall = { id: string; levelId: string; name: string; a: Point; b: Point; height: number; thickness: number; color: string };
export type ResolvedWall = Wall & { aliases: string[]; roomId?: string };
export const furnitureCatalog = [
  { kind: 'sofa', name: 'Sofá', width: 2.2, depth: .9, height: .85, color: '#76948c', category: 'Sala' },
  { kind: 'armchair', name: 'Sillón', width: .85, depth: .85, height: .85, color: '#cda88a', category: 'Sala' },
  { kind: 'table', name: 'Mesa de comedor', width: 1.6, depth: .9, height: .75, color: '#b39473', category: 'Cocina' },
  { kind: 'chair', name: 'Silla', width: .48, depth: .5, height: .85, color: '#c9b28e', category: 'Cocina' },
  { kind: 'bed', name: 'Cama doble', width: 1.6, depth: 2, height: .6, color: '#ad9aba', category: 'Dormitorio' },
  { kind: 'desk', name: 'Escritorio', width: 1.4, depth: .65, height: .75, color: '#bdac93', category: 'Estudio' },
  { kind: 'cabinet', name: 'Armario', width: 1.8, depth: .6, height: 2, color: '#d3bea2', category: 'Dormitorio' },
  { kind: 'counter', name: 'Mueble de cocina', width: 2.4, depth: .65, height: .9, color: '#8d9b9c', category: 'Cocina' },
  { kind: 'plant', name: 'Planta', width: .55, depth: .55, height: 1.15, color: '#78936b', category: 'Sala' },
  { kind: 'coffee', name: 'Mesa de centro', width: 1.1, depth: .6, height: .4, color: '#b39473', category: 'Sala' },
] as const;
export type FurnitureKind = typeof furnitureCatalog[number]['kind'];
export type Furniture = { id: string; levelId: string; kind: FurnitureKind; name: string; x: number; y: number; elevation: number; width: number; depth: number; height: number; rotation: number; color: string };
export type Opening = { id: string; wallId: string; kind: 'door' | 'window'; offset: number; width: number; height: number; sill: number };
export type LightKind = 'point' | 'spot' | 'area';
export type SceneLight = Point3 & { id: string; levelId: string; name: string; kind: LightKind; color: string; power: number; enabled: boolean; shadows: boolean; width: number; depth: number; angle: number; target: Point3 };
export type Measurement = { id: string; levelId: string; name: string; a: Point3; b: Point3 };
export type Environment = { preset: 'day' | 'golden' | 'night'; ambient: number; sunIntensity: number; sunAzimuth: number; sunAltitude: number; exposure: number; background: string; eyeHeight: number; walkSpeed: number };
export type Project = { format: 'prisma-arquitectura'; version: 2; name: string; units: 'm'; levels: Level[]; rooms: Room[]; walls: Wall[]; furniture: Furniture[]; openings: Opening[]; lights: SceneLight[]; measurements: Measurement[]; environment: Environment };
export type Selection = { kind: 'room' | 'wall' | 'furniture' | 'opening' | 'light' | 'measurement'; id: string } | null;
export function environmentPreset(preset: Environment['preset'] = 'day'): Environment {
  return { preset, ambient: preset === 'night' ? .12 : .8, sunIntensity: preset === 'night' ? .08 : 3, sunAzimuth: preset === 'golden' ? 235 : 145, sunAltitude: preset === 'golden' ? 18 : 55, exposure: 1.1, background: preset === 'night' ? '#131d30' : preset === 'golden' ? '#ede2d6' : '#e8edf2', eyeHeight: 1.65, walkSpeed: 1.8 };
}
export const uid = () => crypto.randomUUID();
export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
export const snapPoint = (p: Point, enabled: boolean, step = .25) => enabled ? { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step } : p;
export const distance3 = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y, a.elevation - b.elevation);
export function roomWalls(room: Room): ResolvedWall[] {
  const { x, y, width: w, depth: d } = room;
  const corners = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + d }, { x, y: y + d }];
  return corners.map((a, i) => ({ id: `${room.id}:wall:${i}`, aliases: [`${room.id}:wall:${i}`], roomId: room.id, levelId: room.levelId, name: `Muro · ${room.name}`, a, b: corners[(i + 1) % 4], height: room.height, thickness: room.thickness, color: '#e8e5e0' }));
}
export function resolvedWalls(project: Project, levelId?: string): ResolvedWall[] {
  const candidates = [...project.rooms.flatMap(roomWalls), ...project.walls.map(w => ({ ...w, aliases: [w.id] }))];
  const unique = new Map<string, ResolvedWall>();
  for (const wall of candidates) {
    if (levelId && wall.levelId !== levelId) continue;
    const points = [wall.a, wall.b].map(p => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).sort();
    const key = `${wall.levelId}:${points.join('|')}`;
    const shared = unique.get(key);
    if (shared) {
      shared.aliases.push(...wall.aliases);
      shared.height = Math.max(shared.height, wall.height);
      shared.thickness = Math.max(shared.thickness, wall.thickness);
    } else unique.set(key, { ...wall, aliases: [...wall.aliases] });
  }
  return [...unique.values()];
}
export function openingOnWall(project: Project, opening: Opening, wall: ResolvedWall) {
  const original = [...project.rooms.flatMap(roomWalls), ...project.walls].find(w => w.id === opening.wallId)!;
  const reversed = distance(original.a, wall.a) >= .00001;
  return { ...opening, offset: reversed ? distance(wall.a, wall.b) - opening.offset : opening.offset, reversed };
}
export function wallOpenings(project: Project, wall: ResolvedWall) {
  return project.openings.filter(o => wall.aliases.includes(o.wallId)).map(o => openingOnWall(project, o, wall));
}
export function projectPoint(point: Point, wall: Wall) {
  const length = distance(wall.a, wall.b);
  const t = Math.max(0, Math.min(1, ((point.x - wall.a.x) * (wall.b.x - wall.a.x) + (point.y - wall.a.y) * (wall.b.y - wall.a.y)) / (length * length)));
  const p = { x: wall.a.x + t * (wall.b.x - wall.a.x), y: wall.a.y + t * (wall.b.y - wall.a.y) };
  return { point: p, offset: t * length, distance: distance(point, p) };
}
export function bounds(project: Project, levelId: string) {
  const points: Point[] = project.rooms.filter(r => r.levelId === levelId).flatMap(r => [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y + r.depth }]);
  points.push(...project.walls.filter(w => w.levelId === levelId).flatMap(w => [w.a, w.b]));
  for (const f of project.furniture.filter(f => f.levelId === levelId)) {
    const radius = Math.hypot(f.width, f.depth) / 2;
    points.push({ x: f.x - radius, y: f.y - radius }, { x: f.x + radius, y: f.y + radius });
  }
  points.push(...project.lights.filter(l => l.levelId === levelId), ...project.measurements.filter(m => m.levelId === levelId).flatMap(m => [m.a, m.b]));
  if (!points.length) return { x: -2, y: -2, width: 14, height: 11 };
  const x = Math.min(...points.map(p => p.x)) - 1.4, y = Math.min(...points.map(p => p.y)) - 1.4;
  return { x, y, width: Math.max(4, Math.max(...points.map(p => p.x)) - x + 1.4), height: Math.max(4, Math.max(...points.map(p => p.y)) - y + 1.4) };
}
export function overlaps(a: Room, b: Room) {
  return a.levelId === b.levelId && Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > .00001 && Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y) > .00001;
}
export function emptyProject(): Project {
  return { format: 'prisma-arquitectura', version: 2, name: 'Mi proyecto', units: 'm', levels: [{ id: uid(), name: 'Planta baja', elevation: 0 }], rooms: [], walls: [], furniture: [], openings: [], lights: [], measurements: [], environment: environmentPreset() };
}
export function demoProject(): Project {
  const project = emptyProject(); project.name = 'Casa patio'; const levelId = project.levels[0].id;
  const addRoom = (name: string, x: number, y: number, color: string) => {
    const r: Room = { id: uid(), levelId, name, x, y, width: 5, depth: 4, height: 2.8, thickness: .16, color, finish: name.startsWith('Cocina') ? 'tile' : 'wood' }; project.rooms.push(r); return r;
  };
  const living = addRoom('Sala', 0, 0, '#e5eee8'); const kitchen = addRoom('Cocina · comedor', 5, 0, '#f1e8db');
  const bedroom = addRoom('Dormitorio', 0, 4, '#e9e3ee'); const study = addRoom('Estudio', 5, 4, '#e3eaf0');
  const add = (kind: FurnitureKind, x: number, y: number, rotation = 0) => {
    const item = furnitureCatalog.find(f => f.kind === kind)!;
    project.furniture.push({ ...item, id: uid(), levelId, x, y, elevation: 0, rotation });
  };
  add('sofa', 1.65, .85); add('armchair', 3.65, 1.7, 270); add('coffee', 1.9, 2.2); add('plant', .65, 3.35);
  add('table', 7.25, 2.35); add('chair', 7.25, 1.6); add('chair', 7.25, 3.1, 180); add('counter', 7.4, .6);
  add('bed', 1.55, 6.5, 180); add('cabinet', 3.8, 5.65, 90); add('desk', 7.4, 7.2); add('chair', 7.4, 6.45, 180); add('plant', 9.35, 4.65);
  const door = (r: Room, edge: number, offset: number) => project.openings.push({ id: uid(), wallId: `${r.id}:wall:${edge}`, kind: 'door', offset, width: .9, height: 2.1, sill: 0 });
  const window = (r: Room, edge: number, offset: number) => project.openings.push({ id: uid(), wallId: `${r.id}:wall:${edge}`, kind: 'window', offset, width: 1.6, height: 1.2, sill: .9 });
  door(living, 3, 1.8); door(living, 1, 2); door(living, 2, 1.3); door(study, 0, 2.4);
  window(living, 0, 2.5); window(kitchen, 0, 2.5); window(bedroom, 2, 2.5); window(study, 2, 2.5);
  for (const room of project.rooms) project.lights.push(makeLight('point', levelId, { x: room.x + 2.5, y: room.y + 2 }, 2.6));
  return project;
}
export function makeFurniture(kind: FurnitureKind, levelId: string, point: Point): Furniture {
  return { ...furnitureCatalog.find(f => f.kind === kind)!, ...point, elevation: 0, id: uid(), levelId, rotation: 0 };
}
export function makeLight(kind: LightKind, levelId: string, point: Point, elevation = 2.5): SceneLight {
  return { ...point, elevation, id: uid(), levelId, kind, name: kind === 'point' ? 'Lámpara puntual' : kind === 'spot' ? 'Foco dirigido' : 'Panel de luz', power: kind === 'area' ? 1200 : 650, color: '#ffe9cb', enabled: true, shadows: kind !== 'area', width: 1, depth: .6, angle: 40, target: { ...point, elevation: 0 } };
}
export function deleteSelection(project: Project, selection: Selection): Project {
  if (!selection) return project;
  const next = structuredClone(project);
  if (selection.kind === 'room') next.rooms = next.rooms.filter(r => r.id !== selection.id);
  if (selection.kind === 'furniture') next.furniture = next.furniture.filter(f => f.id !== selection.id);
  if (selection.kind === 'wall') {
    if (!next.walls.some(w => w.id === selection.id)) throw Error('Este muro pertenece a un espacio. Selecciona el espacio para modificarlo o eliminarlo.');
    next.walls = next.walls.filter(w => w.id !== selection.id);
  }
  if (selection.kind === 'opening') next.openings = next.openings.filter(o => o.id !== selection.id);
  if (selection.kind === 'light') next.lights = next.lights.filter(l => l.id !== selection.id);
  if (selection.kind === 'measurement') next.measurements = next.measurements.filter(m => m.id !== selection.id);
  const ids = new Set([...next.rooms.flatMap(roomWalls), ...next.walls].map(w => w.id));
  next.openings = next.openings.filter(o => ids.has(o.wallId));
  return next;
}

// The persisted contract is deliberately independent of either renderer.
export function parseProject(input: unknown): Project {
  const fail = (message: string): never => { throw Error(message); };
  const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail('Objeto de proyecto inválido.');
  const str = (value: unknown, label: string) => typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : fail(`${label}: texto inválido.`);
  const num = (value: unknown, label: string, positive = false) => typeof value === 'number' && Number.isFinite(value) && (!positive || value > 0) ? value : fail(`${label}: número inválido.`);
  const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fail('Color inválido.');
  const list = (v: unknown) => Array.isArray(v) && v.length <= 5000 ? v : fail('Lista inválida o con más de 5000 elementos.');
  const p = record(input);
  if (p.format !== 'prisma-arquitectura' || ![1, 2].includes(p.version as number) || p.units !== 'm') fail('Formato o versión incompatible. Abre un proyecto Prisma Arquitectura v1 o v2.');
  const legacy = p.version === 1;
  const nonnegative = (v: unknown, label: string) => { const n = num(v, label); if (n < 0) fail(`${label}: utiliza un número igual o mayor que cero.`); return n; };
  const bool = (v: unknown) => typeof v === 'boolean' ? v : fail('Estado de iluminación inválido.');
  const point = (v: unknown): Point => { const p = record(v); return { x: num(p.x, 'X'), y: num(p.y, 'Y') }; };
  const point3 = (v: unknown): Point3 => { const p = record(v); return { ...point(p), elevation: num(p.elevation, 'Elevación') }; };
  const levels = list(p.levels).map(v => { const o = record(v); return { id: str(o.id, 'ID'), name: str(o.name, 'Planta'), elevation: num(o.elevation, 'Elevación') }; });
  if (!levels.length) fail('El proyecto necesita al menos una planta.');
  const levelIds = new Set(levels.map(l => l.id));
  const base = (o: Record<string, unknown>) => { const levelId = str(o.levelId, 'Planta'); if (!levelIds.has(levelId)) fail('Referencia a una planta inexistente.'); return { id: str(o.id, 'ID'), name: str(o.name, 'Nombre'), levelId }; };
  const rooms = list(p.rooms).map(v => { const o = record(v); const finish = legacy ? 'wood' : o.finish; if (!['wood', 'tile', 'concrete'].includes(finish as string)) fail('Acabado de suelo desconocido.'); return { ...base(o), x: num(o.x, 'X'), y: num(o.y, 'Y'), width: num(o.width, 'Ancho', true), depth: num(o.depth, 'Fondo', true), height: num(o.height, 'Altura', true), thickness: num(o.thickness, 'Espesor', true), color: color(o.color), finish: finish as Finish }; });
  const walls = list(p.walls).map(v => { const o = record(v); const wall = { ...base(o), a: point(o.a), b: point(o.b), height: num(o.height, 'Altura', true), thickness: num(o.thickness, 'Espesor', true), color: color(o.color) }; if (distance(wall.a, wall.b) < .01) fail('Un muro debe medir al menos 1 cm.'); return wall; });
  const furniture = list(p.furniture).map(v => { const o = record(v); if (!furnitureCatalog.some(f => f.kind === o.kind)) fail('Tipo de mobiliario desconocido.'); return { ...base(o), kind: o.kind as FurnitureKind, x: num(o.x, 'X'), y: num(o.y, 'Y'), elevation: legacy ? 0 : nonnegative(o.elevation, 'Elevación del mueble'), width: num(o.width, 'Ancho', true), depth: num(o.depth, 'Fondo', true), height: num(o.height, 'Altura', true), rotation: num(o.rotation, 'Rotación'), color: color(o.color) }; });
  const openings = list(p.openings).map(v => { const o = record(v); if (o.kind !== 'door' && o.kind !== 'window') fail('Abertura desconocida.'); return { id: str(o.id, 'ID'), wallId: str(o.wallId, 'Muro'), kind: o.kind as Opening['kind'], offset: num(o.offset, 'Posición'), width: num(o.width, 'Ancho', true), height: num(o.height, 'Altura', true), sill: num(o.sill, 'Antepecho') }; });
  const lights = (legacy ? [] : list(p.lights)).map(v => { const o = record(v); if (!['point', 'spot', 'area'].includes(o.kind as string)) fail('Tipo de luz desconocido.'); const angle = num(o.angle, 'Ángulo del foco', true); if (angle >= 90) fail('El ángulo del foco debe ser menor de 90°.'); return { ...base(o), ...point3(o), kind: o.kind as LightKind, power: nonnegative(o.power, 'Potencia de luz'), color: color(o.color), enabled: bool(o.enabled), shadows: o.kind === 'area' ? false : bool(o.shadows), width: num(o.width, 'Ancho del panel', true), depth: num(o.depth, 'Fondo del panel', true), angle, target: point3(o.target) }; });
  const measurements = (legacy ? [] : list(p.measurements)).map(v => { const o = record(v), a = point3(o.a), b = point3(o.b); if (distance3(a, b) < .001) fail('Marca dos puntos separados por al menos 1 mm.'); return { ...base(o), a, b }; });
  const e = legacy ? environmentPreset() : record(p.environment);
  if (!['day', 'golden', 'night'].includes(e.preset as string)) fail('Ambiente desconocido.');
  const environment: Environment = { preset: e.preset as Environment['preset'], ambient: nonnegative(e.ambient, 'Luz ambiente'), sunIntensity: nonnegative(e.sunIntensity, 'Intensidad solar'), sunAzimuth: num(e.sunAzimuth, 'Azimut'), sunAltitude: num(e.sunAltitude, 'Altura solar'), exposure: num(e.exposure, 'Exposición', true), background: color(e.background), eyeHeight: num(e.eyeHeight, 'Altura de ojos', true), walkSpeed: num(e.walkSpeed, 'Velocidad de recorrido', true) };
  if (environment.sunAltitude < 0 || environment.sunAltitude > 90) fail('La altura solar debe estar entre 0° y 90°.');
  const project: Project = { format: 'prisma-arquitectura', version: 2, units: 'm', name: str(p.name, 'Proyecto'), levels, rooms, walls, furniture, openings, lights, measurements, environment };
  const allIds = [...levels, ...rooms, ...walls, ...furniture, ...openings, ...lights, ...measurements].map(v => v.id);
  for (const level of levels) if (lights.filter(l => l.levelId === level.id).length > 16) fail('Esta versión admite hasta 16 fuentes de luz por planta.');
  if (new Set(allIds).size !== allIds.length) fail('El proyecto contiene identificadores duplicados.');
  const roomEdges = rooms.flatMap(roomWalls);
  const edgeIds = new Set(roomEdges.map(w => w.id));
  if (walls.some(w => edgeIds.has(w.id))) fail('El ID de un muro coincide con el de un muro de espacio.');
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) if (overlaps(rooms[i], rooms[j])) fail('Los espacios se superponen. Dibuja cada espacio en una zona libre.');
  const sourceWalls = [...roomEdges, ...walls];
  for (const o of openings) {
    const wall = sourceWalls.find(w => w.id === o.wallId);
    if (!wall) fail('Abertura vinculada a un muro inexistente.');
    if (o.sill < 0 || (o.kind === 'door' && o.sill !== 0) || o.offset - o.width / 2 < -.00001 || o.offset + o.width / 2 > distance(wall!.a, wall!.b) + .00001 || o.sill + o.height > wall!.height + .00001) fail('La puerta o ventana debe quedar dentro de su muro. Ajusta sus dimensiones y posición.');
  }
  for (const wall of resolvedWalls(project)) {
    const holes = wallOpenings(project, wall).sort((a, b) => a.offset - b.offset);
    for (let i = 1; i < holes.length; i++) if (holes[i].offset - holes[i].width / 2 < holes[i - 1].offset + holes[i - 1].width / 2 - .00001) fail('Las aberturas de un mismo muro se superponen.');
  }
  return project;
}
