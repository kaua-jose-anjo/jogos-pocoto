'use strict';
(() => {
const $ = id => document.getElementById(id);
const W = 900, H = 540, PW = 40, STEP = 1 / 60;
const cv = $('game'), ctx = cv.getContext('2d');
const EMO = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ================= TRILHA ================= */
const PTS = [[-30,90],[200,90],[200,260],[80,260],[80,440],[380,440],[380,170],[560,170],[560,400],[720,400],[720,230],[880,230]];
const SEG = []; let TOTAL = 0;
for (let i = 0; i < PTS.length - 1; i++) {
  const a = PTS[i], b = PTS[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  SEG.push({ a, b, len, cum: TOTAL }); TOTAL += len;
}
function posAt(d) {
  if (d <= 0) return { x: PTS[0][0], y: PTS[0][1] };
  for (const s of SEG) if (d <= s.cum + s.len) {
    const t = (d - s.cum) / s.len;
    return { x: s.a[0] + (s.b[0] - s.a[0]) * t, y: s.a[1] + (s.b[1] - s.a[1]) * t };
  }
  const e = PTS[PTS.length - 1]; return { x: e[0], y: e[1] };
}
function distSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let t = ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
const nearPath = (x, y, d) => SEG.some(s => distSeg(x, y, s.a, s.b) < d);

/* ================= DADOS ================= */
const TYPES = {
  coice: { id:'coice', emoji:'🐴', name:'Pocotó Coiceiro', role:'Corpo a corpo · Dano em área', cost:60, upg:[80,140], lv:[
    { n:'Potro Valente', dmg:22, range:72, cd:1.1, push:22, stun:0, crit:0, fx:'Recuo pequeno', d:'Coice básico em área curta com pequeno recuo.' },
    { n:'Garanhão de Ferro', dmg:33, range:86, cd:1.1, push:32, stun:.4, crit:0, fx:'Atordoa 0,4s', d:'Ferraduras reforçadas: raio maior, +50% de dano e atordoamento de 0,4s.' },
    { n:'Lenda do Haras', dmg:70, range:104, cd:1.1, push:60, stun:.4, crit:.25, fx:'Onda sísmica · 25% crítico', d:'Ferraduras douradas: onda de choque sísmica, dano massivo, empurrão forte e 25% de crítico (2x).' } ] },
  sniper: { id:'sniper', emoji:'🐎', name:'Pé-de-Pano Atirador', role:'Sniper · Alvo único', cost:80, upg:[100,170], lv:[
    { n:'Vigia da Cerca', dmg:70, range:230, cd:2.2, pierce:1, fx:'Prioriza o mais forte', d:'Disparo único de longo alcance com dano alto.' },
    { n:'Atirador de Elite', dmg:105, range:275, cd:2, pierce:1, ign:true, fx:'Ignora armadura · 2x vs Javali/Chefe', d:'Mira telescópica: mais alcance, ignora armadura e dobra o dano contra Javalis e Chefes.' },
    { n:'Relâmpago Prateado', dmg:150, range:300, cd:1.8, pierce:3, ign:true, crit:.3, fx:'Perfura 3 · 30% crítico (2,5x)', d:'Disparo perfurante supersônico: atravessa até 3 inimigos e causa crítico devastador.' } ] },
  feno: { id:'feno', emoji:'🌾', name:'Espantalho de Feno', role:'Controle · Lentidão', cost:70, upg:[80,140], lv:[
    { n:'Espantalho Simples', range:135, cd:1.8, mode:'slow', slow:.3, st:2, r:48, fx:'Lentidão 30% por 2s', d:'Reduz a velocidade dos inimigos atingidos em 30% por 2 segundos.' },
    { n:'Espantalho de Lama', range:145, cd:2.6, mode:'zone', kind:'mud', slow:.5, r:56, life:6, fx:'Poça de lama 50%', d:'Cria uma poça de lama persistente que reduz a velocidade em 50%.' },
    { n:'Guardião da Tempestade', range:155, cd:3, mode:'zone', kind:'storm', slow:.65, r:68, life:5, dps:10, vuln:true, fx:'Lentidão 65% · +20% dano recebido', d:'Redemoinho de palha: 65% de lentidão, dano contínuo e inimigos sofrem +20% de dano das outras torres.' } ] },
  galo: { id:'galo', emoji:'🐓', name:'Galo Metralhador', role:'Cadência rápida · DPS', cost:75, upg:[90,150], lv:[
    { n:'Galo Garnisé', dmg:5, range:135, cd:.22, shots:1, fx:'Rajada de milho', d:'Rajada rápida de milhos de alcance médio.' },
    { n:'Galo de Briga', dmg:5, range:140, cd:.11, shots:2, fx:'2 projéteis · cadência 2x', d:'Bico duplo: dobra a velocidade de ataque e dispara 2 projéteis simultâneos.' },
    { n:'Fúria do Galinheiro', dmg:5, range:145, cd:.09, shots:2, ric:true, fx:'Pipocas ricocheteiam', d:'Metralhadora de pipocas explosivas que ricocheteiam para um segundo inimigo.' } ] },
  fogo: { id:'fogo', emoji:'🔥', name:'Alazão Piromaníaco', role:'Elemental · Queimadura', cost:100, upg:[120,200], lv:[
    { n:'Brasa Quente', dmg:20, range:145, cd:1.5, r:40, burn:8, bt:3, fx:'Queima 8/s por 3s', d:'Bola de fogo com explosão pequena e queimadura por 3 segundos.' },
    { n:'Forja do Ferreiro', dmg:30, range:155, cd:1.5, r:56, burn:16, bt:3, blue:true, fx:'Chamas azuis · queima 16/s', d:'Chamas azuis: explosão maior e queimadura com o dobro de dano.' },
    { n:'Fênix do Sertão', dmg:48, range:165, cd:1.6, r:72, burn:22, bt:4, blue:true, spread:true, patch:true, fx:'Trilha em chamas 4s · espalha fogo', d:'Meteoro solar que deixa a trilha em chamas por 4s e espalha o fogo para vizinhos.' } ] },
  horta: { id:'horta', emoji:'🥕', name:'Horta de Cenouras', role:'Farm · Economia', cost:90, upg:[100,180], lv:[
    { n:'Canteiro Pequeno', total:25, n2:2, int:9, fx:'2 colheitas por onda', d:'Produz +25 🥕 por onda divididos em 2 colheitas.' },
    { n:'Estufa Adubada', total:55, n2:3, int:6, fx:'3 colheitas mais rápidas', d:'Produz +55 🥕 por onda divididos em 3 colheitas mais rápidas.' },
    { n:'Fazenda Dourada', total:110, n2:4, int:5, gold:true, aura:.1, fx:'Cenouras douradas · aura +10% alcance', d:'Produz +110 🥕 por onda (douradas) e dá +10% de alcance às torres vizinhas.' } ] }
};
const ORDER = ['coice','sniper','feno','galo','fogo','horta'];
const EN = {
  raposa: { emo:'🦊', name:'Raposa', hp:28, sp:120, r:10, rew:4, life:1, armor:0 },
  lobo:   { emo:'🐺', name:'Lobo', hp:55, sp:78, r:12, rew:7, life:1, armor:0 },
  javali: { emo:'🐗', name:'Javali', hp:240, sp:46, r:15, rew:18, life:2, armor:.5, heavy:1 },
  urso:   { emo:'🐻', name:'URSO CHEFE', hp:1500, sp:36, r:27, rew:120, life:5, armor:.25, heavy:1, boss:1 }
};

/* ================= ÁUDIO ================= */
let AC = null, muted = false;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, d, type = 'sine', v = .06, to = null, delay = 0) {
  if (muted) return; const a = ac(); if (!a) return;
  const t0 = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + d + .03);
}
function noise(d, v, fc) {
  if (muted) return; const a = ac(); if (!a) return;
  const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), c = b.getChannelData(0);
  for (let i = 0; i < n; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(); s.buffer = b;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fc;
  const g = a.createGain(); g.gain.value = v;
  s.connect(f); f.connect(g); g.connect(a.destination); s.start();
}
const SFX = {
  build() { tone(200, .08, 'square', .05, 400); tone(400, .1, 'triangle', .06, 800, .07); },
  up() { [440, 554, 659, 880].forEach((f, i) => tone(f, .12, 'triangle', .06, null, i * .07)); },
  sell() { tone(500, .12, 'triangle', .06, 250); },
  coice() { noise(.15, .15, 300); tone(90, .15, 'sine', .15, 50); },
  sniper() { tone(900, .12, 'sawtooth', .04, 200); noise(.08, .05, 3000); },
  galo() { tone(700, .04, 'square', .02, 500); },
  fogo() { noise(.2, .08, 600); tone(300, .2, 'sawtooth', .03, 120); },
  feno() { tone(250, .1, 'triangle', .05, 150); },
  boom() { noise(.35, .12, 500); tone(110, .3, 'sine', .1, 40); },
  coin() { tone(988, .06, 'square', .035); tone(1319, .1, 'square', .035, null, .06); },
  start() { tone(330, .15, 'square', .05); tone(494, .2, 'square', .05, null, .13); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', .07, null, i * .1)); },
  leak() { tone(200, .3, 'sawtooth', .07, 80); },
  over() { [400, 330, 262, 196].forEach((f, i) => tone(f, .3, 'sawtooth', .06, null, i * .22)); }
};
const lastS = {};
function sfx(n) {
  const t = performance.now(), gap = n === 'galo' ? 70 : 40;
  if (lastS[n] && t - lastS[n] < gap) return; lastS[n] = t; SFX[n]();
}

/* ================= ESTADO ================= */
let lives, money, ondaAtual, active, queue, qt, autoT, over, autoOn = false, speed = 1;
let towers, enemies, projs, zones, fx, texts, pickups, sel, build, banner;
const mouse = { x: 0, y: 0, in: false };
let now = 0;
function reset() {
  lives = 20; money = 150; ondaAtual = 0; active = false; queue = []; qt = 0; autoT = 3; over = false;
  towers = []; enemies = []; projs = []; zones = []; fx = []; texts = []; pickups = [];
  sel = null; build = null; banner = null;
  $('overlay').classList.add('hidden');
}

/* ================= ONDAS ================= */
function buildWave(w) {
  const q = []; let t = 0;
  const add = (type, n, gap) => { for (let i = 0; i < n; i++) { q.push({ t, type }); t += gap; } t += 1.2; };
  add('lobo', 3 + w, .9);
  if (w >= 2) add('raposa', 4 + Math.floor(w * 1.6), .3);
  if (w >= 3) add('javali', Math.floor((w - 1) / 2), 1.8);
  if (w % 5 === 0) add('urso', 1 + Math.floor(w / 10), 4);
  return q;
}
function spawn(type) {
  const d = EN[type], hp = d.hp * Math.pow(1.13, ondaAtual - 1);
  const e = { type, ...d, hp, max: hp, d: 0, x: -30, y: 90, slow: 0, slowT: 0, stun: 0, vuln: 0, burn: null,
    burnVis: 0, flash: 0, acc: 0, tc: 0, dead: false, rew: Math.round(d.rew * (1 + .06 * (ondaAtual - 1))) };
  enemies.push(e);
}
function startWave() {
  if (active || over) return;
  ondaAtual++; queue = buildWave(ondaAtual); qt = 0; active = true;
  towers.forEach(t => { t.spawned = 0; t.timer = 0; t.skip = false; });
  const boss = ondaAtual % 5 === 0;
  banner = { txt: boss ? `🐻 ONDA ${ondaAtual} — CHEFE!` : `ONDA ${ondaAtual}`, t: 2.2 };
  sfx('start');
}
function endWave() {
  active = false;
  const bonus = 25 + 4 * ondaAtual; money += bonus;
  towers.forEach(t => {
    if (t.type !== 'horta') return;
    if (t.skip) { t.skip = false; return; }
    const s = TYPES.horta.lv[t.lv];
    while (t.spawned < s.n2) dropCarrot(t, s);
  });
  ftxt(W / 2, 70, `Onda ${ondaAtual} concluída! +${bonus} 🥕`, '#ffe27a', 2.4, 18);
  sfx('win');
  if (window.PocotoRank) PocotoRank.registrar('defenseWave', ondaAtual, 'max');
  autoT = 3;
}

/* ================= EFEITOS / TEXTOS ================= */
function ftxt(x, y, txt, c = '#fff', life = 1, sz = 14) { texts.push({ x, y, txt, c, t: life, max: life, sz }); }
function ring(x, y, r0, r1, c, max = .4) { fx.push({ k: 'ring', x, y, r0, r1, c, t: max, max }); }
function blob(x, y, r, c, max = .4) { fx.push({ k: 'blob', x, y, r, c, t: max, max }); }

/* ================= DANO ================= */
function hurt(e, amt, o = {}) {
  if (e.dead) return;
  let a = amt;
  if (!o.ign) a *= 1 - e.armor;
  if (e.vuln > 0) a *= 1.2;
  if (o.crit) { a *= o.cm || 2; ftxt(e.x, e.y - e.r - 20, 'CRÍTICO!', '#ffd400', 1.2, 15); }
  e.hp -= a; e.flash = .08;
  if (!o.dot) {
    e.acc += a;
    if (e.tc <= 0 || o.crit) { ftxt(e.x + rnd(-8, 8), e.y - e.r - 6, '-' + Math.max(1, Math.round(e.acc)), '#fff', .8, 13); e.acc = 0; e.tc = .25; }
  }
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  if (e.dead) return;
  e.dead = true; money += e.rew;
  ftxt(e.x, e.y - 8, `+${e.rew} 🥕`, '#ffcf4a', 1, 14);
  blob(e.x, e.y, e.r * 1.4, 'rgba(200,200,200,', .35); sfx('coin');
}
function setSlow(e, a, t) {
  if (a >= e.slow || e.slowT <= 0) { e.slow = a; e.slowT = t; } else e.slowT = Math.max(e.slowT, t);
}
function ignite(e, dps, t, spread) {
  if (!e.burn || dps >= e.burn.dps || e.burn.t < t) e.burn = { dps, t, tt: t, spread, sc: .3 };
}
function setPos(e) { const p = posAt(e.d); e.x = p.x; e.y = p.y; }

/* ================= TORRES ================= */
const stat = t => TYPES[t.type].lv[t.lv];
function rangeOf(t) {
  const s = stat(t); if (!s.range) return 0;
  for (const o of towers) if (o !== t && o.type === 'horta' && o.lv === 2 && dist(o, t) <= 120) return s.range * 1.1;
  return s.range;
}
function canPlace(x, y) {
  if (x < 20 || x > W - 20 || y < 20 || y > H - 20) return false;
  if (x > 815 && y > 150 && y < 310) return false;
  for (const s of SEG) if (distSeg(x, y, s.a, s.b) < PW / 2 + 17) return false;
  for (const t of towers) if (Math.hypot(t.x - x, t.y - y) < 36) return false;
  return true;
}
function placeTower(type, x, y) {
  const T = TYPES[type];
  towers.push({ type, x, y, lv: 0, cd: .3, ang: 0, spent: T.cost, spawned: 0, timer: 0, skip: active, flash: 0 });
  money -= T.cost; sfx('build'); ring(x, y, 8, 30, 'rgba(255,255,255,', .4);
}
function upgrade(t) {
  const T = TYPES[t.type]; if (t.lv >= 2) return;
  const c = T.upg[t.lv]; if (money < c) return;
  money -= c; t.spent += c; t.lv++; sfx('up');
  ring(t.x, t.y, 10, 44, 'rgba(255,215,80,', .6); ftxt(t.x, t.y - 28, T.lv[t.lv].n + '!', '#ffe27a', 1.4, 14);
}
function sell(t) {
  const v = Math.floor(t.spent * .7); money += v;
  ftxt(t.x, t.y - 20, `+${v} 🥕`, '#ffcf4a', 1.2, 15); sfx('sell');
  towers = towers.filter(o => o !== t); if (sel === t) sel = null;
}
function dropCarrot(t, s) {
  t.spawned++;
  pickups.push({ x: t.x + rnd(-26, 26), y: t.y + rnd(20, 32), v: Math.round(s.total / s.n2), gold: !!s.gold, age: 0 });
}
function towerUpdate(t, dt) {
  t.flash -= dt;
  const s = stat(t);
  if (t.type === 'horta') {
    if (!active || t.skip) return;
    t.timer += dt;
    if (t.spawned < s.n2 - 1 && t.timer >= s.int * (t.spawned + 1)) dropCarrot(t, s);
    return;
  }
  t.cd -= dt;
  const rg = rangeOf(t); let tg = null, best = -1;
  for (const e of enemies) {
    if (e.dead || dist(t, e) > rg + e.r * .5) continue;
    const sc = t.type === 'sniper' ? e.hp + e.d * .001 : e.d;
    if (sc > best) { best = sc; tg = e; }
  }
  if (!tg) return;
  t.ang = Math.atan2(tg.y - t.y, tg.x - t.x);
  if (t.cd > 0) return;
  t.cd = s.cd;
  switch (t.type) {
    case 'coice': stomp(t, s, rg); break;
    case 'sniper': {
      const sp = 900;
      projs.push({ k: 'line', type: 'sniper', s, x: t.x, y: t.y, vx: Math.cos(t.ang) * sp, vy: Math.sin(t.ang) * sp, pierce: s.pierce, hit: new Set(), life: rg * 1.25 / sp, ang: t.ang });
      sfx('sniper'); break; }
    case 'galo':
      for (let i = 0; i < s.shots; i++) {
        const o = (i - (s.shots - 1) / 2) * 5, nx = -Math.sin(t.ang) * o, ny = Math.cos(t.ang) * o;
        projs.push({ k: 'pt', type: 'galo', s, x: t.x + nx, y: t.y + ny, tg, lx: tg.x, ly: tg.y, sp: 560, dmg: s.dmg, life: 1, ric: s.ric, ang: t.ang });
      }
      sfx('galo'); break;
    case 'fogo':
      projs.push({ k: 'pt', type: 'fogo', s, x: t.x, y: t.y, tg, lx: tg.x, ly: tg.y, sp: 300, life: 2, ang: t.ang }); sfx('fogo'); break;
    case 'feno':
      projs.push({ k: 'pt', type: 'feno', s, x: t.x, y: t.y, tg, lx: tg.x, ly: tg.y, sp: 320, life: 2, ang: 0 }); sfx('feno'); break;
  }
}
function stomp(t, s, rg) {
  t.flash = .25;
  for (const e of enemies) {
    if (e.dead || dist(t, e) > rg + e.r * .5) continue;
    hurt(e, s.dmg, { crit: Math.random() < (s.crit || 0) });
    if (e.dead) continue;
    e.d = Math.max(0, e.d - s.push * (e.boss ? .4 : 1)); setPos(e);
    if (s.stun) e.stun = Math.max(e.stun, s.stun);
  }
  ring(t.x, t.y, 10, rg, t.lv === 2 ? 'rgba(255,210,70,' : 'rgba(255,255,255,', .35);
  if (t.lv === 2) ring(t.x, t.y, 5, rg * .7, 'rgba(255,170,40,', .5);
  sfx('coice');
}
function explode(x, y, s) {
  blob(x, y, s.r, s.blue ? 'rgba(80,150,255,' : 'rgba(255,140,30,', .45);
  ring(x, y, 6, s.r, s.blue ? 'rgba(160,210,255,' : 'rgba(255,220,100,', .35);
  sfx('boom');
  for (const e of enemies) {
    if (e.dead || Math.hypot(e.x - x, e.y - y) > s.r + e.r * .4) continue;
    hurt(e, s.dmg, { ign: true });
    if (!e.dead) ignite(e, s.burn, s.bt, !!s.spread);
  }
  if (s.patch && zones.length < 40) zones.push({ x, y, r: 44, t: 4, life: 4, kind: 'fire', dps: 14, slow: 0 });
}
function impact(p) {
  const s = p.s;
  if (p.type === 'galo') {
    const e = p.tg; if (!e || e.dead) return;
    hurt(e, p.dmg); blob(e.x, e.y, 7, 'rgba(255,230,120,', .2);
    if (p.ric) {
      let n = null, bd = 110;
      for (const o of enemies) { if (o === e || o.dead) continue; const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; n = o; } }
      if (n) projs.push({ k: 'pt', type: 'galo', s, x: e.x, y: e.y, tg: n, lx: n.x, ly: n.y, sp: 520, dmg: p.dmg * .7, life: 1, ric: false, ang: 0, pop: true });
    }
  } else if (p.type === 'fogo') explode(p.lx, p.ly, s);
  else if (p.type === 'feno') {
    if (s.mode === 'slow') {
      for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.lx, e.y - p.ly) < s.r + e.r) setSlow(e, s.slow, s.st);
      blob(p.lx, p.ly, s.r, 'rgba(230,200,100,', .5);
    } else if (zones.length < 40) {
      zones.push({ x: p.lx, y: p.ly, r: s.r, t: s.life, life: s.life, kind: s.kind, slow: s.slow, dps: s.dps || 0, vuln: !!s.vuln });
      blob(p.lx, p.ly, s.r, 'rgba(120,80,40,', .4);
    }
  }
}
function projUpdate(dt) {
  for (const p of projs) {
    if (p.k === 'line') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      for (const e of enemies) {
        if (e.dead || p.hit.has(e) || Math.hypot(e.x - p.x, e.y - p.y) > e.r + 6) continue;
        p.hit.add(e);
        const s = p.s; let a = s.dmg; if (s.ign && e.heavy) a *= 2;
        hurt(e, a, { ign: s.ign, crit: Math.random() < (s.crit || 0), cm: 2.5 });
        blob(e.x, e.y, 10, 'rgba(255,255,255,', .2);
        if (--p.pierce <= 0) { p.life = 0; break; }
      }
    } else {
      let tx, ty;
      if (p.tg && !p.tg.dead) { tx = p.tg.x; ty = p.tg.y; p.lx = tx; p.ly = ty; } else { tx = p.lx; ty = p.ly; p.tg = null; }
      const dx = tx - p.x, dy = ty - p.y, dd = Math.hypot(dx, dy), st = p.sp * dt;
      p.ang = Math.atan2(dy, dx); p.spin = (p.spin || 0) + dt * 12;
      p.life -= dt;
      if (dd <= st + 3) { impact(p); p.life = 0; } else { p.x += dx / dd * st; p.y += dy / dd * st; }
    }
  }
  projs = projs.filter(p => p.life > 0);
}

