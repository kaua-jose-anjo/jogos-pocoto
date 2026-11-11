/* =========================================================
   POCOTO GAMES - 8-BALL (FÍSICA MATTER.JS + BORDAS CORRIGIDAS)
   (8-ball/8ball.js)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('poolTable');
    const ctx = canvas.getContext('2d');
    const btnRestart = document.getElementById('btn-restart');
    const playerNameEl = document.getElementById('player-name');
    const ballsLeftEl = document.getElementById('balls-left');
    const scoreEl = document.getElementById('score');

    // Elementos da Barra de Força
    const powerBarFill = document.getElementById('power-bar-fill');
    const powerPercentage = document.getElementById('power-percentage');

    // Módulos do Matter.js
    const { Engine, World, Bodies, Body, Vector } = Matter;

    const engine = Engine.create();
    engine.gravity.y = 0;
    engine.gravity.x = 0;

    // Configurações Globais
    const BALL_RADIUS = 10;
    const COLOR_P1 = '#e53935'; // Vermelho (Jogador 1)
    const COLOR_P2 = '#1e88e5'; // Azul (Jogador 2)

    let currentPlayer = 1;
    let scoreP1 = 0;
    let scoreP2 = 0;
    
    // Controle de Carregamento de Força
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
    const pockets = [
        { x: 15, y: 15 }, { x: 400, y: 10 }, { x: 785, y: 15 },
        { x: 15, y: 385 }, { x: 400, y: 390 }, { x: 785, y: 385 }
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

        // --- CORREÇÃO DAS BORDAS / TABELAS DA MESA ---
        // Espessura robusta de 40px para impedir que as bolas atravessem a borda
        const wallThickness = 40;
        const wallPhysicsOptions = { 
            isStatic: true, 
            restitution: 0.98, // Alta elasticidade de quique nas tabelas
            friction: 0.0 
        };

        const walls = [
            // Parede Superior
            Bodies.rectangle(400, -wallThickness / 2, 800 + wallThickness * 2, wallThickness, wallPhysicsOptions),
            // Parede Inferior
            Bodies.rectangle(400, 400 + wallThickness / 2, 800 + wallThickness * 2, wallThickness, wallPhysicsOptions),
            // Parede Esquerda
            Bodies.rectangle(-wallThickness / 2, 200, wallThickness, 400 + wallThickness * 2, wallPhysicsOptions),
            // Parede Direita
            Bodies.rectangle(800 + wallThickness / 2, 200, wallThickness, 400 + wallThickness * 2, wallPhysicsOptions)
        ];
        World.add(engine.world, walls);

        // Física Estilo 8 Ball Pool para as Bolas
        const poolBallPhysics = {
            restitution: 0.99,   // Transferência de momento quase perfeita
            friction: 0.0,       // Sem resistência ao tangenciar outras bolas
            frictionAir: 0.0035, // Desaceleração suave do pano
            density: 0.04
        };

        // Bola Branca
        whiteBallBody = Bodies.circle(200, 200, BALL_RADIUS, poolBallPhysics);
        whiteBallBody.isWhite = true;
        whiteBallBody.color = '#ffffff';
        World.add(engine.world, whiteBallBody);
        ballBodies.push(whiteBallBody);

        // 16 Bolas Alvo (8 Vermelhas e 8 Azuis)
        const targetColors = [
            COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2, COLOR_P2,
            COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1, COLOR_P1
        ];

        // Embaralhamento Aleatório (Fisher-Yates)
        for (let i = targetColors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [targetColors[i], targetColors[j]] = [targetColors[j], targetColors[i]];
        }

        // Montagem do Triângulo
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
            // Quando a bola está na mão, vira sensor para não trombar com as outras bolas enquanto posiciona
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
            statusText += ` <strong style="color: #FFD700;">🖐️ BOLA NA MÃO! (Clique na mesa para posicionar)</strong>`;
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

    // --- MOUSE (MIRA E BOLA NA MÃO) ---
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;

        if (ballInHand && whiteBallBody) {
            // Mantém a bola branca estritamente dentro da mesa ao posicionar
            Body.setPosition(whiteBallBody, {
                x: Math.max(BALL_RADIUS + 5, Math.min(canvas.width - BALL_RADIUS - 5, mousePos.x)),
                y: Math.max(BALL_RADIUS + 5, Math.min(canvas.height - BALL_RADIUS - 5, mousePos.y))
            });
            Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
        }
    });

    canvas.addEventListener('mousedown', () => {
        if (ballInHand) {
            // Confirma a posição e reativa o quique físico da bola branca
            setBallInHand(false);
        }
    });

    // --- TECLADO (BARRA DE ESPAÇO) ---
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            const speed = Vector.magnitude(whiteBallBody.velocity);

            if (!isShotInProgress && !ballInHand && speed < 0.08 && !isChargingPower) {
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
            const forceMagnitude = (power / 100) * 0.28; 

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

    // --- LOOP DE JOGO E RENDERIZAÇÃO ---
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

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Caçapas
        ctx.fillStyle = '#000000';
        pockets.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
            ctx.fill();

            for (let i = ballBodies.length - 1; i >= 0; i--) {
                const b = ballBodies[i];
                const dist = Math.hypot(b.position.x - p.x, b.position.y - p.y);

                if (dist < 18) {
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

        // Indicador de Bola na Mão
        if (ballInHand && whiteBallBody) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(whiteBallBody.position.x, whiteBallBody.position.y, BALL_RADIUS + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Guia de Mira
        if (!isShotInProgress && !ballInHand) {
            const playerColor = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
            ctx.strokeStyle = playerColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(whiteBallBody.position.x, whiteBallBody.position.y);
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.stroke();
        }

        // Desenhar Bolas
        ballBodies.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.position.x, b.position.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = b.color;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000';
            ctx.stroke();
        });

        // Fim da Tacada
        if (isShotInProgress) {
            const totalSpeed = ballBodies.reduce((acc, b) => acc + Vector.magnitude(b.velocity), 0);
            if (totalSpeed < 0.03) {
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