import { freeze } from 'immer';
import { durableTransaction } from '@prisma/core/idb-durability';
import { demoProject, parseProject, uid, type Project } from './model';
import { readLibrary, type SavedProject } from './storage';
export type ProjectSummary={id:string;updated:number;name:string;roomCount:number;objectCount:number;floors:number};
const summary=(record:SavedProject):ProjectSummary=>({id:record.id,updated:record.updated,name:record.project.name,roomCount:record.project.rooms.length,objectCount:record.project.furniture.length,floors:record.project.levels.length});
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('prisma-arquitectura-projects', 2);
    request.onupgradeneeded = () => { for(const name of ['projects','summaries','settings'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,name==='settings'?undefined:{keyPath:'id'}); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => reject(Error('Cierra las otras pestañas del editor para actualizar el guardado local.'));
  });
}
function result<T>(request: IDBRequest<T>) { return new Promise<T>((resolve,reject) => { request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); }
function done(transaction: IDBTransaction) { return new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(transaction.error??Error('No se pudo guardar el proyecto. Exporta una copia.'));}); }
export async function storeProject(id: string, project: Project) {
  const database = await db(), transaction = durableTransaction(database,['projects','summaries','settings']),record={id,project,updated:Date.now()};
  const completed = done(transaction); transaction.objectStore('projects').put(record); transaction.objectStore('summaries').put(summary(record));transaction.objectStore('settings').put(id,'active'); await completed;
}
export async function listStoredProjects(): Promise<ProjectSummary[]> {
  const database = await db(), values = await result(database.transaction('summaries').objectStore('summaries').getAll());
  return (values as ProjectSummary[]).sort((a,b)=>b.updated-a.updated);
}
export async function getStoredProject(id:string){const database=await db(),record=await result(database.transaction('projects').objectStore('projects').get(id)) as SavedProject|undefined;if(!record)throw Error('No se encontró ese proyecto en la biblioteca.');return freeze({...parseProject(record.project)},true);}
export async function loadInitialProject() {
  try {
    const database = await db(); let records = await listStoredProjects();
    if(!records.length){const transaction=durableTransaction(database,['projects','summaries']),completed=done(transaction),request=transaction.objectStore('projects').openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){transaction.objectStore('summaries').put(summary(cursor.value));cursor.continue();}};await completed;records=await listStoredProjects();}
    if (!records.length) { const old = readLibrary(localStorage); for (const record of old.projects) await storeProject(record.id,record.project); records=await listStoredProjects(); if (old.activeId) { const tx=durableTransaction(database,'settings'); tx.objectStore('settings').put(old.activeId,'active'); await done(tx); } }
    const active = await result(database.transaction('settings').objectStore('settings').get('active')), saved = records.find(r=>r.id===active)??records[0];
    return {id:saved?.id??uid(),project:saved?await getStoredProject(saved.id):freeze(demoProject(),true),error:''};
  } catch (e) { return {id:uid(),project:freeze(demoProject(),true),error:`No se pudo abrir la biblioteca local. Conservamos sus datos. ${e instanceof Error?e.message:String(e)}`}; }
}
