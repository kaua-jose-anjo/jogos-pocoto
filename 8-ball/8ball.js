/* =========================================================
   POCOTO GAMES - 8-BALL (QUINAS VISÍVEIS E FÍSICA DESENHADA)
   (8-ball/8ball.js)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('poolTable');
    const ctx = canvas.getContext('2d');
    const btnRestart = document.getElementById('btn-restart');
    const playerNameEl = document.getElementById('player-name');
    const ballsLeftEl = document.getElementById('balls-left');
    const scoreEl = document.getElementById('score');

    const powerBarFill = document.getElementById('power-bar-fill');
    const powerPercentage = document.getElementById('power-percentage');

    const { Engine, World, Bodies, Body, Vector } = Matter;

    const engine = Engine.create();
    engine.gravity.y = 0;
    engine.gravity.x = 0;

    const BALL_RADIUS = 10;
    const COLOR_P1 = '#e53935'; 
    const COLOR_P2 = '#1e88e5'; 

    let currentPlayer = 1;
    let scoreP1 = 0;
    let scoreP2 = 0;
    
    let isChargingPower = false;
    let power = 0; 
    let powerDirection = 1;
    const MAX_POWER = 100;
    
    let mousePos = { x: 0, y: 0 };
    let ballInHand = false;
    let isShotInProgress = false;

    let whiteBallBody = null;
    let ballBodies = [];

    // Caçapas
    const POCKET_RADIUS = 20;
    const pockets = [
        { x: 22, y: 22 },    // Superior Esquerda
        { x: 400, y: 15 },   // Superior Central
        { x: 778, y: 22 },   // Superior Direita
        { x: 22, y: 378 },   // Inferior Esquerda
        { x: 400, y: 385 },  // Inferior Central
        { x: 778, y: 378 }   // Inferior Direita
    ];

    // Vértices Visuais e Físicos das 6 Tabelas com Quinas (Bicos)
    const wallDefs = [
        // Superior Esquerda
        [{ x: 45, y: 0 }, { x: 375, y: 0 }, { x: 365, y: 28 }, { x: 58, y: 28 }],
        // Superior Direita
        [{ x: 425, y: 0 }, { x: 755, y: 0 }, { x: 742, y: 28 }, { x: 435, y: 28 }],
        // Inferior Esquerda
        [{ x: 58, y: 372 }, { x: 365, y: 372 }, { x: 375, y: 400 }, { x: 45, y: 400 }],
        // Inferior Direita
        [{ x: 435, y: 372 }, { x: 742, y: 372 }, { x: 755, y: 400 }, { x: 425, y: 400 }],
        // Lateral Esquerda
        [{ x: 0, y: 45 }, { x: 28, y: 58 }, { x: 28, y: 342 }, { x: 0, y: 355 }],
        // Lateral Direita
        [{ x: 772, y: 58 }, { x: 800, y: 45 }, { x: 800, y: 355 }, { x: 772, y: 342 }]
    ];

    function initGame() {
        World.clear(engine.world);

        currentPlayer = 1;
        scoreP1 = 0;
        scoreP2 = 0;
        isShotInProgress = false;
        isChargingPower = false;
        power = 0;
        updatePowerBarUI();
        ballBodies = [];

        // Criar corpos físicos idênticos aos vértices gráficos das tabelas
        const wallPhysics = { isStatic: true, restitution: 0.96, friction: 0.0 };
        wallDefs.forEach(pts => {
            // Calcula o centro do polígono para a Matter.js
            const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
            const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
            const wall = Bodies.fromVertices(cx, cy, [pts], wallPhysics);
            World.add(engine.world, wall);
        });

        // Física das Bolas
        const poolBallPhysics = {
            restitution: 0.99,   
            friction: 0.0,       
            frictionAir: 0.0035, 
            density: 0.04        
        };

        // Bola Branca
        whiteBallBody = Bodies.circle(200, 200, BALL_RADIUS, poolBallPhysics);
        whiteBallBody.isWhite = true;
        whiteBallBody.color = '#ffffff';
        World.add(engine.world, whiteBallBody);
        ballBodies.push(whiteBallBody);

        // 16 Bolas Alvo
        const targetColors = [
            COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2,
            COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1
        ];

        for (let i = targetColors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [targetColors[i], targetColors[j]] = [targetColors[j], targetColors[i]];
        }

        let startX = 530;
        let startY = 200;
        let index = 0;
        const rows = [1, 2, 3, 4, 6];

        for (let row = 0; row < rows.length; row++) {
            const count = rows[row];
            for (let col = 0; col < count; col++) {
                if (index < targetColors.length) {
                    const bx = startX + row * (BALL_RADIUS * 2 + 2);
                    const by = startY + (col - (count - 1) / 2) * (BALL_RADIUS * 2 + 2);

                    const ball = Bodies.circle(bx, by, BALL_RADIUS, poolBallPhysics);
                    ball.isWhite = false;
                    ball.color = targetColors[index];

                    World.add(engine.world, ball);
                    ballBodies.push(ball);
                    index++;
                }
            }
        }
        
        setBallInHand(false);
    }

    function setBallInHand(active) {
        ballInHand = active;
        if (whiteBallBody) {
            whiteBallBody.isSensor = active;
        }
        updateHUD();
    }

    function updateHUD() {
        const redBalls = ballBodies.filter(b => b.color === COLOR_P1).length;
        const blueBalls = ballBodies.filter(b => b.color === COLOR_P2).length;

        let statusText = currentPlayer === 1 
            ? `<span style="color:${COLOR_P1}">Jogador 1 (Vermelho)</span>` 
            : `<span style="color:${COLOR_P2}">Jogador 2 (Azul)</span>`;

        if (ballInHand) {
            statusText += ` <strong style="color: #FFD700;">🖐️ BOLA NA MÃO! (Clique para posicionar)</strong>`;
        }

        playerNameEl.innerHTML = statusText;
        ballsLeftEl.textContent = `🔴 ${redBalls} | 🔵 ${blueBalls}`;
        scoreEl.textContent = `P1: ${scoreP1} pts | P2: ${scoreP2} pts`;
    }

    function updatePowerBarUI() {
        const percent = Math.round(power);
        powerBarFill.style.height = `${percent}%`;
        powerPercentage.textContent = `${percent}%`;
    }

    // --- CONTROLE DE MOUSE ---
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;

        if (ballInHand && whiteBallBody) {
            Body.setPosition(whiteBallBody, {
                x: Math.max(BALL_RADIUS + 30, Math.min(canvas.width - BALL_RADIUS - 30, mousePos.x)),
                y: Math.max(BALL_RADIUS + 30, Math.min(canvas.height - BALL_RADIUS - 30, mousePos.y))
            });
            Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
        }
    });

    canvas.addEventListener('mousedown', () => {
        if (ballInHand) {
            setBallInHand(false);
        }
    });

    // --- CONTROLE DE TECLADO (BARRA DE ESPAÇO) ---
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            const speed = Vector.magnitude(whiteBallBody.velocity);

            if (!isShotInProgress && !ballInHand && speed < 0.05 && !isChargingPower) {
                isChargingPower = true;
                power = 0;
                powerDirection = 1;
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && isChargingPower) {
            e.preventDefault();
            
            const angle = Math.atan2(mousePos.y - whiteBallBody.position.y, mousePos.x - whiteBallBody.position.x);
            const forceMagnitude = (power / 100) * 0.30; 

            Body.applyForce(whiteBallBody, whiteBallBody.position, {
                x: Math.cos(angle) * forceMagnitude,
                y: Math.sin(angle) * forceMagnitude
            });

            isChargingPower = false;
            isShotInProgress = true;
            
            power = 0;
            updatePowerBarUI();
        }
    });

    btnRestart.addEventListener('click', initGame);

    // --- RENDERIZAÇÃO GRÁFICA DO JOGO ---
    function gameLoop() {
        Engine.update(engine, 1000 / 60);

        if (isChargingPower) {
            power += powerDirection * 2.5;
            if (power >= MAX_POWER) {
                power = MAX_POWER;
                powerDirection = -1;
            } else if (power <= 0) {
                power = 0;
                powerDirection = 1;
            }
            updatePowerBarUI();
        }

        // Limpa a mesa
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. DESENHAR AS CAÇAPAS (BURACOS)
        ctx.fillStyle = '#050505';
        pockets.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#22150c';
            ctx.stroke();

            // Verificação de Encaçapamento
            for (let i = ballBodies.length - 1; i >= 0; i--) {
                const b = ballBodies[i];
                const dist = Math.hypot(b.position.x - p.x, b.position.y - p.y);

                if (dist < POCKET_RADIUS - 2) {
                    if (b.isWhite) {
                        Body.setPosition(whiteBallBody, { x: 200, y: 200 });
                        Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
                        currentPlayer = currentPlayer === 1 ? 2 : 1;
                        setBallInHand(true);
                    } else {
                        if (b.color === COLOR_P1) scoreP1 += 100;
                        if (b.color === COLOR_P2) scoreP2 += 100;

                        World.remove(engine.world, b);
                        ballBodies.splice(i, 1);
                        updateHUD();
                    }
                }
            }
        });

        // 2. DESENHAR AS TABELAS VISÍVEIS COM QUINAS CHANFRADAS (BICOS)
        ctx.fillStyle = '#2e7d32'; // Tom verde de borracha das tabelas
        ctx.strokeStyle = '#1b5e20';
        ctx.lineWidth = 2;

        wallDefs.forEach(pts => {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Destacar os bicos/quinas das pontas com acabamento escuro
            ctx.fillStyle = '#111111';
            ctx.beginPath();
            ctx.arc(pts[2].x, pts[2].y, 3, 0, Math.PI * 2);
            ctx.arc(pts[3].x, pts[3].y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2e7d32'; // Restaura cor verde das tabelas
        });

        // 3. INDICADOR DE BOLA NA MÃO
        if (ballInHand && whiteBallBody) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(whiteBallBody.position.x, whiteBallBody.position.y, BALL_RADIUS + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 4. GUIA DE MIRA
        if (!isShotInProgress && !ballInHand) {
            const playerColor = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
            ctx.strokeStyle = playerColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(whiteBallBody.position.x, whiteBallBody.position.y);
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.stroke();
        }

        // 5. DESENHAR BOLAS
        ballBodies.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.position.x, b.position.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = b.color;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000';
            ctx.stroke();
        });

        // 6. VERIFICAÇÃO DO FIM DA TACADA
        if (isShotInProgress) {
            const totalSpeed = ballBodies.reduce((acc, b) => acc + Vector.magnitude(b.velocity), 0);
            if (totalSpeed < 0.02) {
                isShotInProgress = false;
                currentPlayer = currentPlayer === 1 ? 2 : 1;
                updateHUD();
            }
        }

        requestAnimationFrame(gameLoop);
    }

    initGame();
    gameLoop();
});