import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const deps=path.resolve(process.argv[2]??here),require=createRequire(path.join(deps,'package.json'));
const {build}=await import(pathToFileURL(require.resolve('esbuild')).href);
const output=path.resolve(here,'../../src/architecture/vendor');await fs.mkdir(output,{recursive:true});
await build({stdin:{contents:"export {WebGLPathTracer, GradientEquirectTexture} from 'three-gpu-pathtracer';",resolveDir:deps},bundle:true,format:'esm',target:'es2022',minify:true,external:['three','three/*'],outfile:path.join(output,'pathtracer.js'),legalComments:'eof'});
const bundled=path.join(output,'pathtracer.js');await fs.writeFile(bundled,(await fs.readFile(bundled,'utf8')).replace(/^[ \t]+/gm,indent=>indent.replaceAll('\t','  ')));
for(const [name,file]of [['three-gpu-pathtracer','PATH-TRACER-LICENSE.txt'],['three-mesh-bvh','BVH-LICENSE.txt']]){
  const entry=require.resolve(name),base=entry.slice(0,entry.indexOf(name)+name.length);await fs.copyFile(path.join(base,'LICENSE'),path.join(output,file));
}
console.log('Motor opcional de path tracing generado.');
