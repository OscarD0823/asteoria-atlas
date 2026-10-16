import type {Scene,Camera,WebGLRenderer,WebGLRenderTarget,Vector2,DataTexture,Color} from 'three';
export class WebGLPathTracer {
 constructor(renderer:WebGLRenderer);
 bounces:number;transmissiveBounces:number;filterGlossyFactor:number;renderDelay:number;minSamples:number;fadeDuration:number;renderScale:number;rasterizeScene:boolean;renderToCanvas:boolean;dynamicLowRes:boolean;
 textureSize:Vector2;tiles:Vector2;readonly samples:number;readonly isCompiling:boolean;readonly target:WebGLRenderTarget;
 setScene(scene:Scene,camera:Camera):void;renderSample():void;dispose():void;
}
export class GradientEquirectTexture extends DataTexture {constructor(size?:number);topColor:Color;bottomColor:Color;update():void;}
