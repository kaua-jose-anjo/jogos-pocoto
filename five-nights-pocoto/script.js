const cv=document.getElementById('c'),g=cv.getContext('2d'),W=900,H=550,$=i=>document.getElementById(i);
// IA na ordem [Pocotó, Pé-de-Pano, Alazão, Relâmpago]; k = consumo de bateria por segundo
const DIFF={1:{n:'Noite 1',ai:[1,3,1,2],k:.14},3:{n:'Noite 3',ai:[4,7,6,6],k:.18},5:{n:'Noite 5',ai:[8,12,12,10],k:.23},20:{n:'Noite 20/20/20/20',ai:[20,20,20,20],k:.25}};
const CAMS={'1A':'Estábulo Principal','1B':'Pátio Central / Curral','1C':'Baia Isolada','2A':'Corredor Oeste','2B':'Canto da Porta Esquerda','3':'Celeiro de Ferramentas','4A':'Corredor Leste','4B':'Canto da Porta Direita'};
const MAP={'1A':[64,4],'1B':[64,38],'1C':[6,62],'3':[6,104],'2A':[28,128],'2B':[28,162],'4A':[100,128],'4B':[100,162]};
const PATH={poc:['1A','1B','4A','4B'],pe:['1A','1B','3','2A','2B'],ala:['1A','1B','4A','4B']};
const NAME={poc:'Pocotó',pe:'Pé-de-Pano',ala:'Alazão',rel:'Relâmpago'};
const KEYS={doorL:'dL',doorR:'dR',lightL:'lL',lightR:'lR'};
let S='menu',G=null,cam='1A',camOpen=false,ac=null,hum=null,melT=null;

/* ---------- ÁUDIO ---------- */
function A(){if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();return ac}
function tone(f,d,type,v,f2){try{const a=A(),o=a.createOscillator(),n=a.createGain(),t=a.currentTime;o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);n.gain.setValueAtTime(v||.1,t);n.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(n).connect(a.destination);o.start();o.stop(t+d)}catch(e){}}
function noise(d,v,fr){try{const a=A(),b=a.createBuffer(1,a.sampleRate*d,a.sampleRate),x=b.getChannelData(0);for(let i=0;i<x.length;i++)x[i]=Math.random()*2-1;const s=a.createBufferSource(),f=a.createBiquadFilter(),n=a.createGain(),t=a.currentTime;s.buffer=b;f.frequency.value=fr||1000;n.gain.setValueAtTime(v||.2,t);n.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(f).connect(n).connect(a.destination);s.start()}catch(e){}}
function scream(){noise(1.3,.5,3500);for(let i=0;i<4;i++)tone(320+i*95,1.3,'sawtooth',.15,60+i*25)}
function melody(){const N=[392,330,392,330,262,294,330,294,262,220,262,294];let i=0;melT=setInterval(()=>{tone(N[i++%N.length]*(1+(Math.random()-.5)*.05),.32,'triangle',.14)},380)}
function stopSnd(){try{hum&&hum.stop()}catch(e){}hum=null;clearInterval(melT)}

/* ---------- JOGO ---------- */
function start(d){
  const D=DIFF[d];A().resume();stopSnd();
  G={D,t:0,p:100,dL:0,dR:0,aL:0,aR:0,lL:0,lR:0,out:0,outT:0,jt:0,wt:0,who:'',fan:0,use:1,
    e:{poc:{pos:0,door:false,ai:D.ai[0],iv:3.02,t:0},pe:{pos:0,door:false,ai:D.ai[1],iv:4.97,t:0},ala:{pos:0,door:false,ai:D.ai[2],iv:4.98,t:0}},
    rel:{stage:0,run:0,ai:D.ai[3],t:0}};
  camOpen=false;cam='1A';S='play';
  try{const a=A();hum=a.createOscillator();const n=a.createGain();hum.frequency.value=55;n.gain.value=.04;hum.connect(n).connect(a.destination);hum.start()}catch(e){}
  ui();
}
function jump(w){S='jump';G.who=w;G.jt=0;camOpen=false;stopSnd();scream();ui()}
function win(){S='win';G.wt=0;stopSnd();tone(523,1.5,'triangle',.2);tone(784,2,'triangle',.2);ui()}
function end(m){S='menu';stopSnd();$('msg').textContent=m;ui()}
const roll=ai=>Math.floor(Math.random()*21)<=ai;