/* ================= UPDATE ================= */
function update(dt) {
  if (over) return;
  if (active) {
    qt += dt;
    while (queue.length && queue[0].t <= qt) spawn(queue.shift().type);
  } else if (autoOn && ondaAtual >= 0) {
    autoT -= dt; if (autoT <= 0) startWave();
  }
  // zonas
  for (const z of zones) {
    z.t -= dt;
    for (const e of enemies) {
      if (e.dead || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.r * .5) continue;
      if (z.slow) setSlow(e, z.slow, .25);
      if (z.vuln) e.vuln = Math.max(e.vuln, .25);
      if (z.kind === 'fire') e.burnVis = .3;
      if (z.dps) hurt(e, z.dps * dt, { ign: true, dot: true });
    }
  }
  zones = zones.filter(z => z.t > 0);
  // inimigos
  for (const e of enemies) {
    if (e.dead) continue;
    e.tc -= dt; e.flash -= dt; e.burnVis -= dt;
    if (e.vuln > 0) e.vuln -= dt;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
    if (e.burn) {
      hurt(e, e.burn.dps * dt, { ign: true, dot: true });
      if (e.dead) continue;
      if (e.burn.spread && (e.burn.sc -= dt) <= 0) {
        e.burn.sc = .5;
        for (const o of enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 48) ignite(o, e.burn.dps * .8, 2, false);
      }
      if ((e.burn.t -= dt) <= 0) e.burn = null;
    }
    if (e.stun > 0) e.stun -= dt; else e.d += e.sp * (1 - e.slow) * dt;
    setPos(e);
    if (e.d >= TOTAL) {
      e.dead = true; lives -= e.life; sfx('leak');
      ftxt(860, 215, `-${e.life} ❤️`, '#ff6b6b', 1.3, 18);
      if (lives <= 0) { lives = 0; gameOver(); }
    }
  }
  enemies = enemies.filter(e => !e.dead);
  towers.forEach(t => towerUpdate(t, dt));
  projUpdate(dt);
  // cenouras coletáveis
  pickups = pickups.filter(p => {
    p.age += dt;
    if (p.age > 6 || (mouse.in && Math.hypot(mouse.x - p.x, mouse.y - p.y) < 22)) { collect(p); return false; }
    return true;
  });
  fx.forEach(f => f.t -= dt); fx = fx.filter(f => f.t > 0);
  texts.forEach(t => { t.t -= dt; t.y -= 28 * dt; }); texts = texts.filter(t => t.t > 0);
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (active && !queue.length && !enemies.length && !over) endWave();
}
function collect(p) {
  money += p.v; ftxt(p.x, p.y - 10, `+${p.v} 🥕`, p.gold ? '#ffe14a' : '#ffa94d', 1, 14); sfx('coin');
}
function gameOver() {
  over = true; active = false; sfx('over');
  $('overText').textContent = `Você resistiu até a onda ${ondaAtual}${ondaAtual > 1 ? ' (' + (ondaAtual - 1) + ' concluídas)' : ''}.`;
  $('overlay').classList.remove('hidden');
}

