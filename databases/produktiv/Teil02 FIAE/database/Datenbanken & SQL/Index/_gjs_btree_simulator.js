(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        linearSteps: 0,
        indexSteps: 0,
        isRacing: false
    };

    const el = {
        title: document.getElementById('mission-title'),
        desc: document.getElementById('mission-desc'),
        valLinear: document.getElementById('val-linear'),
        valIndex: document.getElementById('val-index'),
        markerLinear: document.getElementById('marker-linear'),
        treeArea: document.getElementById('tree-area'),
        btnStart: document.getElementById('btn-start'),
        overlay: document.getElementById('overlay'),
        resLinear: document.getElementById('res-linear'),
        resIndex: document.getElementById('res-index'),
        factorBadge: document.getElementById('factor-badge'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(freq, duration = 0.1, type = 'sine') {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_btree_simulator.json');
            state.config = await resp.json();

            el.btnStart.onclick = startRace;
            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                startLevel(state.levelIdx + 1);
            };

            startLevel(0);
        } catch (e) { console.error(e); }
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            location.reload();
            return;
        }
        state.levelIdx = idx;
        state.linearSteps = 0;
        state.indexSteps = 0;
        state.isRacing = false;

        el.valLinear.textContent = '0';
        el.valIndex.textContent = '0';
        el.markerLinear.style.left = '0%';
        el.btnStart.disabled = false;

        const lv = state.config.levels[idx];
        el.title.textContent = `INDEX_OP // ${lv.title}`;
        el.desc.textContent = lv.description;

        renderTree(lv.tree);
    }

    function renderTree(tree) {
        el.treeArea.innerHTML = '';
        const w = el.treeArea.offsetWidth;
        drawNode(tree, w / 2, 40, w / 4);
    }

    function drawNode(node, x, y, offset) {
        if (!node) return;

        const div = document.createElement('div');
        div.className = 'node';
        if (node.values) div.classList.add('leaf');
        div.style.left = `${x - 35}px`;
        div.style.top = `${y}px`;
        div.textContent = node.value || (node.values ? node.values.join(',') : '?');

        if (node.value) div.dataset.val = node.value;
        else if (node.values) div.dataset.vals = node.values.join(',');

        el.treeArea.appendChild(div);

        if (node.left) drawNode(node.left, x - offset, y + 80, offset / 2);
        if (node.right) drawNode(node.right, x + offset, y + 80, offset / 2);
    }

    async function startRace() {
        if (state.isRacing) return;
        state.isRacing = true;
        el.btnStart.disabled = true;

        const lv = state.config.levels[state.levelIdx];

        // Start simulations
        const linearP = animateLinear(lv.targetId, lv.datasetSize);
        const indexP = animateIndex(lv.targetId, lv.tree);

        await Promise.all([linearP, indexP]);

        const factor = (state.linearSteps / state.indexSteps).toFixed(1);
        el.resLinear.textContent = state.linearSteps;
        el.resIndex.textContent = state.indexSteps;
        el.factorBadge.textContent = `${factor}x FASTER`;

        setTimeout(() => {
            playSound(880, 0.5, 'square');
            el.overlay.classList.remove('hidden');
        }, 1000);
    }

    async function animateLinear(targetId, size) {
        const speed = size > 500 ? 5 : 20;
        for (let i = 1; i <= targetId; i++) {
            state.linearSteps = i;
            el.valLinear.textContent = i;
            el.markerLinear.style.left = `${(i / size) * 100}%`;

            if (i % 20 === 0 || i === targetId) playSound(220, 0.05, 'sawtooth');
            await new Promise(r => setTimeout(r, speed));
        }
    }

    async function animateIndex(targetId, tree) {
        let curr = tree;
        while (curr) {
            state.indexSteps++;
            el.valIndex.textContent = state.indexSteps;

            const selector = curr.value ? `.node[data-val="${curr.value}"]` : `.node[data-vals*="${targetId}"]`;
            const nodeEl = el.treeArea.querySelector(selector);

            if (nodeEl) {
                nodeEl.classList.add('active');
                playSound(660, 0.2);
                await new Promise(r => setTimeout(r, 600));
            }

            if (curr.values && curr.values.includes(targetId)) break;
            if (curr.value === targetId) break;

            curr = (targetId < curr.value) ? curr.left : curr.right;
            if (!curr) break;
        }
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