function upd(dt){
  G.t+=dt;G.fan+=dt*12;
  if(G.t>=240){win();return}
  if(!G.out){
    G.use=1+G.dL+G.dR+G.lL+G.lR+(camOpen?1:0);
    G.p-=G.D.k*G.use*dt;
    if(G.p<=0){G.p=0;G.out=1;G.outT=0;G.dL=G.dR=G.lL=G.lR=0;camOpen=false;melody();ui()}
  }else{
    G.outT+=dt;if(G.outT>11){jump('poc');return}
    return;
  }
  for(const k of ['poc','pe','ala']){
    const a=G.e[k];a.t+=dt;if(a.t<a.iv)continue;a.t=0;
    if(!roll(a.ai))continue;
    const P=PATH[k],closed=k=='pe'?G.dL:G.dR;
    if(a.door){
      if(closed){a.door=false;a.pos=1;noise(.3,.3,300)}else{jump(k);return}
      continue;
    }
    if(k=='poc'&&camOpen&&cam==P[a.pos])continue; // Pocotó só avança se não estiver sendo vigiado
    tone(70,.3,'square',.07);
    if(a.pos==P.length-1)a.door=true;else a.pos++;
  }
  const r=G.rel;
  if(r.run>0){
    r.run-=dt;
    if(r.run<=0){
      if(G.dL){G.p=Math.max(0,G.p-5);noise(.5,.6,200);tone(55,.4,'square',.25);r.stage=0;r.run=0}
      else{jump('rel');return}
    }
  }else{
    r.t+=dt;
    if(r.t>=5.01){r.t=0;if(!(camOpen&&cam=='1C')&&roll(r.ai)){r.stage++;if(r.stage>=2){r.stage=2;r.run=5.5;tone(90,.6,'sawtooth',.1,40)}}}
  }
  G.aL+=(G.dL-G.aL)*Math.min(1,dt*10);G.aR+=(G.dR-G.aR)*Math.min(1,dt*10);
}

/* ---------- PERSONAGENS ---------- */
function horse(id,x,y,s,o){
  o=o||{};
  const C={poc:['#4a2a14','#1a0e06','#6a4020'],pe:['#6b7f94','#33404f','#8aa0b4'],ala:['#c79a2c','#7a4a12','#e0b84a'],rel:['#a8301f','#4d0f08','#c4452f']}[id];
  g.save();g.translate(x,y);g.scale(s,s);
  g.fillStyle=C[0];g.beginPath();g.moveTo(-100,200);g.lineTo(-45,40);g.lineTo(45,40);g.lineTo(100,200);g.fill();
  g.fillStyle=C[1];g.beginPath();g.ellipse(0,0,66,88,0,0,7);g.fill();
  g.fillStyle=C[0];
  const L=id=='pe';
  [[-42,-.25],[42,.25]].forEach(e=>{g.beginPath();g.ellipse(e[0],L?-100:-72,L?15:13,L?55:26,e[1],0,7);g.fill()});
  g.beginPath();g.ellipse(0,0,52,70,0,0,7);g.fill();
  g.fillStyle=C[2];g.beginPath();g.ellipse(0,42,36,40,0,0,7);g.fill();
  if(id=='rel'){g.beginPath();g.moveTo(-30,20);g.lineTo(0,118);g.lineTo(30,20);g.fill()}
  g.fillStyle='#000';g.beginPath();g.ellipse(-12,48,5,8,0,0,7);g.ellipse(12,48,5,8,0,0,7);g.fill();
  g.shadowColor='#fff';g.shadowBlur=id=='poc'?20:6;
  [-24,24].forEach((ex,i)=>{
    if(id=='rel'&&i==0)return;
    g.fillStyle=id=='rel'?'#ff5a3c':'#fff';g.beginPath();g.ellipse(ex,-16,11,9,0,0,7);g.fill();
    g.fillStyle='#000';g.beginPath();g.arc(ex,-16,3.5,0,7);g.fill();
  });
  g.shadowBlur=0;
  const m=(o.m||0)*28;
  g.fillStyle='#120606';g.beginPath();g.ellipse(0,82+m/2,26,6+m/2,0,0,7);g.fill();
  g.fillStyle='#e8e2c4';const n=id=='ala'?6:4;
  for(let i=0;i<n;i++)g.fillRect(-24+i*(48/n)+2,76,6,id=='ala'?15:9);
  if(id=='poc'){
    g.fillStyle='#5a3b1a';g.beginPath();g.ellipse(0,-66,86,15,0,0,7);g.fill();g.fillRect(-40,-122,80,58);
    g.fillStyle='#2a1a0a';g.fillRect(-40,-82,80,10);g.fillStyle='#3c2812';g.fillRect(8,-118,14,30);
  }
  if(id=='pe'){
    g.fillStyle=C[0];g.save();g.translate(0,92+m);g.rotate(.35);g.fillRect(-30,0,60,20);g.restore();
    g.strokeStyle='#aaa';g.lineWidth=3;g.beginPath();g.moveTo(-10,70);g.lineTo(14,102);g.stroke();
  }
  if(id=='ala'){
    g.fillStyle='#bfbfbf';g.fillRect(-45,120,90,50);g.strokeStyle='#555';g.lineWidth=3;g.strokeRect(-45,120,90,50);
    g.beginPath();g.moveTo(-30,130);g.lineTo(30,160);g.moveTo(30,130);g.lineTo(-30,160);g.stroke();
  }
  if(id=='rel'){
    g.fillStyle='#8a8a8a';g.beginPath();g.arc(-24,-16,19,0,7);g.fill();
    g.strokeStyle='#555';g.lineWidth=4;g.beginPath();g.moveTo(-52,-34);g.lineTo(52,-2);g.stroke();
  }
  g.restore();
}

