'use strict';

/* =====================================================
   SIMULADOR DE CARREIRA DE FUTEBOL
   ===================================================== */

const SAVE_KEY = 'simCarreiraFutebol_v1';

/* ---------- 1. DADOS ---------- */

// Competições por região (liga, copa e torneio continental)
const REGIONS = {
  BR: { liga: 'Campeonato Brasileiro', copa: 'Copa do Brasil', cont: 'Libertadores' },
  AR: { liga: 'Liga Argentina', copa: 'Copa Argentina', cont: 'Libertadores' },
  CL: { liga: 'Campeonato Chileno', copa: 'Copa Chile', cont: 'Libertadores' },
  PT: { liga: 'Liga Portugal', copa: 'Taça de Portugal', cont: 'Champions League' },
  NL: { liga: 'Eredivisie', copa: 'KNVB Beker', cont: 'Champions League' },
  ES: { liga: 'La Liga', copa: 'Copa del Rey', cont: 'Champions League' },
  EN: { liga: 'Premier League', copa: 'FA Cup', cont: 'Champions League' },
  DE: { liga: 'Bundesliga', copa: 'DFB-Pokal', cont: 'Champions League' },
  FR: { liga: 'Ligue 1', copa: 'Coupe de France', cont: 'Champions League' },
  IT: { liga: 'Serie A', copa: 'Coppa Italia', cont: 'Champions League' }
};

// n = nome, t = tier (1 a 4), r = região
const CLUBS = [
  // Nível 1: base / pequenos
  { n: 'Chapecoense', t: 1, r: 'BR' }, { n: 'Goiás', t: 1, r: 'BR' },
  { n: 'Cuiabá', t: 1, r: 'BR' }, { n: 'Vitória', t: 1, r: 'BR' },
  { n: 'Argentinos Juniors', t: 1, r: 'AR' }, { n: 'Defensa y Justicia', t: 1, r: 'AR' },
  { n: 'Famalicão', t: 1, r: 'PT' },
  // Nível 2: médios nacionais
  { n: 'Athletico-PR', t: 2, r: 'BR' }, { n: 'Bahia', t: 2, r: 'BR' },
  { n: 'Fortaleza', t: 2, r: 'BR' }, { n: 'Colo-Colo', t: 2, r: 'CL' },
  { n: 'Vélez Sarsfield', t: 2, r: 'AR' }, { n: 'Estudiantes', t: 2, r: 'AR' },
  { n: 'Braga', t: 2, r: 'PT' },
  // Nível 3: grandes nacionais / médios europeus
  { n: 'Flamengo', t: 3, r: 'BR' }, { n: 'Palmeiras', t: 3, r: 'BR' },
  { n: 'River Plate', t: 3, r: 'AR' }, { n: 'Boca Juniors', t: 3, r: 'AR' },
  { n: 'Benfica', t: 3, r: 'PT' }, { n: 'Porto', t: 3, r: 'PT' },
  { n: 'Ajax', t: 3, r: 'NL' }, { n: 'Sevilla', t: 3, r: 'ES' },
  // Nível 4: gigantes europeus
  { n: 'Real Madrid', t: 4, r: 'ES' }, { n: 'Barcelona', t: 4, r: 'ES' },
  { n: 'Manchester City', t: 4, r: 'EN' }, { n: 'Liverpool', t: 4, r: 'EN' },
  { n: 'Arsenal', t: 4, r: 'EN' }, { n: 'Bayern de Munique', t: 4, r: 'DE' },
  { n: 'PSG', t: 4, r: 'FR' }, { n: 'Inter de Milão', t: 4, r: 'IT' }
];

const START_CLUBS = ['Chapecoense', 'Argentinos Juniors', 'Famalicão'];

// Parâmetros por posição: g = peso de gols, a = peso de assistências, th = desempenho esperado de um craque
const POS = {
  'Atacante':      { g: 1.00, a: 0.35, th: 30 },
  'Meio-campista': { g: 0.45, a: 0.60, th: 24 },
  'Defensor':      { g: 0.12, a: 0.20, th: 12 },
  'Goleiro':       { g: 0,    a: 0.02, th: 16 }
};

// Chance base de título por tier (índice 0 = tier 1)
const CH_LIGA = [0.03, 0.10, 0.25, 0.40];
const CH_COPA = [0.04, 0.10, 0.20, 0.25];
const CH_CONT = [0, 0.02, 0.08, 0.25];

/* ---------- 2. UTILIDADES ---------- */

const $ = id => document.getElementById(id);
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;          // inteiro entre a e b
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const clubOf = name => CLUBS.find(c => c.n === name);

