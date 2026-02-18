(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        pairIdx: 0,
        currentPair: null,
        selection: {},
        points: 0,
        roi: 0,
        isComplete: false
    };

    const el = {
        title: document.getElementById('level-title'),
        strandA: document.getElementById('record-a'),
        strandB: document.getElementById('record-b'),
        scorePct: document.getElementById('match-pct-val'),
        masterPreview: document.getElementById('master-preview-row'),
        btnMerge: document.getElementById('merge-btn'),
        btnKeep: document.getElementById('skip-btn'),
        roiVal: document.getElementById('roi-val'),
        pointsVal: document.getElementById('points-val'),
        overlay: document.getElementById('overlay'),
        resFinal: document.getElementById('res-final'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(freq, type = 'sine', duration = 0.2) {
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
            const resp = await fetch('_data/_gg01_duplicate_hunter.json');
            state.config = await resp.json();

            el.btnMerge.onclick = attemptFusion;
            el.btnKeep.onclick = skipPair;
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
        state.pairIdx = 0;

        const lv = state.config.levels[idx];
        el.title.textContent = `MDM_LAB // BATCH_${lv.title}`;

        loadPair();
    }

    function loadPair() {
        const lv = state.config.levels[state.levelIdx];
        if (state.pairIdx >= lv.pairs.length) {
            showResult("BATCH_ANALYSIS_COMPLETE");
            return;
        }

        state.currentPair = lv.pairs[state.pairIdx];
        state.selection = {};

        // Reset visuals
        el.strandA.classList.remove('record-merge-anim');
        el.strandB.classList.remove('record-merge-anim');

        renderStrands();
        updateMasterPreview();
        updateMatchScore();
    }

    function renderStrands() {
        const p = state.currentPair;
        renderStrand(el.strandA, p.recordA, 'A', p.conflicts);
        renderStrand(el.strandB, p.recordB, 'B', p.conflicts);
    }

    function renderStrand(container, record, side, conflicts) {
        container.innerHTML = `<div class="strand-header">DATA_SOURCE_${side} [REC_${record.id}]</div>`;
        const keys = Object.keys(record).filter(k => k !== 'id');

        keys.forEach(key => {
            const isConflict = conflicts.includes(key);
            const val = record[key];
            const div = document.createElement('div');
            div.className = `field-cell ${state.selection[key] === side ? 'selected' : ''}`;

            let statusClass = 'match';
            if (isConflict) statusClass = 'conflict';
            // fuzzy check?
            if (isConflict && isFuzzyMatch(key)) statusClass = 'fuzzy';

            div.innerHTML = `
            <div class="f-key">${key}</div>
            <div class="f-val ${statusClass}">${val === null ? 'NULL' : val}</div>
          `;

            div.onclick = () => selectField(key, side);
            container.appendChild(div);
        });
    }

    function isFuzzyMatch(key) {
        const a = String(state.currentPair.recordA[key]).toLowerCase();
        const b = String(state.currentPair.recordB[key]).toLowerCase();
        if (a === b) return false;
        return a.includes(b) || b.includes(a) || (a.length > 3 && b.startsWith(a.substring(0, 3)));
    }

    function selectField(key, side) {
        state.selection[key] = side;
        playSound(800, 'sine', 0.05);
        renderStrands();
        updateMasterPreview();
    }

    function updateMasterPreview() {
        el.masterPreview.innerHTML = '';
        const p = state.currentPair;
        const keys = Object.keys(p.recordA).filter(k => k !== 'id');

        keys.forEach(key => {
            const side = state.selection[key] || (p.conflicts.includes(key) ? null : 'A');
            const val = side ? (side === 'A' ? p.recordA[key] : p.recordB[key]) : '??';

            const div = document.createElement('div');
            div.className = 'prev-pill';
            div.innerHTML = `
            <div class="pill-label">${key}</div>
            <div class="pill-val">${val}</div>
          `;
            el.masterPreview.appendChild(div);
        });
    }

    function updateMatchScore() {
        const p = state.currentPair;
        const total = Object.keys(p.recordA).length - 1;
        const conflicts = p.conflicts.length;
        const score = Math.round(((total - conflicts) / total) * 100);
        el.scorePct.textContent = `${score}%`;
    }

    async function attemptFusion() {
        const p = state.currentPair;
        const unresolved = p.conflicts.filter(k => !state.selection[k]);

        if (unresolved.length > 0) {
            playSound(110, 'sawtooth');
            alert(`UNRESOLVED_CONFLICTS: ${unresolved.join(', ')}`);
            return;
        }

        // Validation against solution (if exists) or simple "correct choice" logic
        let correct = true;
        if (p.solution) {
            p.conflicts.forEach(k => {
                const val = state.selection[k] === 'A' ? p.recordA[k] : p.recordB[k];
                if (String(val) !== String(p.solution[k])) correct = false;
            });
        }

        if (correct) {
            playSound(440, 'triangle', 0.5);
            state.points += 100;
            state.roi += 15.50; // Arbitrary € saved
            updateHUD();

            el.strandA.classList.add('record-merge-anim');
            el.strandB.classList.add('record-merge-anim');

            setTimeout(() => {
                state.pairIdx++;
                loadPair();
            }, 600);
        } else {
            playSound(110, 'sawtooth', 0.5);
            alert("FUSION_ERROR: SUBOPTIMAL_FIELD_SELECTED");
            state.points -= 50;
            updateHUD();
        }
    }

    function skipPair() {
        playSound(220, 'sine');
        state.pairIdx++;
        loadPair();
    }

    function updateHUD() {
        el.pointsVal.textContent = state.points;
        el.roiVal.textContent = `€${state.roi.toFixed(2)}`;
    }

    function showResult(msg) {
        el.resFinal.textContent = msg;
        el.overlay.classList.remove('hidden');
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