/* ---------- RENDER ---------- */
function fx(a){
  for(let i=0;i<90;i++){g.fillStyle='rgba(255,255,255,'+Math.random()*a+')';g.fillRect(Math.random()*W,Math.random()*H,Math.random()*60,2)}
  g.fillStyle='rgba(0,0,0,.18)';for(let y=0;y<H;y+=4)g.fillRect(0,y,W,1);
}
function door(x,s){
  const y=90,w=150,h=330,lit=G['l'+s]&&!G.out,a=G['a'+s];
  g.fillStyle=lit?'#cfc590':'#040302';g.fillRect(x,y,w,h);
  if(lit){const k=s=='L'?(G.e.pe.door&&'pe'):(G.e.ala.door?'ala':(G.e.poc.door&&'poc'));if(k)horse(k,x+75,y+170,.9)}
  if(G.out&&s=='L'&&Math.floor(G.outT*3)%2==0){g.fillStyle='#fff';g.fillRect(x+45,y+120,14,10);g.fillRect(x+90,y+120,14,10)}
  if(a>.01){g.fillStyle='#6b4423';g.fillRect(x,y,w,h*a);g.strokeStyle='#2b1a0d';g.lineWidth=3;for(let i=1;i<5;i++){g.beginPath();g.moveTo(x+i*30,y);g.lineTo(x+i*30,y+h*a);g.stroke()}}
  g.strokeStyle='#8B5A2B';g.lineWidth=8;g.strokeRect(x-4,y-4,w+8,h+8);
}
function office(){
  g.fillStyle='#3a2412';g.fillRect(0,0,W,H);
  g.strokeStyle='#26160a';g.lineWidth=3;for(let x=0;x<W;x+=45){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()}
  door(30,'L');door(720,'R');
  g.fillStyle='#5a3a1c';g.fillRect(250,420,400,130);g.fillStyle='#2b1a0d';g.fillRect(250,420,400,10);
  g.fillStyle='#222';g.fillRect(380,350,140,90);g.fillStyle='#0c2a14';g.fillRect(390,358,120,70);
  g.fillStyle='#2f7a3a';g.fillRect(400,372,60,4);g.fillRect(400,386,90,4);g.fillRect(400,400,40,4);
  g.save();g.translate(300,395);g.rotate(G.fan);g.fillStyle='#777';for(let i=0;i<4;i++){g.rotate(Math.PI/2);g.fillRect(2,-6,30,12)}g.restore();
  g.fillStyle='#555';g.beginPath();g.arc(300,395,6,0,7);g.fill();
  g.fillStyle='#8a6a2a';g.fillRect(585,385,30,40);
  if(!G.out){const f=.4+.1*Math.sin(G.t*25)*Math.random();const gr=g.createRadialGradient(600,400,5,600,400,170);gr.addColorStop(0,'rgba(255,190,80,'+f+')');gr.addColorStop(1,'rgba(255,190,80,0)');g.fillStyle=gr;g.fillRect(430,230,340,320)}
  g.fillStyle=G.out?'rgba(0,0,0,.94)':'rgba(0,0,0,'+(.28+Math.random()*.04)+')';g.fillRect(0,0,W,H);
}
function room(id){
  const bg={'1A':'#1d1710','1B':'#0e1a22','1C':'#1a1209','2A':'#13140f','2B':'#17120c','3':'#1a1a14','4A':'#121510','4B':'#17120c'}[id];
  g.fillStyle=bg;g.fillRect(0,0,W,H);g.fillStyle='rgba(0,0,0,.45)';g.fillRect(0,400,W,150);
  g.strokeStyle='#5a3a1c';g.lineWidth=6;g.fillStyle='#4a3a20';
  if(id=='1A'){for(let i=0;i<4;i++){g.strokeRect(40+i*215,80,190,330);g.fillRect(50+i*215,390,170,18)}}
  if(id=='1B'){g.fillStyle='#cfd6c0';g.beginPath();g.arc(740,90,34,0,7);g.fill();g.fillStyle='#3a2a14';for(let x=10;x<W;x+=70)g.fillRect(x,290,12,130);g.fillRect(0,320,W,12);g.fillRect(0,370,W,10)}
  if(id=='2A'||id=='4A'){g.beginPath();g.moveTo(0,0);g.lineTo(300,150);g.lineTo(300,400);g.lineTo(0,H);g.moveTo(W,0);g.lineTo(600,150);g.lineTo(600,400);g.lineTo(W,H);g.stroke();g.strokeRect(300,150,300,250);g.fillStyle='#000';g.fillRect(303,153,294,244)}
  if(id=='2B'||id=='4B'){const x=id=='2B'?70:680;g.fillStyle='#000';g.fillRect(x,60,150,380);g.strokeRect(x,60,150,380);g.fillStyle='#8a6a2a';g.fillRect(id=='2B'?300:560,200,24,36)}
  if(id=='3'){for(let i=0;i<3;i++){g.fillRect(120,140+i*100,660,10);for(let j=0;j<6;j++){g.fillStyle=j%2?'#6a6a60':'#7a4a22';g.fillRect(150+j*105,105+i*100,18,36)}g.fillStyle='#4a3a20'}}
}
function rc(){
  g.fillStyle='#050402';g.fillRect(250,60,400,360);
  const s=G.rel.stage;
  if(s==1)horse('rel',500,250,1.1);
  g.fillStyle='#a8883a';
  if(s==0)g.fillRect(250,60,400,360);
  else if(s==1){g.fillRect(250,60,150,360);g.fillRect(600,60,50,360)}
  else{g.fillRect(250,60,30,200);g.fillRect(620,60,30,260)}
  g.strokeStyle='#6a5420';g.lineWidth=2;for(let x=255;x<650;x+=18){g.beginPath();g.moveTo(x,60);g.lineTo(x,420);g.stroke()}
  g.strokeStyle='#5a3a1c';g.lineWidth=6;g.strokeRect(250,60,400,360);
}
function camView(){
  room(cam);
  const ents=[];
  for(const k of ['pe','poc','ala'])if(!G.e[k].door&&PATH[k][G.e[k].pos]==cam)ents.push(k);
  ents.forEach((k,j)=>{
    const close=cam=='2B'||cam=='4B';
    const x=close?(cam=='2B'?380:520):cam=='1A'?{pe:210,poc:450,ala:690}[k]:300+j*180;
    horse(k,x,close?300:260,close?1.6:1.1);
  });
  if(cam=='1C')rc();
  if(cam=='2A'&&G.rel.run>2)horse('rel',450+Math.random()*12,280,1.6,{m:1});
  g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,0,W,H);
  fx(.35);
  g.fillStyle='#e6d9a8';g.font='bold 20px Courier New';g.textAlign='left';g.fillText('CAM '+cam+' - '+CAMS[cam],20,32);
  if(Math.floor(G.t*2)%2==0){g.fillStyle='#d22';g.beginPath();g.arc(30,56,7,0,7);g.fill()}
}
function hud(){
  g.font='bold 20px Courier New';g.fillStyle='#e6d9a8';g.textAlign='right';
  g.fillText((G.t<40?'12':Math.floor(G.t/40))+' AM',880,32);g.fillText(G.D.n,880,56);
  g.textAlign='left';g.fillText('Energia: '+Math.ceil(G.p)+'%',20,512);g.fillText('Usage:',20,538);
  for(let i=0;i<G.use;i++){g.fillStyle=i<2?'#4c4':i<4?'#ec4':'#e44';g.fillRect(100+i*16,523,12,16)}
}
function jscare(){
  const t=Math.min(G.jt,.4);
  g.fillStyle=Math.random()<.3?'#500':'#000';g.fillRect(0,0,W,H);
  g.save();g.translate((Math.random()-.5)*40,(Math.random()-.5)*40);
  horse(G.who,450,230+t*325,1+t*5.5,{m:1});g.restore();fx(.5);
}
function draw(){
  if(S=='play'){camOpen?camView():office();hud()}
  else if(S=='jump')jscare();
  else if(S=='win'){g.fillStyle='#000';g.fillRect(0,0,W,H);g.fillStyle='#e6d9a8';g.textAlign='center';g.font='bold 90px Courier New';g.fillText('6:00 AM',450,290);g.font='24px Courier New';g.fillText('Você sobreviveu à noite!',450,340)}
  else{g.fillStyle='#050805';g.fillRect(0,0,W,H);fx(.08)}
}