// Formata valores (guardados em milhões de euros)
const fmt = m => m >= 1 ? `€ ${m.toFixed(1)} mi` : `€ ${Math.round(m * 1000)} mil`;

let S = null;      // estado do jogo (jogador + carreira)
let busy = false;  // trava os botões durante a simulação/modais

/* ---------- 3. ECONOMIA ---------- */

// Valor de mercado cresce com o overall e cai com a idade
function marketValue(p = S) {
  const base = Math.pow(Math.max(p.ovr - 45, 0), 2.4) / 40;
  const ageF = p.age <= 23 ? 1.3 : p.age <= 29 ? 1 : p.age <= 32 ? 0.6 : 0.3;
  return Math.max(0.05, base * ageF);
}
// Salário anual (milhões) conforme o tier do clube
const salaryAt = tier => Math.round((0.15 + marketValue() * 0.05 * (0.6 + tier * 0.2)) * 10) / 10;

/* ---------- 4. PERSISTÊNCIA ---------- */

const save = () => localStorage.setItem(SAVE_KEY, JSON.stringify(S));

function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}

/* ---------- 5. TELAS E RENDER ---------- */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

// Adiciona entrada ao histórico (mais recente primeiro)
function addLog(msg, type = '', age = S.age) {
  S.log.unshift({ age, club: S.club, msg, type });
  S.log = S.log.slice(0, 300);
}

function render() {
  $('p-avatar').textContent = S.name.trim()[0].toUpperCase();
  $('p-name').textContent = S.name;
  $('p-age').textContent = S.age;
  $('p-pos').textContent = S.pos;
  $('p-club').textContent = S.club;
  $('p-ovr').textContent = S.ovr;
  $('p-value').textContent = fmt(marketValue());
  $('p-money').textContent = fmt(S.money);
  $('bar-morale').style.width = S.morale + '%';
  $('bar-fit').style.width = S.fitness + '%';
  $('v-morale').textContent = S.morale;
  $('v-fit').textContent = S.fitness;
  const st = S.stats;
  $('st-games').textContent = st.games;
  $('st-goals').textContent = st.goals;
  $('st-assists').textContent = st.assists;
  $('st-titles').textContent = st.titles;
  $('st-ballons').textContent = st.ballons;

  $('log').innerHTML = S.log.map(l =>
    `<li><span class="tag">${l.age} anos · ${l.club}</span><span class="${l.type}">${l.msg}</span></li>`
  ).join('');

  $('btn-sim').disabled = busy;
  $('btn-train').disabled = busy || S.trained;
  $('btn-train').textContent = S.trained ? 'Treino feito' : 'Treinar';
}

/* ---------- 6. MODAL (baseado em Promise) ---------- */

// Mostra opções e devolve (via await) o índice escolhido
function askChoice(title, text, opts) {
  return new Promise(resolve => {
    $('modal-title').textContent = title;
    $('modal-text').textContent = text;
    const box = $('modal-options');
    box.innerHTML = '';
    opts.forEach((label, i) => {
      const b = document.createElement('button');
      b.className = 'btn' + (i === 0 ? ' primary' : '');
      b.textContent = label;
      b.onclick = () => { $('modal').classList.add('hidden'); resolve(i); };
      box.appendChild(b);
    });
    $('modal').classList.remove('hidden');
  });
}

