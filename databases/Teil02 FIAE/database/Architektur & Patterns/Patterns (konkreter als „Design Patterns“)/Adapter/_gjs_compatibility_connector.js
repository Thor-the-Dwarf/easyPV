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

    function getConfigRoot() {
        return state?.config || state?.cfg || null;
    }

    function getTotalUnits() {
        const cfg = getConfigRoot();
        const arrayKeys = [
            'levels', 'scenarios', 'phases', 'patterns', 'components', 'pillars',
            'definitions', 'pairs', 'items', 'questions', 'tasks', 'steps',
            'orders', 'cards', 'messages', 'events', 'columns'
        ];

        if (cfg) {
            for (const key of arrayKeys) {
                const value = cfg[key];
                if (Array.isArray(value) && value.length > 0) return value.length;
            }
        }

        const numericKeys = ['totalLevels', 'totalScenarios', 'totalRounds', 'totalToSort', 'targetTotal', 'storyTarget', 'maxResistance', 'entityTotal'];
        for (const key of numericKeys) {
            const value = Number(state?.[key]);
            if (Number.isFinite(value) && value > 0) return Math.floor(value);
        }

        return 0;
    }

    function getCurrentIndex(totalUnits) {
        const idxKeys = ['levelIdx', 'scenarioIdx', 'currentPhaseIdx', 'phaseIdx', 'roundIdx', 'stageIdx', 'questionIdx', 'taskIdx', 'pairIdx', 'waveIdx', 'storyIdx', 'targetIdx'];
        for (const key of idxKeys) {
            const value = Number(state?.[key]);
            if (!Number.isFinite(value)) continue;
            const floored = Math.floor(value);
            if (totalUnits > 0) return Math.max(0, Math.min(floored, totalUnits));
            return Math.max(0, floored);
        }
        return 0;
    }

    function getBaseCompleted(totalUnits) {
        const countKeyPairs = [
            ['sortedCount', 'totalToSort'],
            ['placedCount', 'totalItems'],
            ['targetsFound', 'targetTotal'],
            ['scenariosDone', 'scenarioTotal'],
            ['storiesTold', 'storyTarget'],
            ['foundCount', 'maxResistance'],
            ['discovered', 'entityTotal']
        ];

        for (const [doneKey, totalKey] of countKeyPairs) {
            const doneValue = Number(state?.[doneKey]);
            if (!Number.isFinite(doneValue) || doneValue < 0) continue;
            const pairTotal = Number(state?.[totalKey]);
            const cap = Number.isFinite(pairTotal) && pairTotal > 0 ? pairTotal : totalUnits;
            if (cap > 0) return Math.max(0, Math.min(Math.floor(doneValue), Math.floor(cap)));
            return Math.max(0, Math.floor(doneValue));
        }

        if (totalUnits > 0) {
            const idx = getCurrentIndex(totalUnits);
            const remainingKeys = ['cards', 'components'];
            for (const key of remainingKeys) {
                const value = state?.[key];
                if (Array.isArray(value) && value.length <= totalUnits) {
                    return Math.max(idx, Math.max(0, totalUnits - value.length));
                }
            }
            return idx;
        }

        return getCurrentIndex(totalUnits);
    }

    function isRoundComplete() {
        const boolKeys = ['isComplete', 'gameOver', 'solved', 'isChecked', 'finished'];
        for (const key of boolKeys) {
            if (Boolean(state?.[key])) return true;
        }

        const overlayVisible = (el?.overlay && !el.overlay.classList.contains('hidden')) ||
            (el?.resultOverlay && !el.resultOverlay.classList.contains('hidden'));
        if (overlayVisible) return true;

        return false;
    }

    function computeProgressPercent() {
        const totalUnits = getTotalUnits();
        const baseCompleted = getBaseCompleted(totalUnits);
        const completionBonus = isRoundComplete() ? 1 : 0;

        if (totalUnits > 0) {
            const solvedUnits = Math.max(0, Math.min(totalUnits, baseCompleted + completionBonus));
            return Math.round((solvedUnits / totalUnits) * 100);
        }

        return isRoundComplete() ? 100 : 0;
    }

    function renderGameToText() {
        const totalUnits = getTotalUnits();
        const payload = {
            mode: isRoundComplete() ? 'result' : 'running',
            level_index: getCurrentIndex(totalUnits),
            level_total: totalUnits,
            progress_percent: computeProgressPercent(),
            level_complete: isRoundComplete(),
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
