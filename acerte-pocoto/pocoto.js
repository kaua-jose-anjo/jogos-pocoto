/* =========================================================
   POCOTO GAMES - ACERTE O POCOTÓ COM BOMBAS (acerte-pocoto/pocoto.js)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const holes = document.querySelectorAll('.hole');
    const holeGrid = document.getElementById('hole-grid');
    const scoreEl = document.getElementById('score');
    const timerEl = document.getElementById('timer');
    const highScoreEl = document.getElementById('high-score');
    const btnStart = document.getElementById('btn-start');

    let score = 0;
    let lastHole = null;
    let timeUp = false;
    let gameTimer = null;
    let peepTimer = null;
    let timeLeft = 30;

    const BOMB_CHANCE = 0.25; // 25% de probabilidade de sair uma bomba

    let highScore = localStorage.getItem('pocoto_high_score') || 0;
    highScoreEl.textContent = highScore;

    function randomHole(holesList) {
        const idx = Math.floor(Math.random() * holesList.length);
        const hole = holesList[idx];
        if (hole === lastHole) {
            return randomHole(holesList);
        }
        lastHole = hole;
        return hole;
    }

    function peep() {
        const time = Math.floor(Math.random() * (1000 - 500) + 500);
        const hole = randomHole(holes);
        const targetEl = hole.querySelector('.pocoto');

        // Define aleatoriamente se será Cavalo (🐴) ou Bomba (💣)
        const isBomb = Math.random() < BOMB_CHANCE;
        hole.dataset.type = isBomb ? 'bomb' : 'horse';
        targetEl.textContent = isBomb ? '💣' : '🐴';

        hole.classList.remove('hit', 'exploded');
        hole.classList.add('up');

        peepTimer = setTimeout(() => {
            hole.classList.remove('up', 'hit', 'exploded');
            if (!timeUp) peep();
        }, time);
    }

    function startGame() {
        score = 0;
        timeLeft = 30;
        timeUp = false;
        
        scoreEl.textContent = '0';
        timerEl.textContent = timeLeft;
        btnStart.disabled = true;

        peep();

        gameTimer = setInterval(() => {
            timeLeft--;
            timerEl.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(gameTimer);
                clearTimeout(peepTimer);
                timeUp = true;
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
        }, 1000);
    }

    function whack() {
        const hole = this;
        if (!hole.classList.contains('up') || hole.classList.contains('hit') || hole.classList.contains('exploded')) {
            return;
        }

        const targetEl = hole.querySelector('.pocoto');

        if (hole.dataset.type === 'bomb') {
            // Penalidade da Bomba
            score = Math.max(0, score - 20);
            scoreEl.textContent = score;
            targetEl.textContent = '💥';
            hole.classList.add('exploded');

            // Efeito visual de tremor no tabuleiro
            if (holeGrid) {
                holeGrid.classList.remove('shake');
                void holeGrid.offsetWidth; // Reinicia a animação CSS
                holeGrid.classList.add('shake');
            }
        } else {
            // Acerto no Pocotó
            score += 10;
            scoreEl.textContent = score;
            hole.classList.add('hit');
        }

        setTimeout(() => {
            hole.classList.remove('up');
        }, 180);
    }

    holes.forEach(hole => hole.addEventListener('click', whack));
    btnStart.addEventListener('click', startGame);
});