/* ---------- INTERFACE ---------- */
function ui(){
  const p=S=='play',cm=p&&camOpen,out=G&&G.out;
  $('menu').classList.toggle('hid',S!='menu');
  $('ctl').classList.toggle('hid',!p);
  $('map').classList.toggle('hid',!cm);
  $('camBtn').classList.toggle('hid',!!out);
  document.querySelectorAll('.side').forEach(e=>e.classList.toggle('hid',cm||!!out));
  if(G)for(const id in KEYS)$(id).classList.toggle('on',!!G[KEYS[id]]);
  $('camBtn').classList.toggle('on',camOpen);
  document.querySelectorAll('#map button').forEach(b=>b.classList.toggle('on',b.textContent==cam));
}
function light(s){
  if(G.out)return;
  const k='l'+s,o=s=='L'?'lR':'lL';
  G[k]^=1;G[o]=0;
  if(G[k]){tone(180,.12,'square',.06);const there=s=='L'?G.e.pe.door:(G.e.ala.door||G.e.poc.door);if(there){tone(900,.25,'sawtooth',.15,200);noise(.3,.3,2500)}}
  ui();
}
$('doorL').onclick=()=>{if(G.out)return;G.dL^=1;noise(.25,.35,400);ui()};
$('doorR').onclick=()=>{if(G.out)return;G.dR^=1;noise(.25,.35,400);ui()};
$('lightL').onclick=()=>light('L');
$('lightR').onclick=()=>light('R');
$('camBtn').onclick=()=>{if(G.out)return;camOpen=!camOpen;if(camOpen)G.lL=G.lR=0;tone(300,.15,'triangle',.08);ui()};
const M=$('map');
for(const id in MAP){const b=document.createElement('button');b.textContent=id;b.title=CAMS[id];b.style.left=MAP[id][0]+'px';b.style.top=MAP[id][1]+'px';b.onclick=()=>{cam=id;tone(500,.08,'square',.05);ui()};M.appendChild(b)}
const you=document.createElement('div');you.id='you';you.textContent='YOU';M.appendChild(you);
document.querySelectorAll('#diffs button').forEach(b=>b.onclick=()=>start(+b.dataset.d));

let last=0;
function loop(ts){
  const dt=Math.min(.1,(ts-last)/1000||0);last=ts;
  if(S=='play')upd(dt);
  else if(S=='jump'){G.jt+=dt;if(G.jt>1.6)end(NAME[G.who]+' pegou você! Tente de novo.')}
  else if(S=='win'){G.wt+=dt;if(G.wt>5)end('Você sobreviveu até as 6:00 AM!')}
  draw();requestAnimationFrame(loop);
}
requestAnimationFrame(loop);