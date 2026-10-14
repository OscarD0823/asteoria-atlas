import type { Project } from './model';
export type History = { past: Project[]; present: Project; future: Project[] };
export function editHistory(history: History, project: Project): History {
  if (JSON.stringify(history.present) === JSON.stringify(project)) return history;
  return { past: [...history.past.slice(-79), history.present], present: project, future: [] };
}
export function undoHistory(h: History): History {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] };
}
export function redoHistory(h: History): History {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
