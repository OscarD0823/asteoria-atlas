import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type { Furniture, Room, SceneLight } from './model';
RectAreaLightUniformsLib.init();
export function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, color: string, rounded = false) {
  w = Math.max(.001, w); h = Math.max(.001, h); d = Math.max(.001, d);
  const geometry = rounded ? new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * .12) : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .78 }));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function furnitureMesh(f: Furniture) {
  const group = new THREE.Group(), w = f.width, d = f.depth, h = f.height;
  const part = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) => box(group, w, h, d, x, y, z, color, true);
  const legs = (top: number) => { for (const x of [-w * .4, w * .4]) for (const z of [-d * .35, d * .35]) part(.045, top, .045, x, top / 2, z, '#76604e'); };
  if (f.kind === 'plant') {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(w * .3, w * .22, h * .32, 20), new THREE.MeshStandardMaterial({ color: '#bc9879', roughness: .8 }));
    pot.position.y = h * .16; pot.castShadow = true; group.add(pot);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: i % 2 ? '#608350' : f.color, roughness: .7 }));
      leaf.scale.set(w * .24, h * .23, d * .24); leaf.position.set(Math.sin(i * 2.4) * w * .2, h * (.55 + .03 * i), Math.cos(i * 2.4) * d * .2); leaf.castShadow = true; group.add(leaf);
    }
  } else if (f.kind === 'bed') {
    part(w, h * .25, d, 0, h * .13, 0, '#ab9176');
    part(w * .96, h * .19, d * .94, 0, h * .35, .01, '#f7f2ea');
    part(w * .97, h * .05, d * .64, 0, h * .46, d * .13, f.color);
    part(w, h, .07, 0, h * .5, -d / 2 + .035, f.color);
    for (const x of [-w * .24, w * .24]) part(w * .42, h * .1, d * .2, x, h * .49, -d * .32, '#faf8f3');
  } else if (f.kind === 'sofa' || f.kind === 'armchair') {
    legs(h * .18); part(w, h * .33, d, 0, h * .33, 0, f.color);
    part(w, h * .6, d * .18, 0, h * .7, -d * .41, f.color);
    for (const x of [-w * .46, w * .46]) part(w * .09, h * .57, d, x, h * .5, 0, f.color);
    const count = f.kind === 'sofa' ? 3 : 1;
    for (let i = 0; i < count; i++) part(w * .81 / count - .02, h * .15, d * .72, -w * .405 + w * .81 / count * (i + .5), h * .56, d * .05, f.color);
  } else if (['table', 'desk', 'coffee'].includes(f.kind)) {
    legs(h - .06); part(w, .06, d, 0, h - .03, 0, f.color);
    if (f.kind === 'desk') part(w * .28, h * .22, d * .8, w * .3, h * .81, 0, f.color);
  } else if (f.kind === 'chair') {
    legs(h * .5); part(w, .055, d, 0, h * .52, 0, f.color); part(w, h * .44, .065, 0, h * .78, -d * .43, f.color);
  } else {
    part(w, h, d, 0, h / 2, 0, f.color);
    if (f.kind === 'counter') part(w, .04, d, 0, h - .02, 0, '#e9e5db');
    for (let i = 0; i < 2; i++) part(.022, .12, .018, (i ? 1 : -1) * w * .05, h * .55, d / 2, '#747675');
  }
  group.position.set(f.x, f.elevation, f.y); group.rotation.y = -f.rotation * Math.PI / 180;
  group.userData.selection = { kind: 'furniture', id: f.id }; group.userData.dimensions = { width: w, height: h, depth: d }; return group;
}
export function floorTexture(room: Room) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const color = new THREE.Color(room.color);
  if (room.finish === 'wood') color.lerp(new THREE.Color('#c9a77f'), .4);
  ctx.fillStyle = '#' + color.getHexString(); ctx.fillRect(0, 0, 512, 512);
  if (room.finish === 'wood') {
    for (let row = 0; row < 8; row++) {
      ctx.fillStyle = row % 3 === 0 ? '#ffffff16' : '#61472f0d'; ctx.fillRect(0, row * 64, 512, 64);
      ctx.strokeStyle = '#62482d33'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(0, row * 64); ctx.lineTo(512, row * 64); ctx.moveTo(row % 2 ? 128 : 384, row * 64); ctx.lineTo(row % 2 ? 128 : 384, (row + 1) * 64); ctx.stroke();
      ctx.strokeStyle = '#70543a12'; ctx.lineWidth = 1;
      for (let line = 0; line < 8; line++) { ctx.beginPath(); for (let x = 0; x <= 512; x += 8) { const y = row * 64 + line * 8 + Math.sin(x / 38 + row) * 2; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
    }
  } else if (room.finish === 'tile') {
    ctx.strokeStyle = '#ffffff90'; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 512); ctx.moveTo(0, i * 128); ctx.lineTo(512, i * 128); ctx.stroke(); }
  } else {
    for (let i = 0; i < 1800; i++) { ctx.fillStyle = i % 2 ? '#ffffff0c' : '#5259630c'; ctx.fillRect((i * 73) % 512, (i * 137) % 512, 2, 2); }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(room.width / 2, room.depth / 2); texture.anisotropy = 8; return texture;
}
export function lightMesh(data: SceneLight, shadowsAllowed: boolean) {
  const group = new THREE.Group(); group.position.set(data.x, data.elevation, data.y); group.userData.selection = { kind: 'light', id: data.id };
  const target = new THREE.Vector3(data.target.x - data.x, data.target.elevation - data.elevation, data.target.y - data.y);
  let light: THREE.PointLight | THREE.SpotLight | THREE.RectAreaLight;
  if (data.kind === 'area') {
    light = new THREE.RectAreaLight(data.color, 1, data.width, data.depth); light.lookAt(target); light.power = data.enabled ? data.power : 0;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(data.width, data.depth), new THREE.MeshStandardMaterial({ color: '#fff9ed', emissive: data.color, emissiveIntensity: data.enabled ? .8 : 0, side: THREE.DoubleSide, roughness: .35 }));
    panel.quaternion.copy(light.quaternion); group.add(panel);
  } else {
    light = data.kind === 'spot' ? new THREE.SpotLight(data.color, 1, 0, data.angle * Math.PI / 180, .35, 2) : new THREE.PointLight(data.color, 1, 0, 2);
    light.power = data.enabled ? data.power : 0; light.castShadow = data.enabled && data.shadows && shadowsAllowed; light.shadow.mapSize.set(512, 512); light.shadow.normalBias = .015; light.shadow.bias = -.0001;
    if (light instanceof THREE.SpotLight) { light.target.position.copy(target); group.add(light.target); }
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.06, 16, 12), new THREE.MeshStandardMaterial({ color: '#fff5df', emissive: data.color, emissiveIntensity: data.enabled ? 1.3 : 0, roughness: .2 })); group.add(bulb);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.12, .07, .08, 24), new THREE.MeshStandardMaterial({ color: '#ece5d7', metalness: .3, roughness: .4 })); rim.position.y = .09; group.add(rim);
  }
  group.add(light); return group;
}
export function textSprite(text: string) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 112;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ffffffee'; ctx.beginPath(); ctx.roundRect(5, 5, 502, 102, 20); ctx.fill(); ctx.font = '500 43px Segoe UI, sans-serif'; ctx.fillStyle = '#655185'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 56);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false })); sprite.scale.set(1.3, .28, 1); return sprite;
}
export function dispose(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(o => {
    if (o instanceof THREE.PointLight || o instanceof THREE.SpotLight || o instanceof THREE.DirectionalLight) o.shadow.dispose();
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Line || o instanceof THREE.Sprite) {
      if ('geometry' in o) geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) { materials.add(m); for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value); }
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}
