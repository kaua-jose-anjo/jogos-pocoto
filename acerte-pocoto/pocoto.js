/* =========================================================
   POCOTO GAMES - ACERTE O POCOTÓ (acerte-pocoto/pocoto.js)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const holes = document.querySelectorAll('.hole');
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
        
        hole.classList.add('up');

        peepTimer = setTimeout(() => {
            hole.classList.remove('up', 'hit');
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
        if (!hole.classList.contains('up') || hole.classList.contains('hit')) return;

        score += 10;
        hole.classList.add('hit');
        scoreEl.textContent = score;

        setTimeout(() => {
            hole.classList.remove('up');
        }, 150);
    }

    holes.forEach(hole => hole.addEventListener('click', whack));
    btnStart.addEventListener('click', startGame);
});