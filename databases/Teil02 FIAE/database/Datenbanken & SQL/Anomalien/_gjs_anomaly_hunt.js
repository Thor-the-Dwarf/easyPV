(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        isComplete: false
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        tableContainer: document.querySelector('.table-container'),
        tableHead: document.getElementById('table-head'),
        tableBody: document.getElementById('table-body'),
        cardDesc: document.getElementById('card-desc'),
        btnExecute: document.getElementById('btn-execute'),
        btnReject: document.getElementById('btn-reject'),
        overlay: document.getElementById('overlay'),
        alertTitle: document.getElementById('alert-title'),
        alertDesc: document.getElementById('alert-desc'),
        btnNext: document.getElementById('btn-next'),
        statusVal: document.getElementById('status-val')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_anomaly_hunt.json');
            state.config = await resp.json();

            el.btnExecute.onclick = () => handleChoice(true);
            el.btnReject.onclick = () => handleChoice(false);
            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                el.tableContainer.classList.remove('shake');
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
        state.isComplete = false;

        const lv = state.config.levels[idx];
        el.levelTitle.textContent = `DIAGNOSTIC_MODE // ${lv.title}`;
        el.statusVal.textContent = 'SYSTEM_VULNERABLE';
        el.statusVal.style.color = 'var(--anomaly-orange)';

        renderTable(lv.table);

        const action = lv.action;
        let desc = '';
        if (action.type === 'INSERT') {
            desc = `REQUEST: <span style="color:var(--safe-cyan);">INSERT</span><br>Project: <b>${action.data.Project_Name}</b><br>Employee: <b style="color:var(--anomaly-orange)">NULL</b>`;
        } else if (action.type === 'UPDATE') {
            desc = `REQUEST: <span style="color:var(--safe-cyan);">UPDATE</span><br>TargetID: <b>${action.target_id}</b><br>NewValue: <b>${action.new_value}</b>`;
        } else if (action.type === 'DELETE') {
            desc = `REQUEST: <span style="color:var(--safe-cyan);">DELETE</span><br>ProjectRow: <b>${action.target_row + 1}</b>`;
        }
        el.cardDesc.innerHTML = desc;
    }

    function renderTable(tableData) {
        el.tableHead.innerHTML = '';
        el.tableBody.innerHTML = '';

        const hTr = document.createElement('tr');
        tableData.headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            hTr.appendChild(th);
        });
        el.tableHead.appendChild(hTr);

        tableData.data.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell === null ? 'NULL' : cell;
                tr.appendChild(td);
            });
            el.tableBody.appendChild(tr);
        });
    }

    function handleChoice(isExecute) {
        if (state.isComplete) return;
        const lv = state.config.levels[state.levelIdx];

        if (isExecute) {
            // This game implies all scenarios are anomalies
            playSound('error');
            el.tableContainer.classList.add('shake');

            // Final "Heatmap" highlight for problematic columns
            highlightAnomalies(lv);

            showOverlay(lv.action.error, lv.action.explanation, true);
        } else {
            playSound('success');
            showOverlay("ANOMALY_AVERTED", `Structural flaw detected: ${lv.title}. Integrity preserved.`, false);
        }
        state.isComplete = true;
    }

    function highlightAnomalies(lv) {
        const cells = el.tableBody.querySelectorAll('td');
        cells.forEach(td => {
            if (lv.title.includes('Insertion') && td.textContent === 'NULL') {
                td.classList.add('anomaly-glow');
            }
            if (lv.title.includes('Update') && td.textContent === 'Müller') {
                td.classList.add('anomaly-glow');
            }
            if (lv.title.includes('Deletion') && td.textContent === 'Schulze') {
                td.classList.add('anomaly-glow');
            }
        });
    }

    function showOverlay(title, desc, isAnomaly) {
        el.alertTitle.textContent = title;
        el.alertDesc.innerHTML = desc;
        el.overlay.querySelector('.alert-card').className = isAnomaly ? 'alert-card anomaly' : 'alert-card';

        setTimeout(() => {
            el.overlay.classList.remove('hidden');
        }, 600);
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
