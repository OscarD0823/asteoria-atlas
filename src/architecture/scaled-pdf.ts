import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { bounds, distance, resolvedWalls, wallOpenings, type Point, type Project } from './model';
import { printedLengthMm } from './units';
export function sheetLayout(project: Project, levelId: string, scale: number, paper: 'A4' | 'A3') {
  if (![20, 25, 50, 75, 100, 200].includes(scale)) throw Error('Escala de impresión desconocida.');
  const b = bounds(project, levelId), widthMm = paper === 'A3' ? 420 : 297, heightMm = paper === 'A3' ? 297 : 210;
  if (printedLengthMm(b.width, scale) > widthMm - 30 || printedLengthMm(b.height, scale) > heightMm - 55) throw Error(`El plano no cabe en ${paper} a 1:${scale}. Elige una escala menor o papel A3.`);
  return { b, widthMm, heightMm, factor: 1000 / scale * 72 / 25.4 };
}
export async function scaledPdf(project: Project, levelId: string, scale: number, paper: 'A4' | 'A3') {
  const { b, widthMm, heightMm, factor } = sheetLayout(project, levelId, scale, paper), pt = 72 / 25.4;
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([widthMm * pt, heightMm * pt]), level = project.levels.find(l => l.id === levelId)!;
  const x0 = (widthMm * pt - b.width * factor) / 2 - b.x * factor, top = heightMm * pt - 35 * pt + b.y * factor;
  const point = (p: Point) => ({ x: x0 + p.x * factor, y: top - p.y * factor });
  const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
  const text = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
  page.drawText(text(`${project.name} · ${level.name}`), { x: 15 * pt, y: heightMm * pt - 18 * pt, size: 16, font: bold, color: color('#3a334c') });
  page.drawText(`Prisma Arquitectura · Escala 1:${scale} · ${paper} horizontal · Medidas en metros`, { x: 15 * pt, y: heightMm * pt - 26 * pt, size: 9, font, color: color('#81758f') });
  for (const room of project.rooms.filter(r => r.levelId === levelId)) {
    const p = point({ x: room.x, y: room.y + room.depth }); page.drawRectangle({ ...p, width: room.width * factor, height: room.depth * factor, color: color(room.color) });
    const label = point({ x: room.x + .25, y: room.y + room.depth - .45 }); page.drawText(text(`${room.name} · ${(room.width * room.depth).toFixed(2)} m²`), { ...label, size: 8, font, color: color('#52505b') });
  }
  for (const f of project.furniture.filter(f => f.levelId === levelId)) {
    const a = f.rotation * Math.PI / 180;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => { const x = sx * f.width / 2, y = sy * f.depth / 2; return { x: f.x + Math.cos(a) * x - Math.sin(a) * y, y: f.y + Math.sin(a) * x + Math.cos(a) * y }; });
    const path = corners.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ') + ' Z'; page.drawSvgPath(path, { x: x0, y: top, scale: factor, color: color(f.color), borderColor: color('#897d73'), borderWidth: .01 });
  }
  for (const wall of resolvedWalls(project, levelId)) {
    page.drawLine({ start: point(wall.a), end: point(wall.b), thickness: wall.thickness * factor, color: color('#50525d') });
    const length = distance(wall.a, wall.b), dx = (wall.b.x - wall.a.x) / length, dy = (wall.b.y - wall.a.y) / length;
    for (const o of wallOpenings(project, wall)) {
      const a = { x: wall.a.x + dx * (o.offset - o.width / 2), y: wall.a.y + dy * (o.offset - o.width / 2) }, end = { x: a.x + dx * o.width, y: a.y + dy * o.width };
      page.drawLine({ start: point(a), end: point(end), thickness: wall.thickness * factor + .3, color: rgb(1, 1, 1) });
      if (o.kind === 'window') page.drawLine({ start: point(a), end: point(end), thickness: .045 * factor, color: color('#75a1b2') });
      else page.drawLine({ start: point(a), end: point({ x: a.x + dy * o.width, y: a.y - dx * o.width }), thickness: .02 * factor, color: color('#ab8d6a') });
    }
  }
  const barX = 15 * pt, barY = 14 * pt; page.drawLine({ start: { x: barX, y: barY }, end: { x: barX + factor, y: barY }, thickness: 1, color: color('#776287') });
  page.drawText('0', { x: barX, y: barY - 11, font, size: 8 }); page.drawText('1 m', { x: barX + factor - 12, y: barY - 11, font, size: 8 });
  page.drawText('Imprimir al 100%, sin ajustar a la página. La barra permite verificar la escala.', { x: barX + factor + 22, y: barY, size: 8, font, color: color('#857b8b') });
  doc.setTitle(project.name); doc.setCreator('Prisma Arquitectura 0.2'); return doc.save();
}
