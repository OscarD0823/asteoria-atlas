import { openingIsOpen } from './walk-actions';
import { distance, projectPoint, resolvedWalls, wallOpenings, parseProject, type Point, type Project, type Selection } from './model';
import { produce } from 'immer';
import { indexedCanWalk } from './collisions';
export type Transform = { x: number; y: number; elevation: number; rotation: number; scaleX: number; scaleY: number; scaleZ: number };
export function transformProject(project: Project, selection: NonNullable<Selection>, t: Transform) {
  const next = produce(project, next => {
  if (selection.kind === 'furniture') {
    const f = next.furniture.find(f => f.id === selection.id)!;
    Object.assign(f, { x: t.x, y: t.y, elevation: t.elevation, rotation: t.rotation, width: f.width * t.scaleX, depth: f.depth * t.scaleZ, height: f.height * t.scaleY });
  } else if (selection.kind === 'light') {
    const light = next.lights.find(l => l.id === selection.id)!;
    light.target = { x: light.target.x + t.x - light.x, y: light.target.y + t.y - light.y, elevation: light.target.elevation + t.elevation - light.elevation };
    Object.assign(light, { x: t.x, y: t.y, elevation: t.elevation });
  } else if (selection.kind === 'room') {
    const room = next.rooms.find(r => r.id === selection.id)!;
    room.width *= t.scaleX; room.depth *= t.scaleZ;
    room.x = t.x - room.width / 2; room.y = t.y - room.depth / 2;
  } else if (selection.kind === 'wall') {
    const w = next.walls.find(w => w.id === selection.id);
    if (!w) throw Error('Selecciona el espacio para modificar sus muros.');
    const length = distance(w.a, w.b) * t.scaleX, angle = t.rotation * Math.PI / 180;
    w.a = { x: t.x, y: t.y }; w.b = { x: t.x + Math.cos(angle) * length, y: t.y + Math.sin(angle) * length }; w.height *= t.scaleY; w.thickness *= t.scaleZ;
  } else if (selection.kind === 'opening') {
    const o = next.openings.find(o => o.id === selection.id)!;
    o.offset = t.x; o.sill = o.kind === 'window' ? t.elevation : 0; o.width *= t.scaleX; o.height *= t.scaleY;
  }
  }); parseProject(next); return next;
}
export function canWalkAt(project: Project, levelId: string, p: Point, radius = .18) {
  if (Object.isFrozen(project)) return indexedCanWalk(project,levelId,p,radius);
  for (const wall of resolvedWalls(project, levelId)) {
    const nearest = projectPoint(p, wall);
    if (nearest.distance >= wall.thickness / 2 + radius) continue;
    const door = wallOpenings(project, wall).some(o => o.kind === 'door' && openingIsOpen(o) && o.height >= project.environment.eyeHeight + .05 && Math.abs(nearest.offset - o.offset) <= o.width / 2 - radius);
    if (!door) return false;
  }
  for (const f of project.furniture.filter(f => f.levelId === levelId && f.elevation < project.environment.eyeHeight + .15)) {
    const a = f.rotation * Math.PI / 180, dx = p.x - f.x, dy = p.y - f.y;
    const x = Math.cos(a) * dx + Math.sin(a) * dy, y = -Math.sin(a) * dx + Math.cos(a) * dy;
    if (Math.abs(x) < f.width / 2 + radius && Math.abs(y) < f.depth / 2 + radius) return false;
  }
  return true;
}
export function walkStep(project: Project, levelId: string, start: Point, delta: Point): Point {
  let p = { ...start }; const count = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / .08));
  for (let i = 0; i < count; i++) {
    const dx = delta.x / count, dy = delta.y / count;
    if (canWalkAt(project, levelId, { x: p.x + dx, y: p.y + dy })) p = { x: p.x + dx, y: p.y + dy };
    else { if (canWalkAt(project, levelId, { x: p.x + dx, y: p.y })) p.x += dx; if (canWalkAt(project, levelId, { x: p.x, y: p.y + dy })) p.y += dy; }
  }
  return p;
}
export function walkStart(project: Project, levelId: string, roomId?: string): Point {
  const rooms = project.rooms.filter(r => r.levelId === levelId).sort((a, b) => Number(b.id === roomId) - Number(a.id === roomId));
  for (const room of rooms) for (const fx of [.5, .2, .8]) for (const fy of [.5, .2, .8]) {
    const point = { x: room.x + room.width * fx, y: room.y + room.depth * fy };
    if (canWalkAt(project, levelId, point)) return point;
  }
  throw Error('No encontramos un punto de inicio libre. Deja espacio entre los muebles para recorrer esta planta.');
}