/* ---------- 7. EVENTOS ALEATÓRIOS ---------- */
// Cada opção tem um label e uma função run() que aplica os efeitos e devolve a mensagem do log
const EVENTS = [
  {
    when: s => s.ovr >= 70,
    title: '🌎 Convocação para a Seleção',
    text: 'O técnico da seleção quer você na próxima convocação. Aceitar ou poupar o corpo?',
    opts: [
      { label: 'Aceitar a convocação', run: s => {
        s.morale = clamp(s.morale + 10, 0, 100);
        if (s.ovr >= 78 && Math.random() < 0.2) {
          s.stats.titles++;
          s.trophies.push({ age: s.age, club: 'Seleção', name: 'Torneio com a Seleção' });
          return ['Convocado, você foi campeão com a Seleção! 🏆', 'gold'];
        }
        return ['Você defendeu a Seleção e ganhou prestígio.', ''];
      } },
      { label: 'Recusar para descansar', run: s => {
        s.morale = clamp(s.morale - 5, 0, 100);
        return ['Você recusou a convocação. A torcida não gostou.', ''];
      } }
    ]
  },
  {
    when: () => true,
    title: '🚑 Lesão grave',
    text: 'Você sofreu uma lesão séria. Cirurgia arriscada (65% de sucesso total) ou tratamento conservador?',
    opts: [
      { label: 'Fazer a cirurgia arriscada', run: s => {
        if (Math.random() < 0.65) { s.morale = clamp(s.morale + 5, 0, 100); return ['A cirurgia foi um sucesso total!', '']; }
        s.ovr = clamp(s.ovr - 3, 50, 99); s.morale = clamp(s.morale - 10, 0, 100);
        return ['A cirurgia deu errado: -3 de overall.', 'bad'];
      } },
      { label: 'Tratamento conservador', run: s => {
        s.ovr = clamp(s.ovr - 1, 50, 99); s.morale = clamp(s.morale - 3, 0, 100);
        return ['Recuperação lenta e segura: -1 de overall.', ''];
      } }
    ]
  },
  {
    when: () => true,
    title: '💼 Proposta de patrocínio',
    text: 'Uma marca esportiva quer você como garoto-propaganda. Isso rende dinheiro, mas toma tempo.',
    opts: [
      { label: 'Assinar o patrocínio', run: s => {
        const v = Math.round((0.5 + marketValue() * 0.1) * 10) / 10;
        s.money += v; s.morale = clamp(s.morale - 3, 0, 100);
        return [`Você assinou o patrocínio e recebeu ${fmt(v)}.`, ''];
      } },
      { label: 'Recusar e focar no campo', run: s => {
        s.morale = clamp(s.morale + 5, 0, 100);
        return ['Você recusou o patrocínio para focar no futebol.', ''];
      } }
    ]
  },
  {
    when: () => true,
    title: '🗣️ Discussão com o técnico',
    text: 'Você se desentendeu com o treinador depois de ser substituído.',
    opts: [
      { label: 'Pedir desculpas', run: s => {
        s.morale = clamp(s.morale + 3, 0, 100);
        return ['Você pediu desculpas e a paz voltou ao vestiário.', ''];
      } },
      { label: 'Bater de frente', run: s => {
        if (Math.random() < 0.5) { s.morale = clamp(s.morale + 8, 0, 100); return ['A torcida apoiou sua postura!', '']; }
        s.morale = clamp(s.morale - 15, 0, 100);
        return ['A imprensa te criticou e o clima ficou pesado.', 'bad'];
      } }
    ]
  }
];

async function runRandomEvent() {
  const ev = shuffle(EVENTS.filter(e => e.when(S)))[0];
  const i = await askChoice(ev.title, ev.text, ev.opts.map(o => o.label));
  const [msg, type] = ev.opts[i].run(S);
  addLog(`${ev.title}: ${msg}`, type);
}

/* ---------- 8. TRANSFERÊNCIAS ---------- */

async function transferWindow() {
  // Tier máximo que se interessa pelo jogador, conforme o overall
  const maxTier = S.ovr >= 83 ? 4 : S.ovr >= 74 ? 3 : S.ovr >= 62 ? 2 : 1;
  const cur = clubOf(S.club);
  let pool = CLUBS.filter(c => c.n !== S.club && c.t <= maxTier && c.t >= cur.t - 1);
  if (!pool.length) pool = CLUBS.filter(c => c.n !== S.club && c.t <= maxTier);
  const offers = shuffle(pool).slice(0, 3);

  const renewSalary = salaryAt(cur.t);
  const labels = offers.map(c => `Aceitar: ${c.n} (Nível ${c.t}) · ${fmt(salaryAt(c.t))}/ano`);
  labels.push(`Renovar com ${S.club} · ${fmt(renewSalary)}/ano + luvas`);

  const i = await askChoice('📩 Fim de contrato',
    `Seu contrato acabou. Você tem ${S.ovr} de overall e ${S.age} anos. O que fazer?`, labels);

  if (i < offers.length) {
    const c = offers[i];
    S.club = c.n;
    S.contract = rand(2, 4);
    S.clubs.push({ club: c.n, from: S.age });
    addLog(`Transferência: você assinou com o ${c.n}!`, 'gold');
  } else {
    S.contract = rand(1, 3);
    S.money += renewSalary * 0.5;
    addLog(`Você renovou com o ${S.club} e recebeu ${fmt(renewSalary * 0.5)} de luvas.`);
  }
}

/* ---------- 9. SIMULAÇÃO DA TEMPORADA ---------- */

