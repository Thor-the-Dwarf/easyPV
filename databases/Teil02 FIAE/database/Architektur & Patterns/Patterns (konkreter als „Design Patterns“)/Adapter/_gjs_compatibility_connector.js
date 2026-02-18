(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        score: 0,
        gameOver: false,
        currentModule: null
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudLevel: document.getElementById('level-val'),
        sourceNode: document.getElementById('source-node'),
        targetNode: document.getElementById('target-node'),
        adapterSocket: document.getElementById('adapter-socket'),
        modulesTray: document.getElementById('modules-tray'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn'),
        spark: document.getElementById('spark')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'connect') {
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.rampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start();
            osc.stop(now + 0.4);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_compatibility_connector.json');
            state.config = await resp.json();

            el.restartBtn.addEventListener('click', restartGame);
            setupDragDrop();

            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function restartGame() {
        state.levelIdx = 0;
        state.score = 0;
        state.gameOver = false;

        el.resultScreen.classList.add('hidden');
        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true);
            return;
        }

        state.levelIdx = idx;
        const level = state.config.levels[idx];

        updateHUD();

        // Setup Nodes
        setupNode(el.sourceNode, level.source);
        setupNode(el.targetNode, level.target);

        // Reset Adapter
        el.adapterSocket.innerHTML = '<div class="socket-label">DROP MODULE</div>';
        el.adapterSocket.className = 'adapter-socket';
        state.currentModule = null;

        // Setup Modules
        el.modulesTray.innerHTML = '';
        level.modules.forEach(mod => {
            const card = document.createElement('div');
            card.className = 'module-card';
            card.draggable = true;
            card.textContent = mod.label;
            card.dataset.id = mod.id;

            card.addEventListener('dragstart', handleDragStart);
            el.modulesTray.appendChild(card);
        });
    }

    function setupNode(node, data) {
        node.style.borderColor = data.color;
        node.querySelector('.node-label').textContent = data.label;
        node.querySelector('.node-label').style.color = data.color;
        node.querySelector('.payload-display').textContent = data.payload || 'signal';

        node.className = 'system-node ' + (data.type.includes('socket') || data.type === 'json' ? 'node-round' : 'node-square');
    }

    let draggedItem = null;

    function handleDragStart(e) {
        draggedItem = this;
        e.dataTransfer.effectAllowed = 'move';
    }

    function setupDragDrop() {
        const socket = el.adapterSocket;

        socket.addEventListener('dragover', e => {
            e.preventDefault();
            socket.classList.add('drag-over');
        });

        socket.addEventListener('dragleave', e => {
            socket.classList.remove('drag-over');
        });

        socket.addEventListener('drop', e => {
            e.preventDefault();
            socket.classList.remove('drag-over');
            if (draggedItem) {
                const modId = draggedItem.dataset.id;
                installModule(modId);
            }
        });
    }

    function installModule(modId) {
        const level = state.config.levels[state.levelIdx];
        const mod = level.modules.find(m => m.id === modId);

        if (!mod) return;

        // Visual Install
        el.adapterSocket.innerHTML = `<div class="installed-module">${mod.label}</div>`;
        playTone('connect');

        // Run Simulation
        if (mod.correct) {
            runSuccess();
        } else {
            runFailure();
        }
    }

    function runSuccess() {
        state.score += 500;
        el.sourceNode.classList.add('success');
        el.targetNode.classList.add('success');

        // Spark Animation
        el.spark.style.display = 'block';
        el.spark.classList.remove('animate');
        void el.spark.offsetWidth; // reflow
        el.spark.classList.add('animate');

        setTimeout(() => {
            el.sourceNode.classList.remove('success');
            el.targetNode.classList.remove('success');
            el.spark.style.display = 'none';

            startLevel(state.levelIdx + 1);
        }, 1500);

        updateHUD();
    }

    function runFailure() {
        state.score = Math.max(0, state.score - 200);
        el.sourceNode.classList.add('failure');
        el.targetNode.classList.add('failure');
        playTone('error');

        setTimeout(() => {
            el.sourceNode.classList.remove('failure');
            el.targetNode.classList.remove('failure');
            // Clear socket to retry
            el.adapterSocket.innerHTML = '<div class="socket-label">RETRY</div>';
        }, 1000);

        updateHUD();
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudLevel.textContent = state.levelIdx + 1;
    }

    function endGame(win) {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "Integration Complete!" : "Signal Lost!";
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
