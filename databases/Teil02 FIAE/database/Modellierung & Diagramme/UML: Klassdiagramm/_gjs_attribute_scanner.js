(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        targetIdx: 0,
        isComplete: false,
        selectedLine: -1
    };

    const el = {
        terminal: document.getElementById('terminal'),
        beam: document.getElementById('scan-beam'),
        cardContent: document.getElementById('card-content'),
        cardHeader: document.getElementById('card-header'),
        overlay: document.getElementById('overlay'),
        score: document.getElementById('score-val'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'stamp') {
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'scan') {
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_attribute_scanner.json');
            state.config = await resp.json();

            document.querySelectorAll('.stamp-btn').forEach(btn => {
                btn.addEventListener('click', () => handleStamp(btn.dataset.val));
            });

            el.btnNext.addEventListener('click', nextScenario);

            startScenario(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.targetIdx = 0;
        state.isComplete = false;
        state.selectedLine = -1;

        const s = state.config.scenarios[idx];
        el.cardHeader.textContent = s.title.split(':')[0] || 'CLASS_UNIT';
        el.terminal.innerHTML = '';
        el.cardContent.innerHTML = '';
        el.overlay.classList.add('hidden');
        el.score.textContent = 'PENDING';

        s.code.forEach((line, i) => {
            const div = document.createElement('div');
            div.className = 'code-line';
            div.textContent = line;
            div.dataset.index = i;
            div.onclick = () => selectLine(i, div);
            el.terminal.appendChild(div);
        });

        // Auto-select first target line if exists
        const firstTarget = s.targets[0];
        if (firstTarget) {
            const lineEl = el.terminal.children[firstTarget.line];
            selectLine(firstTarget.line, lineEl);
        }
    }

    function selectLine(idx, element) {
        if (state.isComplete) return;

        state.selectedLine = idx;
        document.querySelectorAll('.code-line').forEach(l => l.classList.remove('active'));
        element.classList.add('active');

        // Move scan beam
        const rect = element.getBoundingClientRect();
        const termRect = el.terminal.getBoundingClientRect();
        el.beam.style.opacity = '1';
        el.beam.style.top = `${rect.top - termRect.top + rect.height / 2}px`;

        playSound('scan');
    }

    function handleStamp(visibility) {
        if (state.isComplete || state.selectedLine === -1) return;

        const s = state.config.scenarios[state.scenarioIdx];
        const target = s.targets[state.targetIdx];

        if (state.selectedLine === target.line) {
            if (visibility === target.visibility) {
                stampSuccess(target);
            } else {
                stampFailure();
            }
        } else {
            alert("SCAN_ERROR: Targeted attribute mismatch.");
        }
    }

    function stampSuccess(target) {
        playSound('stamp');

        const line = document.createElement('div');
        line.className = 'card-line visible stamp-anim';
        line.textContent = target.uml;
        el.cardContent.appendChild(line);

        state.targetIdx++;
        const s = state.config.scenarios[state.scenarioIdx];

        if (state.targetIdx >= s.targets.length) {
            state.isComplete = true;
            el.score.textContent = 'VALIDATED';
            setTimeout(() => el.overlay.classList.remove('hidden'), 1000);
        } else {
            // Prepare next target
            const nextTarget = s.targets[state.targetIdx];
            const lineEl = el.terminal.children[nextTarget.line];
            selectLine(nextTarget.line, lineEl);
        }
    }

    function stampFailure() {
        el.terminal.classList.add('shake');
        setTimeout(() => el.terminal.classList.remove('shake'), 500);
        // Visual feedback for wrong choice
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