async function simulateSeason() {
  if (busy || S.retired) return;
  busy = true; render();

  const club = clubOf(S.club), reg = REGIONS[club.r], P = POS[S.pos];
  const age0 = S.age;   // idade durante a temporada (para o log)

  // --- Jogos: depende do nível do jogador vs. nível do clube ---
  const baseOvr = [55, 68, 78, 86][club.t - 1];
  const playTime = clamp(0.55 + (S.ovr - baseOvr) / 25, 0.25, 1);
  const games = Math.round(rand(32, 52) * playTime * (0.7 + 0.3 * S.fitness / 100));

  // --- Gols e assistências: posição + overall + tier + moral + RNG ---
  const rate = Math.pow((S.ovr - 40) / 50, 2) * 0.9;           // produção por jogo
  const form = (0.85 + S.morale / 400);                         // moral alta ajuda
  const tierBoost = 1 + (club.t - 2.5) * 0.06;                  // time forte cria mais chances
  const rng = () => 0.7 + Math.random() * 0.6;
  const goals = Math.round(games * rate * P.g * tierBoost * form * rng());
  const assists = Math.round(games * rate * P.a * tierBoost * form * rng() * 1.6);
  addLog(`Temporada: ${games} jogos, ${goals} gols e ${assists} assistências.`, '', age0);

  // --- Títulos do clube (só conta se o jogador atuou bastante) ---
  const q = clamp(0.8 + (S.ovr - 60) / 100, 0.6, 1.2);
  const won = [];
  if (games >= 15) {
    if (Math.random() < CH_LIGA[club.t - 1] * q) won.push(reg.liga);
    if (Math.random() < CH_COPA[club.t - 1] * q) won.push(reg.copa);
    if (Math.random() < CH_CONT[club.t - 1] * q) won.push(reg.cont);
  }
  won.forEach(t => {
    S.trophies.push({ age: age0, club: S.club, name: t });
    addLog(`Campeão: ${t}! 🏆`, 'gold', age0);
  });

  // --- Bola de Ouro: overall > 88 + desempenho + títulos ---
  let ballon = false;
  if (S.ovr > 88) {
    const perf = S.pos === 'Goleiro' ? Math.round(games * 0.4 * rng()) : goals + assists;
    if (perf >= P.th * 0.7) {
      const chance = clamp(0.15 + (S.ovr - 88) * 0.05 + won.length * 0.2 + (perf / P.th - 1) * 0.2, 0.03, 0.9);
      ballon = Math.random() < chance;
    }
  }
  if (ballon) {
    S.stats.ballons++;
    S.trophies.push({ age: age0, club: S.club, name: 'Bola de Ouro' });
    addLog('🥇 Você foi eleito o MELHOR DO MUNDO e ganhou a Bola de Ouro!', 'gold', age0);
  }

  // --- Atualiza estatísticas, moral, forma, salário e recordes ---
  S.stats.games += games; S.stats.goals += goals; S.stats.assists += assists;
  S.stats.titles += won.length;
  S.morale = clamp(S.morale + won.length * 8 + (ballon ? 15 : 0) + (playTime < 0.5 ? -12 : 3), 0, 100);
  S.fitness = rand(75, 100);                       // descanso entre temporadas
  const salary = salaryAt(club.t);
  S.money += salary;
  if (goals > S.rec.bestGoals) { S.rec.bestGoals = goals; S.rec.bestGoalsAge = age0; }

  // --- Evento aleatório (35% de chance) ---
  if (Math.random() < 0.35) await runRandomEvent();

  // --- Evolução / declínio por faixa etária ---
  let d;
  if (age0 <= 27) d = rand(1, 4);
  else if (age0 <= 31) d = rand(-1, 1);
  else d = -rand(1, 3);
  if (S.trained) d += 1;                           // bônus do treino
  S.ovr = clamp(S.ovr + d, 50, 99);
  S.trained = false;
  S.age++;
  S.contract--;
  S.rec.peakOvr = Math.max(S.rec.peakOvr, S.ovr);
  S.rec.peakValue = Math.max(S.rec.peakValue, marketValue());
  addLog(`Evolução: ${d >= 0 ? '+' : ''}${d} de overall (agora ${S.ovr}). Salário: ${fmt(salary)}.`, d < 0 ? 'bad' : '', age0);

  // --- Fim de contrato: propostas ou renovação ---
  if (S.contract <= 0) await transferWindow();

  // --- Aposentadoria entre 36 e 40 anos ---
  if (S.age >= 36) {
    const chance = (S.age - 35) * 0.2 + (S.ovr < 65 ? 0.3 : 0);
    if (S.age >= 40 || Math.random() < chance) {
      S.retired = true;
      addLog('Você anunciou a aposentadoria. Que carreira!', 'gold');
    }
  }

  busy = false;
  save();
  if (S.retired) showRetirement(); else render();
}

