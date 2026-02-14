(function () {
    'use strict';

    const state = {
        config: null,
        level: 1,
        score: 0,
        health: 100,
        activeMemos: [],
        spawnTimer: null,
        gameLoopFrame: null,
        isDragging: false,
        draggedMemo: null,
        offsetX: 0,
        offsetY: 0,
        gameOver: false,
        bins: {}
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudHealth: document.getElementById('health-bar'),
        stage: document.querySelector('.office-stage'),
        memoContainer: document.getElementById('memo-container'),
        bins: document.querySelectorAll('.bin'),
        feedback: document.getElementById('feedback-msg'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'good') {
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'bad') {
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.type = 'sawtooth';
            osc.start();
            osc.stop(now + 0.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_g01_protokoll_arten_sortierer.json');
            state.config = await resp.json();
            setupBins();
            el.restartBtn.addEventListener('click', startGame);
            setupDragDrop();
            startGame();
        } catch (e) {
            console.error(e);
        }
    }

    function setupBins() {
        el.bins.forEach(bin => {
            state.bins[bin.dataset.id] = bin;
        });
    }

    function setupDragDrop() {
        // Touch/Mouse handlers are attached to memos on spawn
        // Global move/up handlers
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('touchmove', onDragMove, { passive: false });
        window.addEventListener('mouseup', onDragEnd);
        window.addEventListener('touchend', onDragEnd);
    }

    function startGame() {
        state.score = 0;
        state.health = 100;
        state.level = 1;
        state.gameOver = false;
        state.activeMemos = [];
        el.memoContainer.innerHTML = '';
        el.resultScreen.classList.add('hidden');
        updateHUD();

        // Start Loops
        spawnLoop();
        gameLoop();
    }

    function spawnLoop() {
        if (state.gameOver) return;

        const levelConfig = state.config.levels.find(l => l.id === state.level) || state.config.levels[0];
        const scenarios = levelConfig.scenarios;
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

        createMemo(scenario, levelConfig.speed_modifier);

        // Dynamic difficulty: faster spawn as score increases?
        let rate = levelConfig.spawn_rate;
        // slightly decrease rate based on score, min 800ms
        rate = Math.max(800, rate - (state.score / 10));

        state.spawnTimer = setTimeout(spawnLoop, rate);
    }

    function createMemo(scenario, speedMod) {
        const memo = document.createElement('div');
        memo.className = 'memo';
        memo.innerHTML = `
      <div class="memo-title">${scenario.title}</div>
      <div class="memo-text">${scenario.context}</div>
      <div class="memo-stamp">SORTED</div>
    `;

        // Random Start X (keep within bounds with padding)
        const maxX = el.stage.clientWidth - 220; // 200 width + padding
        const startX = 20 + Math.random() * maxX;

        memo.style.left = startX + 'px';
        memo.style.top = '-150px';
        memo.style.setProperty('--angle', (Math.random() * 10 - 5) + 'deg');

        const memoObj = {
            el: memo,
            data: scenario,
            y: -150,
            x: startX,
            speed: (1 + Math.random() * 0.5) * speedMod,
            isHeld: false
        };

        // Attach Drag Start
        const onStart = (e) => onDragStart(e, memoObj);
        memo.addEventListener('mousedown', onStart);
        memo.addEventListener('touchstart', onStart, { passive: false });

        el.memoContainer.appendChild(memo);
        state.activeMemos.push(memoObj);
    }

    function gameLoop() {
        if (state.gameOver) return;

        const screenH = el.stage.clientHeight;

        state.activeMemos.forEach((m, idx) => {
            if (!m.isHeld) {
                m.y += m.speed;
                m.el.style.top = m.y + 'px';
                m.el.style.left = m.x + 'px'; // Ensure X is maintained

                // Check bounds (missed)
                if (m.y > screenH) {
                    handleMiss(m);
                    destroyMemo(idx);
                }
            }
        });

        // Cleanup destroyed
        state.activeMemos = state.activeMemos.filter(m => m.el.parentNode);

        state.gameLoopFrame = requestAnimationFrame(gameLoop);
    }

    /* --- Drag & Drop Logic --- */

    function onDragStart(e, memoObj) {
        if (state.gameOver) return;
        e.preventDefault();
        state.isDragging = true;
        state.draggedMemo = memoObj;
        memoObj.isHeld = true;
        memoObj.el.classList.add('dragging');

        // Calculate offset
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        const rect = memoObj.el.getBoundingClientRect();
        state.offsetX = clientX - rect.left;
        state.offsetY = clientY - rect.top;

        // Move to body for overlay? Or keep in container z-index high
        // Keeping in container is easier for relative coords if container is relative.
        // But Drag uses client coords usually. 
        // Let's rely on mapping client back to container.
    }

    function onDragMove(e) {
        if (!state.isDragging || !state.draggedMemo) return;
        e.preventDefault();

        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        const containerRect = el.stage.getBoundingClientRect();

        let newX = clientX - containerRect.left - state.offsetX;
        let newY = clientY - containerRect.top - state.offsetY;

        state.draggedMemo.x = newX;
        state.draggedMemo.y = newY;

        state.draggedMemo.el.style.left = newX + 'px';
        state.draggedMemo.el.style.top = newY + 'px';
        state.draggedMemo.el.style.transform = 'rotate(0deg) scale(1.05)';

        checkBinHover(clientX, clientY);
    }

    function checkBinHover(x, y) {
        el.bins.forEach(bin => {
            const rect = bin.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                bin.classList.add('drop-target');
            } else {
                bin.classList.remove('drop-target');
            }
        });
    }

    function onDragEnd(e) {
        if (!state.isDragging) return;

        const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

        // Check Drop
        let droppedBinId = null;
        el.bins.forEach(bin => {
            const rect = bin.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
                droppedBinId = bin.dataset.id;
            }
            bin.classList.remove('drop-target');
        });

        if (droppedBinId) {
            handleSort(state.draggedMemo, droppedBinId);
        } else {
            // Drop failed, release
            state.draggedMemo.isHeld = false;
            state.draggedMemo.el.classList.remove('dragging');
        }

        state.isDragging = false;
        state.draggedMemo = null;
    }

    /* --- Game Logic --- */

    function handleSort(memo, binId) {
        const correct = memo.data.correct_bin;
        const alt = memo.data.alt_bin;

        if (binId === correct || binId === alt) {
            // Success
            state.score += 100;
            state.health = Math.min(100, state.health + 5);
            showFeedback(binId === correct ? "Perfekt!" : "Passt auch", "stamp-ok");
            playTone('good');
        } else {
            // Fail
            state.health -= 15;
            showFeedback("Verschwendung!", "stamp-fail");
            playTone('bad');
        }

        // Check Level Up
        if (state.score > 500 && state.level === 1) state.level = 2;
        if (state.score > 1500 && state.level === 2) state.level = 3;

        updateHUD();
        destroyMemo(state.activeMemos.indexOf(memo));

        if (state.health <= 0) endGame();
    }

    function handleMiss(memo) {
        state.health -= 10;
        updateHUD();
        if (state.health <= 0) endGame();
    }

    function destroyMemo(idx) {
        if (idx === -1) return;
        const m = state.activeMemos[idx];
        if (m && m.el && m.el.parentNode) {
            m.el.remove();
        }
        state.activeMemos.splice(idx, 1);
    }

    function showFeedback(text, cls) {
        // Simple center feedback
        el.feedback.textContent = text;
        el.feedback.className = `feedback-msg show ${cls === 'stamp-ok' ? 'msg-hit' : 'msg-miss'}`;
        // Also color
        el.feedback.style.color = cls === 'stamp-ok' ? 'hsl(var(--success))' : 'hsl(var(--error))';

        setTimeout(() => {
            el.feedback.classList.remove('show');
        }, 1000);
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudHealth.style.width = state.health + '%';
        el.hudHealth.style.backgroundColor = state.health > 50 ? 'hsl(var(--success))' : (state.health > 20 ? 'hsl(var(--primary))' : 'hsl(var(--error))');
    }

    function endGame() {
        state.gameOver = true;
        clearTimeout(state.spawnTimer);
        cancelAnimationFrame(state.gameLoopFrame);
        el.finalScore.textContent = state.score;
        el.resultScreen.classList.remove('hidden');
    }

    // Debug
    window.render_game_to_text = function () {
        return JSON.stringify({ state: state.gameOver ? 'over' : 'running', score: state.score });
    }

    init();
})();
