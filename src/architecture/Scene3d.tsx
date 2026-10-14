import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Move, RotateCw, Scaling, Trash2 } from 'lucide-react';
import { bounds, distance, distance3, resolvedWalls, snapPoint, wallOpenings, makeFurniture, type FurnitureKind, type Point3, type Project, type Selection } from './model';
import { walkStart, walkStep, type Transform } from './interactions';
import { dimensionText, type DisplayUnit } from './units';
import { box, dispose, floorTexture, furnitureMesh, lightMesh, textSprite } from './scene-geometry';
import type { Tool } from './Plan';
export type TransformMode = 'translate' | 'rotate' | 'scale';
export type SceneHandle = { capture: (width: number, height: number, ao: boolean) => string };
type Props = { project: Project; levelId: string; selection: Selection; cutaway: boolean; resetKey: number; tool: Tool; furnitureKind: FurnitureKind; pending: Point3 | null; snap: boolean; snapStep: number; unit: DisplayUnit; showDimensions: boolean; walking: boolean; mode: TransformMode; onMode: (mode: TransformMode) => void; onSelect: (s: Selection) => void; onPoint: (p: Point3) => void; onTransform: (s: NonNullable<Selection>, t: Transform) => boolean; onDelete: () => void; onError: (error: unknown) => void; onWalking: (walking: boolean) => void };
function createRuntime(element: HTMLDivElement, latest: MutableRefObject<Props>, readout: HTMLDivElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; element.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), model = new THREE.Group(), preview = new THREE.Group(), annotations = new THREE.Group(); scene.add(model, preview, annotations);
  const camera = new THREE.PerspectiveCamera(40, 1, .025, 3000), orbit = new OrbitControls(camera, renderer.domElement); orbit.maxPolarAngle = Math.PI * .49;
  const gizmo = new TransformControls(camera, renderer.domElement); gizmo.setSize(.8); const helper = gizmo.getHelper(); scene.add(helper);
  const selectedBox = new THREE.BoxHelper(new THREE.Object3D(), '#9b79de'); selectedBox.visible = false; scene.add(selectedBox);
  const ambient = new THREE.HemisphereLight('#fff7eb', '#9aabbf', .8); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff1da', 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = .02; sun.shadow.bias = -.0001; scene.add(sun, sun.target);
  const objects = new Map<string, THREE.Object3D>(), ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let walking = false, frameId = 0, lastTime = 0, yaw = 0, pitch = 0, down = { x: 0, y: 0 }, look = false, suppressClick = false;
  let orbitPose: { position: THREE.Vector3; target: THREE.Vector3; quaternion: THREE.Quaternion } | null = null;
  type Gesture = { object: THREE.Object3D; selection: NonNullable<Selection>; position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3; offset: THREE.Vector3; plane: THREE.Plane; moved: boolean };
  let gesture: Gesture | null = null; const keys = new Set<string>();
  const objectSelection = (o: THREE.Object3D) => o.userData.selection as NonNullable<Selection>;
  function draw() { if (selectedBox.visible && gizmo.object) selectedBox.setFromObject(gizmo.object); renderer.render(scene, camera); }
  function showReadout(object: THREE.Object3D) { const p = object.getWorldPosition(new THREE.Vector3()), u = latest.current.unit; readout.textContent = `X ${dimensionText(p.x, u)} · Z ${dimensionText(p.z, u)} · Altura ${dimensionText(Math.max(0, p.y), u)}`; readout.style.display = 'block'; }
  function frame() {
    if (walking) return; const b = bounds(latest.current.project, latest.current.levelId), center = new THREE.Vector3(b.x + b.width / 2, .5, b.y + b.height / 2);
    const radius = Math.hypot(b.width, b.height) / 2, angle = Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.min(1, camera.aspect));
    orbit.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(.8, .95, 1.15).normalize().multiplyScalar(radius / Math.sin(angle))); orbit.update(); draw();
  }
  function pointer(e: PointerEvent) { const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera); }
  function pick(e: PointerEvent) { pointer(e); const hit = ray.intersectObject(model, true)[0]; let o: THREE.Object3D | null = hit?.object ?? null; while (o && !o.userData.selection) o = o.parent; return o; }
  function planePoint(e: PointerEvent, surface = false): Point3 | null { pointer(e); const hit = surface ? ray.intersectObject(model, true)[0]?.point : undefined; const p = hit ?? ray.ray.intersectPlane(groundPlane, new THREE.Vector3()); if (!p) return null; return { ...snapPoint({ x: p.x, y: p.z }, latest.current.snap, latest.current.snapStep), elevation: surface ? Math.round(p.y * 1000) / 1000 : 0 }; }
  function syncSelection() {
    const p = latest.current, s = p.selection, object = s ? objects.get(`${s.kind}:${s.id}`) : undefined;
    gizmo.detach(); selectedBox.visible = false; readout.style.display = 'none'; orbit.enabled = !walking && !gesture; orbit.mouseButtons.LEFT = ['select', 'pan'].includes(p.tool) ? THREE.MOUSE.ROTATE : null;
    if (!object || walking || p.tool !== 'select' || s?.kind === 'measurement' || (s?.kind === 'wall' && object.userData.derived)) { draw(); return; }
    const kind = s!.kind, mode = kind === 'light' ? 'translate' : (kind === 'room' || kind === 'opening') && p.mode === 'rotate' ? 'translate' : p.mode;
    gizmo.setMode(mode); gizmo.setSpace(kind === 'opening' ? 'local' : 'world'); gizmo.showX = true; gizmo.showY = kind !== 'room' && !(kind === 'wall' && mode === 'translate') && !(kind === 'opening' && object.userData.door && mode === 'translate'); gizmo.showZ = kind !== 'opening';
    if (mode === 'rotate') { gizmo.showX = false; gizmo.showY = true; gizmo.showZ = false; }
    gizmo.setTranslationSnap(p.snap ? p.snapStep : null); gizmo.setRotationSnap(p.snap ? Math.PI / 12 : null); gizmo.setScaleSnap(p.snap ? .05 : null);
    gizmo.attach(object); selectedBox.setFromObject(object); selectedBox.visible = true; draw();
  }
  function begin(object: THREE.Object3D, offset = new THREE.Vector3()): Gesture { return { object, selection: objectSelection(object), position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone(), offset, plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -object.position.y), moved: false }; }
  function finish(g: Gesture) {
    const o = g.object, s = g.selection; let x = o.position.x; if (s.kind === 'opening' && o.userData.reverse) x = o.userData.wallLength - x;
    const t: Transform = { x, y: o.position.z, elevation: s.kind === 'furniture' ? Math.max(0, o.position.y) : o.position.y, rotation: -o.rotation.y * 180 / Math.PI, scaleX: o.scale.x / g.scale.x, scaleY: o.scale.y / g.scale.y, scaleZ: o.scale.z / g.scale.z };
    if (!latest.current.onTransform(s, t)) { o.position.copy(g.position); o.rotation.copy(g.rotation); o.scale.copy(g.scale); } gesture = null; orbit.enabled = !walking; readout.style.display = 'none'; draw();
  }
  gizmo.addEventListener('mouseDown', () => { if (gizmo.object) { gesture = begin(gizmo.object); suppressClick = true; } });
  gizmo.addEventListener('objectChange', () => { if (gizmo.object) { showReadout(gizmo.object); if (gesture) gesture.moved = true; } draw(); });
  gizmo.addEventListener('dragging-changed', e => { orbit.enabled = !e.value && !walking; }); gizmo.addEventListener('mouseUp', () => { if (gesture) finish(gesture); }); gizmo.addEventListener('change', draw); orbit.addEventListener('change', draw);
  function previewAt(point: Point3 | null) {
    dispose(preview); preview.clear(); const p = latest.current;
    if (!point || walking || p.tool === 'select' || p.tool === 'pan') { draw(); return; }
    if (p.tool === 'furniture') {
      const ghost = furnitureMesh(makeFurniture(p.furnitureKind, p.levelId, point)); ghost.traverse(o => { if (o instanceof THREE.Mesh) { const m = o.material as THREE.MeshStandardMaterial; m.color.set('#9b79de'); m.transparent = true; m.opacity = .35; m.depthWrite = false; o.castShadow = false; } }); preview.add(ghost);
    } else if (p.pending) {
      const a = p.pending, y = p.tool === 'measure' ? point.elevation : .02;
      const points = p.tool === 'room' ? [new THREE.Vector3(a.x, .02, a.y), new THREE.Vector3(point.x, .02, a.y), new THREE.Vector3(point.x, .02, point.y), new THREE.Vector3(a.x, .02, point.y), new THREE.Vector3(a.x, .02, a.y)] : [new THREE.Vector3(a.x, a.elevation + .02, a.y), new THREE.Vector3(point.x, y + .02, point.y)];
      preview.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#956bd4', depthTest: false })));
      const label = textSprite(p.tool === 'room' ? `${dimensionText(Math.abs(point.x - a.x), p.unit)} × ${dimensionText(Math.abs(point.y - a.y), p.unit)}` : dimensionText(distance3(a, point), p.unit)); label.position.set((a.x + point.x) / 2, y + .25, (a.y + point.y) / 2); preview.add(label);
    } else { const dot = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 8), new THREE.MeshBasicMaterial({ color: '#956bd4' })); dot.position.set(point.x, point.elevation + .04, point.y); preview.add(dot); } draw();
  }
  function pointerDown(e: PointerEvent) {
    down = { x: e.clientX, y: e.clientY }; suppressClick = false;
    if (walking && e.button === 0) { look = true; renderer.domElement.setPointerCapture(e.pointerId); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.button !== 0 || latest.current.tool !== 'select' || gizmo.axis || gizmo.dragging) return;
    const object = pick(e); if (object) latest.current.onSelect(objectSelection(object));
    if (object && ['furniture', 'light'].includes(objectSelection(object).kind)) { pointer(e); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -object.position.y), hit = ray.ray.intersectPlane(plane, new THREE.Vector3()); if (hit) { gesture = begin(object, hit.clone().sub(object.position)); orbit.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); e.preventDefault(); e.stopImmediatePropagation(); } }
  }
  function pointerMove(e: PointerEvent) {
    if (walking) { if (look) { yaw -= (e.clientX - down.x) * .004; pitch = Math.max(-Math.PI * .44, Math.min(Math.PI * .44, pitch - (e.clientY - down.y) * .004)); camera.rotation.set(pitch, yaw, 0, 'YXZ'); down = { x: e.clientX, y: e.clientY }; draw(); } return; }
    if (gesture && !gizmo.dragging) { pointer(e); const hit = ray.ray.intersectPlane(gesture.plane, new THREE.Vector3()); if (hit) { const q = snapPoint({ x: hit.x - gesture.offset.x, y: hit.z - gesture.offset.z }, latest.current.snap, latest.current.snapStep); if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 3) gesture.moved = true; if (gesture.moved) { gesture.object.position.x = q.x; gesture.object.position.z = q.y; showReadout(gesture.object); draw(); } } return; }
    if (!gizmo.dragging) previewAt(planePoint(e, latest.current.tool === 'measure'));
  }
  function pointerUp(e: PointerEvent) {
    if (walking) { look = false; return; }
    if (gesture && !gizmo.dragging) { const g = gesture; if (g.moved) finish(g); else { gesture = null; orbit.enabled = true; } return; }
    if (suppressClick || gizmo.dragging || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
    if (latest.current.tool === 'select') { const object = pick(e); latest.current.onSelect(object ? objectSelection(object) : null); }
    else if (latest.current.tool !== 'pan') { const p = planePoint(e, latest.current.tool === 'measure'); if (p) latest.current.onPoint(p); }
  }
  function cancelGesture() { if (gesture) { const g = gesture; g.object.position.copy(g.position); g.object.rotation.copy(g.rotation); g.object.scale.copy(g.scale); gesture = null; } look = false; orbit.enabled = !walking; readout.style.display = 'none'; draw(); }
  function tick(time: number) {
    if (!walking) return; const dt = Math.min(.04, Math.max(0, (time - lastTime) / 1000)); lastTime = time;
    if (document.activeElement?.closest('input,select,textarea') || document.querySelector('.pa-modal-backdrop')) keys.clear();
    let f = Number(keys.has('w') || keys.has('ArrowUp')) - Number(keys.has('s') || keys.has('ArrowDown')), r = Number(keys.has('d') || keys.has('ArrowRight')) - Number(keys.has('a') || keys.has('ArrowLeft')); const norm = Math.hypot(f, r);
    if (norm) { f /= norm; r /= norm; const speed = latest.current.project.environment.walkSpeed * dt * (keys.has('Shift') ? 1.8 : 1); const moved = walkStep(latest.current.project, latest.current.levelId, { x: camera.position.x, y: camera.position.z }, { x: (-Math.sin(yaw) * f + Math.cos(yaw) * r) * speed, y: (-Math.cos(yaw) * f - Math.sin(yaw) * r) * speed }); camera.position.set(moved.x, latest.current.project.environment.eyeHeight, moved.y); draw(); } frameId = requestAnimationFrame(tick);
  }
  function setWalking(enable: boolean) {
    if (walking === enable) return; keys.clear(); look = false; cancelGesture();
    if (enable) { const p = latest.current, start = walkStart(p.project, p.levelId, p.selection?.kind === 'room' ? p.selection.id : undefined); orbitPose = { position: camera.position.clone(), target: orbit.target.clone(), quaternion: camera.quaternion.clone() }; walking = true; orbit.enabled = false; gizmo.detach(); selectedBox.visible = false; camera.fov = 65; camera.position.set(start.x, p.project.environment.eyeHeight, start.y); yaw = 0; pitch = 0; camera.rotation.set(0, 0, 0, 'YXZ'); camera.updateProjectionMatrix(); lastTime = performance.now(); frameId = requestAnimationFrame(tick); }
    else { walking = false; cancelAnimationFrame(frameId); camera.fov = 40; camera.updateProjectionMatrix(); if (orbitPose) { camera.position.copy(orbitPose.position); camera.quaternion.copy(orbitPose.quaternion); orbit.target.copy(orbitPose.target); } orbit.enabled = true; orbit.update(); syncSelection(); } draw();
  }
  function keyDown(e: KeyboardEvent) { if (!walking || (e.target as HTMLElement).closest('input,select,textarea') || document.querySelector('.pa-modal-backdrop')) return; if (e.key === 'Escape') { latest.current.onWalking(false); return; } const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'].includes(k)) { e.preventDefault(); keys.add(k); } }
  const keyUp = (e: KeyboardEvent) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key), blur = () => { keys.clear(); cancelGesture(); };
  function rebuild() {
    cancelGesture(); gizmo.detach(); dispose(model); model.clear(); dispose(annotations); annotations.clear(); objects.clear(); const { project, levelId, cutaway, showDimensions, unit } = latest.current, env = project.environment, b = bounds(project, levelId);
    scene.background = new THREE.Color(env.background); renderer.toneMappingExposure = env.exposure; ambient.intensity = env.ambient; sun.intensity = env.sunIntensity; sun.color.set(env.preset === 'golden' ? '#ffcc93' : '#fff1df');
    const az = env.sunAzimuth * Math.PI / 180, alt = env.sunAltitude * Math.PI / 180, size = Math.max(b.width, b.height, 15), center = new THREE.Vector3(b.x + b.width / 2, 0, b.y + b.height / 2);
    sun.position.copy(center).add(new THREE.Vector3(Math.cos(az) * Math.cos(alt), Math.sin(alt), Math.sin(az) * Math.cos(alt)).multiplyScalar(size * 2)); sun.target.position.copy(center); sun.shadow.camera.left = -size; sun.shadow.camera.right = size; sun.shadow.camera.top = size; sun.shadow.camera.bottom = -size; sun.shadow.camera.far = size * 6; sun.shadow.camera.updateProjectionMatrix();
    const ground = box(model, Math.max(40, b.width + 10), .1, Math.max(40, b.height + 10), center.x, -.2, center.z, '#dfe4e8'); ground.castShadow = false;
    if (!walking) { const grid = new THREE.GridHelper(Math.max(40, Math.ceil(size / 10) * 10), Math.max(40, Math.ceil(size / 10) * 10), '#ccd4dd', '#d6dee5'); grid.position.set(center.x, -.14, center.z); annotations.add(grid); }
    for (const room of project.rooms.filter(r => r.levelId === levelId)) { const floor = box(model, room.width, .12, room.depth, room.x + room.width / 2, -.06, room.y + room.depth / 2, '#ffffff'); const m = floor.material as THREE.MeshStandardMaterial; m.map = floorTexture(room); m.roughness = room.finish === 'tile' ? .4 : .78; floor.userData.selection = { kind: 'room', id: room.id }; objects.set(`room:${room.id}`, floor); if (walking) { const ceiling = box(model, room.width, .05, room.depth, room.x + room.width / 2, room.height + .025, room.y + room.depth / 2, '#f7f4ed'); ceiling.userData.selection = floor.userData.selection; } }
    for (const wall of resolvedWalls(project, levelId)) {
      const length = distance(wall.a, wall.b), height = cutaway && !walking ? Math.min(.85, wall.height) : wall.height, holes = wallOpenings(project, wall), group = new THREE.Group();
      group.position.set(wall.a.x, 0, wall.a.y); group.rotation.y = -Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x); group.userData.selection = { kind: 'wall', id: wall.id }; group.userData.derived = !!wall.roomId; model.add(group); objects.set(`wall:${wall.id}`, group);
      const cuts = [0, length, ...holes.flatMap(o => [o.offset - o.width / 2, o.offset + o.width / 2])].sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) { const a = cuts[i], end = cuts[i + 1]; if (end - a < .00001) continue; const o = holes.find(o => (a + end) / 2 > o.offset - o.width / 2 && (a + end) / 2 < o.offset + o.width / 2); if (!o) box(group, end - a, height, wall.thickness, (a + end) / 2, height / 2, 0, wall.color); else { const bottom = Math.min(o.sill, height), top = Math.min(o.sill + o.height, height); if (bottom > .00001) box(group, end - a, bottom, wall.thickness, (a + end) / 2, bottom / 2, 0, wall.color); if (height - top > .00001) box(group, end - a, height - top, wall.thickness, (a + end) / 2, (height + top) / 2, 0, wall.color); } }
      for (const o of holes) {
        const h = o.kind === 'window' ? o.height : Math.min(o.height, height); const og = new THREE.Group(); og.position.set(o.offset, o.sill, 0); og.userData.selection = { kind: 'opening', id: o.id }; og.userData.door = o.kind === 'door'; og.userData.reverse = o.reversed; og.userData.wallLength = length; group.add(og); objects.set(`opening:${o.id}`, og);
        if (o.kind === 'window') { const pane = box(og, o.width, h, .02, 0, h / 2, 0, '#bad8e1'), m = pane.material as THREE.MeshStandardMaterial; m.transparent = true; m.opacity = .23; m.roughness = .1; pane.castShadow = false; for (const x of [-o.width / 2, 0, o.width / 2]) box(og, .03, h, .05, x, h / 2, 0, '#f2eee5'); }
        else { box(og, o.width, .035, wall.thickness, 0, .02, 0, '#b89a76'); const leaf = new THREE.Group(); leaf.position.x = -o.width / 2; leaf.rotation.y = Math.PI / 3; og.add(leaf); box(leaf, o.width, h, .04, o.width / 2, h / 2, 0, '#d7bd9b'); }
      }
    }
    for (const f of project.furniture.filter(f => f.levelId === levelId)) { const object = furnitureMesh(f); model.add(object); objects.set(`furniture:${f.id}`, object); }
    let shadows = 0; for (const light of project.lights.filter(l => l.levelId === levelId)) { const object = lightMesh(light, shadows < 4); if (light.shadows && light.enabled && light.kind !== 'area') shadows++; model.add(object); objects.set(`light:${light.id}`, object); }
    if (showDimensions && !walking) for (const m of project.measurements.filter(m => m.levelId === levelId)) { const a = new THREE.Vector3(m.a.x, m.a.elevation + .03, m.a.y), end = new THREE.Vector3(m.b.x, m.b.elevation + .03, m.b.y), line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, end]), new THREE.LineBasicMaterial({ color: '#9b79de', depthTest: false })); annotations.add(line); const label = textSprite(dimensionText(distance3(m.a, m.b), unit)); label.position.copy(a.clone().add(end).multiplyScalar(.5)).add(new THREE.Vector3(0, .2, 0)); annotations.add(label); }
    renderer.shadowMap.needsUpdate = true; syncSelection(); draw();
  }
  function capture(width: number, height: number, ao: boolean) {
    const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio(), aspect = camera.aspect, visibility = [helper.visible, selectedBox.visible, annotations.visible, preview.visible]; let composer: EffectComposer | undefined, beauty: RenderPass | undefined, ssao: SSAOPass | undefined, output: OutputPass | undefined;
    try { helper.visible = selectedBox.visible = annotations.visible = preview.visible = false; renderer.setPixelRatio(1); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); if (ao) { composer = new EffectComposer(renderer); beauty = new RenderPass(scene, camera); composer.addPass(beauty); ssao = new SSAOPass(scene, camera, width, height, 16); ssao.kernelRadius = .35; ssao.minDistance = .001; ssao.maxDistance = .08; composer.addPass(ssao); output = new OutputPass(); composer.addPass(output); composer.render(); } else renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); }
    finally { beauty?.dispose(); ssao?.dispose(); output?.dispose(); composer?.dispose(); renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false); camera.aspect = aspect; camera.updateProjectionMatrix(); [helper.visible, selectedBox.visible, annotations.visible, preview.visible] = visibility; draw(); }
  }
  const observer = new ResizeObserver(() => { camera.aspect = element.clientWidth / Math.max(1, element.clientHeight); camera.updateProjectionMatrix(); renderer.setSize(element.clientWidth, element.clientHeight); if (!walking) frame(); else draw(); }); observer.observe(element);
  renderer.domElement.addEventListener('pointerdown', pointerDown, true); renderer.domElement.addEventListener('pointermove', pointerMove); renderer.domElement.addEventListener('pointerup', pointerUp); renderer.domElement.addEventListener('pointercancel', cancelGesture);
  const contextLost = (e: Event) => { e.preventDefault(); latest.current.onError('Se perdió el contexto gráfico. Guarda el proyecto y recarga el editor.'); }; renderer.domElement.addEventListener('webglcontextlost', contextLost); window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', blur); frame();
  return { rebuild, syncSelection, frame, setWalking, capture, walkKey: (key: string, pressed: boolean) => pressed ? keys.add(key) : keys.delete(key), dispose: () => { cancelAnimationFrame(frameId); observer.disconnect(); gizmo.detach(); gizmo.dispose(); orbit.dispose(); renderer.domElement.removeEventListener('pointerdown', pointerDown, true); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('pointercancel', cancelGesture); renderer.domElement.removeEventListener('webglcontextlost', contextLost); window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur); dispose(scene); renderer.dispose(); renderer.domElement.remove(); } };
}
const Scene = forwardRef<SceneHandle, Props>(function Scene(props, ref) {
  const host = useRef<HTMLDivElement>(null), readout = useRef<HTMLDivElement>(null), latest = useRef(props); latest.current = props; const runtime = useRef<ReturnType<typeof createRuntime> | null>(null), [error, setError] = useState('');
  useImperativeHandle(ref, () => ({ capture: (w, h, ao) => { if (!runtime.current) throw Error('Espera a que termine de cargar la vista 3D.'); return runtime.current.capture(w, h, ao); } }), []);
  useEffect(() => { try { runtime.current = createRuntime(host.current!, latest, readout.current!); } catch (e) { setError('Este dispositivo no pudo iniciar la vista 3D. Puedes continuar en 2D.'); props.onError(e); } return () => { runtime.current?.dispose(); runtime.current = null; }; }, []);
  useEffect(() => { try { runtime.current?.setWalking(props.walking); } catch (e) { props.onError(e); props.onWalking(false); } }, [props.walking, props.levelId]);
  useEffect(() => { runtime.current?.rebuild(); if (runtime.current) { document.documentElement.dataset.architectureReady = 'true'; window.dispatchEvent(new Event('prisma-architecture-ready')); } }, [props.project, props.levelId, props.cutaway, props.walking, props.showDimensions, props.unit]);
  useEffect(() => { runtime.current?.syncSelection(); }, [props.selection, props.tool, props.mode, props.snap, props.snapStep]); useEffect(() => { runtime.current?.frame(); }, [props.resetKey, props.levelId]);
  return <div className="pa-scene-shell"><div className="pa-scene" ref={host} aria-label="Vista 3D interactiva"/><div ref={readout} className="pa-live-measure" style={{ display: 'none' }}/>{error && <div className="pa-3d-error" role="alert">{error}</div>}{props.walking ? <div className="pa-walk-controls"><b>Recorrido · {dimensionText(props.project.environment.eyeHeight, props.unit)} de altura</b><span>WASD / flechas para caminar · Arrastra para mirar · Esc para salir</span><div>{[['ArrowLeft', ArrowLeft], ['ArrowUp', ArrowUp], ['ArrowDown', ArrowDown], ['ArrowRight', ArrowRight]].map(([key, Icon]) => { const K = key as string, Component = Icon as typeof ArrowUp; return <button key={K} aria-label={`Caminar ${K}`} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); runtime.current?.walkKey(K, true); }} onPointerUp={() => runtime.current?.walkKey(K, false)} onPointerCancel={() => runtime.current?.walkKey(K, false)}><Component size={19}/></button>; })}<button onClick={() => props.onWalking(false)}>Salir del recorrido</button></div></div> : props.selection && props.tool === 'select' && <div className="pa-transform-toolbar" aria-label="Transformar selección en 3D">{([['translate', Move, 'Mover'], ['rotate', RotateCw, 'Girar'], ['scale', Scaling, 'Escalar']] as const).map(([mode, Icon, label]) => <button key={mode} onClick={() => props.onMode(mode)} aria-label={`${label} en 3D`} aria-pressed={props.mode === mode} className={props.mode === mode ? 'pa-chosen' : ''}><Icon size={16}/><span>{label}</span></button>)}<button aria-label="Eliminar selección en 3D" onClick={props.onDelete}><Trash2 size={16}/></button></div>}</div>;
});
export default Scene;