/* ---------- 10. TREINO E SALA DE TROFÉUS ---------- */

function train() {
  if (busy || S.trained || S.retired) return;
  S.trained = true;
  S.fitness = clamp(S.fitness - 8, 0, 100);
  S.morale = clamp(S.morale + 4, 0, 100);
  addLog('Treino intensivo: +1 de overall extra no fim da temporada.');
  save(); render();
}

async function showTrophies() {
  if (busy) return;
  busy = true;
  const list = S.trophies.length
    ? S.trophies.slice().reverse().map(t => `🏆 ${t.name} · ${t.club} (${t.age} anos)`).join('\n')
    : 'Ainda não há troféus. Simule temporadas para conquistá-los!';
  await askChoice(`Sala de troféus · ${S.stats.titles} títulos · ${S.stats.ballons} Bolas de Ouro`, list, ['Fechar']);
  busy = false; render();
}

/* ---------- 11. APOSENTADORIA ---------- */

function classify() {
  const st = S.stats;
  const score = st.ballons * 25 + st.titles * 4 + (st.goals + st.assists) / 20 + (S.rec.peakOvr - 60);
  if (score >= 110) return 'Lenda Mundial';
  if (score >= 60) return 'Ídolo Nacional';
  if (score >= 35) return 'Craque de Elite';
  if (score >= 15) return 'Bom Profissional';
  return 'Jogador Mediano';
}

function showRetirement() {
  const st = S.stats;
  $('retire-card').innerHTML = `
    <h1>🏁 Fim de carreira</h1>
    <p class="muted">${S.name} (${S.nat}) · ${S.pos} · parou aos ${S.age} anos</p>
    <div class="rank">${classify()}</div>
    <p>${st.games} jogos · ${st.goals} gols · ${st.assists} assistências</p>
    <p><b style="color:var(--gold)">${st.titles} títulos · ${st.ballons} Bolas de Ouro</b></p>
    <h3>Clubes</h3>
    <ul class="retire-list">${S.clubs.map(c => `<li>${c.club} (desde os ${c.from} anos)</li>`).join('')}</ul>
    <h3>Recordes</h3>
    <ul class="retire-list">
      <li>Melhor temporada: ${S.rec.bestGoals} gols (aos ${S.rec.bestGoalsAge} anos)</li>
      <li>Overall máximo: ${S.rec.peakOvr}</li>
      <li>Maior valor de mercado: ${fmt(S.rec.peakValue)}</li>
      <li>Patrimônio final: ${fmt(S.money)}</li>
    </ul>
    <button class="btn primary js-new">Novo jogo</button>`;
  $('retire-card').querySelector('.js-new').onclick = newGame;
  showScreen('screen-retire');
}

/* ---------- 12. INÍCIO / NOVO JOGO ---------- */

function startCareer(name, nat, pos, club) {
  S = {
    name, nat, pos, club, age: 17,
    ovr: rand(52, 62), morale: 70, fitness: 100, money: 0.1,
    contract: rand(2, 3), trained: false, retired: false,
    stats: { games: 0, goals: 0, assists: 0, titles: 0, ballons: 0 },
    clubs: [{ club, from: 17 }], trophies: [], log: [],
    rec: { bestGoals: 0, bestGoalsAge: 17, peakOvr: 0, peakValue: 0 }
  };
  S.rec.peakOvr = S.ovr;
  S.rec.peakValue = marketValue();
  addLog(`Você estreou no profissional pelo ${club}. Que comece a lenda!`);
  save(); render(); showScreen('screen-game');
}

function newGame() {
  if (!confirm('Apagar o save atual e começar uma nova carreira?')) return;
  localStorage.removeItem(SAVE_KEY);
  S = null; busy = false;
  $('create-form').reset();
  showScreen('screen-create');
}

/* ---------- 13. INICIALIZAÇÃO ---------- */

function init() {
  // Opções de clube inicial
  $('f-club').innerHTML = START_CLUBS.map(c => `<option>${c}</option>`).join('');

  $('create-form').addEventListener('submit', e => {
    e.preventDefault();
    startCareer($('f-name').value.trim(), $('f-nat').value, $('f-pos').value, $('f-club').value);
  });
  $('btn-sim').onclick = simulateSeason;
  $('btn-train').onclick = train;
  $('btn-trophies').onclick = showTrophies;
  document.querySelectorAll('.js-new').forEach(b => b.onclick = newGame);

  // Retoma o save, se existir
  S = load();
  if (S) {
    if (S.retired) showRetirement(); else { render(); showScreen('screen-game'); }
  }
}

init();