/* ================= CENÁRIO (pré-renderizado) ================= */
const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
function buildBG() {
  const g = bg.getContext('2d'); let sd = 7;
  const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#7cc15a'); gr.addColorStop(1, '#5fa745');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 45; i++) { g.fillStyle = `rgba(${40 + r() * 30 | 0},${110 + r() * 40 | 0},50,.12)`; g.beginPath(); g.ellipse(r() * W, r() * H, 30 + r() * 50, 15 + r() * 25, 0, 0, 7); g.fill(); }
  const stroke = (w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); PTS.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
  stroke(PW + 10, '#6b4423'); stroke(PW + 4, '#a77a4b'); stroke(PW - 4, '#c19a6b');
  for (let i = 0; i < 260; i++) { // pedrinhas na trilha
    const d = r() * TOTAL, p = posAt(d); g.fillStyle = r() > .5 ? '#a98258' : '#8c6a42';
    g.beginPath(); g.arc(p.x + (r() - .5) * 28, p.y + (r() - .5) * 28, 1 + r() * 1.6, 0, 7); g.fill();
  }
  for (let i = 0; i < 380; i++) { // tufos e flores
    const x = r() * W, y = r() * H; if (nearPath(x, y, PW / 2 + 8)) continue;
    if (r() < .8) { g.strokeStyle = r() > .5 ? '#3f8f3a' : '#2f7a33'; g.lineWidth = 1.5; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(x + k * 2, y); g.lineTo(x + k * 4, y - 6 - r() * 3); } g.stroke(); }
    else { g.fillStyle = ['#fff', '#ffd54a', '#ff8fb3', '#c9a6ff'][r() * 4 | 0]; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); g.fillStyle = '#f5a623'; g.beginPath(); g.arc(x, y, .9, 0, 7); g.fill(); }
  }
  const fence = (x1, y1, x2, y2) => {
    const n = Math.hypot(x2 - x1, y2 - y1), k = Math.floor(n / 18);
    g.strokeStyle = '#c99a5b'; g.lineWidth = 3; g.beginPath(); g.moveTo(x1, y1 - 7); g.lineTo(x2, y2 - 7); g.moveTo(x1, y1 - 2); g.lineTo(x2, y2 - 2); g.stroke();
    g.strokeStyle = '#8b5a2b'; g.lineWidth = 4;
    for (let i = 0; i <= k; i++) { const x = x1 + (x2 - x1) * i / k, y = y1 + (y2 - y1) * i / k; g.beginPath(); g.moveTo(x, y + 3); g.lineTo(x, y - 12); g.stroke(); }
  };
  fence(240, 28, 880, 28); fence(400, 516, 700, 516); fence(10, 500, 120, 500);
  const tree = (x, y, s, c) => {
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x, y + 14 * s, 14 * s, 5 * s, 0, 0, 7); g.fill();
    g.fillStyle = '#5b3a1e'; g.fillRect(x - 3 * s, y, 6 * s, 14 * s);
    g.fillStyle = c; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x, y - 24 * s + i * 9 * s); g.lineTo(x + (13 + i * 4) * s, y + i * 7 * s); g.lineTo(x - (13 + i * 4) * s, y + i * 7 * s); g.fill(); }
  };
  for (let y = 20; y < 520; y += 38) if (y < 50 || y > 130) { tree(14, y, 1, '#1d5a2b'); if (r() > .4) tree(42 + r() * 6, y + 14, .8, '#26703a'); }
  for (let x = 260; x < 700; x += 70) tree(x + r() * 20, 8, .7, '#2a7a3a');
  for (let x = 130; x < 400; x += 80) tree(x, 528, .7, '#2a7a3a');
  // Celeiro
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(868, 288, 50, 8, 0, 0, 7); g.fill();
  g.fillStyle = '#a83232'; g.fillRect(836, 190, 70, 96);
  g.strokeStyle = '#7d2222'; g.lineWidth = 2; for (let x = 846; x < 900; x += 10) { g.beginPath(); g.moveTo(x, 190); g.lineTo(x, 286); g.stroke(); }
  g.fillStyle = '#4a3b30'; g.beginPath(); g.moveTo(826, 194); g.lineTo(871, 150); g.lineTo(916, 194); g.lineTo(906, 200); g.lineTo(871, 166); g.lineTo(846, 200); g.fill();
  g.fillStyle = '#f2e6c9'; g.fillRect(858, 232, 36, 54); g.strokeStyle = '#a83232'; g.lineWidth = 3; g.strokeRect(858, 232, 36, 54);
  g.beginPath(); g.moveTo(858, 232); g.lineTo(894, 286); g.moveTo(894, 232); g.lineTo(858, 286); g.stroke();
  g.fillStyle = '#e6c25a'; g.fillRect(862, 200, 20, 18); g.strokeStyle = '#7d2222'; g.strokeRect(862, 200, 20, 18);
  g.fillStyle = '#e6c25a'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(832 + i * 4, 288 + (i % 2) * 3, 7, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.35)'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('CELEIRO', 871, 143);
}

