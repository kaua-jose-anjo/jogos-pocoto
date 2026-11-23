/* =========================================================
   POCOTO GAMES - 8-BALL (TABELAS, CAÇAPAS E IA PROGRESSIVA)
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

    // Elementos Multiplayer
    const btnCreateRoom = document.getElementById('btn-create-room');
    const btnJoinRoom = document.getElementById('btn-join-room');
    const roomCodeInput = document.getElementById('room-code-input');
    const onlineStatusEl = document.getElementById('online-status');

    const { Engine, World, Bodies, Body, Vector, Events, Vertices } = Matter;

    // Impede o Matter.js de matar o quique das bolas que batem devagar nas tabelas
    Matter.Resolver._restingThresh = 0.001;

    const engine = Engine.create();
    engine.gravity.y = 0;
    engine.gravity.x = 0;

    engine.positionIterations = 10;
    engine.velocityIterations = 10;

    const BALL_RADIUS = 10;
    const COLOR_P1 = '#e53935'; // Vermelho
    const COLOR_P2 = '#1e88e5'; // Azul

    let vsAI = false;
    let isAITurn = false;
    let isFirstShot = true;
    let aiLevel = 1;
    let aiTurnCount = 0;

    // Variáveis Multiplayer Online
    let isOnline = false;
    let myPlayerNumber = 1;
    let peer = null;
    let conn = null;

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
    let lastFoulMessage = "";

    let firstBallHit = null;      
    let pottedThisTurn = [];      
    let cueBallPotted = false;    

    let whiteBallBody = null;
    let ballBodies = [];

    // Caçapas com posicionamento alinhado à abertura das tabelas e raio de captura ampliado
    const POCKET_RADIUS = 22;
    const CAPTURE_RADIUS = 26;
    const SUCTION_RADIUS = 34;

    const pockets = [
        { x: 28, y: 28 },    // Canto Superior Esquerdo
        { x: 400, y: 20 },   // Meio Superior
        { x: 772, y: 28 },   // Canto Superior Direito
        { x: 28, y: 372 },   // Canto Inferior Esquerdo
        { x: 400, y: 380 },  // Meio Inferior
        { x: 772, y: 372 }   // Canto Inferior Direito
    ];

    // Tabelas verde claro com abertura mais generosa nas bocas das 6 caçapas
    const wallDefs = [
        // Topo Esquerda
        [{ x: 54, y: 8 }, { x: 372, y: 8 }, { x: 362, y: 30 }, { x: 66, y: 30 }],
        // Topo Direita
        [{ x: 428, y: 8 }, { x: 746, y: 8 }, { x: 734, y: 30 }, { x: 438, y: 30 }],
        // Inferior Esquerda
        [{ x: 66, y: 370 }, { x: 362, y: 370 }, { x: 372, y: 392 }, { x: 54, y: 392 }],
        // Inferior Direita
        [{ x: 438, y: 370 }, { x: 734, y: 370 }, { x: 746, y: 392 }, { x: 428, y: 392 }],
        // Lateral Esquerda
        [{ x: 8, y: 54 }, { x: 30, y: 66 }, { x: 30, y: 334 }, { x: 8, y: 346 }],
        // Lateral Direita
        [{ x: 770, y: 66 }, { x: 792, y: 54 }, { x: 792, y: 346 }, { x: 770, y: 334 }]
    ];

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

    /* =========================================================
       SISTEMA DE REDE MULTIPLAYER (PEERJS)
       ========================================================= */
    function setupConnection(connection) {
        conn = connection;
        isOnline = true;
        vsAI = false;

        conn.on('open', () => {
            if (myPlayerNumber === 1) {
                onlineStatusEl.innerHTML = `✅ Jogador 2 conectado! Você é o <span style="color:${COLOR_P1}">Jogador 1 (Vermelho)</span>.`;
                initGame(true);
            } else {
                onlineStatusEl.innerHTML = `✅ Conectado à sala! Você é o <span style="color:${COLOR_P2}">Jogador 2 (Azul)</span>.`;
            }
        });

        conn.on('data', (data) => {
            if (data.type === 'INIT_BOARD') {
                loadBoardState(data.balls);
                currentPlayer = 1;
                isFirstShot = true;
                scoreP1 = 0;
                scoreP2 = 0;
                lastFoulMessage = "";
                setBallInHand(false);
            } else if (data.type === 'SHOT') {
                lastFoulMessage = "";
                firstBallHit = null;
                pottedThisTurn = [];
                cueBallPotted = false;

                Body.setPosition(whiteBallBody, data.whitePos);
                Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
                Body.applyForce(whiteBallBody, whiteBallBody.position, data.force);
                isShotInProgress = true;
            } else if (data.type === 'BALL_IN_HAND_MOVE') {
                if (whiteBallBody) {
                    Body.setPosition(whiteBallBody, data.pos);
                    Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
                }
            } else if (data.type === 'BALL_IN_HAND_PLACE') {
                if (whiteBallBody) {
                    Body.setPosition(whiteBallBody, data.pos);
                    Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
                }
                lastFoulMessage = "";
                setBallInHand(false);
            } else if (data.type === 'SYNC_END_TURN') {
                syncFinalState(data);
            }
        });

        conn.on('close', () => {
            onlineStatusEl.textContent = '❌ O oponente desconectou da sala.';
            isOnline = false;
            conn = null;
        });
    }

    btnCreateRoom.addEventListener('click', () => {
        const randomCode = 'pocoto-' + Math.floor(1000 + Math.random() * 9000);
        onlineStatusEl.textContent = '⏳ Gerando código da sala...';
        btnCreateRoom.disabled = true;

        if (peer) peer.destroy();
        peer = new Peer(randomCode);
        myPlayerNumber = 1;

        peer.on('open', (id) => {
            roomCodeInput.value = id;
            btnCreateRoom.disabled = false;
            onlineStatusEl.innerHTML = `
                📡 Sala pronta! Código: <strong style="color:#1E4620; font-size:1.05rem;">${id}</strong> 
                <button id="btn-copy-code" style="margin-left:8px; padding:3px 8px; border-radius:6px; border:1px solid #8B5A2B; background:#FFF; cursor:pointer; font-weight:700;">📋 Copiar</button>
            `;

            document.getElementById('btn-copy-code').addEventListener('click', () => {
                navigator.clipboard.writeText(id);
                document.getElementById('btn-copy-code').textContent = '✅ Copiado!';
            });
        });

        peer.on('error', (err) => {
            btnCreateRoom.disabled = false;
            onlineStatusEl.innerHTML = `⚠️ Erro ao gerar sala (${err.type}). Tente novamente.`;
        });

        peer.on('connection', (connection) => {
            setupConnection(connection);
        });
    });

    btnJoinRoom.addEventListener('click', () => {
        const targetCode = roomCodeInput.value.trim();
        if (!targetCode) {
            alert('Digite o código da sala para entrar!');
            return;
        }

        onlineStatusEl.textContent = '⏳ Conectando à sala...';
        btnJoinRoom.disabled = true;

        if (peer) peer.destroy();
        peer = new Peer();
        myPlayerNumber = 2;

        peer.on('open', () => {
            const connection = peer.connect(targetCode);
            btnJoinRoom.disabled = false;
            setupConnection(connection);
        });

        peer.on('error', (err) => {
            btnJoinRoom.disabled = false;
            onlineStatusEl.innerHTML = `⚠️ Não foi possível entrar (${err.type}). Verifique o código.`;
        });
    });

    function sendOnlineData(payload) {
        if (isOnline && conn && conn.open) {
            conn.send(payload);
        }
    }

    function canIControlNow() {
        if (isAITurn) return false;
        if (isOnline && currentPlayer !== myPlayerNumber) return false;
        return true;
    }

    /* =========================================================
       CONSTRUÇÃO FÍSICA DAS TABELAS E RECUO EXTERNO
       ========================================================= */
    function setupWalls() {
        const wallPhysics = {
            isStatic: true,
            restitution: 0.98,
            friction: 0.0,
            frictionStatic: 0.0,
            inertia: Infinity,
            slop: 0.0
        };

        wallDefs.forEach(pts => {
            const center = Vertices.centre(pts);
            const cushionBody = Bodies.fromVertices(center.x, center.y, [pts], wallPhysics, true);
            if (cushionBody) {
                const currentCenter = Vertices.centre(cushionBody.vertices);
                Body.translate(cushionBody, {
                    x: center.x - currentCenter.x,
                    y: center.y - currentCenter.y
                });
                // Garante restituição nas partes internas caso Bodies.fromVertices subdivida o polígono
                if (cushionBody.parts) {
                    cushionBody.parts.forEach(part => {
                        part.restitution = 0.98;
                        part.friction = 0.0;
                        part.frictionStatic = 0.0;
                        part.slop = 0.0;
                    });
                }
                World.add(engine.world, cushionBody);
            }
        });

        // Paredes externas recuadas para que a bola entre livremente na caçapa sem bater no fundo
        const outerWalls = [
            Bodies.rectangle(400, -30, 900, 30, wallPhysics),
            Bodies.rectangle(400, 430, 900, 30, wallPhysics),
            Bodies.rectangle(-30, 200, 30, 500, wallPhysics),
            Bodies.rectangle(830, 200, 30, 500, wallPhysics)
        ];
        World.add(engine.world, outerWalls);
    }

    function initGame(broadcast = false) {
        World.clear(engine.world);

        currentPlayer = 1;
        isAITurn = false;
        isFirstShot = true;
        aiTurnCount = 0;
        scoreP1 = 0;
        scoreP2 = 0;
        isShotInProgress = false;
        isChargingPower = false;
        power = 0;
        firstBallHit = null;
        pottedThisTurn = [];
        cueBallPotted = false;
        lastFoulMessage = "";
        updatePowerBarUI();
        ballBodies = [];

        setupWalls();

        const poolBallPhysics = {
            restitution: 0.99,   
            friction: 0.0,
            frictionStatic: 0.0,
            frictionAir: 0.0035, 
            density: 0.04,
            slop: 0.0
        };

        whiteBallBody = Bodies.circle(200, 200, BALL_RADIUS, poolBallPhysics);
        whiteBallBody.isWhite = true;
        whiteBallBody.ballId = 0;
        whiteBallBody.color = '#ffffff';
        World.add(engine.world, whiteBallBody);
        ballBodies.push(whiteBallBody);

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
                    ball.ballId = index + 1;
                    ball.color = targetColors[index];

                    World.add(engine.world, ball);
                    ballBodies.push(ball);
                    index++;
                }
            }
        }
        
        setBallInHand(false);

        if (broadcast && isOnline && myPlayerNumber === 1) {
            const serializedBalls = ballBodies.map(b => ({
                ballId: b.ballId,
                isWhite: b.isWhite,
                color: b.color,
                x: b.position.x,
                y: b.position.y
            }));
            sendOnlineData({ type: 'INIT_BOARD', balls: serializedBalls });
        }
    }

    function loadBoardState(serializedBalls) {
        World.clear(engine.world);
        ballBodies = [];
        setupWalls();

        const poolBallPhysics = {
            restitution: 0.99,   
            friction: 0.0,
            frictionStatic: 0.0,
            frictionAir: 0.0035, 
            density: 0.04,
            slop: 0.0
        };

        serializedBalls.forEach(item => {
            const ball = Bodies.circle(item.x, item.y, BALL_RADIUS, poolBallPhysics);
            ball.isWhite = item.isWhite;
            ball.ballId = item.ballId;
            ball.color = item.color;

            if (item.isWhite) whiteBallBody = ball;
            World.add(engine.world, ball);
            ballBodies.push(ball);
        });
    }

    function syncFinalState(data) {
        isShotInProgress = false;
        isChargingPower = false;
        
        loadBoardState(data.balls);
        currentPlayer = data.currentPlayer;
        scoreP1 = data.scoreP1;
        scoreP2 = data.scoreP2;
        isFirstShot = data.isFirstShot;
        lastFoulMessage = data.foulReason || "";
        
        setBallInHand(data.ballInHand, lastFoulMessage);
    }

    function setBallInHand(active, foulMessage = "") {
        ballInHand = active;
        if (whiteBallBody) {
            whiteBallBody.isSensor = active;
            if (!active) {
                Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
            }
        }
        updateHUD(foulMessage);
    }

    function getEffectiveAIDifficulty() {
        const playerProgress = (scoreP1 / 100) * 0.05;
        const turnProgress = aiTurnCount * 0.04;
        const baseSkill = (aiLevel - 1) * 0.20 + 0.25;
        return Math.min(1.0, baseSkill + turnProgress + playerProgress);
    }

    function updateHUD(foulMessage = lastFoulMessage) {
        const redBalls = ballBodies.filter(b => b.color === COLOR_P1).length;
        const blueBalls = ballBodies.filter(b => b.color === COLOR_P2).length;

        const skillPercent = Math.round(getEffectiveAIDifficulty() * 100);
        let p2Label = vsAI ? `🤖 IA Nv.${aiLevel} (${skillPercent}%)` : "Jogador 2 (Azul)";
        let statusText = currentPlayer === 1 
            ? `<span style="color:${COLOR_P1}">Jogador 1 (Vermelho)</span>` 
            : `<span style="color:${COLOR_P2}">${p2Label}</span>`;

        if (isOnline) {
            statusText += currentPlayer === myPlayerNumber ? " <strong>(Sua Vez)</strong>" : " <em>(Vez do Oponente)</em>";
        }

        if (isFirstShot) {
            statusText += ` <strong style="color: #FFD700;">💥 ESTOURADA INICIAL</strong>`;
        } else if (foulMessage) {
            statusText += ` <strong style="color: #ff5252;">⚠️ INFRAÇÃO: ${foulMessage}</strong>`;
        }

        if (ballInHand) {
            if (isOnline && currentPlayer !== myPlayerNumber) {
                statusText += ` <strong style="color: #FFD700;">🖐️ Oponente posicionando a bola...</strong>`;
            } else {
                statusText += ` <strong style="color: #FFD700;">🖐️ BOLA NA MÃO! (Clique para posicionar)</strong>`;
            }
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

    function isPathBlocked(startPos, endPos, ignoreBodies = []) {
        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return false;

        const ux = dx / len;
        const uy = dy / len;

        for (let b of ballBodies) {
            if (ignoreBodies.includes(b)) continue;

            const px = b.position.x - startPos.x;
            const py = b.position.y - startPos.y;
            const proj = px * ux + py * uy;

            if (proj > 0 && proj < len) {
                const perpDist = Math.abs(px * uy - py * ux);
                if (perpDist < BALL_RADIUS * 2.1) {
                    return true;
                }
            }
        }
        return false;
    }

    function playAITurn() {
        if (!vsAI || isOnline || currentPlayer !== 2 || isShotInProgress) return;

        isAITurn = true;
        aiTurnCount++;
        const skill = getEffectiveAIDifficulty();

        if (ballInHand) {
            Body.setPosition(whiteBallBody, { x: 200, y: 200 + (Math.random() * 60 - 30) });
            lastFoulMessage = "";
            setBallInHand(false);
        }

        setTimeout(() => {
            const aiBalls = ballBodies.filter(b => b.color === COLOR_P2);
            let bestShot = null;
            let bestScore = -Infinity;

            aiBalls.forEach(ball => {
                pockets.forEach(pocket => {
                    const pocketAngle = Math.atan2(pocket.y - ball.position.y, pocket.x - ball.position.x);
                    const ghostPos = {
                        x: ball.position.x - Math.cos(pocketAngle) * (BALL_RADIUS * 2),
                        y: ball.position.y - Math.sin(pocketAngle) * (BALL_RADIUS * 2)
                    };

                    const distToPocket = Math.hypot(ball.position.x - pocket.x, ball.position.y - pocket.y);
                    const distWhiteToGhost = Math.hypot(ghostPos.x - whiteBallBody.position.x, ghostPos.y - whiteBallBody.position.y);

                    let shotQuality = 1000 - (distToPocket + distWhiteToGhost * 0.5);

                    const blockedToBall = isPathBlocked(whiteBallBody.position, ghostPos, [whiteBallBody, ball]);
                    const blockedToPocket = isPathBlocked(ball.position, pocket, [whiteBallBody, ball]);

                    if (blockedToBall || blockedToPocket) {
                        shotQuality -= 800 * skill;
                    }

                    if (shotQuality > bestScore) {
                        bestScore = shotQuality;
                        bestShot = { ball, pocket, ghostPos, distToPocket };
                    }
                });
            });

            let aimAngle = 0;
            if (bestShot) {
                aimAngle = Math.atan2(
                    bestShot.ghostPos.y - whiteBallBody.position.y,
                    bestShot.ghostPos.x - whiteBallBody.position.x
                );
            } else {
                aimAngle = Math.random() * Math.PI * 2;
            }

            const maxErrorAngle = (1 - skill) * 0.30;
            const randomError = (Math.random() * 2 - 1) * maxErrorAngle;
            aimAngle += randomError;

            const idealPower = bestShot ? Math.min(85, Math.max(40, (bestShot.distToPocket / 400) * 70 + 35)) : 60;
            const powerNoise = (Math.random() * 2 - 1) * (1 - skill) * 30;
            const finalPower = Math.max(25, Math.min(95, idealPower + powerNoise));
            const forceMagnitude = (finalPower / 100) * 0.28;

            firstBallHit = null;
            pottedThisTurn = [];
            cueBallPotted = false;
            lastFoulMessage = "";

            Body.applyForce(whiteBallBody, whiteBallBody.position, {
                x: Math.cos(aimAngle) * forceMagnitude,
                y: Math.sin(aimAngle) * forceMagnitude
            });

            isShotInProgress = true;
            isAITurn = false;
        }, 800);
    }

    canvas.addEventListener('mousemove', (e) => {
        if (!canIControlNow()) return;

        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;

        if (ballInHand && whiteBallBody) {
            const newPos = {
                x: Math.max(45 + BALL_RADIUS, Math.min(755 - BALL_RADIUS, mousePos.x)),
                y: Math.max(45 + BALL_RADIUS, Math.min(355 - BALL_RADIUS, mousePos.y))
            };
            Body.setPosition(whiteBallBody, newPos);
            Body.setVelocity(whiteBallBody, { x: 0, y: 0 });

            if (isOnline) {
                sendOnlineData({ type: 'BALL_IN_HAND_MOVE', pos: newPos });
            }
        }
    });

    canvas.addEventListener('mousedown', () => {
        if (ballInHand && canIControlNow()) {
            lastFoulMessage = "";
            setBallInHand(false);
            if (isOnline) {
                sendOnlineData({
                    type: 'BALL_IN_HAND_PLACE',
                    pos: { x: whiteBallBody.position.x, y: whiteBallBody.position.y }
                });
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!canIControlNow()) return;

            const speed = Vector.magnitude(whiteBallBody.velocity);

            if (!isShotInProgress && !ballInHand && speed < 0.05 && !isChargingPower) {
                isChargingPower = true;
                power = 0;
                powerDirection = 1;
                firstBallHit = null;
                pottedThisTurn = [];
                cueBallPotted = false;
                lastFoulMessage = "";
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && isChargingPower) {
            e.preventDefault();
            if (!canIControlNow()) return;

            const angle = Math.atan2(mousePos.y - whiteBallBody.position.y, mousePos.x - whiteBallBody.position.x);
            const forceMagnitude = (power / 100) * 0.30; 
            const forceVector = {
                x: Math.cos(angle) * forceMagnitude,
                y: Math.sin(angle) * forceMagnitude
            };

            if (isOnline) {
                sendOnlineData({
                    type: 'SHOT',
                    whitePos: { x: whiteBallBody.position.x, y: whiteBallBody.position.y },
                    force: forceVector
                });
            }

            Body.applyForce(whiteBallBody, whiteBallBody.position, forceVector);

            isChargingPower = false;
            isShotInProgress = true;
            power = 0;
            updatePowerBarUI();
        }
    });

    btnRestart.addEventListener('click', () => {
        if (isOnline && myPlayerNumber !== 1) {
            alert('Apenas o criador da sala (Jogador 1) pode reiniciar a partida online.');
            return;
        }
        initGame(true);
    });

    const btnToggleAI = document.createElement('button');
    btnToggleAI.id = 'btn-toggle-ai';
    btnToggleAI.textContent = 'Modo: 2 Jogadores (PvP)';
    btnToggleAI.style.cssText = 'margin-left: 10px; padding: 0.85rem 1.5rem; font-weight: 700; border: 2px solid #8B5A2B; border-radius: 10px; background: #1E4620; color: #FFF; cursor: pointer;';

    btnToggleAI.addEventListener('click', () => {
        if (isOnline) {
            alert('Desconecte do modo online para jogar contra a IA.');
            return;
        }
        vsAI = !vsAI;
        btnToggleAI.textContent = vsAI ? 'Modo: Contra IA (PvE)' : 'Modo: 2 Jogadores (PvP)';
        initGame(false);
    });

    const controlsPanel = document.querySelector('.controls-panel');
    if (controlsPanel && !document.getElementById('btn-toggle-ai')) {
        controlsPanel.appendChild(btnToggleAI);
    }

    function gameLoop() {
        Engine.update(engine, 1000 / 60);

        const STOP_THRESHOLD = 0.08;
        ballBodies.forEach(b => {
            const currentSpeed = Vector.magnitude(b.velocity);
            if (currentSpeed > 0 && currentSpeed < STOP_THRESHOLD) {
                Body.setVelocity(b, { x: 0, y: 0 });
                Body.setAngularVelocity(b, 0);
            }
        });

        if (isChargingPower) {
            power += powerDirection * 2.5;
            if (power >= MAX_POWER) { power = MAX_POWER; powerDirection = -1; }
            else if (power <= 0) { power = 0; powerDirection = 1; }
            updatePowerBarUI();
        }

        ctx.fillStyle = '#1e5622';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Desenho e Lógica de Captura das Caçapas
        ctx.fillStyle = '#0a0a0a';
        pockets.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#22150c';
            ctx.stroke();

            for (let i = ballBodies.length - 1; i >= 0; i--) {
                const b = ballBodies[i];
                if (b.isSensor) continue;

                const dx = p.x - b.position.x;
                const dy = p.y - b.position.y;
                const dist = Math.hypot(dx, dy);

                if (dist >= CAPTURE_RADIUS && dist < SUCTION_RADIUS) {
                    const pullStrength = 0.0025;
                    Body.applyForce(b, b.position, {
                        x: (dx / dist) * pullStrength,
                        y: (dy / dist) * pullStrength
                    });
                }

                if (dist < CAPTURE_RADIUS) {
                    if (b.isWhite) {
                        cueBallPotted = true;
                        Body.setPosition(whiteBallBody, { x: 200, y: 200 });
                        Body.setVelocity(whiteBallBody, { x: 0, y: 0 });
                    } else {
                        pottedThisTurn.push(b.color);
                        if (!isOnline || currentPlayer === myPlayerNumber) {
                            if (b.color === COLOR_P1) scoreP1 += 100;
                            if (b.color === COLOR_P2) scoreP2 += 100;
                        }

                        World.remove(engine.world, b);
                        ballBodies.splice(i, 1);
                        updateHUD();
                    }
                }
            }
        });

        // Desenho das Tabelas Verde Claro
        ctx.fillStyle = '#388e3c';
        ctx.strokeStyle = '#2e7d32';
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
            ctx.fillStyle = '#388e3c';
        });

        if (ballInHand && whiteBallBody) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(whiteBallBody.position.x, whiteBallBody.position.y, BALL_RADIUS + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (!isShotInProgress && !ballInHand && canIControlNow()) {
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

        if (isShotInProgress) {
            const totalSpeed = ballBodies.reduce((acc, b) => acc + Vector.magnitude(b.velocity), 0);
            if (totalSpeed < 0.02) {
                isShotInProgress = false;

                if (!isOnline || currentPlayer === myPlayerNumber) {
                    const remainingRed = ballBodies.filter(b => b.color === COLOR_P1).length;
                    const remainingBlue = ballBodies.filter(b => b.color === COLOR_P2).length;

                    if (remainingRed === 0 || remainingBlue === 0) {
                        const p1Won = remainingRed === 0;
                        if (vsAI) {
                            if (p1Won) {
                                aiLevel++;
                                alert(`🎉 Você venceu! A IA ficou irritada e subiu para o Nível ${aiLevel}!`);
                            } else {
                                aiLevel = Math.max(1, aiLevel - 1);
                                alert(`💀 Você perdeu até pra essa IA! Dificuldade reduzida para o Nível ${aiLevel}.`);
                            }
                        } else {
                            alert(p1Won ? '🏆 Jogador 1 (Vermelho) venceu!' : '🏆 Jogador 2 (Azul) venceu!');
                        }
                        initGame(true);
                        requestAnimationFrame(gameLoop);
                        return;
                    }

                    const myColor = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
                    const opponentColor = currentPlayer === 1 ? COLOR_P2 : COLOR_P1;

                    let isFoul = false;
                    let foulReason = "";

                    if (cueBallPotted) {
                        isFoul = true;
                        foulReason = "Encaçapou a bola branca!";
                    } else if (!isFirstShot) {
                        if (firstBallHit === null) {
                            isFoul = true;
                            foulReason = "Não tocou em nenhuma bola!";
                        } else if (firstBallHit.color === opponentColor) {
                            isFoul = true;
                            foulReason = "Primeiro toque foi na bola do adversário!";
                        }
                    }

                    if (isFirstShot) {
                        isFirstShot = false;
                    }

                    lastFoulMessage = foulReason;

                    if (isFoul) {
                        currentPlayer = currentPlayer === 1 ? 2 : 1;
                        setBallInHand(true, foulReason);
                    } else if (pottedThisTurn.includes(myColor)) {
                        updateHUD("");
                    } else {
                        currentPlayer = currentPlayer === 1 ? 2 : 1;
                        updateHUD("");
                    }

                    firstBallHit = null;
                    pottedThisTurn = [];
                    cueBallPotted = false;

                    if (isOnline) {
                        const serializedBalls = ballBodies.map(b => ({
                            ballId: b.ballId,
                            isWhite: b.isWhite,
                            color: b.color,
                            x: b.position.x,
                            y: b.position.y
                        }));
                        sendOnlineData({
                            type: 'SYNC_END_TURN',
                            balls: serializedBalls,
                            currentPlayer,
                            scoreP1,
                            scoreP2,
                            isFirstShot,
                            ballInHand,
                            foulReason
                        });
                    } else if (vsAI && currentPlayer === 2) {
                        playAITurn();
                    }
                }
            }
        }

        requestAnimationFrame(gameLoop);
    }

    initGame(false);
    gameLoop();
});