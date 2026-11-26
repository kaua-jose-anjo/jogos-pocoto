(() => {
const { Engine, World, Bodies, Body, Events, Vertices } = Matter;
const W = 800, H = 400, R = 10;
const STOP_THRESHOLD = 0.15, CAPTURE_RADIUS = 26, SUCTION_RADIUS = 34;
const FL = 30, FR = 770, FT = 30, FB = 370;
const POCKETS = [[FL,FT],[400,FT],[FR,FT],[FL,FB],[400,FB],[FR,FB]].map(([x,y]) => ({ x, y }));
// Trapézios: borda interna (pano) mais curta, quinas chanfradas nas bocas
const CUSHIONS = [
  [[58,30],[374,30],[390,14],[42,14]], [[426,30],[742,30],[758,14],[410,14]],
  [[58,370],[374,370],[390,386],[42,386]], [[426,370],[742,370],[758,386],[410,386]],
  [[30,58],[30,342],[14,358],[14,42]], [[770,58],[770,342],[786,358],[786,42]]
];
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const COLORS = { 0: '#ffffff', 1: '#e53935', 2: '#1e88e5' };

// ---------- Física ----------
const engine = Engine.create();
engine.gravity.x = 0; engine.gravity.y = 0; engine.gravity.scale = 0;
engine.positionIterations = 10; engine.velocityIterations = 10;
const world = engine.world;

CUSHIONS.forEach(v => {
  const pts = v.map(([x, y]) => ({ x, y }));
  const c = Vertices.centre(pts);
  World.add(world, Bodies.fromVertices(c.x, c.y, [pts], { isStatic: true, restitution: 0.8, friction: 0, label: 'cushion' }));
});
World.add(world, [ // paredes externas de segurança
  Bodies.rectangle(400, -20, 1000, 68, { isStatic: true }), Bodies.rectangle(400, 420, 1000, 68, { isStatic: true }),
  Bodies.rectangle(-20, 200, 68, 600, { isStatic: true }), Bodies.rectangle(820, 200, 68, 600, { isStatic: true })
]);

let balls = [], cue = null;
function makeBall(x, y, id, col) {
  const b = Bodies.circle(x, y, R, { restitution: 0.95, friction: 0, frictionStatic: 0, frictionAir: 0.014, density: 0.002 });
  b.pid = id; b.col = col; return b;
}
function genRack() {
  const rows = [1,2,3,4,5,1], list = [];
  const cols = Array.from({ length: 16 }, (_, i) => i % 2 + 1).sort(() => Math.random() - 0.5);
  let id = 0;
  rows.forEach((n, r) => { for (let k = 0; k < n; k++) {
    list.push({ id: id, col: cols[id], x: 560 + r * (R * 1.732 + 0.6), y: 200 + (k - (n - 1) / 2) * (2 * R + 0.6) }); id++;
  } });
  return list;
}
function buildBoard(list) {
  balls.forEach(b => World.remove(world, b));
  if (cue && !cue.out) World.remove(world, cue);
  balls = list.map(o => makeBall(o.x, o.y, o.id, o.col));
  cue = makeBall(200, 200, 'cue', 0); cue.out = false;
  World.add(world, [cue, ...balls]);
}

// ---------- Estado ----------
const G = { mode: 'pvp', cur: 1, first: true, phase: 'aim', reason: '', winner: 0, me: 1,
  rem: { 1: 8, 2: 8 }, wins: { 1: 0, 2: 0 }, hp: { x: 200, y: 200 }, charging: false, power: 0, t0: 0, shooter: 1, winRecorded: false };
let firstHit = null, pocketed = [], cuePocketed = false, mouse = { x: 400, y: 200 }, aiT = null;
let peer = null, conn = null, isHost = false;

function resetG() {
  Object.assign(G, { cur: 1, first: true, phase: 'aim', reason: '', winner: 0, rem: { 1: 8, 2: 8 }, charging: false, power: 0, winRecorded: false });
}
function restart(sendInit) {
  clearTimeout(aiT); resetG();
  const list = genRack(); buildBoard(list);
  if (sendInit && conn) send({ type: 'INIT_BOARD', balls: list });
  schedAI();
}

Events.on(engine, 'collisionStart', e => e.pairs.forEach(({ bodyA: a, bodyB: b }) => {
  if (G.phase !== 'moving' || firstHit) return;
  if (a === cue && b.col) firstHit = b; else if (b === cue && a.col) firstHit = a;
}));

function capture(b) {
  World.remove(world, b);
  if (b === cue) { cue.out = true; cuePocketed = true; }
  else { balls = balls.filter(x => x !== b); pocketed.push(b); G.rem[b.col]--; }
}
function physicsStep() {
  for (let i = 0; i < 3; i++) {
    Engine.update(engine, 1000 / 180);
    [cue, ...balls].forEach(b => {
      if (b.out) return;
      for (const p of POCKETS) {
        const dx = p.x - b.position.x, dy = p.y - b.position.y, d = Math.hypot(dx, dy);
        if (d < CAPTURE_RADIUS) { capture(b); return; }
        if (d < SUCTION_RADIUS) Body.applyForce(b, b.position, { x: dx / d * 0.0001, y: dy / d * 0.0001 });
      }
      if (Math.hypot(b.velocity.x, b.velocity.y) < STOP_THRESHOLD) { Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }
    });
  }
}
const allStopped = () => [cue, ...balls].every(b => b.out || (b.velocity.x === 0 && b.velocity.y === 0));

// ---------- Tacada e regras ----------
function doShot(angle, power) {
  G.shooter = G.cur; G.reason = ''; G.charging = false;
  firstHit = null; pocketed = []; cuePocketed = false;
  const v = Math.max(0.05, power) * 22;
  Body.setVelocity(cue, { x: Math.cos(angle) * v, y: Math.sin(angle) * v });
  G.phase = 'moving';
}
function endTurn() {
  if (G.mode === 'online' && G.shooter !== G.me) return; // aguarda SYNC_END_TURN
  const own = G.cur; let foul = false, reason = '';
  if (cuePocketed) { foul = true; reason = 'Bola branca encaçapada'; }
  else if (!G.first) {
    if (!firstHit) { foul = true; reason = 'Não acertou nenhuma bola'; }
    else if (firstHit.col !== own) { foul = true; reason = 'Acertou primeiro a bola do adversário'; }
  }
  const ownIn = pocketed.some(b => b.col === own);
  const next = (foul || !ownIn) ? 3 - own : own;
  let winner = 0;
  if (G.rem[1] <= 0) winner = 1; else if (G.rem[2] <= 0) winner = 2;
  if (winner) G.wins[winner]++;
  const s = { balls: balls.map(b => ({ id: b.pid, x: b.position.x, y: b.position.y })),
    cue: cue.out ? { x: 200, y: 200 } : { x: cue.position.x, y: cue.position.y },
    rem: G.rem, wins: G.wins, cur: next, hand: foul, reason, winner };
  applyState(s);
  send({ type: 'SYNC_END_TURN', state: s });
}
function applyState(s) {
  const ids = new Set(s.balls.map(b => b.id));
  balls = balls.filter(b => { if (ids.has(b.pid)) return true; World.remove(world, b); return false; });
  s.balls.forEach(o => { const b = balls.find(x => x.pid === o.id); if (b) { Body.setPosition(b, o); Body.setVelocity(b, { x: 0, y: 0 }); } });
  Object.assign(G, { cur: s.cur, rem: s.rem, wins: s.wins, first: false, reason: s.reason, winner: s.winner, charging: false });
  if (s.hand) {
    if (!cue.out) { World.remove(world, cue); cue.out = true; }
    G.hp = { x: s.cue.x, y: s.cue.y }; G.phase = 'hand';
  } else {
    if (cue.out) { cue.out = false; World.add(world, cue); }
    Body.setPosition(cue, s.cue); Body.setVelocity(cue, { x: 0, y: 0 }); G.phase = 'aim';
  }
  if (s.winner) {
    G.phase = 'over';
    const venceuValido = (G.mode === 'pve' && s.winner === 1) || (G.mode === 'online' && s.winner === G.me);
    if (venceuValido && !G.winRecorded && window.PocotoRank) {
      G.winRecorded = true;
      PocotoRank.registrar('poolWins', 1, 'add').catch(() => {});
    }
  }
  schedAI();
}
const canPlace = p => p.x > FL + R && p.x < FR - R && p.y > FT + R && p.y < FB - R && balls.every(b => Math.hypot(b.position.x - p.x, b.position.y - p.y) > 2 * R + 1);
function place(p) {
  cue.out = false; World.add(world, cue);
  Body.setPosition(cue, p); Body.setVelocity(cue, { x: 0, y: 0 }); G.phase = 'aim';
}
function canAct() {
  if (G.phase === 'moving' || G.phase === 'over') return false;
  if (G.mode === 'pve' && G.cur === 2) return false;
  if (G.mode === 'online') return !!conn && G.cur === G.me;
  return true;
}

// ---------- IA ----------
function ray(from, a) {
  const dx = Math.cos(a), dy = Math.sin(a); let best = null, bt = 1e9;
  for (const b of balls) {
    const px = b.position.x - from.x, py = b.position.y - from.y, t = px * dx + py * dy;
    if (t <= 0) continue;
    const d2 = px * px + py * py - t * t;
    if (d2 >= 4 * R * R) continue;
    const tt = t - Math.sqrt(4 * R * R - d2);
    if (tt < bt) { bt = tt; best = b; }
  }
  return { ball: best, t: best ? bt : 800 };
}
function schedAI() {
  clearTimeout(aiT);
  if (G.mode !== 'pve' || G.cur !== 2 || G.phase === 'moving' || G.phase === 'over') return;
  aiT = setTimeout(() => {
    if (G.phase === 'hand') {
      const spots = [[200,200],[150,200],[200,120],[200,280],[120,120],[120,280]];
      const s = spots.find(([x, y]) => canPlace({ x, y })) || [200, 200];
      place({ x: s[0], y: s[1] });
    }
    aiT = setTimeout(aiShoot, 700);
  }, 900);
}
function aiShoot() {
  if (G.phase !== 'aim' || G.cur !== 2 || G.mode !== 'pve') return;
  const c = cue.position;
  if (G.first) return doShot(Math.atan2(200 - c.y, 560 - c.x), 1);
  const cands = [];
  balls.filter(b => b.col === 2).forEach(b => POCKETS.forEach(p => {
    const dx = p.x - b.position.x, dy = p.y - b.position.y, d = Math.hypot(dx, dy);
    const gx = b.position.x - dx / d * 2 * R, gy = b.position.y - dy / d * 2 * R;
    const cx = gx - c.x, cy = gy - c.y, dc = Math.hypot(cx, cy), cos = (cx * dx + cy * dy) / (dc * d || 1);
    if (cos > 0.15) cands.push({ a: Math.atan2(cy, cx), dist: dc + d, score: dc + d * 1.2 - cos * 80 });
  }));
  cands.sort((x, y) => x.score - y.score);
  let pick = cands.find(k => { const r = ray(c, k.a); return r.ball && r.ball.col === 2; });
  if (!pick) {
    const t = balls.filter(b => b.col === 2).sort((a, b) => Math.hypot(a.position.x - c.x, a.position.y - c.y) - Math.hypot(b.position.x - c.x, b.position.y - c.y))[0];
    pick = cands[0] || { a: Math.atan2(t.position.y - c.y, t.position.x - c.x), dist: 300 };
  }
  doShot(pick.a + (Math.random() - 0.5) * 0.03, Math.min(1, Math.max(0.4, 0.35 + pick.dist / 900)));
}

// ---------- Entrada ----------
function mpos(e) {
  const r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e;
  return { x: (t.clientX - r.left) * W / r.width, y: (t.clientY - r.top) * H / r.height };
}
let lastSent = 0;
cv.addEventListener('mousemove', e => {
  mouse = mpos(e);
  if (G.phase === 'hand' && canAct()) {
    G.hp = { x: Math.min(FR - R, Math.max(FL + R, mouse.x)), y: Math.min(FB - R, Math.max(FT + R, mouse.y)) };
    if (performance.now() - lastSent > 40) { lastSent = performance.now(); send({ type: 'BALL_IN_HAND_MOVE', x: G.hp.x, y: G.hp.y }); }
  }
});
cv.addEventListener('click', e => {
  mouse = mpos(e);
  if (G.phase === 'hand' && canAct() && canPlace(G.hp)) { place(G.hp); send({ type: 'BALL_IN_HAND_PLACE', x: G.hp.x, y: G.hp.y }); }
});
addEventListener('keydown', e => {
  if (e.code !== 'Space' || e.target.tagName === 'INPUT') return;
  e.preventDefault();
  if (e.repeat || G.phase !== 'aim' || !canAct() || G.charging) return;
  G.charging = true; G.t0 = performance.now();
});
addEventListener('keyup', e => {
  if (e.code !== 'Space' || !G.charging) return;
  e.preventDefault();
  G.charging = false;
  if (G.phase !== 'aim' || !canAct()) return;
  const angle = Math.atan2(mouse.y - cue.position.y, mouse.x - cue.position.x), power = G.power;
  send({ type: 'SHOT', angle, power });
  doShot(angle, power);
});

// ---------- Rede (PeerJS) ----------
function send(o) { if (conn && conn.open) conn.send(o); }
const setNet = t => $('netStatus').textContent = t;
function onData(m) {
  if (!m || !m.type) return;
  if (m.type === 'INIT_BOARD') { clearTimeout(aiT); resetG(); buildBoard(m.balls); }
  else if (m.type === 'SHOT') doShot(m.angle, m.power);
  else if (m.type === 'BALL_IN_HAND_MOVE') G.hp = { x: m.x, y: m.y };
  else if (m.type === 'BALL_IN_HAND_PLACE') place({ x: m.x, y: m.y });
  else if (m.type === 'SYNC_END_TURN') applyState(m.state);
}
function setupConn(c) {
  conn = c;
  c.on('open', () => {
    G.mode = 'online'; G.me = isHost ? 1 : 2; updateModeBtn();
    setNet(isHost ? '🟢 Adversário conectado (você é P1 🔴)' : '🟢 Conectado (você é P2 🔵)');
    if (isHost) restart(true);
  });
  c.on('data', onData);
  c.on('close', () => { conn = null; G.mode = 'pvp'; updateModeBtn(); setNet('🔴 Conexão encerrada'); });
  c.on('error', () => setNet('⚠️ Erro na conexão'));
}
function closeNet() { if (conn) conn.close(); if (peer) peer.destroy(); conn = null; peer = null; }
function createRoom(tries = 0) {
  closeNet(); isHost = true; setNet('Criando sala...');
  const code = 'pocoto-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  try { peer = new Peer(code); } catch (e) { return setNet('⚠️ Não foi possível criar a sala'); }
  peer.on('open', id => { $('roomCode').textContent = id; $('roomBox').hidden = false; setNet('⏳ Aguardando adversário...'); });
  peer.on('connection', c => { if (conn) return c.close(); setupConn(c); });
  peer.on('error', err => {
    if (err.type === 'unavailable-id' && tries < 4) return createRoom(tries + 1);
    $('roomBox').hidden = true; setNet('⚠️ Erro ao criar sala: ' + err.type);
  });
}
function joinRoom() {
  let code = $('joinInput').value.trim();
  if (!code) return setNet('Digite o código da sala');
  if (!/^pocoto-/i.test(code)) code = 'pocoto-' + code;
  code = 'pocoto-' + code.slice(7).toUpperCase();
  closeNet(); isHost = false; $('roomBox').hidden = true; setNet('Conectando...');
  try { peer = new Peer(); } catch (e) { return setNet('⚠️ Falha ao iniciar conexão'); }
  peer.on('open', () => setupConn(peer.connect(code, { reliable: true })));
  peer.on('error', err => setNet(err.type === 'peer-unavailable' ? '⚠️ Sala não encontrada' : '⚠️ Erro: ' + err.type));
}
$('createBtn').onclick = () => createRoom();
$('joinBtn').onclick = joinRoom;
$('copyBtn').onclick = () => {
  const t = $('roomCode').textContent;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => $('copyBtn').textContent = '✅ Copiado', () => {
    const r = document.createRange(); r.selectNode($('roomCode')); getSelection().removeAllRanges(); getSelection().addRange(r); $('copyBtn').textContent = 'Selecione e copie';
  });
  setTimeout(() => $('copyBtn').textContent = '📋 Copiar', 1800);
};
function updateModeBtn() {
  $('modeBtn').textContent = G.mode === 'online' ? 'Modo: Online' : G.mode === 'pve' ? 'Modo: Contra IA (PvE)' : 'Modo: 2 Jogadores (PvP)';
}
$('modeBtn').onclick = () => {
  if (G.mode === 'online') return setNet('Saia da sala para trocar de modo');
  G.mode = G.mode === 'pvp' ? 'pve' : 'pvp'; updateModeBtn(); restart(false);
};
$('restartBtn').onclick = () => {
  if (G.mode === 'online' && !isHost) return setNet('Só o anfitrião pode reiniciar');
  restart(true);
};
$('winPlayAgain').onclick = () => $('restartBtn').click();

// ---------- Render ----------
function ball(x, y, col) {
  ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fillStyle = COLORS[col]; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(x - 3, y - 3, 2.6, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
}
function draw() {
  ctx.fillStyle = '#8B5A2B'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1e5622'; ctx.fillRect(FL, FT, FR - FL, FB - FT);
  ctx.fillStyle = '#000'; POCKETS.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 7); ctx.fill(); });
  CUSHIONS.forEach(v => {
    ctx.beginPath(); v.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = '#388e3c'; ctx.fill(); ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#000'; v.slice(0, 2).forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); });
  });
  balls.forEach(b => ball(b.position.x, b.position.y, b.col));
  if (G.phase === 'hand') {
    ctx.globalAlpha = canPlace(G.hp) ? 0.85 : 0.35; ball(G.hp.x, G.hp.y, 0); ctx.globalAlpha = 1;
  } else if (!cue.out) ball(cue.position.x, cue.position.y, 0);
  if (G.phase === 'aim' && canAct()) {
    const c = cue.position, a = Math.atan2(mouse.y - c.y, mouse.x - c.x), r = ray(c, a);
    const ex = c.x + Math.cos(a) * r.t, ey = c.y + Math.sin(a) * r.t;
    ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
    if (r.ball) { ctx.beginPath(); ctx.arc(ex, ey, R, 0, 7); ctx.stroke(); }
    const pull = 14 + G.power * 40;
    ctx.strokeStyle = '#d7a86e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(c.x - Math.cos(a) * pull, c.y - Math.sin(a) * pull);
    ctx.lineTo(c.x - Math.cos(a) * (pull + 170), c.y - Math.sin(a) * (pull + 170)); ctx.stroke(); ctx.lineCap = 'butt';
  }
}
const pname = p => p === 1 ? 'Jogador 1' : G.mode === 'pve' ? 'IA' : 'Jogador 2';
function updateWinScreen() {
  const over = G.phase === 'over' && G.winner;
  $('winOverlay').hidden = !over;
  if (!over) return;
  const winName = pname(G.winner) + (G.mode === 'online' && G.winner === G.me ? ' (Você!)' : '');
  $('winTitle').textContent = winName + ' venceu!';
  $('winSub').textContent = G.winner === 1 ? 'Todas as bolas vermelhas 🔴 foram encaçapadas!' : 'Todas as bolas azuis 🔵 foram encaçapadas!';
  $('winScore').textContent = `Placar: P1 ${G.wins[1]} × ${G.wins[2]} ${G.mode === 'pve' ? 'IA' : 'P2'}`;
}
function hud() {
  const who = pname(G.cur) + (G.mode === 'online' && G.cur === G.me ? ' (você)' : '');
  $('turnTxt').textContent = G.phase === 'over' ? '🏆 ' + pname(G.winner) + ' venceu!' : 'Vez: ' + who + (G.cur === 1 ? ' 🔴' : ' 🔵');
  const n = [];
  if (G.first && G.phase !== 'over') n.push('💥 Estourada Inicial');
  if (G.reason) n.push('❌ Infração: ' + G.reason);
  if (G.phase === 'hand') n.push('✋ Bola na Mão');
  $('notice').textContent = n.join(' · ');
  $('cnt').textContent = `🔴 ${G.rem[1]} × ${G.rem[2]} 🔵`;
  $('score').textContent = `P1 ${G.wins[1]} × ${G.wins[2]} ${G.mode === 'pve' ? 'IA' : 'P2'}`;
  const p = Math.round(G.power * 100);
  $('powerFill').style.height = p + '%'; $('powerTxt').textContent = p + '%';
  updateWinScreen();
}
function loop(now) {
  if (G.charging) { const t = ((now - G.t0) / 700) % 2; G.power = t < 1 ? t : 2 - t; }
  else if (G.phase !== 'aim') G.power = 0;
  if (G.phase === 'moving') { physicsStep(); if (allStopped()) endTurn(); }
  draw(); hud(); requestAnimationFrame(loop);
}
restart(false); updateModeBtn(); requestAnimationFrame(loop);
})();