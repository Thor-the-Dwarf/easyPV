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

            if (Array.isArray(state?.cards) && state.cards.length <= totalUnits) {
                const inHand = state?.currentCard ? 1 : 0;
                const processed = totalUnits - state.cards.length - inHand;
                if (processed >= 0) {
                    return Math.max(idx, Math.min(totalUnits, processed));
                }
            }

            if (Array.isArray(state?.components) && state.components.length <= totalUnits) {
                const inHand = state?.currentComponent ? 1 : 0;
                const processed = totalUnits - state.components.length - inHand;
                if (processed >= 0) {
                    return Math.max(idx, Math.min(totalUnits, processed));
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
        if (typeof state?.__simulated_ms === 'number') payload.simulated_ms = state.__simulated_ms;
        if (el?.statusVal?.textContent) payload.status = el.statusVal.textContent.trim();

        return JSON.stringify(payload);
    }

    window.render_game_to_text = renderGameToText;
    window.advanceTime = function advanceTime(ms) {
        const deltaMs = Math.max(0, Number(ms) || 0);
        state.__simulated_ms = (state.__simulated_ms || 0) + deltaMs;

        if (deltaMs >= 1000 && typeof gameTick === 'function') {
            const ticks = Math.floor(deltaMs / 1000);
            for (let i = 0; i < ticks; i++) gameTick();
        }

        return state.__simulated_ms;
    };

    init();
})();
