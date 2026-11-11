/* =========================================================
   POCOTO GAMES - 8-BALL (MODO CONTRA IA INCLUÍDO)
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

    const { Engine, World, Bodies, Body, Vector, Events } = Matter;

    const engine = Engine.create();
    engine.gravity.y = 0;
    engine.gravity.x = 0;

    const BALL_RADIUS = 10;
    const COLOR_P1 = '#e53935'; // Vermelho (Jogador 1)
    const COLOR_P2 = '#1e88e5'; // Azul (Jogador 2 / IA)

    let vsAI = false; // Alterna entre PvP (false) e PvE/Contra IA (true)
    let isAITurn = false;

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

    // Registos de Infrações
    let firstBallHit = null;      
    let pottedThisTurn = [];      
    let cueBallPotted = false;    

    let whiteBallBody = null;
    let ballBodies = [];

    const POCKET_RADIUS = 20;
    const pockets = [
        { x: 22, y: 22 },    
        { x: 400, y: 15 },   
        { x: 778, y: 22 },   
        { x: 22, y: 378 },   
        { x: 400, y: 385 },  
        { x: 778, y: 378 }   
    ];

    const wallDefs = [
        [{ x: 45, y: 0 }, { x: 375, y: 0 }, { x: 365, y: 28 }, { x: 58, y: 28 }],
        [{ x: 425, y: 0 }, { x: 755, y: 0 }, { x: 742, y: 28 }, { x: 435, y: 28 }],
        [{ x: 58, y: 372 }, { x: 365, y: 372 }, { x: 375, y: 400 }, { x: 45, y: 400 }],
        [{ x: 435, y: 372 }, { x: 755, y: 372 }, { x: 770, y: 400 }, { x: 425, y: 400 }],
        [{ x: 0, y: 45 }, { x: 28, y: 58 }, { x: 28, y: 342 }, { x: 0, y: 355 }],
        [{ x: 772, y: 58 }, { x: 800, y: 45 }, { x: 800, y: 355 }, { x: 772, y: 342 }]
    ];

    // Detetar o Primeiro Toque
    Events.on(engine, 'collisionStart', (event) => {
        if (!isShotInProgress || firstBallHit !== null) return;

        for (let i = 0; i < event.pairs.length; i++) {
            const pair = event.pairs[i];
            let otherBody = null;

            if (pair.bodyA === whiteBallBody) otherBody = pair.bodyB;
            else if (pair.bodyB === whiteBallBody) otherBody = pair.bodyA;

            if (otherBody && !otherBody.isStatic && !otherBody.isWhite) {
                firstBallHit = otherBody;
                break;
            }
        }
    });

    function initGame() {
        World.clear(engine.world);

        currentPlayer = 1;
        isAITurn = false;
        scoreP1 = 0;
        scoreP2 = 0;
        isShotInProgress = false;
        isChargingPower = false;
        power = 0;
        firstBallHit = null;
        pottedThisTurn = [];
        cueBallPotted = false;
        updatePowerBarUI();
        ballBodies = [];

        const wallPhysics = { isStatic: true, restitution: 0.96, friction: 0.0 };
        wallDefs.forEach(pts => {
            const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
            const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
            
            let wall;
            if (typeof Matter.Vertices !== 'undefined' && window.decomp) {
                wall = Bodies.fromVertices(cx, cy, [pts], wallPhysics);
            } else {
                wall = Bodies.rectangle(cx, cy, 300, 20, wallPhysics);
            }
            World.add(engine.world, wall);
        });

        const poolBallPhysics = {
            restitution: 0.99,   
            friction: 0.0,       
            frictionAir: 0.0035, 
            density: 0.04        
        };

        // Branca
        whiteBallBody = Bodies.circle(200, 200, BALL_RADIUS, poolBallPhysics);
        whiteBallBody.isWhite = true;
        whiteBallBody.color = '#ffffff';
        World.add(engine.world, whiteBallBody);
        ballBodies.push(whiteBallBody);

        // Bolas Alvo
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
            if (!active) {
                Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
            }
        }
        updateHUD();
    }

    function updateHUD(foulMessage = "") {
        const redBalls = ballBodies.filter(b => b.color === COLOR_P1).length;
        const blueBalls = ballBodies.filter(b => b.color === COLOR_P2).length;

        let p2Label = vsAI ? "🤖 IA (Azul)" : "Jogador 2 (Azul)";
        let statusText = currentPlayer === 1 
            ? `<span style="color:${COLOR_P1}">Jogador 1 (Vermelho)</span>` 
            : `<span style="color:${COLOR_P2}">${p2Label}</span>`;

        if (foulMessage) {
            statusText += ` <strong style="color: #ff5252;">⚠️ INFRAÇÃO: ${foulMessage}</strong>`;
        } else if (ballInHand) {
            statusText += ` <strong style="color: #FFD700;">🖐️ BOLA NA MÃO!</strong>`;
        }

        playerNameEl.innerHTML = statusText;
        ballsLeftEl.textContent = `🔴 ${redBalls} | 🔵 ${blueBalls}`;
        scoreEl.textContent = `P1: ${scoreP1} pts | ${vsAI ? 'IA' : 'P2'}: ${scoreP2} pts`;
    }

    function updatePowerBarUI() {
        const percent = Math.round(power);
        powerBarFill.style.height = `${percent}%`;
        powerPercentage.textContent = `${percent}%`;
    }

    /* =========================================================
       LÓGICA DA INTELIGÊNCIA ARTIFICIAL (IA)
       ========================================================= */
    function playAITurn() {
        if (!vsAI || currentPlayer !== 2 || isShotInProgress) return;

        isAITurn = true;

        // Se a IA tiver bola na mão, posiciona a branca na zona de partida
        if (ballInHand) {
            Body.setPosition(whiteBallBody, { x: 200, y: 200 + (Math.random() * 60 - 30) });
            setBallInHand(false);
        }

        setTimeout(() => {
            // Procura as bolas do Jogador 2 (Azuis)
            const aiBalls = ballBodies.filter(b => b.color === COLOR_P2);
            let targetBall = null;
            let bestPocket = null;
            let minDistance = Infinity;

            // Encontra a bola azul mais próxima de qualquer caçapa
            aiBalls.forEach(ball => {
                pockets.forEach(pocket => {
                    const dist = Math.hypot(ball.position.x - pocket.x, ball.position.y - pocket.y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        targetBall = ball;
                        bestPocket = pocket;
                    }
                });
            });

            // Se não houver bolas azuis (ou fallback), escolhe a bola mais próxima da branca
            if (!targetBall) {
                const targetCandidates = ballBodies.filter(b => !b.isWhite);
                if (targetCandidates.length > 0) {
                    targetBall = targetCandidates[0];
                }
            }

            let aimAngle = 0;
            if (targetBall) {
                // Calcula o vetor de impacto necessário entre a bola azul e a caçapa
                const pocketAngle = Math.atan2(bestPocket.y - targetBall.position.y, bestPocket.x - targetBall.position.x);
                const ghostX = targetBall.position.x - Math.cos(pocketAngle) * (BALL_RADIUS * 2);
                const ghostY = targetBall.position.y - Math.sin(pocketAngle) * (BALL_RADIUS * 2);

                aimAngle = Math.atan2(ghostY - whiteBallBody.position.y, ghostX - whiteBallBody.position.x);
            } else {
                aimAngle = Math.random() * Math.PI * 2;
            }

            // Simula o carregamento e disparo da IA
            const aiPower = Math.floor(Math.random() * 35) + 45; 
            const forceMagnitude = (aiPower / 100) * 0.28;

            firstBallHit = null;
            pottedThisTurn = [];
            cueBallPotted = false;

            Body.applyForce(whiteBallBody, whiteBallBody.position, {
                x: Math.cos(aimAngle) * forceMagnitude,
                y: Math.sin(aimAngle) * forceMagnitude
            });

            isShotInProgress = true;
            isAITurn = false;
        }, 800);
    }

    // Eventos de Mouse e Teclado
    canvas.addEventListener('mousemove', (e) => {
        if (isAITurn) return;
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;

        if (ballInHand && whiteBallBody && currentPlayer === 1) {
            Body.setPosition(whiteBallBody, {
                x: Math.max(BALL_RADIUS + 30, Math.min(canvas.width - BALL_RADIUS - 30, mousePos.x)),
                y: Math.max(BALL_RADIUS + 30, Math.min(canvas.height - BALL_RADIUS - 30, mousePos.y))
            });
            Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
        }
    });

    canvas.addEventListener('mousedown', () => {
        if (ballInHand && !isAITurn) setBallInHand(false);
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (isAITurn) return;

            const speed = Vector.magnitude(whiteBallBody.velocity);

            if (!isShotInProgress && !ballInHand && speed < 0.05 && !isChargingPower) {
                isChargingPower = true;
                power = 0;
                powerDirection = 1;
                firstBallHit = null;
                pottedThisTurn = [];
                cueBallPotted = false;
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && isChargingPower) {
            e.preventDefault();
            if (isAITurn) return;

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

    // Botão de Seleção de Modo (PvP vs IA)
    const btnToggleAI = document.createElement('button');
    btnToggleAI.id = 'btn-toggle-ai';
    btnToggleAI.textContent = 'Modo: 2 Jogadores (PvP)';
    btnToggleAI.style.cssText = 'margin-left: 10px; padding: 0.85rem 1.5rem; font-weight: 700; border: 2px solid #8B5A2B; border-radius: 10px; background: #1E4620; color: #FFF; cursor: pointer;';

    btnToggleAI.addEventListener('click', () => {
        vsAI = !vsAI;
        btnToggleAI.textContent = vsAI ? 'Modo: Contra IA (PvE)' : 'Modo: 2 Jogadores (PvP)';
        initGame();
    });

    const controlsPanel = document.querySelector('.controls-panel');
    if (controlsPanel && !document.getElementById('btn-toggle-ai')) {
        controlsPanel.appendChild(btnToggleAI);
    }

    function gameLoop() {
        Engine.update(engine, 1000 / 60);

        if (isChargingPower) {
            power += powerDirection * 2.5;
            if (power >= MAX_POWER) { power = MAX_POWER; powerDirection = -1; }
            else if (power <= 0) { power = 0; powerDirection = 1; }
            updatePowerBarUI();
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Renderizar Caçapas
        ctx.fillStyle = '#050505';
        pockets.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#22150c';
            ctx.stroke();

            for (let i = ballBodies.length - 1; i >= 0; i--) {
                const b = ballBodies[i];
                const dist = Math.hypot(b.position.x - p.x, b.position.y - p.y);

                if (dist < POCKET_RADIUS - 2) {
                    if (b.isWhite) {
                        cueBallPotted = true;
                        Body.setPosition(whiteBallBody, { x: 200, y: 200 });
                        Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
                    } else {
                        pottedThisTurn.push(b.color);
                        if (b.color === COLOR_P1) scoreP1 += 100;
                        if (b.color === COLOR_P2) scoreP2 += 100;

                        World.remove(engine.world, b);
                        ballBodies.splice(i, 1);
                        updateHUD();
                    }
                }
            }
        });

        // Renderizar Tabelas
        ctx.fillStyle = '#2e7d32';
        ctx.strokeStyle = '#1b5e20';
        ctx.lineWidth = 2;

        wallDefs.forEach(pts => {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#111111';
            ctx.beginPath();
            ctx.arc(pts[2].x, pts[2].y, 3, 0, Math.PI * 2);
            ctx.arc(pts[3].x, pts[3].y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2e7d32';
        });

        // Mira e Desenho de Bolas
        if (!isShotInProgress && !ballInHand && !isAITurn) {
            const playerColor = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
            ctx.strokeStyle = playerColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(whiteBallBody.position.x, whiteBallBody.position.y);
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.stroke();
        }

        ballBodies.forEach(b => {
            ctx.beginPath();
            ctx.arc(b.position.x, b.position.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = b.color;
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#000';
            ctx.stroke();
        });

        // Regra de Fim de Tacada
        if (isShotInProgress) {
            const totalSpeed = ballBodies.reduce((acc, b) => acc + Vector.magnitude(b.velocity), 0);
            if (totalSpeed < 0.02) {
                isShotInProgress = false;

                const myColor = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
                const opponentColor = currentPlayer === 1 ? COLOR_P2 : COLOR_P1;

                let isFoul = false;
                let foulReason = "";

                if (cueBallPotted) {
                    isFoul = true;
                    foulReason = "Encaçapou a bola branca!";
                } else if (firstBallHit === null) {
                    isFoul = true;
                    foulReason = "Não tocou em nenhuma bola!";
                } else if (firstBallHit.color === opponentColor) {
                    isFoul = true;
                    foulReason = "Primeiro toque foi na bola do adversário!";
                }

                if (isFoul) {
                    currentPlayer = currentPlayer === 1 ? 2 : 1;
                    setBallInHand(true);
                    updateHUD(foulReason);
                } else if (pottedThisTurn.includes(myColor)) {
                    updateHUD();
                } else {
                    currentPlayer = currentPlayer === 1 ? 2 : 1;
                    updateHUD();
                }

                firstBallHit = null;
                pottedThisTurn = [];
                cueBallPotted = false;

                // Executa a tacada da IA se for o turno dela
                if (vsAI && currentPlayer === 2) {
                    playAITurn();
                }
            }
        }

        requestAnimationFrame(gameLoop);
    }

    initGame();
    gameLoop();
});