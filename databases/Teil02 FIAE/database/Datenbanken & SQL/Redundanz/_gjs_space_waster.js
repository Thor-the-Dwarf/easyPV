(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        selectedCol: null,
        isSlimmed: false
    };

    const el = {
        meterFill: document.getElementById('meter-fill'),
        sizeValue: document.getElementById('size-value'),
        tableHeader: document.getElementById('table-header'),
        tableBody: document.getElementById('table-body'),
        btnCut: document.getElementById('btn-cut'),
        overlay: document.getElementById('overlay'),
        resultText: document.getElementById('result-text'),
        btnNext: document.getElementById('btn-next'),
        tablePanel: document.getElementById('table-panel')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'click') {
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'cut') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_space_waster.json');
            state.config = await resp.json();

            el.btnCut.addEventListener('click', performCut);
            el.btnNext.addEventListener('click', nextScenario);

            startScenario(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.isSlimmed = false;
        state.selectedCol = null;
        const s = state.config.scenarios[idx];

        el.tablePanel.classList.remove('slimmed');
        el.overlay.classList.add('hidden');
        el.btnCut.classList.remove('active');

        renderTable(s);
        updateSizeMeter(100);
    }

    function renderTable(scenario) {
        el.tableHeader.innerHTML = '';
        el.tableBody.innerHTML = '';

        scenario.headers.forEach((h, i) => {
            const th = document.createElement('th');
            th.textContent = h;
            if (h === scenario.redundantColumn) {
                th.classList.add('column-highlight');
                th.addEventListener('click', () => selectColumn(h));
            }
            el.tableHeader.appendChild(th);
        });

        scenario.data.forEach(row => {
            const tr = document.createElement('tr');
            scenario.headers.forEach(h => {
                const td = document.createElement('td');
                td.textContent = row[h];
                if (h === scenario.redundantColumn) {
                    td.classList.add('column-highlight');
                }
                tr.appendChild(td);
            });
            el.tableBody.appendChild(tr);
        });
    }

    function selectColumn(name) {
        if (state.isSlimmed) return;
        playSound('click');
        state.selectedCol = name;

        document.querySelectorAll('.column-highlight').forEach(el => el.classList.add('selected'));
        el.btnCut.classList.add('active');
    }

    function updateSizeMeter(percent) {
        el.meterFill.style.width = `${percent}%`;
        el.sizeValue.textContent = `TABLE_WEIGHT: ${percent}%`;
        el.sizeValue.style.color = percent > 60 ? '#e74c3c' : '#2ecc71';
    }

    function performCut() {
        if (!state.selectedCol || state.isSlimmed) return;
        state.isSlimmed = true;
        playSound('cut');

        el.tablePanel.classList.add('slimmed');

        // Simulate space saving calculation
        const s = state.config.scenarios[state.scenarioIdx];
        const originalSize = calculateSize(s.data, s.headers);

        // Transform table visually
        setTimeout(() => {
            const uniqueValues = [...new Set(s.data.map(r => r[s.redundantColumn]))];
            const masterSize = uniqueValues.join('').length * s.bytePerChar;
            const mainSizeSlim = s.data.length * (originalSize / s.data.length - s.headers.find(h => h === s.redundantColumn).length + s.idByteSize);
            const totalSlim = mainSizeSlim + masterSize;
            const ratio = Math.round((totalSlim / originalSize) * 100);

            updateSizeMeter(ratio);
            renderSlimTable(s);

            setTimeout(() => {
                el.resultText.textContent = s.successMessage + ` Final weight reduced to ${ratio}%.`;
                el.overlay.classList.remove('hidden');
            }, 1200);
        }, 800);
    }

    function calculateSize(data, headers) {
        let size = 0;
        data.forEach(row => {
            headers.forEach(h => {
                size += (row[h].toString().length);
            });
        });
        return size;
    }

    function renderSlimTable(scenario) {
        const rows = el.tableBody.querySelectorAll('tr');
        const colIdx = scenario.headers.indexOf(scenario.redundantColumn);

        const uniqueMap = new Map();
        let idCounter = 1;

        rows.forEach((tr, i) => {
            const td = tr.children[colIdx];
            const val = td.textContent;
            if (!uniqueMap.has(val)) uniqueMap.set(val, idCounter++);

            td.textContent = `FK_${uniqueMap.get(val)}`;
            td.style.fontFamily = 'monospace';
            td.style.color = '#4a90e2';
        });
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
        if (el?.statusVal?.textContent) payload.status = el.statusVal.textContent.trim();

        return JSON.stringify(payload);
    }

    window.render_game_to_text = renderGameToText;
    window.advanceTime = function advanceTime(ms) {
        return ms;
    };

    init();
})();
