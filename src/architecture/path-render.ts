import * as T from 'three';
import type { Environment } from './model';

export type PathOptions={width:number;height:number;samples:number;signal:AbortSignal;progress:(samples:number,total:number)=>void};
const MAX_TRIANGLES=1200000;

// The walking scene stays instanced. Only an explicitly requested still image expands visible instances.
export function pathSnapshot(source:T.Scene){
  source.updateMatrixWorld(true);let triangles=0;
  source.traverseVisible(o=>{if(o instanceof T.Mesh&&o.material){const g=o.geometry;triangles+=(g.index?.count??g.getAttribute('position').count)/3*(o instanceof T.InstancedMesh?o.count:1);}});
  if(triangles>MAX_TRIANGLES)throw Error(`El render físico admite hasta ${MAX_TRIANGLES.toLocaleString('es')} triángulos visibles para controlar la memoria. Oculta objetos o reduce la zona; la vista rápida sigue disponible.`);
  const scene=new T.Scene(),geometries:T.BufferGeometry[]=[],materials:T.Material[]=[],palette=new Map<string,T.MeshStandardMaterial>();
  scene.background=source.background instanceof T.Color?source.background.clone():new T.Color('#d8e2ec');
  function mesh(source:T.Mesh,world:T.Matrix4,tint?:T.Color){
    const input=(Array.isArray(source.material)?source.material[0]:source.material) as T.MeshStandardMaterial;
    if(!input.isMeshStandardMaterial)return;
    let geometry=source.geometry.clone();if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}
    const color=geometry.getAttribute('color'),mask=geometry.getAttribute('tintMask'),surface=geometry.getAttribute('surface');
    if(tint&&color){const values=new Float32Array(color.count*3);for(let i=0;i<color.count;i++){const primary=mask?mask.getX(i):1;values[i*3]=color.getX(i)*(1-primary+primary*tint.r);values[i*3+1]=color.getY(i)*(1-primary+primary*tint.g);values[i*3+2]=color.getZ(i)*(1-primary+primary*tint.b);}geometry.setAttribute('color',new T.BufferAttribute(values,3));}
    let output:T.MeshStandardMaterial|T.MeshStandardMaterial[];
    if(surface){
      output=[];geometry.clearGroups();const groups=new Map<string,number>();let first=0,lastKey='';
      for(let i=0;i<=surface.count;i+=3){const key=i===surface.count?'end':`${surface.getX(i).toFixed(2)}:${surface.getY(i).toFixed(2)}:${surface.getZ(i).toFixed(2)}`;
        if(i&&key!==lastKey)geometry.addGroup(first,i-first,groups.get(lastKey)!);
        if(key===lastKey)continue;first=i;lastKey=key;if(i===surface.count)break;
        if(!groups.has(key)){const paletteKey=input.uuid+':'+key;let m=palette.get(paletteKey);if(!m){m=input.clone();m.onBeforeCompile=()=>{};m.roughness=surface.getX(i);m.metalness=surface.getY(i);if(surface.getZ(i)>.01){m.emissive.set('#9eb9b9');m.emissiveIntensity=.6;}palette.set(paletteKey,m);materials.push(m);}groups.set(key,output.length);output.push(m);}
      }
    }else{output=input.clone();materials.push(output);}
    geometry.deleteAttribute('surface');geometry.deleteAttribute('tintMask');geometry.applyMatrix4(world);geometries.push(geometry);const copy=new T.Mesh(geometry,output);copy.castShadow=source.castShadow;copy.receiveShadow=true;scene.add(copy);
  }
  try{source.traverseVisible(o=>{
    if(o instanceof T.InstancedMesh){for(let i=0;i<o.count;i++){const matrix=new T.Matrix4(),tint=new T.Color('#ffffff');o.getMatrixAt(i,matrix);if(o.instanceColor)o.getColorAt(i,tint);mesh(o,o.matrixWorld.clone().multiply(matrix),tint);}}
    else if(o instanceof T.Mesh)mesh(o,o.matrixWorld);
    else if(o instanceof T.PointLight||o instanceof T.SpotLight||o instanceof T.DirectionalLight||o instanceof T.RectAreaLight){const copy=o.clone();copy.position.copy(o.getWorldPosition(new T.Vector3()));copy.quaternion.copy(o.getWorldQuaternion(new T.Quaternion()));if(copy instanceof T.SpotLight||copy instanceof T.DirectionalLight){const original=o as T.SpotLight|T.DirectionalLight;copy.target=new T.Object3D();copy.target.position.copy(original.target.getWorldPosition(new T.Vector3()));scene.add(copy.target);}scene.add(copy);}
  });}catch(e){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());throw e;}
  return {scene,triangles,dispose(){geometries.forEach(g=>g.dispose());new Set(materials).forEach(m=>m.dispose());scene.clear();}};
}

export async function renderPathImage(source:T.Scene,camera:T.PerspectiveCamera,environment:Environment,options:PathOptions,sharedRenderer?:T.WebGLRenderer){
  if(options.width>1920||options.height>1080||options.width<1||options.height<1)throw Error('El render físico admite hasta Full HD.');
  const check=()=>{if(options.signal.aborted)throw new DOMException('Render cancelado','AbortError');};check();
  const {WebGLPathTracer,GradientEquirectTexture}=await import('./vendor/pathtracer.js');check();
  const snapshot=pathSnapshot(source),sky=new GradientEquirectTexture(128);let renderer:T.WebGLRenderer|undefined,tracer:InstanceType<typeof WebGLPathTracer>|undefined;
  try{
    renderer=sharedRenderer??new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
    if(!renderer.extensions.has('EXT_color_buffer_float'))throw Error('La tarjeta no admite el render físico. Usa el render rápido.');
    renderer.setPixelRatio(1);renderer.setSize(options.width,options.height,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=environment.exposure*.55;
    sky.topColor.set(environment.preset==='night'?'#26344d':'#c9d8ec');sky.bottomColor.set('#9b9386');sky.update();snapshot.scene.environment=sky;snapshot.scene.environmentIntensity=environment.ambient*.22;
    const pose=camera.clone();pose.aspect=options.width/options.height;pose.updateProjectionMatrix();
    tracer=new WebGLPathTracer(renderer);tracer.textureSize.set(256,256);tracer.tiles.set(3,3);tracer.bounces=4;tracer.transmissiveBounces=4;tracer.filterGlossyFactor=.5;tracer.dynamicLowRes=false;tracer.rasterizeScene=false;tracer.renderDelay=0;tracer.minSamples=1;tracer.fadeDuration=0;tracer.setScene(snapshot.scene,pose);
    const start=performance.now(),total=Math.max(1,Math.min(128,Math.round(options.samples)));let reported=-1;
    while(tracer.samples<total){check();if(performance.now()-start>240000)throw Error('El render físico excedió cuatro minutos. Prueba menos muestras o una resolución menor.');tracer.renderSample();const sample=Math.min(total,Math.floor(tracer.samples));if(sample!==reported){reported=sample;options.progress(sample,total);}await new Promise<void>(resolve=>setTimeout(resolve,0));}
    // The editor canvas does not preserve its back buffer across tasks. Draw once more and read it synchronously.
    check();tracer.renderSample();return renderer.domElement.toDataURL('image/png');
  }finally{tracer?.dispose();sky.dispose();snapshot.dispose();if(!sharedRenderer){renderer?.dispose();renderer?.forceContextLoss();}}
}