/* ================= DESENHO ================= */
function drawTower(t, x, y, alpha) {
  const l = t.lv; ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 14, 18, 7, 0, 0, 7); ctx.fill();
  const rc = ['#a8743a', '#aab4c0', '#ffd24a'][l];
  if (l === 2) { ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 10 + 4 * Math.sin(now * 4); }
  ctx.fillStyle = ['#6b4423', '#4d5661', '#8a6a12'][l]; ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fill();
  ctx.lineWidth = 2 + l; ctx.strokeStyle = rc; ctx.stroke(); ctx.shadowBlur = 0;
  if (l > 0) { ctx.fillStyle = rc; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 1.8, 0, 7); ctx.fill(); } }
  ctx.save(); ctx.rotate(t.ang || 0);
  if (t.type === 'sniper') { ctx.fillStyle = '#333'; ctx.fillRect(4, -2, 16 + l * 5, 4); ctx.fillStyle = rc; ctx.fillRect(18 + l * 5, -3, 3, 6); if (l > 0) { ctx.fillStyle = '#6aa5d8'; ctx.fillRect(6, -6, 7, 3); } }
  else if (t.type === 'galo') { ctx.fillStyle = '#444'; ctx.fillRect(4, -3, 13, 2.5); if (l > 0) ctx.fillRect(4, 1, 13, 2.5); ctx.fillStyle = rc; ctx.fillRect(15, -3.5, 2, 7); }
  else if (t.type === 'fogo') { ctx.fillStyle = l > 0 ? '#3b8bff' : '#e8590c'; ctx.beginPath(); ctx.moveTo(6, -5); ctx.lineTo(20 + l * 3, 0); ctx.lineTo(6, 5); ctx.fill(); }
  ctx.restore();
  if (t.type === 'coice') {
    ctx.strokeStyle = rc; ctx.lineWidth = 2.5 + (t.flash > 0 ? 1.5 : 0); ctx.beginPath(); ctx.arc(0, 7, 6, 0, Math.PI); ctx.stroke();
    if (l > 0) { ctx.fillStyle = rc; for (const dx of [-6, 6]) { ctx.beginPath(); ctx.arc(dx, 7, 1.6, 0, 7); ctx.fill(); } }
  } else if (t.type === 'feno') {
    ctx.fillStyle = '#e6c25a'; ctx.beginPath(); ctx.arc(0, 9, 7, 0, 7); ctx.fill(); ctx.strokeStyle = '#b8902f'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 2.5, 3); ctx.lineTo(i * 3, 15); ctx.stroke(); }
    if (l === 1) { ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 9, 10, 0, 7); ctx.stroke(); }
    if (l === 2) { ctx.save(); ctx.rotate(now * 3); ctx.strokeStyle = '#f5deb3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 21, 3.14, 5.1); ctx.stroke(); ctx.restore(); }
  } else if (t.type === 'horta') {
    for (let i = -1; i <= 1; i++) { ctx.fillStyle = l === 2 ? '#ffd24a' : '#f08a24'; ctx.beginPath(); ctx.moveTo(i * 8 - 3, 6); ctx.lineTo(i * 8 + 3, 6); ctx.lineTo(i * 8, 17); ctx.fill(); ctx.fillStyle = '#3fae49'; ctx.fillRect(i * 8 - 2, 2, 4, 5); }
    if (l > 0) { ctx.strokeStyle = 'rgba(190,232,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 8, 14, Math.PI, 0); ctx.stroke(); }
  }
  ctx.font = `20px ${EMO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(TYPES[t.type].emoji, 0, -4);
  ctx.fillStyle = '#ffe27a'; for (let i = 0; i <= l; i++) { ctx.beginPath(); ctx.arc(i * 7 - l * 3.5, 24, 2.4, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawEnemy(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, e.r * .8, e.r * .9, e.r * .4, 0, 0, 7); ctx.fill();
  if (e.boss) { ctx.strokeStyle = 'rgba(255,60,40,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, e.r + 3, 0, 7); ctx.stroke(); }
  if (e.armor >= .5) { ctx.strokeStyle = '#b0b7c0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, e.r, Math.PI * .85, Math.PI * 2.15); ctx.stroke(); }
  ctx.font = `${Math.round(e.r * 2.1)}px ${EMO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.emo, 0, 1);
  if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, 7); ctx.fill(); }
  if (e.slow > 0 || e.slowT > 0) { ctx.strokeStyle = 'rgba(120,200,255,.9)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, e.r + 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.font = `11px ${EMO}`; ctx.fillText('❄️', -e.r, -e.r); }
  if (e.burn || e.burnVis > 0) { ctx.font = `13px ${EMO}`; ctx.fillText('🔥', e.r * .6, -e.r - 2 + Math.sin(now * 12) * 2); }
  if (e.stun > 0) { ctx.font = `13px ${EMO}`; ctx.fillText('💫', 0, -e.r - 14 - (e.boss ? 6 : 0)); }
  if (e.vuln > 0) { ctx.font = `10px ${EMO}`; ctx.fillText('🎯', -e.r, e.r); }
  if (e.hp < e.max || e.boss) {
    const w = e.boss ? 64 : e.r * 2.4 + 6, h = e.boss ? 8 : 4, y = -e.r - (e.boss ? 14 : 9), p = Math.max(0, e.hp / e.max);
    ctx.fillStyle = '#2b1a10'; ctx.fillRect(-w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = p > .5 ? '#4cc24a' : p > .25 ? '#f0b429' : '#e03b3b'; ctx.fillRect(-w / 2, y, w * p, h);
    if (e.boss) { ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText('👑 ' + e.name, 0, y - 6); ctx.fillText('👑 ' + e.name, 0, y - 6); }
  }
  ctx.restore();
}
function drawZone(z) {
  const a = Math.min(1, z.t / 1), p = z.t / z.life;
  ctx.save(); ctx.translate(z.x, z.y); ctx.globalAlpha = .75 * a;
  if (z.kind === 'mud') {
    ctx.fillStyle = '#5a3d22'; ctx.beginPath(); ctx.ellipse(0, 0, z.r, z.r * .7, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8a6238'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, z.r * (.5 + .1 * Math.sin(now * 3)), z.r * .35, 0, 0, 7); ctx.stroke();
  } else if (z.kind === 'storm') {
    ctx.fillStyle = 'rgba(230,200,120,.25)'; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#f0d890'; ctx.lineWidth = 2; ctx.rotate(now * 5);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, z.r * (.35 + i * .2), i * 2, i * 2 + 3); ctx.stroke(); }
  } else {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, z.r * (.9 + .1 * Math.sin(now * 14)));
    g.addColorStop(0, 'rgba(255,230,90,.9)'); g.addColorStop(.6, 'rgba(255,110,20,.6)'); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function drawProj(p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang || 0);
  if (p.type === 'sniper') { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(6, 0); ctx.stroke(); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(6, 0); ctx.stroke(); }
  else if (p.type === 'galo') { ctx.fillStyle = p.pop ? '#fff3c4' : '#ffd93d'; ctx.beginPath(); ctx.arc(0, 0, p.pop ? 4 : 3, 0, 7); ctx.fill(); if (p.pop) { ctx.strokeStyle = '#ff9d2f'; ctx.stroke(); } }
  else if (p.type === 'fogo') {
    const b = p.s.blue; const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 11);
    g.addColorStop(0, '#fff'); g.addColorStop(.4, b ? '#5aa0ff' : '#ffb830'); g.addColorStop(1, b ? 'rgba(40,90,255,0)' : 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
  } else { ctx.rotate(p.spin || 0); ctx.fillStyle = '#e6c25a'; ctx.fillRect(-6, -4, 12, 8); ctx.strokeStyle = '#8b5a2b'; ctx.strokeRect(-6, -4, 12, 8); }
  ctx.restore();
}
function drawFx(f) {
  const p = 1 - f.t / f.max; ctx.save();
  if (f.k === 'ring') { ctx.strokeStyle = f.c + (1 - p) + ')'; ctx.lineWidth = 4 * (1 - p) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * p, 0, 7); ctx.stroke(); }
  else { const r = f.r * (.6 + .6 * p), g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, r); g.addColorStop(0, f.c + (.8 * (1 - p)) + ')'); g.addColorStop(1, f.c + '0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawPickup(p) {
  ctx.save(); const y = p.y + Math.sin(now * 5 + p.x) * 2;
  if (p.gold) { ctx.shadowColor = '#ffe14a'; ctx.shadowBlur = 12; }
  ctx.font = `20px ${EMO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🥕', p.x, y);
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, y, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.age / 6)); ctx.stroke();
  ctx.restore();
}
function draw() {
  ctx.drawImage(bg, 0, 0);
  zones.forEach(drawZone);
  if (sel) {
    const rg = rangeOf(sel);
    if (rg) { ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sel.x, sel.y, rg, 0, 7); ctx.fill(); ctx.stroke(); }
    if (sel.type === 'horta' && sel.lv === 2) { ctx.strokeStyle = 'rgba(255,215,80,.8)'; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(sel.x, sel.y, 120, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sel.x, sel.y, 21, 0, 7); ctx.stroke();
  }
  towers.forEach(t => drawTower(t, t.x, t.y, 1));
  [...enemies].sort((a, b) => a.y - b.y).forEach(drawEnemy);
  pickups.forEach(drawPickup); projs.forEach(drawProj); fx.forEach(drawFx);
  texts.forEach(t => {
    ctx.save(); ctx.globalAlpha = Math.min(1, t.t / .5); ctx.font = `bold ${t.sz}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(t.txt, t.x, t.y); ctx.fillStyle = t.c; ctx.fillText(t.txt, t.x, t.y); ctx.restore();
  });
  if (build && mouse.in) {
    const ok = canPlace(mouse.x, mouse.y) && money >= TYPES[build].cost, s = TYPES[build].lv[0];
    if (s.range) { ctx.fillStyle = ok ? 'rgba(80,220,80,.22)' : 'rgba(230,60,60,.25)'; ctx.strokeStyle = ok ? '#4cd64c' : '#e04040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, s.range, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = ok ? 'rgba(80,220,80,.5)' : 'rgba(230,60,60,.5)'; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 19, 0, 7); ctx.fill();
    drawTower({ type: build, lv: 0, ang: 0, flash: 0 }, mouse.x, mouse.y, .65);
  }
  const boss = enemies.find(e => e.boss);
  if (boss) {
    const p = Math.max(0, boss.hp / boss.max);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(290, 8, 320, 22); ctx.fillStyle = '#d63a2a'; ctx.fillRect(293, 11, 314 * p, 16);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🐻 URSO CHEFE', 450, 19);
  }
  if (banner) {
    ctx.save(); ctx.globalAlpha = Math.min(1, banner.t); ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#1E4620'; ctx.strokeText(banner.txt, W / 2, 250); ctx.fillStyle = '#fff3c4'; ctx.fillText(banner.txt, W / 2, 250); ctx.restore();
  }
}

/* ================= INTERFACE ================= */
const shop = $('shop');
ORDER.forEach((id, i) => {
  const T = TYPES[id], b = document.createElement('button');
  b.className = 'shop-btn'; b.dataset.id = id;
  b.innerHTML = `<span class="k">${i + 1}</span><span class="e">${T.emoji}</span><span class="n">${T.name}</span><span class="c">${T.cost} 🥕</span>`;
  b.onclick = () => { ac(); selectBuild(id); };
  shop.appendChild(b);
});
function selectBuild(id) { build = build === id ? null : id; sel = null; }
function statsHTML(type, lv, t) {
  const s = TYPES[type].lv[lv], o = [];
  if (type === 'horta') { o.push(['Produção', `+${s.total} 🥕/onda`], ['Colheitas', s.n2]); }
  else {
    if (s.dmg) o.push(['Dano', s.dmg + (s.shots > 1 ? ' ×' + s.shots : '')]);
    o.push(['Alcance', Math.round(t ? rangeOf(t) : s.range)], ['Velocidade', (1 / s.cd).toFixed(1) + ' tiros/s']);
  }
  o.push(['Efeito', s.fx]);
  return o.map(r => `<div class="row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
}
const setH = (el, v) => { if (el._v !== v) { el._v = v; el.innerHTML = v; } };
function updateUI() {
  setH($('lives'), lives); setH($('money'), Math.floor(money)); setH($('waveNum'), ondaAtual);
  const bw = $('btnWave');
  setH(bw, active ? `Onda ${ondaAtual} em andamento…` : `▶ Iniciar Onda ${ondaAtual + 1}${(ondaAtual + 1) % 5 === 0 ? ' 🐻' : ''}`);
  bw.disabled = active || over;
  shop.querySelectorAll('.shop-btn').forEach(b => {
    b.classList.toggle('active', build === b.dataset.id);
    b.classList.toggle('poor', money < TYPES[b.dataset.id].cost);
  });
  const up = $('btnUp'), sl = $('btnSell');
  up.style.display = sl.style.display = sel ? '' : 'none';
  if (sel) {
    const T = TYPES[sel.type], s = T.lv[sel.lv];
    setH($('pTitle'), `${T.emoji} ${s.n}`); setH($('pSub'), `${T.name} · Nível ${sel.lv + 1}/3`);
    setH($('pStats'), statsHTML(sel.type, sel.lv, sel)); setH($('pDesc'), s.d);
    if (sel.lv < 2) {
      const c = T.upg[sel.lv], n = T.lv[sel.lv + 1];
      setH($('pNext'), `<b>Próximo: ${n.n}</b><br>${n.d}`); setH(up, `⬆ Evoluir · ${c} 🥕`); up.disabled = money < c;
    } else { setH($('pNext'), ''); setH(up, '⭐ Nível máximo'); up.disabled = true; }
    setH(sl, `💰 Vender (+${Math.floor(sel.spent * .7)} 🥕)`);
  } else if (build) {
    const T = TYPES[build], s = T.lv[0];
    setH($('pTitle'), `${T.emoji} ${T.name}`); setH($('pSub'), `${T.role} · ${T.cost} 🥕`);
    setH($('pStats'), statsHTML(build, 0, null)); setH($('pDesc'), s.d);
    setH($('pNext'), `Evolui: ${T.lv[1].n} → ${T.lv[2].n}`);
  } else {
    setH($('pTitle'), 'Defenda o Celeiro!'); setH($('pSub'), 'Nenhuma torre selecionada');
    setH($('pStats'), ''); setH($('pDesc'), 'Escolha uma torre na loja e posicione no pasto, ou clique numa torre construída para evoluir/vender.'); setH($('pNext'), '');
  }
}

/* ================= ENTRADA ================= */
function mpos(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
cv.addEventListener('pointermove', e => { Object.assign(mouse, mpos(e)); mouse.in = true; });
cv.addEventListener('pointerleave', () => { if (e => e.pointerType === 'mouse') mouse.in = false; mouse.in = false; });
cv.addEventListener('contextmenu', e => { e.preventDefault(); build = null; sel = null; });
cv.addEventListener('pointerdown', e => {
  if (e.button === 2 || over) return;
  ac(); Object.assign(mouse, mpos(e)); mouse.in = true;
  const pk = pickups.find(p => Math.hypot(p.x - mouse.x, p.y - mouse.y) < 26);
  if (pk) { collect(pk); pickups = pickups.filter(p => p !== pk); return; }
  if (build) {
    if (canPlace(mouse.x, mouse.y) && money >= TYPES[build].cost) { placeTower(build, mouse.x, mouse.y); if (!e.shiftKey) build = null; }
    else if (money < TYPES[build].cost) ftxt(mouse.x, mouse.y - 14, 'Cenouras insuficientes!', '#ff8a8a', 1.2, 13);
    return;
  }
  sel = towers.find(t => Math.hypot(t.x - mouse.x, t.y - mouse.y) < 20) || null;
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { build = null; sel = null; }
  else if (e.code === 'Space') { e.preventDefault(); startWave(); }
  else if (e.key >= '1' && e.key <= '6') { ac(); selectBuild(ORDER[+e.key - 1]); }
});
$('btnWave').onclick = () => { ac(); startWave(); };
$('chkAuto').onchange = e => { autoOn = e.target.checked; autoT = 1; };
$('btn1x').onclick = () => setSpeed(1);
$('btn2x').onclick = () => setSpeed(2);
function setSpeed(s) { speed = s; $('btn1x').classList.toggle('active', s === 1); $('btn2x').classList.toggle('active', s === 2); }
$('btnMute').onclick = () => { muted = !muted; $('btnMute').textContent = muted ? '🔇 Mudo' : '🔊 Som'; if (!muted) ac(); };
$('btnUp').onclick = () => { if (sel) upgrade(sel); };
$('btnSell').onclick = () => { if (sel) sell(sel); };
$('btnRestart').onclick = () => reset();

/* ================= LOOP ================= */
let last = performance.now(), acc = 0;
function frame(t) {
  const raw = Math.min(.1, (t - last) / 1000); last = t; now = t / 1000;
  if (!over) {
    acc += raw * speed; let n = 0;
    while (acc >= STEP && n < 12) { update(STEP); acc -= STEP; n++; }
    if (n >= 12) acc = 0;
  }
  draw(); updateUI();
  requestAnimationFrame(frame);
}
buildBG(); reset();
requestAnimationFrame(frame);
})();