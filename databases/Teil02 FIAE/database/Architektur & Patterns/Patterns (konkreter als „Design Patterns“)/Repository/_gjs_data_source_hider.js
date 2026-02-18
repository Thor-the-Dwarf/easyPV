(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        currentRequest: null,
        score: 0,
        happiness: 100,
        heldData: null, // { content, type: 'raw'|'clean' }
        gameOver: false
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudHappy: document.getElementById('happy-val'),
        clientArea: document.getElementById('client-area'),
        counterSlot: document.getElementById('counter-slot'),
        cellar: document.getElementById('the-cellar'),
        actionArea: document.getElementById('action-area'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn'),
        convertBtn: document.getElementById('convert-btn'),
        deliverBtn: document.getElementById('deliver-btn')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'fetch') {
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        } else if (type === 'magic') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_data_source_hider.json');
            state.config = await resp.json();

            setupBackends();
            el.restartBtn.addEventListener('click', restartGame);
            el.convertBtn.addEventListener('click', convertData);
            el.deliverBtn.addEventListener('click', deliverData);

            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function setupBackends() {
        el.cellar.innerHTML = '';
        state.config.backends.forEach(be => {
            const div = document.createElement('div');
            div.className = 'backend-source';
            div.style.borderColor = be.color;
            div.innerHTML = `<div class="source-icon">${be.icon}</div><div>${be.label}</div>`;
            div.addEventListener('click', () => fetchData(be.id));
            el.cellar.appendChild(div);
        });
    }

    function restartGame() {
        state.levelIdx = 0;
        state.score = 0;
        state.happiness = 100;
        state.gameOver = false;
        state.heldData = null;

        el.resultScreen.classList.add('hidden');
        updateHUD();
        updateCounterVisuals();
        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true);
            return;
        }
        state.levelIdx = idx;
        nextRequest();
    }

    function nextRequest() {
        state.heldData = null;
        updateCounterVisuals();

        const level = state.config.levels[state.levelIdx];
        // Pick random
        const req = level.requests[Math.floor(Math.random() * level.requests.length)];
        state.currentRequest = req;

        // Spawn Ghost
        el.clientArea.innerHTML = '';
        const ghost = document.createElement('div');
        ghost.className = 'ghost-client';
        ghost.innerHTML = `<div>User Request:</div><div style="font-weight:bold">${req.query}</div>`;
        el.clientArea.appendChild(ghost);
    }

    function fetchData(backendId) {
        if (state.heldData) return; // Empty hands first

        const targetId = state.currentRequest.targetId;
        const dataItem = state.config.data.find(d => d.id === targetId);

        const sourceContent = dataItem.sources[backendId];

        if (sourceContent) {
            state.heldData = {
                content: sourceContent,
                type: 'raw',
                origin: backendId
            };
            playTone('fetch');
        } else {
            // Empty source (e.g. cache miss)
            state.heldData = {
                content: "NULL (Empty)",
                type: 'empty',
                origin: backendId
            };
            playTone('error');
        }
        updateCounterVisuals();
    }

    function convertData() {
        if (!state.heldData || state.heldData.type !== 'raw') return;

        const targetId = state.currentRequest.targetId;
        const dataItem = state.config.data.find(d => d.id === targetId);

        playTone('magic');
        state.heldData = {
            content: dataItem.domain,
            type: 'clean'
        };

        updateCounterVisuals();
    }

    function deliverData() {
        if (!state.heldData) return;

        if (state.heldData.type === 'clean') {
            // Success
            state.score += 500;
            playTone('magic');

            // Check level progression logic
            if (state.score >= (state.levelIdx + 1) * 1500) { // simple threshold
                startLevel(state.levelIdx + 1);
            } else {
                nextRequest();
            }
        } else {
            // Fail: Leaked details or empty
            state.happiness -= 25;
            state.score -= 200;
            playTone('error');

            const ghost = el.clientArea.querySelector('.ghost-client');
            ghost.style.background = 'radial-gradient(circle, #f00 0%, transparent 70%)';
            setTimeout(() => {
                if (state.happiness <= 0) endGame(false);
                else nextRequest();
            }, 1000);
        }
        updateHUD();
    }

    function updateCounterVisuals() {
        // Clear current packet
        const existing = el.counterSlot.querySelector('.data-packet');
        if (existing) existing.remove();

        if (state.heldData) {
            const packet = document.createElement('div');
            packet.className = `data-packet ${state.heldData.type}`;
            packet.textContent = state.heldData.content;

            // Center it
            packet.style.left = '50%';
            packet.style.top = '50%';
            packet.style.transform = 'translate(-50%, -50%)';

            el.counterSlot.appendChild(packet);

            // Enable buttons
            el.convertBtn.disabled = state.heldData.type !== 'raw';
            el.convertBtn.style.opacity = state.heldData.type === 'raw' ? 1 : 0.5;
            el.deliverBtn.disabled = false;
        } else {
            el.convertBtn.disabled = true;
            el.convertBtn.style.opacity = 0.5;
            el.deliverBtn.disabled = true;
        }
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudHappy.textContent = state.happiness + '%';
    }

    function endGame(win) {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "Master Librarian!" : "You are haunted!";
        el.resultScreen.classList.remove('hidden');
    }

    function computeProgressPercent() {
        const totalLevels = Array.isArray(state?.config?.levels) ? state.config.levels.length : 0;
        if (!totalLevels) return 0;

        const completedLevels = Math.max(0, Math.min(Number(state?.levelIdx) || 0, totalLevels));
        const overlayVisible = (el?.overlay && !el.overlay.classList.contains('hidden')) ||
            (el?.resultOverlay && !el.resultOverlay.classList.contains('hidden'));
        const levelFinished = Boolean(state?.isComplete) || overlayVisible;
        const solved = Math.min(totalLevels, completedLevels + (levelFinished ? 1 : 0));
        return Math.round((solved / totalLevels) * 100);
    }

    function renderGameToText() {
        const payload = {
            mode: 'running',
            level_index: Number(state?.levelIdx) || 0,
            level_total: Array.isArray(state?.config?.levels) ? state.config.levels.length : 0,
            progress_percent: computeProgressPercent(),
            level_complete: Boolean(state?.isComplete),
            title: (el?.levelTitle?.textContent || el?.title?.textContent || document.title || '').trim()
        };

        const metricKeys = ['points', 'score', 'roi', 'pairIdx', 'activeColIdx'];
        metricKeys.forEach((key) => {
            if (typeof state?.[key] === 'number') payload[key] = state[key];
        });

        if (Array.isArray(state?.columns)) payload.columns_count = state.columns.length;
        if (el?.statusVal?.textContent) payload.status = el.statusVal.textContent.trim();

        return JSON.stringify(payload);
    }

    window.render_game_to_text = renderGameToText;
    window.advanceTime = function advanceTime(ms) {
        return ms;
    };

    init();
})();
