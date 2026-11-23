* =========================================================
   POCOTO GAMES - ACERTE O POCOTÓ COM BOMBAS (acerte-pocoto/pocoto.js)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const holes = document.querySelectorAll('.hole');
    const holeGrid = document.getElementById('hole-grid');
    const scoreEl = document.getElementById('score');
    const timerEl = document.getElementById('timer');
    const highScoreEl = document.getElementById('high-score');
    const btnStart = document.getElementById('btn-start');

    const INITIAL_TIME = 30;
    const MAX_TIME_CAP = 45;     // Teto máximo de tempo para não virar farm infinito
    const HORSE_TIME_BONUS = 1;  // +1 segundo ao acertar o cavalo
    const BOMB_TIME_PENALTY = 3; // -3 segundos ao acertar a bomba

    let score = 0;
    let lastHole = null;
    let timeUp = false;
    let gameTimer = null;
    let peepTimer = null;
    let timeLeft = INITIAL_TIME;
    let elapsedTime = 0; // Controla a progressão de dificuldade mesmo quando o jogador ganha tempo extra

    let highScore = localStorage.getItem('pocoto_high_score') || 0;
    highScoreEl.textContent = highScore;

    // Calcula a dificuldade de 0.0 (fácil) até 1.0 (insano) usando tempo sobrevivido + pontuação
    function getDifficulty() {
        const survivalProgress = Math.min(1.0, elapsedTime / 35); // Em 35s sobrevividos chega na velocidade máxima
        const scoreBonus = Math.min(0.3, (score / 250) * 0.3);
        return Math.min(1.0, survivalProgress * 0.75 + scoreBonus);
    }

    function flashTimerColor(color) {
        timerEl.style.color = color;
        timerEl.style.fontWeight = 'bold';
        setTimeout(() => {
            timerEl.style.color = '';
        }, 300);
    }

    function endGame() {
        if (timeUp) return;
        clearInterval(gameTimer);
        clearTimeout(peepTimer);
        timeUp = true;
        timeLeft = 0;
        timerEl.textContent = '0';
        btnStart.disabled = false;

        holes.forEach(h => h.classList.remove('up', 'hit', 'exploded'));

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('pocoto_high_score', highScore);
            highScoreEl.textContent = highScore;
            alert(`🎉 NOVO RECORDE! Marcou ${score} pontos!`);
        } else {
            alert(`Fim de jogo! Marcou ${score} pontos.`);
        }
    }

    function randomHole(holesList, excludeHole = null) {
        const availableHoles = Array.from(holesList).filter(
            h => h !== lastHole && h !== excludeHole && !h.classList.contains('up')
        );

        const pool = availableHoles.length > 0 ? availableHoles : Array.from(holesList);
        const idx = Math.floor(Math.random() * pool.length);
        const hole = pool[idx];

        lastHole = hole;
        return hole;
    }

    function spawnTarget(timeVisible, bombChance, excludeHole = null) {
        const hole = randomHole(holes, excludeHole);
        const targetEl = hole.querySelector('.pocoto');

        const isBomb = Math.random() < bombChance;
        hole.dataset.type = isBomb ? 'bomb' : 'horse';
        targetEl.textContent = isBomb ? '💣' : '🐴';

        hole.classList.remove('hit', 'exploded');
        hole.classList.add('up');

        setTimeout(() => {
            hole.classList.remove('up', 'hit', 'exploded');
        }, timeVisible);

        return hole;
    }

    function peep() {
        if (timeUp) return;

        const diff = getDifficulty();

        // Velocidade escala de lento (800ms~1300ms) até muito rápido (280ms~500ms)
        const minTime = Math.round(800 - diff * 520);
        const maxTime = Math.round(1300 - diff * 800);
        const timeVisible = Math.floor(Math.random() * (maxTime - minTime) + minTime);

        // Chance de bomba vai de 15% até 45%
        const currentBombChance = 0.15 + diff * 0.30;

        const firstHole = spawnTarget(timeVisible, currentBombChance);

        // A partir de 50% de dificuldade, pode subir um segundo alvo junto
        if (diff > 0.5 && Math.random() < (diff - 0.3)) {
            spawnTarget(timeVisible, currentBombChance, firstHole);
        }

        const nextDelay = Math.max(250, timeVisible * (0.95 - diff * 0.25));
        peepTimer = setTimeout(() => {
            if (!timeUp) peep();
        }, nextDelay);
    }

    function startGame() {
        score = 0;
        timeLeft = INITIAL_TIME;
        elapsedTime = 0;
        timeUp = false;
        lastHole = null;

        scoreEl.textContent = '0';
        timerEl.textContent = timeLeft;
        btnStart.disabled = true;

        peep();

        gameTimer = setInterval(() => {
            timeLeft--;
            elapsedTime++;
            timerEl.textContent = Math.max(0, timeLeft);

            if (timeLeft <= 0) {
                endGame();
            }
        }, 1000);
    }

    function whack() {
        const hole = this;
        if (timeUp || !hole.classList.contains('up') || hole.classList.contains('hit') || hole.classList.contains('exploded')) {
            return;
        }

        const targetEl = hole.querySelector('.pocoto');

        if (hole.dataset.type === 'bomb') {
            // Penalidade da Bomba: perde pontos e perde tempo
            score = Math.max(0, score - 20);
            scoreEl.textContent = score;
            targetEl.textContent = '💥';
            hole.classList.add('exploded');

            timeLeft = Math.max(0, timeLeft - BOMB_TIME_PENALTY);
            timerEl.textContent = timeLeft;
            flashTimerColor('#ff3b30');

            if (holeGrid) {
                holeGrid.classList.remove('shake');
                void holeGrid.offsetWidth;
                holeGrid.classList.add('shake');
            }

            if (timeLeft <= 0) {
                endGame();
                return;
            }
        } else {
            // Acerto no Pocotó: ganha pontos e ganha tempo (até o teto máximo)
            score += 10;
            scoreEl.textContent = score;
            hole.classList.add('hit');

            if (timeLeft < MAX_TIME_CAP) {
                timeLeft = Math.min(MAX_TIME_CAP, timeLeft + HORSE_TIME_BONUS);
                timerEl.textContent = timeLeft;
                flashTimerColor('#4cd964');
            }
        }

        setTimeout(() => {
            hole.classList.remove('up');
        }, 180);
    }

    holes.forEach(hole => hole.addEventListener('click', whack));
    btnStart.addEventListener('click', startGame);
});