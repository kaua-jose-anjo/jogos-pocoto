(() => {
const { Engine, World, Bodies, Body, Events, Vertices } = Matter;
const W = 800, H = 400, R = 10;
const STOP_THRESHOLD = 0.15, CAPTURE_RADIUS = 26, SUCTION_RADIUS = 34;
const FL = 30, FR = 770, FT = 30, FB = 370;
const POCKETS = [[FL,FT],[400,FT],[FR,FT],[FL,FB],[400,FB],[FR,FB]].map(([x,y]) => ({ x, y }));
const CUSHIONS = [
  [[58,30],[374,30],[390,14],[42,14]], [[426,30],[742,30],[758,14],[410,14]],
  [[58,370],[374,370],[390,386],[42,386]], [[426,370],[742,370],[758,386],[410,386]],
  [[30,58],[30,342],[14,358],[14,42]], [[770,58],[770,342],[786,358],[786,42]]
];
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const COLORS = { 0: '#ffffff', 1: '#e53935', 2: '#1e88e5' };

// ---------- Física (Autoritativa no Host / Local) ----------
const engine = Engine.create();
engine.gravity.x = 0; engine.gravity.y = 0; engine.gravity.scale = 0;
engine.positionIterations = 10; engine.velocityIterations = 10;
const world = engine.world;

CUSHIONS.forEach(v => {
  const pts = v.map(([x, y]) => ({ x, y }));
  const c = Vertices.centre(pts);
  World.add(world, Bodies.fromVertices(c.x, c.y, [pts], { isStatic: true, restitution: 0.8, friction: 0, label: 'cushion' }));
});
World.add(world, [
  Bodies.rectangle(400, -20, 1000, 68, { isStatic: true }), Bodies.rectangle(400, 420, 1000, 68, { isStatic: true }),
  Bodies.rectangle(-20, 200, 68, 600, { isStatic: true }), Bodies.rectangle(820, 200, 68, 600, { isStatic: true })
]);

let balls = [], cue = null;
function makeBall(x, y, id, col) {
  const b = Bodies.circle(x, y, R, { restitution: 0.95, friction: 0, frictionStatic: 0, frictionAir: 0.014, density: 0.002 });
  b.pid = id; b.col = col; b.tx = x; b.ty = y; return b;
}
function genRack() {
  const rows = [1,2,3,4,5,1], list = [];
  const cols = Array.from({ length: 16 }, (_, i) => i % 2 + 1).sort(() => Math.random() - 0.5);
  let id = 0;
  rows.forEach((n, r) => { for (let k = 0; k < n; k++) {
    list.push({ id, col: cols[id], x: 560 + r * (R * 1.732 + 0.6), y: 200 + (k - (n - 1) / 2) * (2 * R + 0.6) }); id++;
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
const G = {
  mode: 'pvp', cur: 1, first: true, phase: 'aim', reason: '', winner: 0, me: 1,
  rem: { 1: 8, 2: 8 }, wins: { 1: 0, 2: 0 }, hp: { x: 200, y: 200 },
  charging: false, power: 0, t0: 0, winRecorded: false,
  remoteAim: { a: 0, p: 0 }
};
let firstHit = null, pocketed = [], cuePocketed = false, mouse = { x: 400, y: 200 }, aiT = null;

// Estado da Sala Firestore
let roomRef = null, unsubRoom = null, isHost = false, guestJoined = false;
let lastShotId = '', lastActionId = '', lastSyncPush = 0, lastAimPush = 0;
const myClientId = Math.random().toString(36).slice(2, 10);

const isAuthoritative = () => G.mode !== 'online' || isHost;

function serializeBalls() {
  return balls.map(b => ({
    id: b.pid,
    col: b.col,
    x: Math.round(b.position.x * 10) / 10,
    y: Math.round(b.position.y * 10) / 10
  }));
}

function serializeCue() {
  return {
    out: !!cue.out,
    x: Math.round(cue.position.x * 10) / 10,
    y: Math.round(cue.position.y * 10) / 10
  };
}

function resetG() {
  Object.assign(G, {
    cur: 1, first: true, phase: 'aim', reason: '', winner: 0,
    rem: { 1: 8, 2: 8 }, charging: false, power: 0, winRecorded: false
  });
}

async function restart(syncCloud = true) {
  clearTimeout(aiT);
  resetG();
  const list = genRack();
  buildBoard(list);
  if (syncCloud && G.mode === 'online' && roomRef && isHost) {
    lastShotId = '';
    lastActionId = '';
    await roomRef.set({
      status: guestJoined ? 'playing' : 'waiting',
      hostId: myClientId,
      guestId: guestJoined ? 'connected' : null,
      phase: 'aim',
      cur: 1,
      first: true,
      reason: '',
      winner: 0,
      rem: { 1: 8, 2: 8 },
      wins: G.wins,
      balls: list,
      cue: { out: false, x: 200, y: 200 },
      hp: { x: 200, y: 200 },
      shot: null,
      action: null,
      aim: { a: 0, p: 0 },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
  schedAI();
}

Events.on(engine, 'collisionStart', e => e.pairs.forEach(({ bodyA: a, bodyB: b }) => {
  if (!isAuthoritative() || G.phase !== 'moving' || firstHit) return;
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
      if (Math.hypot(b.velocity.x, b.velocity.y) < STOP_THRESHOLD) {
        Body.setVelocity(b, { x: 0, y: 0 });
        Body.setAngularVelocity(b, 0);
      }
    });
  }
}

const allStopped = () => [cue, ...balls].every(b => b.out || (b.velocity.x === 0 && b.velocity.y === 0));

// ---------- Tacada e Regras (Host Autoritativo) ----------
function executeShotPhysics(angle, power) {
  G.reason = '';
  G.charging = false;
  firstHit = null;
  pocketed = [];
  cuePocketed = false;
  const v = Math.max(0.05, power) * 22;
  Body.setVelocity(cue, { x: Math.cos(angle) * v, y: Math.sin(angle) * v });
  G.phase = 'moving';
}

function triggerShot(angle, power) {
  if (G.mode === 'online' && !isHost) {
    // Visitante envia o comando da tacada para o Host simular
    G.charging = false;
    G.phase = 'moving';
    const id = Math.random().toString(36).slice(2, 9);
    roomRef.update({
      phase: 'moving',
      shot: { id, angle, power, by: 2 }
    }).catch(() => {});
    return;
  }

  executeShotPhysics(angle, power);
  if (G.mode === 'online' && isHost && roomRef) {
    roomRef.update({
      phase: 'moving',
      reason: '',
      balls: serializeBalls(),
      cue: serializeCue()
    }).catch(() => {});
  }
}

function endTurn() {
  if (!isAuthoritative()) return;
  const own = G.cur;
  let foul = false, reason = '';
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

  const cuePos = cue.out ? { x: 200, y: 200 } : { x: cue.position.x, y: cue.position.y };
  const s = {
    balls: serializeBalls(),
    cue: cuePos,
    rem: { ...G.rem },
    wins: { ...G.wins },
    cur: next,
    hand: foul,
    reason,
    winner
  };

  applyState(s);

  if (G.mode === 'online' && isHost && roomRef) {
    roomRef.update({
      phase: s.winner ? 'over' : (s.hand ? 'hand' : 'aim'),
      cur: s.cur,
      first: false,
      reason: s.reason,
      winner: s.winner,
      rem: s.rem,
      wins: s.wins,
      balls: s.balls,
      cue: { out: s.hand, x: s.cue.x, y: s.cue.y },
      hp: { x: s.cue.x, y: s.cue.y },
      shot: null,
      action: null
    }).catch(() => {});
  }
}

function applyState(s) {
  const ids = new Set(s.balls.map(b => b.id));
  balls = balls.filter(b => {
    if (ids.has(b.pid)) return true;
    World.remove(world, b);
    return false;
  });
  s.balls.forEach(o => {
    const b = balls.find(x => x.pid === o.id);
    if (b) {
      b.tx = o.x; b.ty = o.y;
      Body.setPosition(b, { x: o.x, y: o.y });
      Body.setVelocity(b, { x: 0, y: 0 });
    }
  });
  Object.assign(G, {
    cur: s.cur,
    rem: s.rem,
    wins: s.wins,
    first: false,
    reason: s.reason,
    winner: s.winner,
    charging: false
  });
  if (s.hand) {
    if (!cue.out) { World.remove(world, cue); cue.out = true; }
    G.hp = { x: s.cue.x, y: s.cue.y };
    G.phase = 'hand';
  } else {
    if (cue.out) { cue.out = false; World.add(world, cue); }
    cue.tx = s.cue.x; cue.ty = s.cue.y;
    Body.setPosition(cue, { x: s.cue.x, y: s.cue.y });
    Body.setVelocity(cue, { x: 0, y: 0 });
    G.phase = 'aim';
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

const canPlace = p => p.x > FL + R && p.x < FR - R && p.y > FT + R && p.y < FB - R &&
  balls.every(b => Math.hypot(b.position.x - p.x, b.position.y - p.y) > 2 * R + 1);

function place(p) {
  cue.out = false;
  World.add(world, cue);
  cue.tx = p.x; cue.ty = p.y;
  Body.setPosition(cue, p);
  Body.setVelocity(cue, { x: 0, y: 0 });
  G.phase = 'aim';
}

function canAct() {
  if (G.phase === 'moving' || G.phase === 'over') return false;
  if (G.mode === 'pve' && G.cur === 2) return false;
  if (G.mode === 'online') return guestJoined && G.cur === G.me;
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
  if (G.first) return triggerShot(Math.atan2(200 - c.y, 560 - c.x), 1);
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
  triggerShot(pick.a + (Math.random() - 0.5) * 0.03, Math.min(1, Math.max(0.4, 0.35 + pick.dist / 900)));
}

// ---------- Entrada ----------
function mpos(e) {
  const r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e;
  return { x: (t.clientX - r.left) * W / r.width, y: (t.clientY - r.top) * H / r.height };
}

cv.addEventListener('mousemove', e => {
  mouse = mpos(e);
  if (!canAct()) return;

  if (G.phase === 'hand') {
    G.hp = { x: Math.min(FR - R, Math.max(FL + R, mouse.x)), y: Math.min(FB - R, Math.max(FT + R, mouse.y)) };
    if (G.mode === 'online' && roomRef && performance.now() - lastAimPush > 90) {
      lastAimPush = performance.now();
      roomRef.update({ hp: G.hp }).catch(() => {});
    }
  } else if (G.phase === 'aim' && G.mode === 'online' && roomRef && performance.now() - lastAimPush > 110) {
    lastAimPush = performance.now();
    const a = Math.atan2(mouse.y - cue.position.y, mouse.x - cue.position.x);
    roomRef.update({ aim: { a, p: G.power } }).catch(() => {});
  }
});

cv.addEventListener('click', e => {
  mouse = mpos(e);
  if (G.phase === 'hand' && canAct() && canPlace(G.hp)) {
    const pos = { x: G.hp.x, y: G.hp.y };
    place(pos);
    if (G.mode === 'online' && roomRef) {
      const id = Math.random().toString(36).slice(2, 9);
      roomRef.update({
        phase: 'aim',
        cue: { out: false, x: pos.x, y: pos.y },
        action: { id, type: 'PLACE', x: pos.x, y: pos.y }
      }).catch(() => {});
    }
  }
});

addEventListener('keydown', e => {
  if (e.code !== 'Space' || e.target.tagName === 'INPUT') return;
  e.preventDefault();
  if (e.repeat || G.phase !== 'aim' || !canAct() || G.charging) return;
  G.charging = true;
  G.t0 = performance.now();
});

addEventListener('keyup', e => {
  if (e.code !== 'Space' || !G.charging) return;
  e.preventDefault();
  G.charging = false;
  if (G.phase !== 'aim' || !canAct()) return;
  const angle = Math.atan2(mouse.y - cue.position.y, mouse.x - cue.position.x);
  const power = G.power;
  triggerShot(angle, power);
});

// ---------- Servidor Online (Firestore Realtime) ----------
const setNet = t => $('netStatus').textContent = t;

function closeNet() {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  roomRef = null;
  isHost = false;
  guestJoined = false;
}

function subscribeRoom(ref) {
  roomRef = ref;
  unsubRoom = ref.onSnapshot(snap => {
    if (!snap.exists) return;
    const d = snap.data();

    // Notifica entrada do P2
    if (d.guestId && !guestJoined) {
      guestJoined = true;
      setNet(isHost ? '🟢 Adversário entrou! Você é P1 🔴' : '🟢 Conectado na sala! Você é P2 🔵');
    }

    if (d.aim) G.remoteAim = d.aim;

    if (isHost) {
      // Host escuta comandos do Visitante (P2)
      if (d.shot && d.shot.by === 2 && d.shot.id !== lastShotId && G.cur === 2) {
        lastShotId = d.shot.id;
        executeShotPhysics(d.shot.angle, d.shot.power);
      }
      if (d.action && d.action.type === 'PLACE' && d.action.id !== lastActionId && G.cur === 2) {
        lastActionId = d.action.id;
        place({ x: d.action.x, y: d.action.y });
      }
      if (d.hp && G.cur === 2 && G.phase === 'hand') {
        G.hp = d.hp;
      }
    } else {
      // Visitante (P2) espelha fielmente o estado autoritativo do Host
      if (d.balls) {
        if (balls.length !== d.balls.length) {
          buildBoard(d.balls);
        } else {
          d.balls.forEach(o => {
            const b = balls.find(x => x.pid === o.id);
            if (b) {
              b.tx = o.x;
              b.ty = o.y;
              if (d.phase !== 'moving') {
                Body.setPosition(b, { x: o.x, y: o.y });
                Body.setVelocity(b, { x: 0, y: 0 });
              }
            }
          });
        }
      }

      if (d.cue) {
        if (d.cue.out && !cue.out) {
          World.remove(world, cue);
          cue.out = true;
        } else if (!d.cue.out && cue.out) {
          cue.out = false;
          World.add(world, cue);
        }
        if (!cue.out) {
          cue.tx = d.cue.x;
          cue.ty = d.cue.y;
          if (d.phase !== 'moving') {
            Body.setPosition(cue, { x: d.cue.x, y: d.cue.y });
            Body.setVelocity(cue, { x: 0, y: 0 });
          }
        }
      }

      if (d.hp && !(G.cur === 2 && d.phase === 'hand')) {
        G.hp = d.hp;
      }

      const prevPhase = G.phase;
      G.phase = d.phase || 'aim';
      G.cur = d.cur || 1;
      G.first = !!d.first;
      G.reason = d.reason || '';
      G.winner = d.winner || 0;
      if (d.rem) G.rem = d.rem;
      if (d.wins) G.wins = d.wins;

      if (G.phase === 'over' && prevPhase !== 'over' && G.winner === G.me && !G.winRecorded && window.PocotoRank) {
        G.winRecorded = true;
        PocotoRank.registrar('poolWins', 1, 'add').catch(() => {});
      }
    }
  }, err => {
    setNet('⚠️ Erro de sincronização: ' + err.message);
  });
}

async function createRoom() {
  if (!window.fbDb) return setNet('⚠️ Firebase não carregado');
  closeNet();
  isHost = true;
  guestJoined = false;
  G.mode = 'online';
  G.me = 1;
  updateModeBtn();
  setNet('Criando sala no servidor...');

  const code = 'pocoto-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const ref = fbDb.collection('salas_8ball').doc(code);

  try {
    await restart(false);
    await ref.set({
      status: 'waiting',
      hostId: myClientId,
      guestId: null,
      phase: 'aim',
      cur: 1,
      first: true,
      reason: '',
      winner: 0,
      rem: { 1: 8, 2: 8 },
      wins: { 1: 0, 2: 0 },
      balls: serializeBalls(),
      cue: serializeCue(),
      hp: { x: 200, y: 200 },
      shot: null,
      action: null,
      aim: { a: 0, p: 0 },
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $('roomCode').textContent = code;
    $('roomBox').hidden = false;
    setNet('⏳ Aguardando adversário entrar...');
    subscribeRoom(ref);
  } catch (e) {
    setNet('⚠️ Libere salas_8ball nas regras do Firestore');
  }
}

async function joinRoom() {
  if (!window.fbDb) return setNet('⚠️ Firebase não carregado');
  let code = $('joinInput').value.trim();
  if (!code) return setNet('Digite o código da sala');
  if (!/^pocoto-/i.test(code)) code = 'pocoto-' + code;
  code = 'pocoto-' + code.slice(7).toUpperCase();

  closeNet();
  $('roomBox').hidden = true;
  setNet('Buscando sala...');

  try {
    const ref = fbDb.collection('salas_8ball').doc(code);
    const snap = await ref.get();
    if (!snap.exists) return setNet('⚠️ Sala não encontrada');

    isHost = false;
    guestJoined = true;
    G.mode = 'online';
    G.me = 2;
    updateModeBtn();

    await ref.update({
      guestId: myClientId,
      status: 'playing'
    });

    setNet('🟢 Conectado! Você é P2 🔵');
    subscribeRoom(ref);
  } catch (e) {
    setNet('⚠️ Erro ao entrar na sala');
  }
}

$('createBtn').onclick = () => createRoom();
$('joinBtn').onclick = () => joinRoom();
$('copyBtn').onclick = () => {
  const t = $('roomCode').textContent;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => $('copyBtn').textContent = '✅ Copiado', () => {
    const r = document.createRange(); r.selectNode($('roomCode')); getSelection().removeAllRanges(); getSelection().addRange(r); $('copyBtn').textContent = 'Selecione e copie';
  });
  setTimeout(() => $('copyBtn').textContent = '📋 Copiar', 1800);
};

function updateModeBtn() {
  $('modeBtn').textContent = G.mode === 'online' ? 'Modo: Online (Sair)' : G.mode === 'pve' ? 'Modo: Contra IA (PvE)' : 'Modo: 2 Jogadores (PvP)';
}

$('modeBtn').onclick = () => {
  if (G.mode === 'online') {
    closeNet();
    $('roomBox').hidden = true;
    G.mode = 'pvp';
    G.me = 1;
    setNet('Offline');
    updateModeBtn();
    restart(false);
    return;
  }
  G.mode = G.mode === 'pvp' ? 'pve' : 'pvp';
  updateModeBtn();
  restart(false);
};

$('restartBtn').onclick = () => {
  if (G.mode === 'online' && !isHost) return setNet('Só o anfitrião (P1) pode reiniciar');
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
    ctx.globalAlpha = canPlace(G.hp) ? 0.85 : 0.35;
    ball(G.hp.x, G.hp.y, 0);
    ctx.globalAlpha = 1;
  } else if (!cue.out) {
    ball(cue.position.x, cue.position.y, 0);
  }

  // Desenha o taco (tanto na sua vez quanto o taco do adversário online ao vivo)
  if (G.phase === 'aim' && !cue.out) {
    const showLocal = canAct();
    const showRemote = G.mode === 'online' && guestJoined && G.cur !== G.me;
    if (showLocal || showRemote) {
      const c = cue.position;
      const a = showLocal ? Math.atan2(mouse.y - c.y, mouse.x - c.x) : G.remoteAim.a;
      const pwr = showLocal ? G.power : G.remoteAim.p;
      const r = ray(c, a);
      const ex = c.x + Math.cos(a) * r.t, ey = c.y + Math.sin(a) * r.t;

      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = showLocal ? 'rgba(255,255,255,.7)' : 'rgba(255,215,0,.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);

      if (r.ball) { ctx.beginPath(); ctx.arc(ex, ey, R, 0, 7); ctx.stroke(); }
      const pull = 14 + pwr * 40;
      ctx.strokeStyle = showLocal ? '#d7a86e' : '#b8864b';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x - Math.cos(a) * pull, c.y - Math.sin(a) * pull);
      ctx.lineTo(c.x - Math.cos(a) * (pull + 170), c.y - Math.sin(a) * (pull + 170));
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
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
  $('powerFill').style.height = p + '%';
  $('powerTxt').textContent = p + '%';
  updateWinScreen();
}

function loop(now) {
  if (G.charging) {
    const t = ((now - G.t0) / 700) % 2;
    G.power = t < 1 ? t : 2 - t;
    if (G.mode === 'online' && roomRef && now - lastAimPush > 110) {
      lastAimPush = now;
      const a = Math.atan2(mouse.y - cue.position.y, mouse.x - cue.position.x);
      roomRef.update({ aim: { a, p: G.power } }).catch(() => {});
    }
  } else if (G.phase !== 'aim') {
    G.power = 0;
  }

  if (G.phase === 'moving') {
    if (isAuthoritative()) {
      physicsStep();
      // Host transmite keyframes das bolas a cada 85ms durante a tacada
      if (G.mode === 'online' && isHost && roomRef && now - lastSyncPush > 85) {
        lastSyncPush = now;
        roomRef.update({ balls: serializeBalls(), cue: serializeCue() }).catch(() => {});
      }
      if (allStopped()) endTurn();
    } else {
      // Visitante (P2) interpola suavemente até a posição real do Host
      balls.forEach(b => {
        if (typeof b.tx === 'number') {
          Body.setPosition(b, {
            x: b.position.x + (b.tx - b.position.x) * 0.45,
            y: b.position.y + (b.ty - b.position.y) * 0.45
          });
        }
      });
      if (!cue.out && typeof cue.tx === 'number') {
        Body.setPosition(cue, {
          x: cue.position.x + (cue.tx - cue.position.x) * 0.45,
          y: cue.position.y + (cue.ty - cue.position.y) * 0.45
        });
      }
    }
  }

  draw();
  hud();
  requestAnimationFrame(loop);
}

restart(false);
updateModeBtn();
requestAnimationFrame(loop);
})();