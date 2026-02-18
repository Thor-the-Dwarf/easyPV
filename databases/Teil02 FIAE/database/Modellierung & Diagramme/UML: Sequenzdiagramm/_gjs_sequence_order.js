(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        placedMessages: [], // {id, y}
        isComplete: false,
        draggedMsg: null
    };

    const el = {
        matrix: document.getElementById('matrix-bench'),
        svg: document.getElementById('svg-layer'),
        palette: document.getElementById('drag-palette'),
        latency: document.getElementById('latency-val'),
        overlay: document.getElementById('overlay'),
        btnNext: document.getElementById('btn-next'),
        instruction: document.getElementById('instruction')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'drop') {
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'error') {
            osc.frequency.setValueAtTime(100, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_sequence_order.json');
            state.config = await resp.json();

            el.btnNext.addEventListener('click', nextScenario);
            startScenario(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.placedMessages = [];
        state.isComplete = false;

        const s = state.config.scenarios[idx];
        el.instruction.textContent = s.instruction;
        el.overlay.classList.add('hidden');
        el.matrix.innerHTML = '';
        el.svg.innerHTML = '';
        el.palette.innerHTML = '';

        // Add Time Ruler
        const ruler = document.createElement('div');
        ruler.className = 'time-ruler';
        ruler.innerHTML = '<div style="transform:rotate(90deg); margin-top:20px;">TIME_FLOW_V</div>';
        el.matrix.appendChild(ruler);

        s.lifelines.forEach(renderLifeline);
        s.availableMessages.forEach(renderPaletteItem);

        updateLatency('STABLE');
    }

    function renderLifeline(ll) {
        const container = document.createElement('div');
        container.className = 'pylon-container';
        container.id = `ll-${ll.id}`;

        const head = document.createElement('div');
        head.className = 'pylon-head';
        head.textContent = ll.label;

        const line = document.createElement('div');
        line.className = 'lifeline';
        line.addEventListener('dragover', (e) => e.preventDefault());
        line.addEventListener('drop', (e) => handleDrop(e, ll.id));

        container.appendChild(head);
        container.appendChild(line);
        el.matrix.appendChild(container);
    }

    function renderPaletteItem(msg) {
        const div = document.createElement('div');
        div.className = 'palette-item';
        div.textContent = msg.label;
        div.draggable = true;
        div.addEventListener('dragstart', (e) => {
            state.draggedMsg = msg;
        });
        el.palette.appendChild(div);
    }

    function handleDrop(e, toLifelineId) {
        e.preventDefault();
        if (!state.draggedMsg) return;

        const s = state.config.scenarios[state.scenarioIdx];
        const msg = state.draggedMsg;
        const rect = e.currentTarget.getBoundingClientRect();
        const dropY = e.clientY - rect.top + 80; // Offset for header

        // Check if correct order
        const nextIdx = state.placedMessages.length;
        if (s.correctSequence[nextIdx] === msg.id) {
            placeMessage(msg, dropY);
        } else {
            triggerError();
        }
    }

    function placeMessage(msg, y) {
        playSound('drop');
        state.placedMessages.push({ id: msg.id, y });

        const fromLL = document.getElementById(`ll-${msg.from}`);
        const toLL = document.getElementById(`ll-${msg.to}`);

        const fromRect = fromLL.querySelector('.lifeline').getBoundingClientRect();
        const toRect = toLL.querySelector('.lifeline').getBoundingClientRect();

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.className.baseVal = `msg-arrow msg-${msg.type}`;
        line.setAttribute('x1', fromRect.left + fromRect.width / 2);
        line.setAttribute('y1', y);
        line.setAttribute('x2', toRect.left + toRect.width / 2);
        line.setAttribute('y2', y + (msg.type === 'sync' || msg.type === 'async' ? 10 : -10));
        el.svg.appendChild(line);

        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute('x', (fromRect.left + toRect.left) / 2);
        txt.setAttribute('y', y - 5);
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('fill', 'var(--neon-green)');
        txt.setAttribute('font-size', '10px');
        txt.textContent = msg.label;
        el.svg.appendChild(txt);

        // Activation bar for sync
        if (msg.type === 'sync' && msg.from !== msg.to) {
            const bar = document.createElement('div');
            bar.className = 'activation-bar';
            bar.style.top = `${y - 80}px`;
            bar.style.height = '40px';
            bar.style.display = 'block';
            toLL.querySelector('.lifeline').appendChild(bar);
        }

        checkWin();
    }

    function triggerError() {
        playSound('error');
        updateLatency('SEQUENCE_BROKEN!');
        el.matrix.classList.add('shake');
        setTimeout(() => {
            el.matrix.classList.remove('shake');
            startScenario(state.scenarioIdx);
        }, 1000);
    }

    function checkWin() {
        const s = state.config.scenarios[state.scenarioIdx];
        if (state.placedMessages.length === s.correctSequence.length) {
            state.isComplete = true;
            setTimeout(() => el.overlay.classList.remove('hidden'), 800);
        }
    }

    function updateLatency(text) {
        el.latency.textContent = text;
    }

    function nextScenario() {
        if (state.scenarioIdx < state.config.scenarios.length - 1) {
            startScenario(state.scenarioIdx + 1);
        } else {
            location.reload();
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
