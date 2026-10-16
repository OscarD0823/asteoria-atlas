import { version } from '../package.json';
import test from 'node:test';
import assert from 'node:assert/strict';
import { demoProject, emptyProject, deleteSelection, parseProject, resolvedWalls, roomWalls, wallOpenings, makeFurniture, makeLight, environmentPreset, uid } from '../src/architecture/model';
import { transformProject, canWalkAt, walkStep, walkStart, type Transform } from '../src/architecture/interactions';
import { toMeters, fromMeters, printedLengthMm, dimensionText } from '../src/architecture/units';
import { scaledPdf, sheetLayout } from '../src/architecture/scaled-pdf';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { editHistory, redoHistory, undoHistory, type History } from '../src/architecture/history';
import { measurementsCsv, planSvg } from '../src/architecture/exports';
import { readLibrary, saveProject, STORAGE_KEY } from '../src/architecture/storage';
const memory = () => { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } }; };
test('el ejemplo conserva geometría, unidades y áreas al guardar y reabrir', () => {
  const p = demoProject(), loaded = parseProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(loaded, parseProject(p));
  assert.equal(loaded.rooms.reduce((a, r) => a + r.width * r.depth, 0), 80);
  assert.equal(loaded.units, 'm'); assert.equal(loaded.openings.length, 8);
});
test('espacios contiguos comparten un muro y conservan referencias de ambos sentidos', () => {
  const p = demoProject(), living = p.rooms[0], kitchen = p.rooms[1];
  const wall = resolvedWalls(p).find(w => w.aliases.includes(`${living.id}:wall:1`))!;
  assert.equal(resolvedWalls(p).length, 12);
  assert.ok(wall.aliases.includes(`${kitchen.id}:wall:3`));
  p.openings = [{ id: uid(), wallId: `${kitchen.id}:wall:3`, kind: 'door', offset: 1, width: .8, height: 2, sill: 0 }];
  assert.equal(wallOpenings(parseProject(p), wall)[0].offset, 3);
});
test('aberturas de muros compartidos se validan en la misma referencia espacial', () => {
  const p = demoProject();
  p.openings.push({ id: uid(), wallId: `${p.rooms[1].id}:wall:3`, kind: 'window', offset: 2, width: 1, height: 1, sill: 1 });
  assert.throws(() => parseProject(p), /superponen/);
});
test('rechaza aberturas fuera de un muro o por encima de su altura', () => {
  const p = demoProject(); p.openings[0].offset = 100;
  assert.throws(() => parseProject(p), /dentro de su muro/);
  p.openings[0].offset = 2; p.openings[0].height = 4;
  assert.throws(() => parseProject(p), /dentro de su muro/);
});
test('cambiar un espacio conserva las identidades de sus muros y aberturas', () => {
  const p = demoProject(), wallIds = roomWalls(p.rooms[0]).map(w => w.id), openingIds = p.openings.map(o => o.id);
  p.rooms[0].x = -10;
  const next = parseProject(p);
  assert.deepEqual(roomWalls(next.rooms[0]).map(w => w.id), wallIds);
  assert.deepEqual(next.openings.map(o => o.id), openingIds);
});
test('no acepta espacios superpuestos ni referencias a plantas ausentes', () => {
  const p = demoProject(); p.rooms[1].x = 4;
  assert.throws(() => parseProject(p), /superponen/);
  p.rooms[1].x = 5; p.furniture[0].levelId = 'missing';
  assert.throws(() => parseProject(p), /planta inexistente/);
});
test('rechaza versiones futuras, IDs duplicados y dimensiones no finitas', () => {
  assert.throws(() => parseProject({ ...emptyProject(), version: 5 }), /versión incompatible/);
  const p = demoProject(); p.furniture[1].id = p.furniture[0].id;
  assert.throws(() => parseProject(p), /duplicados/);
  p.furniture[1].id = uid(); p.rooms[0].width = Infinity;
  assert.throws(() => parseProject(p), /número inválido/);
});
test('eliminar un espacio retira sus muros y sus aberturas sin tocar otros espacios', () => {
  const p = demoProject(), deleted = p.rooms[0].id;
  const next = deleteSelection(p, { kind: 'room', id: deleted });
  assert.equal(next.rooms.length, 3);
  assert.ok(!next.openings.some(o => o.wallId.startsWith(deleted)));
  assert.equal(p.rooms.length, 4); assert.doesNotThrow(() => parseProject(next));
});
test('una edición completa se deshace y rehace; editar después de deshacer descarta el futuro', () => {
  const p = demoProject(), moved = structuredClone(p); moved.furniture[0].x += 2;
  const initial: History = { past: [], present: p, future: [] };
  const edited = editHistory(initial, moved), undone = undoHistory(edited);
  assert.equal(edited.past.length, 1); assert.deepEqual(undone.present, p); assert.deepEqual(redoHistory(undone).present, moved);
  const renamed = { ...p, name: 'Otro proyecto' }; assert.equal(editHistory(undone, renamed).future.length, 0);
});
test('la biblioteca guarda proyectos independientes y recupera el proyecto activo', () => {
  const storage = memory(), a = demoProject(), b = emptyProject();
  saveProject(storage, 'one', a, 100); saveProject(storage, 'two', b, 200);
  const loaded = readLibrary(storage); assert.equal(loaded.activeId, 'two'); assert.equal(loaded.projects.length, 2);
  assert.deepEqual(loaded.projects.find(p => p.id === 'one')!.project, parseProject(a));
});
test('un almacenamiento corrupto no se sobrescribe con un proyecto nuevo', () => {
  const storage = memory(); storage.setItem(STORAGE_KEY, '{broken');
  assert.throws(() => saveProject(storage, 'new', demoProject())); assert.equal(storage.getItem(STORAGE_KEY), '{broken');
});
test('los fallos de cuota se comunican y no fingen que el proyecto quedó guardado', () => {
  const storage = { getItem: () => null, setItem: () => { throw Error('QuotaExceededError'); } };
  assert.throws(() => saveProject(storage, 'new', demoProject()), /QuotaExceededError/);
});
test('el SVG escapa nombres y conserva una referencia métrica', () => {
  const p = demoProject(); p.rooms[0].name = '<script>alert(1)</script>&';
  const svg = planSvg(p, p.levels[0].id);
  assert.ok(!svg.includes('<script>')); assert.ok(svg.includes('&lt;script&gt;')); assert.ok(svg.includes('viewBox=')); assert.ok(svg.includes('2 m'));
});
test('el CSV exporta medidas y no ejecuta nombres que parecen fórmulas', () => {
  const p = demoProject(); p.rooms[0].name = '=1+1';
  const csv = measurementsCsv(p); assert.ok(csv.includes("\"'=1+1\"")); assert.ok(csv.includes('"5","4","20","18","2.8"')); assert.ok(csv.startsWith('\uFEFF'));
});
test('migra un proyecto v1 sin cambiar geometría, aberturas ni identidades', () => {
  const p = demoProject(), old = { ...p, version: 1 } as Record<string, unknown>;
  delete old.lights; delete old.measurements; delete old.environment;
  old.furniture = p.furniture.map(({ elevation: _e, ...f }) => f); old.rooms = p.rooms.map(({ finish: _f, ...r }) => r);
  const migrated = parseProject(JSON.parse(JSON.stringify(old)));
  assert.equal(migrated.version, 4); assert.deepEqual(migrated.openings, p.openings);
  assert.deepEqual(migrated.furniture, parseProject(p).furniture); assert.ok(migrated.rooms.every(r => r.finish === 'wood'));
  assert.deepEqual(migrated.lights, []); assert.deepEqual(migrated.measurements, []);
  assert.equal(migrated.environment.eyeHeight, 1.65); assert.deepEqual(parseProject(migrated), migrated);
});
const pose = (patch: Partial<Transform> = {}): Transform => ({ x: 2, y: 3, elevation: 0, rotation: 0, scaleX: 1, scaleY: 1, scaleZ: 1, ...patch });
test('transformar en 3D conserva altura, orientación y tamaño al exportar y deshacer', () => {
  const p = demoProject(), f = p.furniture[0];
  const moved = transformProject(p, { kind: 'furniture', id: f.id }, pose({ elevation: 1.25, rotation: 90, scaleX: 1.5, scaleY: 2, scaleZ: .5 }));
  const result = parseProject(JSON.parse(JSON.stringify(moved))).furniture[0];
  assert.equal(result.x, 2); assert.equal(result.y, 3); assert.equal(result.elevation, 1.25); assert.equal(result.rotation, 90);
  assert.equal(result.width, f.width * 1.5); assert.equal(result.height, f.height * 2); assert.equal(result.depth, f.depth * .5);
  assert.equal(p.furniture[0].elevation, 0); assert.equal(p.furniture[0].width, f.width);
  const history = editHistory({ past: [], present: p, future: [] }, moved); assert.deepEqual(undoHistory(history).present, p); assert.deepEqual(redoHistory(undoHistory(history)).present, moved);
});
test('una transformación inválida no modifica el proyecto de origen', () => {
  const p = demoProject(), before = structuredClone(p);
  assert.throws(() => transformProject(p, { kind: 'furniture', id: p.furniture[0].id }, pose({ scaleX: -1 })), /Ancho/);
  assert.throws(() => transformProject(p, { kind: 'opening', id: p.openings[0].id }, pose({ x: 100 })), /dentro de su muro/);
  assert.deepEqual(p, before);
});
test('mover un foco traslada también su objetivo y conserva el haz al guardar', () => {
  const p = emptyProject(), l = makeLight('spot', p.levels[0].id, { x: 1, y: 2 }); l.target.x = 3; p.lights.push(l);
  const moved = transformProject(p, { kind: 'light', id: l.id }, pose({ x: 4, y: 6, elevation: 3.5 }));
  const light = parseProject(JSON.parse(JSON.stringify(moved))).lights[0];
  assert.deepEqual(light.target, { x: 6, y: 6, elevation: 1 }); assert.equal(light.power, 650); assert.equal(light.angle, 40);
  assert.equal(l.x, 1); assert.equal(light.kind, 'spot');
});
test('acepta apagar todas las luces y rechaza parámetros luminosos inválidos', () => {
  const p = demoProject(); p.environment = { ...environmentPreset('night'), ambient: 0, sunIntensity: 0 }; p.lights.forEach(l => { l.power = 0; l.enabled = false; });
  assert.doesNotThrow(() => parseProject(p)); p.lights[0].power = -1; assert.throws(() => parseProject(p), /Potencia/);
  p.lights[0].power = 650; p.lights[0].angle = 90; assert.throws(() => parseProject(p), /menor de 90/);
  p.lights[0].angle = 40; p.environment.sunAltitude = 91; assert.throws(() => parseProject(p), /entre 0/);
});
test('limita las luces por planta y un panel no solicita sombras no soportadas', () => {
  const p = emptyProject(), level = p.levels[0].id;
  for (let i = 0; i < 2048; i++) p.lights.push(makeLight('point', level, { x: i, y: 0 }));
  assert.doesNotThrow(() => parseProject(p)); p.lights.push(makeLight('area', level, { x: 1, y: 2 })); assert.throws(() => parseProject(p), /2048 fuentes/);
  p.lights = [makeLight('area', level, { x: 1, y: 2 })]; p.lights[0].shadows = true; assert.equal(parseProject(p).lights[0].shadows, false);
});
test('el sentido de una abertura centrada sigue identificado en un muro compartido', () => {
  const p = demoProject(), wall = resolvedWalls(p).find(w => w.aliases.includes(`${p.rooms[1].id}:wall:3`))!;
  p.openings = [{ id: uid(), wallId: `${p.rooms[1].id}:wall:3`, kind: 'door', offset: 2, width: .9, height: 2.1, sill: 0 }];
  const o = wallOpenings(parseProject(p), wall)[0]; assert.equal(o.offset, 2); assert.equal(o.reversed, true);
});
test('el recorrido atraviesa puertas transitables y se detiene ante muros y ventanas', () => {
  const p = emptyProject(), level = p.levels[0].id, id = uid();
  p.walls.push({ id, levelId: level, name: 'Muro', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, height: 2.8, thickness: .16, color: '#ffffff' });
  p.openings.push({ id: uid(), wallId: id, kind: 'door', offset: 2, width: .9, height: 2.1, sill: 0 }, { id: uid(), wallId: id, kind: 'window', offset: 4, width: 1, height: 1.2, sill: .9 });
  assert.equal(canWalkAt(p, level, { x: 1, y: 0 }), false); assert.equal(canWalkAt(p, level, { x: 2, y: 0 }), true); assert.equal(canWalkAt(p, level, { x: 4, y: 0 }), false);
  assert.ok(walkStep(p, level, { x: 2, y: 1 }, { x: 0, y: -2 }).y < -.9);
  assert.ok(walkStep(p, level, { x: 1, y: 1 }, { x: 0, y: -10 }).y >= .26 - .00001);
  p.environment.eyeHeight = 2.2; assert.equal(canWalkAt(p, level, { x: 2, y: 0 }), false);
});
test('las colisiones de muebles girados y elevados usan su posición 3D', () => {
  const p = emptyProject(), level = p.levels[0].id, f = makeFurniture('sofa', level, { x: 2, y: 2 }); f.width = 3; f.depth = .6; f.rotation = 90; p.furniture.push(f);
  assert.equal(canWalkAt(p, level, { x: 2, y: 3.2 }), false); assert.equal(canWalkAt(p, level, { x: 3.2, y: 2 }), true);
  f.elevation = 3; assert.equal(canWalkAt(p, level, { x: 2, y: 3.2 }), true);
});
test('el inicio del recorrido deja al visitante en un lugar transitable', () => {
  const p = demoProject(), level = p.levels[0].id, room = p.rooms[2], start = walkStart(p, level, room.id);
  assert.equal(canWalkAt(p, level, start), true); assert.ok(start.x > room.x && start.x < room.x + room.width && start.y > room.y && start.y < room.y + room.depth);
  assert.throws(() => walkStart(emptyProject(), 'missing'), /punto de inicio/);
});
test('las unidades visibles se convierten sin cambiar los metros del proyecto', () => {
  for (const unit of ['m', 'cm', 'mm'] as const) for (const value of [.01, 1.25, -2.5, 10]) assert.ok(Math.abs(toMeters(fromMeters(value, unit), unit) - value) < 1e-12);
  assert.equal(dimensionText(1.25, 'cm'), '125 cm'); assert.equal(printedLengthMm(1, 50), 20); assert.equal(printedLengthMm(5, 100), 50);
});
test('medidas 3D incluyen la altura y siguen siendo editables después de reabrir', () => {
  const p = emptyProject(), m = { id: uid(), levelId: p.levels[0].id, name: 'Altura', a: { x: 0, y: 0, elevation: 0 }, b: { x: 0, y: 0, elevation: 2.8 } }; p.measurements.push(m);
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))).measurements[0], m); assert.equal(deleteSelection(p, { kind: 'measurement', id: m.id }).measurements.length, 0);
  m.b.elevation = 0; assert.throws(() => parseProject(p), /al menos 1 mm/);
});
test('el PDF conserva una barra física de 20 mm a 1:50 y el tamaño A3', async () => {
  const p = demoProject(), bytes = await scaledPdf(p, p.levels[0].id, 50, 'A3'), doc = await PDFDocument.load(bytes), page = doc.getPages()[0];
  assert.equal(doc.getPageCount(), 1); assert.ok(Math.abs(page.getWidth() * 25.4 / 72 - 420) < 1e-8); assert.ok(Math.abs(page.getHeight() * 25.4 / 72 - 297) < 1e-8);
  const contents = page.node.Contents()!, streams = contents instanceof PDFArray ? contents.asArray().map(ref => doc.context.lookup(ref)) : [contents];
  const drawing = streams.map(stream => new TextDecoder().decode(decodePDFRawStream(stream as PDFRawStream).decode())).join('\n');
  const segments = [...drawing.matchAll(/([\d.]+) ([\d.]+) m\s+([\d.]+) ([\d.]+) l/g)];
  assert.ok(segments.some(([, x1, y1, x2, y2]) => Math.abs(Number(y1) - Number(y2)) < 1e-8 && Math.abs((Number(x2) - Number(x1)) * 25.4 / 72 - 20) < 1e-6), 'el PDF debe incluir una barra vectorial de un metro que mida 20 mm');
  assert.equal(doc.getCreator(), `Auralis Atlas ${version} BETA`);
});
test('un plano que no cabe a su escala se rechaza, sin reescalarlo silenciosamente', async () => {
  const p = demoProject(), level = p.levels[0].id;
  assert.throws(() => sheetLayout(p, level, 20, 'A4'), /no cabe/); await assert.rejects(scaledPdf(p, level, 20, 'A4'), /no cabe/);
  assert.doesNotThrow(() => sheetLayout(p, level, 100, 'A4')); assert.throws(() => sheetLayout(p, level, 13, 'A3'), /desconocida/);
});
