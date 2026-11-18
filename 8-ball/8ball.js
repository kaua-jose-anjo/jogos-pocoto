/* =========================================================
   POCOTO GAMES - 8-BALL (LOCAL + IA + MULTIPLAYER ONLINE P2P)
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

    const { Engine, World, Bodies, Body, Vector, Events } = Matter;

    const engine = Engine.create();
    engine.gravity.y = 0;
    engine.gravity.x = 0;

    const BALL_RADIUS = 10;
    const COLOR_P1 = '#e53935'; // Vermelho
    const COLOR_P2 = '#1e88e5'; // Azul

    let vsAI = false;
    let isAITurn = false;
    let isFirstShot = true;

    // Variáveis Multiplayer Online
    let isOnline = false;
    let myPlayerNumber = 1; // 1 = Host (Vermelho), 2 = Guest (Azul)
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

    let firstBallHit = null;      
    let pottedThisTurn = [];      
    let cueBallPotted = false;    

    let whiteBallBody = null;
    let ballBodies = [];

    const POCKET_RADIUS = 20;
    const pockets = [
        { x: 25, y: 25 },    
        { x: 400, y: 18 },   
        { x: 775, y: 25 },   
        { x: 25, y: 375 },   
        { x: 400, y: 382 },  
        { x: 775, y: 375 }   
    ];

    const wallVisualDefs = [
        [{ x: 50, y: 10 }, { x: 375, y: 10 }, { x: 365, y: 30 }, { x: 62, y: 30 }],
        [{ x: 425, y: 10 }, { x: 750, y: 10 }, { x: 738, y: 30 }, { x: 435, y: 30 }],
        [{ x: 62, y: 370 }, { x: 365, y: 370 }, { x: 375, y: 390 }, { x: 50, y: 390 }],
        [{ x: 435, y: 370 }, { x: 738, y: 370 }, { x: 750, y: 390 }, { x: 425, y: 390 }],
        [{ x: 10, y: 50 }, { x: 30, y: 62 }, { x: 30, y: 338 }, { x: 10, y: 350 }],
        [{ x: 770, y: 62 }, { x: 790, y: 50 }, { x: 790, y: 350 }, { x: 770, y: 338 }]
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
                setBallInHand(false);
            } else if (data.type === 'SHOT') {
                firstBallHit = null;
                pottedThisTurn = [];
                cueBallPotted = false;

                Body.setPosition(whiteBallBody, data.whitePos);
                Body.applyForce(whiteBallBody, whiteBallBody.position, data.force);
                isShotInProgress = true;
            } else if (data.type === 'BALL_IN_HAND_MOVE') {
                Body.setPosition(whiteBallBody, data.pos);
            } else if (data.type === 'BALL_IN_HAND_PLACE') {
                Body.setPosition(whiteBallBody, data.pos);
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
       INICIALIZAÇÃO E SINCRONIZAÇÃO DA MESA
       ========================================================= */
    function setupWalls() {
        const wallPhysics = { isStatic: true, restitution: 0.98, friction: 0.0 };

        const tableWalls = [
            Bodies.rectangle(212.5, 20, 312.5, 20, wallPhysics),
            Bodies.rectangle(587.5, 20, 312.5, 20, wallPhysics),
            Bodies.rectangle(212.5, 380, 312.5, 20, wallPhysics),
            Bodies.rectangle(587.5, 380, 312.5, 20, wallPhysics),
            Bodies.rectangle(20, 200, 20, 276, wallPhysics),
            Bodies.rectangle(780, 200, 20, 276, wallPhysics)
        ];
        World.add(engine.world, tableWalls);

        const outerWalls = [
            Bodies.rectangle(400, -10, 840, 20, wallPhysics),
            Bodies.rectangle(400, 410, 840, 20, wallPhysics),
            Bodies.rectangle(-10, 200, 20, 440, wallPhysics),
            Bodies.rectangle(810, 200, 20, 440, wallPhysics)
        ];
        World.add(engine.world, outerWalls);
    }

    function initGame(broadcast = false) {
        World.clear(engine.world);

        currentPlayer = 1;
        isAITurn = false;
        isFirstShot = true;
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

        setupWalls();

        const poolBallPhysics = {
            restitution: 0.99,   
            friction: 0.0,       
            frictionAir: 0.0035, 
            density: 0.04        
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
            frictionAir: 0.0035, 
            density: 0.04        
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
        loadBoardState(data.balls);
        currentPlayer = data.currentPlayer;
        scoreP1 = data.scoreP1;
        scoreP2 = data.scoreP2;
        isFirstShot = data.isFirstShot;
        setBallInHand(data.ballInHand);
        updateHUD(data.foulReason);
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

        if (isOnline) {
            statusText += currentPlayer === myPlayerNumber ? " <strong>(Sua Vez)</strong>" : " <em>(Aguardando Oponente...)</em>";
        }

        if (isFirstShot) {
            statusText += ` <strong style="color: #FFD700;">💥 ESTOURADA INICIAL</strong>`;
        } else if (foulMessage) {
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

    function playAITurn() {
        if (!vsAI || isOnline || currentPlayer !== 2 || isShotInProgress) return;

        isAITurn = true;

        if (ballInHand) {
            Body.setPosition(whiteBallBody, { x: 200, y: 200 + (Math.random() * 60 - 30) });
            setBallInHand(false);
        }

        setTimeout(() => {
            const aiBalls = ballBodies.filter(b => b.color === COLOR_P2);
            let targetBall = null;
            let bestPocket = null;
            let minDistance = Infinity;

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

            if (!targetBall) {
                const targetCandidates = ballBodies.filter(b => !b.isWhite);
                if (targetCandidates.length > 0) targetBall = targetCandidates[0];
            }

            let aimAngle = 0;
            if (targetBall && bestPocket) {
                const pocketAngle = Math.atan2(bestPocket.y - targetBall.position.y, bestPocket.x - targetBall.position.x);
                const ghostX = targetBall.position.x - Math.cos(pocketAngle) * (BALL_RADIUS * 2);
                const ghostY = targetBall.position.y - Math.sin(pocketAngle) * (BALL_RADIUS * 2);

                aimAngle = Math.atan2(ghostY - whiteBallBody.position.y, ghostX - whiteBallBody.position.x);
            } else {
                aimAngle = Math.random() * Math.PI * 2;
            }

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

    canvas.addEventListener('mousemove', (e) => {
        if (!canIControlNow()) return;

        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;

        if (ballInHand && whiteBallBody) {
            const newPos = {
                x: Math.max(35 + BALL_RADIUS, Math.min(765 - BALL_RADIUS, mousePos.x)),
                y: Math.max(35 + BALL_RADIUS, Math.min(365 - BALL_RADIUS, mousePos.y))
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

        const STOP_THRESHOLD = 0.15;
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

        ctx.fillStyle = '#388e3c';
        ctx.strokeStyle = '#2e7d32';
        ctx.lineWidth = 2;

        wallVisualDefs.forEach(pts => {
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