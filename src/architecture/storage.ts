import { demoProject, parseProject, uid, type Project } from './model';
export const STORAGE_KEY = 'prisma-arquitectura-library-v1';
export type SavedProject = { id: string; updated: number; project: Project };
type Library = { version: 1; activeId: string; projects: SavedProject[] };
export function readLibrary(storage: Pick<Storage, 'getItem'>): Library {
  const value = storage.getItem(STORAGE_KEY);
  if (!value) return { version: 1, activeId: '', projects: [] };
  const data = JSON.parse(value);
  if (data.version !== 1 || !Array.isArray(data.projects) || typeof data.activeId !== 'string') throw Error('La biblioteca local tiene un formato incompatible. Conservamos su contenido; exporta tu proyecto antes de recargar.');
  const projects = data.projects.map((p: SavedProject) => {
    if (typeof p.id !== 'string' || !p.id || !Number.isFinite(p.updated)) throw Error('Registro de biblioteca inválido.');
    return { id: p.id, updated: p.updated, project: parseProject(p.project) };
  });
  if (new Set(projects.map((p: SavedProject) => p.id)).size !== projects.length) throw Error('La biblioteca contiene proyectos con el mismo identificador.');
  return { version: 1, activeId: data.activeId, projects };
}
export function saveProject(storage: Pick<Storage, 'getItem' | 'setItem'>, id: string, project: Project, now = Date.now()) {
  const library = readLibrary(storage), record = { id, project: parseProject(project), updated: now };
  const projects = [...library.projects.filter(p => p.id !== id), record].sort((a, b) => b.updated - a.updated);
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, activeId: id, projects }));
  return projects;
}
export function initialProject() {
  try {
    const library = readLibrary(localStorage), saved = library.projects.find(p => p.id === library.activeId) ?? library.projects[0];
    return { id: saved?.id ?? uid(), project: saved?.project ?? demoProject(), error: '' };
  } catch (e) {
    return { id: uid(), project: demoProject(), error: e instanceof Error ? e.message : String(e) };
  }
}
