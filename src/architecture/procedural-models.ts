import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Furniture } from './model';
// A small primitive pool serves the complete local catalog. Detail is merged once per model.
export function modelFactory(){
 const shapes={box:new T.BoxGeometry(1,1,1),soft:new RoundedBoxGeometry(1,1,1,2,.075),sphere:new T.SphereGeometry(.5,16,10),cylinder:new T.CylinderGeometry(.5,.5,1,16),cone:new T.ConeGeometry(.5,1,12),torus:new T.TorusGeometry(.42,.08,6,16)},materials=new Map<string,T.MeshStandardMaterial>();
 const material=(color:string,metal=0,rough=.65)=>{const key=`${color}:${metal}:${rough}`;let m=materials.get(key);if(!m){m=new T.MeshStandardMaterial({color,metalness:metal,roughness:rough});materials.set(key,m);}return m;};
 function create(f:Furniture){
  const g=new T.Group(),w=f.width,d=f.depth,h=f.height,k=f.kind,c=f.color,wood='#a98761',dark='#272d34',white='#f1eee7',glass='#9cbcc6',chrome='#a3aab0',fabric=c;
  function part(type:keyof typeof shapes,ww:number,hh:number,dd:number,x:number,y:number,z:number,color=c,metal=0,rough=.65,rx=0,ry=0,rz=0){const m=new T.Mesh(shapes[type],material(color,metal,rough));m.scale.set(Math.max(.002,ww),Math.max(.002,hh),Math.max(.002,dd));m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
  const b=(ww:number,hh:number,dd:number,x:number,y:number,z:number,color=c,soft=false,metal=0,rough=.65)=>part(soft?'soft':'box',ww,hh,dd,x,y,z,color,metal,rough);
  const s=(ww:number,hh:number,dd:number,x:number,y:number,z:number,color=c)=>part('sphere',ww,hh,dd,x,y,z,color);
  const cy=(ww:number,hh:number,dd:number,x:number,y:number,z:number,color=c,rx=0,rz=0)=>part('cylinder',ww,hh,dd,x,y,z,color,.08,.52,rx,0,rz);
  const ring=(ww:number,hh:number,dd:number,x:number,y:number,z:number,color=dark,ry=0)=>part('torus',ww,hh,dd,x,y,z,color,.1,.55,0,ry,0);
  const legs=(height:number)=>{for(const x of [-w*.4,w*.4])for(const z of [-d*.35,d*.35])b(Math.min(w*.04,.055),height,Math.min(d*.05,.055),x,height/2,z,wood,true);};
  const cushions=(ww:number,dd:number,y:number,z:number,count=3)=>{for(let i=0;i<count;i++){b(ww/count*.965,h*.16,dd,-ww/2+ww/count*(i+.5),y,z,fabric,true,0,k==='sofa-leather'?.4:.85);b(ww/count*.965,h*.28,dd*.2,-ww/2+ww/count*(i+.5),y+h*.26,z-dd*.44,fabric,true);}};
  const doorPanels=(count=2)=>{for(let i=0;i<count;i++){const x=-w/2+w/count*(i+.5);b(w/count*.965,h*.88,.025,x,h*.5,d/2+.006,c,true);b(.015,h*.065,.035,x+w/count*.32,h*.52,d/2+.035,chrome,true,1,.24);}};
  const tv=(ww:number,hh:number,dd:number,x:number,y:number,z:number)=>{b(ww,hh,dd,x,y,z,dark,true,.1,.4);b(ww*.94,hh*.9,.012,x,y,z+dd/2+.005,'#233c4e',false,.3,.18);b(ww*.82,hh*.04,.015,x,y+hh*.23,z+dd/2+.013,'#557b82');b(ww*.57,hh*.02,.015,x-ww*.13,y-hh*.24,z+dd/2+.014,'#79929e');};
  const speaker=(ww:number,hh:number,dd:number,x:number,y:number,z:number)=>{b(ww,hh,dd,x,y,z,dark,true);for(const yy of [y-hh*.22,y+hh*.2]){ring(ww*.7,ww*.7,ww*.12,x,yy,z+dd/2,'#515760');cy(ww*.46,.012,ww*.46,x,yy,z+dd/2+.01,dark,Math.PI/2);}};
  const bed=(ww:number,dd:number,y:number,height:number)=>{b(ww,height*.32,dd,0,y+height*.17,0,wood,true);b(ww*.97,height*.24,dd*.97,0,y+height*.45,0,white,true);b(ww*.97,height*.09,dd*.64,0,y+height*.61,dd*.15,c,true);for(const x of [-ww*.24,ww*.24])b(ww*.42,height*.13,dd*.19,x,y+height*.65,-dd*.34,white,true);};
  const wheel=(x:number,y:number,z:number,r:number)=>{cy(r*2,.13,r*2,x,y,z,dark,0,Math.PI/2);ring(r*1.45,r*1.45,.08,x+.071*Math.sign(x),y,z,chrome,Math.PI/2);cy(r*.7,.145,r*.7,x,y,z,chrome,0,Math.PI/2);};
  if(['sofa','sofa-l','sofa-leather','armchair','recliner'].includes(k)){
   legs(h*.16);b(w,h*.29,d,0,h*.29,0,c,true);b(w,h*.6,d*.14,0,h*.68,-d*.43,c,true);
   for(const x of [-w*.46,w*.46])b(w*.09,h*.55,d*.93,x,h*.48,0,c,true);
   cushions(w*.81,k==='sofa-l'?d*.41:d*.71,h*.48,k==='sofa-l'?-d*.18:d*.045,k==='armchair'||k==='recliner'?1:3);
   if(k==='sofa-l'){b(w*.36,h*.39,d*.56,-w*.25,h*.35,d*.21,c,true);b(w*.33,h*.16,d*.5,-w*.25,h*.54,d*.21,c,true);}
   if(k==='recliner')b(w*.7,h*.12,d*.3,0,h*.25,d*.48,c,true);
  }else if(['bed','bed-single','bed-king','bunk-bed'].includes(k)){
   if(k==='bunk-bed'){bed(w,d,0,h*.27);bed(w,d,h*.62,h*.27);for(const x of [-w*.47,w*.47])for(const z of [-d*.47,d*.47])b(.05,h,.05,x,h/2,z,wood);for(let i=0;i<6;i++)b(w*.35,.03,.04,w*.25,h*.13+i*h*.12,d*.49,wood);b(w*.98,.1,.04,0,h*.91,d*.47,wood);}else{bed(w,d,0,h);b(w,h,.08,0,h/2,-d*.49,c,true);for(let i=0;i<5;i++)b(w*.15,h*.7,.024,-w*.4+i*w*.2,h*.6,-d*.455,c,true);}
  }else if(['table','desk','coffee','side-table','table-round','stool','bench','lounge'].includes(k)){
   if(k==='table-round'||k==='stool'){cy(w,h*.07,d,0,h*.965,0);cy(w*.12,h*.84,w*.12,0,h*.46,0,wood);cy(w*.5,h*.05,w*.5,0,h*.025,0,wood);}else if(k==='lounge'){legs(h*.35);b(w,h*.18,d*.75,0,h*.3,d*.1,c,true);const back=b(w,h*.15,d*.32,0,h*.58,-d*.33,c,true);back.rotation.x=-.55;}else{legs(h*.88);b(w,h*.08,d,0,h*.96,0,c,true);if(k==='desk')b(w*.3,h*.3,d*.85,w*.3,h*.76,0,c,true);if(k==='bench')b(w,h*.43,.06,0,h*.73,-d*.45,c,true);}
  }else if(['chair','office-chair'].includes(k)){
   if(k==='office-chair'){cy(.09,h*.42,.09,0,h*.22,0,chrome);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const leg=b(w*.44,.03,.035,Math.cos(a)*w*.2,.06,Math.sin(a)*d*.2,dark);leg.rotation.y=-a;s(.06,.06,.06,Math.cos(a)*w*.42,.035,Math.sin(a)*d*.42,dark);}b(w*.76,h*.1,d*.75,0,h*.46,0,c,true);b(w*.74,h*.46,.08,0,h*.75,-d*.34,c,true);for(const x of [-w*.43,w*.43])b(.04,.04,d*.45,x,h*.57,0,dark,true);}else{legs(h*.5);b(w,h*.06,d,0,h*.52,0,c,true);b(w,h*.43,.065,0,h*.79,-d*.44,c,true);}
  }else if(['cabinet','dresser','nightstand','counter','island','vanity','sink'].includes(k)){
   b(w*.98,h*.9,d*.98,0,h*.45,0,c,true);b(w,.04,d,0,h-.02,0,['counter','island','vanity','sink'].includes(k)?'#eee8de':c,true);doorPanels(k==='nightstand'?1:Math.max(2,Math.round(w/.6)));
   if(k==='vanity'||k==='sink'){s(w*.67,.06,d*.7,0,h-.012,0,chrome);ring(w*.64,d*.69,.015,0,h+.012,0,white).rotation.x=Math.PI/2;cy(.035,.21,.035,w*.3,h+.085,-d*.27,chrome);b(.15,.025,.035,w*.235,h+.185,-d*.27,chrome,true,1);}
   if(k==='counter'){for(const x of [-w*.25,-w*.12])for(const z of [-d*.22,d*.22])cy(d*.25,.02,d*.25,x,h+.008,z,dark);}
  }else if(k==='shelf'){for(const x of [-w*.48,w*.48])b(w*.04,h,d,x,h/2,0);for(let j=0;j<6;j++){b(w,.035,d,0,j*h/5,0);if(j<5)for(let i=0;i<5;i++)b(w*.08,h*.14,d*.65,-w*.37+i*w*.15,j*h/5+h*.085,-d*.05,['#74868c','#b09b79','#93879b'][i%3],true);}}
  else if(['tv','tv-large','screen','cinema','speaker','soundbar','projector','computer'].includes(k)){
   if(k==='cinema'){tv(w*.64,h*.66,.06,0,h*.61,-d*.05);b(w*.48,h*.18,d*.7,0,h*.09,0,c,true);for(const x of [-w*.43,w*.43])speaker(w*.14,h*.75,d*.8,x,h*.375,0);speaker(w*.21,h*.3,d*.65,0,h*.15,d*.15);}
   else if(k==='speaker'||k==='soundbar')speaker(w,h,d,0,h/2,0);
   else if(k==='projector'){b(w,h,d,0,h/2,0,c,true);ring(w*.3,w*.3,.03,w*.21,h*.55,d*.51,chrome);cy(w*.23,.02,w*.23,w*.21,h*.55,d*.52,dark,Math.PI/2);}
   else{tv(w,k==='computer'?h*.78:h*.85,k==='screen'?.035:Math.min(.065,d*.24),0,h*.56,-d*.15);b(w*.35,.025,d*.75,0,.025,d*.1,dark,true);b(.045,h*.23,.045,0,h*.13,-d*.15,chrome);if(k==='computer')b(w*.75,.025,d*.4,0,.04,d*.31,dark,true);}
  }else if(['fridge','fridge-small','oven','microwave','dishwasher','washer','dryer','hood','coffee-machine','toaster','air-conditioner','radiator'].includes(k)){
   if(k!=='hood')b(w,h,d,0,h/2,0,c,true,.35,.35);
   if(k==='fridge'||k==='fridge-small'){doorPanels(k==='fridge'?2:1);b(w*.96,.012,.016,0,h*.27,d*.515,dark);}
   if(k==='washer'||k==='dryer'){ring(w*.64,w*.64,w*.085,0,h*.46,d*.52,chrome);cy(w*.48,.018,w*.48,0,h*.46,d*.54,'#314651',Math.PI/2);b(w*.42,h*.055,.025,-w*.22,h*.87,d*.515,dark,true);}
   if(['oven','microwave','dishwasher'].includes(k)){b(w*.89,h*.65,.025,0,h*.43,d*.51,dark,true,.1,.22);b(w*.82,.025,.04,0,h*.8,d*.55,chrome,true,1);for(let i=0;i<4;i++)cy(w*.055,.025,w*.055,-w*.34+i*w*.22,h*.91,d*.525,dark,Math.PI/2);if(k==='oven')for(const x of [-w*.25,w*.25])for(const z of [-d*.25,d*.25])cy(w*.3,.018,w*.3,x,h+.004,z,dark);}
   if(k==='hood'){b(w,h*.12,d,0,h*.12,0,chrome,true,.6);b(w*.32,h*.8,d*.4,0,h*.58,-d*.2,chrome,false,.5);}
   if(k==='coffee-machine'){b(w*.7,h*.5,.035,0,h*.37,d*.51,dark,true);cy(w*.3,h*.2,w*.3,0,h*.18,d*.54,white);}
   if(k==='toaster')for(const x of [-w*.2,w*.2])b(w*.075,.012,d*.65,x,h+.003,0,dark,true);
   if(k==='air-conditioner'||k==='radiator')for(let i=0;i<8;i++)b(w*.92,.014,.02,0,h*.17+i*h*.075,d*.52,'#b3b9ba');
  }else if(['toilet','bathtub','shower','mirror'].includes(k)){
   if(k==='toilet'){s(w*.95,h*.46,d*.75,0,h*.37,d*.13,white);cy(w*.57,h*.4,w*.54,0,h*.2,d*.02,white);b(w*.83,h*.48,d*.28,0,h*.7,-d*.35,white,true);ring(w*.93,d*.65,.045,0,h*.6,d*.15,white).rotation.x=Math.PI/2;}
   if(k==='bathtub'){b(w,h,d,0,h/2,0,white,true);b(w*.91,.025,d*.8,0,h*.91,0,glass,true,.1,.12);for(const x of [-w*.47,w*.47])b(w*.055,.055,d,x,h*.97,0,white,true);for(const z of [-d*.47,d*.47])b(w,.055,d*.055,0,h*.97,z,white,true);}
   if(k==='shower'){b(w,.08,d,0,.04,0,white,true);for(const x of [-w*.48,w*.48])for(const z of [-d*.48,d*.48])b(.025,h,.025,x,h/2,z,chrome);b(w*.94,h*.93,.016,0,h*.5,-d*.48,glass,false,.35,.13);b(.016,h*.93,d*.94,-w*.48,h*.5,0,glass,false,.35,.13);cy(.025,h*.5,.025,w*.37,h*.65,-d*.35,chrome);cy(.18,.025,.18,w*.28,h*.93,-d*.35,chrome);}
   if(k==='mirror'){b(w,h,d,0,h/2,0,wood,true);b(w*.94,h*.94,.01,0,h/2,d*.55,glass,false,.8,.1);}
  }else if(['plant','tree','pine','palm','hedge'].includes(k)){
   if(k==='hedge')b(w,h,d,0,h/2,0,c,true);
   else if(k==='plant'){cy(w*.65,h*.29,d*.65,0,h*.145,0,'#b69578');for(let i=0;i<9;i++){const a=i*2.4;s(w*.48,h*.4,d*.48,Math.sin(a)*w*.22,h*(.45+i*.035),Math.cos(a)*d*.22,i%2?c:'#688353');}}
   else{cy(w*.085,h*.7,d*.085,0,h*.35,0,wood);if(k==='pine')for(let i=0;i<4;i++)part('cone',w*(1-i*.19),h*.34,d*(1-i*.19),0,h*(.32+i*.15),0,c);else if(k==='palm')for(let i=0;i<9;i++){const a=i*Math.PI*2/9;const leaf=s(w*.58,h*.04,d*.16,Math.cos(a)*w*.22,h*.94,Math.sin(a)*d*.22,c);leaf.rotation.y=-a;leaf.rotation.z=Math.cos(a)*.18;}else for(let i=0;i<7;i++){const a=i*2.4;s(w*.7,h*.38,d*.7,Math.sin(a)*w*.2,h*(.63+i*.025),Math.cos(a)*d*.2,i%2?c:'#607a55');}}
  }else if(['car','suv','pickup','van','truck'].includes(k)){
   const isTruck=k==='truck',long=k==='van'||isTruck;const r=h*(long?.12:.19),bodyBottom=r*.65;
   b(w*.94,h*(long?.56:.42),d*.94,0,bodyBottom+h*(long?.28:.21),0,c,true,.55,.3);
   if(isTruck)b(w*.96,h*.64,d*.6,0,h*.68,-d*.14,'#d4d5cf',true,.3,.45);
   else{b(w*.78,h*.43,d*(k==='pickup'?.35:long?.85:.54),0,h*.75,k==='pickup'?d*.12:-d*.02,c,true,.55,.3);b(w*.76,h*.3,.035,0,h*.78,d*(long?.42:.27),glass,true,.5,.12);for(const x of [-w*.405,w*.405])b(.025,h*.31,d*(long?.6:.41),x,h*.78,-d*.02,glass,true,.5,.12);}
   if(k==='pickup'){b(w*.75,.03,d*.25,0,h*.62,-d*.3,dark);}
   for(const x of [-w*.49,w*.49])for(const z of [-d*.31,d*.31])wheel(x,r,z,r);
   for(const x of [-w*.34,w*.34]){b(w*.22,h*.06,.03,x,h*.32,d*.477,'#eee6be',true);b(w*.16,h*.055,.03,x,h*.36,-d*.477,'#9c4a42',true);b(w*.1,h*.075,d*.09,x*1.35,h*.65,d*.19,c,true);}
   b(w*.75,h*.035,.04,0,h*.19,d*.49,chrome,true,.7);b(w*.38,h*.13,.035,0,h*.34,d*.49,dark,true);
  }else if(['motorcycle','bicycle','scooter'].includes(k)){
   const r=h*.3;for(const z of [-d*.36,d*.36]){ring(r*2,r*2,w*.2,0,r,z,dark,Math.PI/2);cy(r*1.1,w*.21,r*1.1,0,r,z,chrome,0,Math.PI/2);}
   b(w*.45,h*.13,d*.5,0,h*.62,-d*.13,dark,true);s(w*.7,h*.3,d*.36,0,h*.63,d*.08,c);const fork=b(.045,h*.63,.045,0,h*.49,d*.3,chrome);fork.rotation.x=-.2;b(w*.9,.035,.06,0,h*.94,d*.26,dark,true);b(.09,h*.38,.09,0,h*.5,-d*.1,chrome);cy(w*.26,.035,w*.26,0,h*.76,d*.42,'#f0e0ba',Math.PI/2);
  }else if(['boat','sailboat','jetski','kayak'].includes(k)){
   s(w,h*(k==='sailboat'?.12:.6),d,0,h*(k==='sailboat'?.08:.3),0,c);b(w*.68,.03,d*.63,0,h*(k==='sailboat'?.1:.57),0,white,true);if(k==='sailboat'){cy(.06,h*.87,.06,0,h*.55,0,chrome);const sail=b(w*.65,h*.65,.016,w*.23,h*.58,-d*.04,white);sail.rotation.z=-.12;}else if(k==='boat'){tv(w*.58,h*.35,.03,0,h*.73,d*.13);b(w*.8,.04,d*.45,0,h*.97,-d*.06,white,true);}else b(w*.49,h*.1,d*.47,0,h*.65,-d*.1,dark,true);
  }else if(['plane','helicopter','drone'].includes(k)){
   if(k==='plane'){s(w*.12,h*.6,d,0,h*.47,0,c);b(w,.05,d*.2,0,h*.43,-d*.04,c,true);b(w*.32,.04,d*.1,0,h*.56,-d*.43,c,true);b(.04,h*.55,d*.14,0,h*.73,-d*.42,c,true);s(w*.095,h*.33,d*.26,0,h*.62,d*.12,glass);for(const x of [-w*.08,w*.08])wheel(x,h*.12,d*.07,h*.1);b(w*.12,h*.6,.018,0,h*.43,d*.49,dark,true);}
   else if(k==='helicopter'){s(w*.22,h*.63,d*.5,0,h*.45,d*.2,c);s(w*.19,h*.4,d*.25,0,h*.56,d*.33,glass);b(w*.045,h*.075,d*.58,0,h*.42,-d*.23,c,true);cy(.07,h*.32,.07,0,h*.8,d*.1,chrome);b(w,.025,d*.035,0,h*.98,d*.1,dark,true);b(w*.04,.025,d*.88,0,h*.98,d*.1,dark,true);for(const x of [-w*.12,w*.12])b(.05,.05,d*.52,x,h*.07,d*.15,chrome,true);}
   else{b(w*.3,h*.5,d*.3,0,h*.4,0,c,true);for(const x of [-w*.4,w*.4])for(const z of [-d*.4,d*.4]){const arm=b(w*.56,.015,.03,x*.5,h*.4,z*.5,c,true);arm.rotation.y=x*z>0?-.785:.785;cy(w*.25,.015,d*.25,x,h*.75,z,dark);}}
  }else if(['pool','pool-round','hot-tub'].includes(k)){
   if(k==='pool-round'){cy(w,h,d,0,h/2,0,'#c2c8c4');cy(w*.92,.02,d*.92,0,h*.9,0,c);ring(w*.99,d*.99,.06,0,h*.99,0,white).rotation.x=Math.PI/2;}
   else{b(w,h,d,0,h/2,0,k==='hot-tub'?wood:'#c5c0af',true);b(w*.92,.025,d*.88,0,h*.85,0,c,true,.3,.14);for(const x of [-w*.475,w*.475])b(w*.05,h*.12,d,x,h*.95,0,white,true);for(const z of [-d*.475,d*.475])b(w,h*.12,d*.05,0,h*.95,z,white,true);for(let i=0;i<5;i++)b(w*.8,.008,.012,0,h*.875,-d*.28+i*d*.13,'#b4e0e4');}
  }else if(['floor-lamp','pendant','wall-lamp','spot-fixture','led-strip'].includes(k)){
   if(k==='floor-lamp'){cy(w*.7,.035,d*.7,0,.018,0,chrome);cy(.025,h*.8,.025,0,h*.42,0,chrome);part('cone',w,h*.25,d,0,h*.87,0,c);cy(w*.75,.008,d*.75,0,h*.745,0,'#f5ddb0');}else if(k==='pendant'){cy(.014,h*.53,.014,0,h*.72,0,chrome);part('cone',w,h*.44,d,0,h*.23,0,c);cy(w*.76,.014,d*.76,0,h*.065,0,'#f6e3bd');}else{b(w,h,d,0,h/2,0,c,true);b(w*.86,h*.68,.005,0,h/2,d*.51,'#f5e4ba',true);}
  }else if(k==='stairs'){for(let i=0;i<14;i++)b(w,h*(i+1)/14,d/14,0,h*(i+1)/28,-d/2+d/14*(i+.5),c);for(const x of [-w*.48,w*.48]){const rail=b(.035,Math.hypot(d,h),.035,x,h*.64,0,chrome);rail.rotation.x=-Math.atan2(d,h);}}
  else if(k==='column')cy(w,h,d,0,h/2,0,c);
  else if(k==='roof'){for(const x of [-w*.25,w*.25]){const side=b(Math.hypot(w*.5,h),.06,d,x,h*.5,0,c);side.rotation.z=x>0?-.45:.45;}}
  else if(k==='fence'||k==='gate'){for(const x of [-w*.47,w*.47])b(.07,h,.07,x,h/2,0,c);for(let i=0;i<12;i++)b(.035,h*.92,d,-w*.44+i*w*.08,h*.46,0,c,true);b(w,.04,d,0,h*.25,0,c);b(w,.04,d,0,h*.78,0,c);}
  else if(k==='gazebo'){for(const x of [-w*.45,w*.45])for(const z of [-d*.45,d*.45])b(.1,h,.1,x,h/2,z);for(let i=0;i<10;i++)b(.07,.07,d,-w*.45+i*w*.1,h,0);}
  else if(k==='umbrella'){cy(.03,h,.03,0,h/2,0,chrome);part('cone',w,h*.2,d,0,h*.9,0,c);cy(w*.15,.04,d*.15,0,.02,0,chrome);}
  else if(k==='rug'){b(w,h,d,0,h/2,0,c,true);for(const z of [-d*.46,d*.46])b(w*.93,.001,d*.035,0,h+.002,z,'#e1d4c3');}
  else if(k==='curtain'){for(let i=0;i<16;i++)b(w*.065,h,d, -w*.47+i*w*.063,h/2,0,c,true);b(w*1.06,.025,.025,0,h+.01,0,chrome);}
  else if(k==='rock')s(w,h,d,0,h/2,0,c);
  else if(k==='grill'){legs(h*.55);b(w,h*.43,d,0,h*.77,0,c,true,.45);b(w*.8,.025,d*.8,0,h*.6,0,dark);for(let i=0;i<9;i++)b(.014,.015,d*.7,-w*.34+i*w*.085,h*.64,0,chrome);}
  else if(k==='swing'){for(const x of [-w*.43,w*.43])b(.06,h,.06,x,h/2,0,c);b(w,.06,.06,0,h,0,c);for(const x of [-w*.21,w*.21])b(.015,h*.65,.015,x,h*.67,0,chrome);b(w*.52,.05,d*.4,0,h*.33,0,wood,true);}
  else if(k==='ceiling-fan'){cy(w*.17,h*.6,d*.17,0,h*.45,0,chrome);for(let i=0;i<4;i++){const a=i*Math.PI/2;const blade=b(w*.46,.02,d*.13,Math.cos(a)*w*.24,h*.2,Math.sin(a)*d*.24,c,true);blade.rotation.y=-a;}}
  else b(w,h,d,0,h/2,0,c,true);
  return g;
 }
 return{create,dispose:()=>{Object.values(shapes).forEach(g=>g.dispose());materials.forEach(m=>m.dispose());materials.clear();}};
}
