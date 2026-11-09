/* =========================================================
   POCOTO GAMES - LÓGICA DO JOGO 8-BALL (REGRAS COMPLETAS + BOLA NA MÃO)
   (8-ball/8ball.js)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('poolTable');
    const ctx = canvas.getContext('2d');
    const btnRestart = document.getElementById('btn-restart');
    const playerNameEl = document.getElementById('player-name');
    const ballsLeftEl = document.getElementById('balls-left');
    const scoreEl = document.getElementById('score');

    // Configurações físicas e visuais
    const BALL_RADIUS = 10;
    const FRICTION = 0.985;
    
    // Cores dos Jogadores
    const COLOR_P1 = '#e53935'; // Vermelho (Jogador 1)
    const COLOR_P2 = '#1e88e5'; // Azul (Jogador 2)

    let isAiming = false;
    let power = 0;
    let mousePos = { x: 0, y: 0 };
    
    // Controle de Turnos e Regras
    let currentPlayer = 1; // 1 = Jogador 1 (Vermelho), 2 = Jogador 2 (Azul)
    let scoreP1 = 0;
    let scoreP2 = 0;
    
    let isShotInProgress = false;
    let playerScoredCurrentTurn = false; 
    let ballInHand = false; // Modo "Bola na mão" ativado
    let firstBallHit = null; // Registra a primeira bola atingida pela branca
    let whiteBallPocketed = false; // Registra se a branca caiu na caçapa
    let opponentBallPocketed = false; // Registra se derrubou bola do oponente

    // Caçapas
    const pockets = [
        { x: 15, y: 15 }, { x: 400, y: 10 }, { x: 785, y: 15 },
        { x: 15, y: 385 }, { x: 400, y: 390 }, { x: 785, y: 385 }
    ];

    let balls = [];

    function initGame() {
        currentPlayer = 1;
        scoreP1 = 0;
        scoreP2 = 0;
        isShotInProgress = false;
        playerScoredCurrentTurn = false;
        ballInHand = false;
        firstBallHit = null;
        whiteBallPocketed = false;
        opponentBallPocketed = false;
        balls = [];

        // Bola Branca
        balls.push({ x: 200, y: 200, vx: 0, vy: 0, color: '#ffffff', isWhite: true });

        // Lista com exatamente 16 bolas (8 Azuis e 8 Vermelhas)
        const targetColors = [
            COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2,
            COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1
        ];

        // Embaralha as cores de forma aleatória (Fisher-Yates)
        for (let i = targetColors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [targetColors[i], targetColors[j]] = [targetColors[j], targetColors[i]];
        }

        // Montagem do triângulo de 16 bolas
        let startX = 530;
        let startY = 200;
        let index = 0;
        const rows = [1, 2, 3, 4, 6];

        for (let row = 0; row < rows.length; row++) {
            const count = rows[row];
            for (let col = 0; col < count; col++) {
                if (index < targetColors.length) {
                    balls.push({
                        x: startX + row * (BALL_RADIUS * 2 + 2),
                        y: startY + (col - (count - 1) / 2) * (BALL_RADIUS * 2 + 2),
                        vx: 0,
                        vy: 0,
                        color: targetColors[index],
                        isWhite: false
                    });
                    index++;
                }
            }
        }
        updateHUD();
    }

    function updateHUD() {
        const redBallsLeft = balls.filter(b => b.color === COLOR_P1).length;
        const blueBallsLeft = balls.filter(b => b.color === COLOR_P2).length;

        let statusText = currentPlayer === 1 
            ? `<span style="color:${COLOR_P1}">Jogador 1 (Vermelho)</span>` 
            : `<span style="color:${COLOR_P2}">Jogador 2 (Azul)</span>`;

        if (ballInHand) {
            statusText += ` <strong style="color: #FFD700;">🖐️ BOLA NA MÃO! (Clique na mesa para posicionar)</strong>`;
        }

        playerNameEl.innerHTML = statusText;
        ballsLeftEl.textContent = `🔴 ${redBallsLeft} | 🔵 ${blueBallsLeft}`;
        scoreEl.textContent = `P1: ${scoreP1} pts | P2: ${scoreP2} pts`;
    }

    // Controle do Mouse (Posicionamento da Bola Branca / Mira)
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;

        // Se estiver no modo "Bola na Mão", move a bola branca junto com o cursor
        if (ballInHand) {
            const whiteBall = balls[0];
            if (whiteBall) {
                // Restringe a bola branca para ficar dentro da mesa
                whiteBall.x = Math.max(BALL_RADIUS, Math.min(canvas.width - BALL_RADIUS, mousePos.x));
                whiteBall.y = Math.max(BALL_RADIUS, Math.min(canvas.height - BALL_RADIUS, mousePos.y));
            }
        }
    });

    canvas.addEventListener('mousedown', () => { 
        const whiteBall = balls[0];

        // Se estiver no modo Bola na Mão, um clique fixa a bola na posição
        if (ballInHand) {
            ballInHand = false;
            updateHUD();
            return;
        }

        // Só permite mirar se a jogada anterior já tiver terminado
        if (!isShotInProgress && whiteBall && Math.abs(whiteBall.vx) < 0.05 && Math.abs(whiteBall.vy) < 0.05) {
            isAiming = true; 
            power = 0; 
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (isAiming && !ballInHand) {
            const whiteBall = balls[0];
            const dx = mousePos.x - whiteBall.x;
            const dy = mousePos.y - whiteBall.y;
            const angle = Math.atan2(dy, dx);
            const force = Math.min(power, 15);

            whiteBall.vx = Math.cos(angle) * force;
            whiteBall.vy = Math.sin(angle) * force;

            isAiming = false;
            power = 0;
            
            // Reseta contadores da jogada atual
            isShotInProgress = true;
            playerScoredCurrentTurn = false;
            firstBallHit = null;
            whiteBallPocketed = false;
            opponentBallPocketed = false;
        }
    });

    btnRestart.addEventListener('click', initGame);

    // Resolução de Colisão entre Bolas
    function resolveBallCollisions() {
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                const b1 = balls[i];
                const b2 = balls[j];

                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                const distance = Math.hypot(dx, dy);

                if (distance < BALL_RADIUS * 2) {
                    // Registra o primeiro toque da bola branca em outra bola
                    if (b1.isWhite && !firstBallHit) {
                        firstBallHit = b2;
                    } else if (b2.isWhite && !firstBallHit) {
                        firstBallHit = b1;
                    }

                    const overlap = (BALL_RADIUS * 2) - distance;
                    const nx = dx / (distance || 1);
                    const ny = dy / (distance || 1);

                    b1.x -= nx * (overlap / 2);
                    b1.y -= ny * (overlap / 2);
                    b2.x += nx * (overlap / 2);
                    b2.y += ny * (overlap / 2);

                    const kx = b1.vx - b2.vx;
                    const ky = b1.vy - b2.vy;
                    const p = 2 * (nx * kx + ny * ky) / 2;

                    b1.vx -= p * nx;
                    b1.vy -= p * ny;
                    b2.vx += p * nx;
                    b2.vy += p * ny;
                }
            }
        }
    }

    function updatePhysics() {
        if (isAiming && power < 15) power += 0.3;

        let anyBallMoving = false;

        balls.forEach((ball) => {
            ball.x += ball.vx;
            ball.y += ball.vy;
            ball.vx *= FRICTION;
            ball.vy *= FRICTION;

            if (Math.abs(ball.vx) < 0.05) ball.vx = 0;
            if (Math.abs(ball.vy) < 0.05) ball.vy = 0;

            if (ball.vx !== 0 || ball.vy !== 0) {
                anyBallMoving = true;
            }

            if (ball.x - BALL_RADIUS < 0) {
                ball.x = BALL_RADIUS;
                ball.vx *= -1;
            } else if (ball.x + BALL_RADIUS > canvas.width) {
                ball.x = canvas.width - BALL_RADIUS;
                ball.vx *= -1;
            }

            if (ball.y - BALL_RADIUS < 0) {
                ball.y = BALL_RADIUS;
                ball.vy *= -1;
            } else if (ball.y + BALL_RADIUS > canvas.height) {
                ball.y = canvas.height - BALL_RADIUS;
                ball.vy *= -1;
            }
        });

        resolveBallCollisions();

        // Encaçapamento de bolas
        for (let i = balls.length - 1; i >= 0; i--) {
            const ball = balls[i];
            pockets.forEach(pocket => {
                const dist = Math.hypot(ball.x - pocket.x, ball.y - pocket.y);
                if (dist < 20) {
                    if (ball.isWhite) {
                        whiteBallPocketed = true;
                        ball.x = 200;
                        ball.y = 200;
                        ball.vx = 0;
                        ball.vy = 0;
                    } else {
                        const targetMyColor = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;

                        if (ball.color === COLOR_P1) scoreP1 += 100;
                        if (ball.color === COLOR_P2) scoreP2 += 100;

                        if (ball.color === targetMyColor) {
                            playerScoredCurrentTurn = true;
                        } else {
                            // Encaçapou a bola do adversário
                            opponentBallPocketed = true;
                        }

                        balls.splice(i, 1);
                        updateHUD();
                    }
                }
            });
        }

        // FIM DA JOGADA: Executado quando todas as bolas pararam
        if (isShotInProgress && !anyBallMoving) {
            isShotInProgress = false;

            const myColor = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
            
            // 1. Falta: Não atingiu nenhuma bola ou acertou primeiro a bola do adversário
            const hitFoul = !firstBallHit || (firstBallHit.color !== myColor);
            
            // 2. Falta total se: errou a primeira bola, encaçapou a branca OU encaçapou a bola do oponente
            const isFoul = hitFoul || whiteBallPocketed || opponentBallPocketed;

            if (isFoul) {
                // Passa a vez e ativa "Bola na Mão" para o próximo jogador
                currentPlayer = currentPlayer === 1 ? 2 : 1;
                ballInHand = true;
            } else if (!playerScoredCurrentTurn) {
                // Se não cometeu falta mas também não encaçapou a sua cor, apenas passa a vez normalmente
                currentPlayer = currentPlayer === 1 ? 2 : 1;
            }
            // Se encaçapou a sua cor e não cometeu faltas, o jogador repete a jogada normalmente.

            updateHUD();
        }
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Desenhar caçapas
        ctx.fillStyle = '#000000';
        pockets.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
            ctx.fill();
        });

        // Desenhar linha de pontaria com a cor do jogador atual
        const whiteBall = balls[0];
        if (whiteBall && isAiming && !isShotInProgress && !ballInHand) {
            const playerColor = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
            
            ctx.strokeStyle = playerColor;
            ctx.lineWidth = 3 + (power / 5);
            ctx.beginPath();
            ctx.moveTo(whiteBall.x, whiteBall.y);
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.stroke();
        }

        // Desenhar indicador visual do modo "Bola na Mão"
        if (ballInHand && whiteBall) {
            const playerColor = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
            ctx.strokeStyle = playerColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(whiteBall.x, whiteBall.y, BALL_RADIUS + 6, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Desenhar bolas
        balls.forEach(ball => {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = ball.color;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000';
            ctx.stroke();
        });

        updatePhysics();
        requestAnimationFrame(render);
    }

    initGame();
    render();
});