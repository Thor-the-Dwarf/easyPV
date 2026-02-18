(function () {
    'use strict';

    const state = {
        config: null,
        points: 0,
        totalToSort: 0,
        sortedCount: 0,
        selectedStone: null
    };

    const el = {
        integrityScore: document.getElementById('integrity-score'),
        pillarGrid: document.getElementById('pillar-grid'),
        quarry: document.getElementById('quarry'),
        overlay: document.getElementById('result-overlay'),
        flash: document.getElementById('flash-effect'),
        btnRestart: document.getElementById('btn-restart')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'slam') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'error') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'surge') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.8);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.8);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_acid_sorter.json');
            state.config = await resp.json();
            state.totalToSort = state.config.definitions.length;

            initPillars();
            initQuarry();

            el.btnRestart.onclick = () => location.reload();

            // Tap-to-map fallback
            document.body.onclick = () => { if (state.selectedStone) deselectStone(); };
        } catch (e) { console.error(e); }
    }

    function initPillars() {
        el.pillarGrid.innerHTML = '';
        state.config.pillars.forEach(p => {
            const div = document.createElement('div');
            div.className = 'pillar';
            div.dataset.id = p.id;
            div.innerHTML = `
            <div class="pillar-header">
                <div class="pillar-icon">${p.icon}</div>
                <div class="pillar-name">${p.name}</div>
                <div style="font-size:0.55rem; color:var(--gold-primary); margin-top:5px;">"${p.slogan}"</div>
            </div>
            <div class="pillar-slots" id="slots-${p.id}"></div>
        `;

            div.onclick = (e) => {
                e.stopPropagation();
                if (state.selectedStone) handleDrop(div, state.selectedStone);
            };

            // Drag events
            div.ondragover = e => { e.preventDefault(); div.classList.add('highlight'); };
            div.ondragleave = () => div.classList.remove('highlight');
            div.ondrop = e => {
                e.preventDefault();
                div.classList.remove('highlight');
                const stoneId = e.dataTransfer.getData('text/plain');
                const stone = document.getElementById(stoneId);
                handleDrop(div, stone);
            };

            el.pillarGrid.appendChild(div);
        });
    }

    function initQuarry() {
        el.quarry.innerHTML = '';
        const shuffled = [...state.config.definitions].sort(() => Math.random() - 0.5);
        shuffled.forEach((def, i) => {
            const s = document.createElement('div');
            s.className = 'stone';
            s.id = `stone-${i}`;
            s.textContent = def.text;
            s.dataset.pillar = def.pillar;
            s.draggable = true;

            s.onclick = (e) => {
                e.stopPropagation();
                selectStone(s);
            };

            s.ondragstart = e => {
                e.dataTransfer.setData('text/plain', s.id);
                s.style.opacity = '0.5';
            };
            s.ondragend = () => s.style.opacity = '1';

            el.quarry.appendChild(s);
        });
    }

    function selectStone(s) {
        if (state.selectedStone) state.selectedStone.classList.remove('selected');
        state.selectedStone = s;
        s.classList.add('selected');
        s.style.borderColor = 'var(--gold-primary)';
    }

    function deselectStone() {
        if (state.selectedStone) {
            state.selectedStone.classList.remove('selected');
            state.selectedStone.style.borderColor = '';
        }
        state.selectedStone = null;
    }

    function handleDrop(pillar, stone) {
        if (stone.dataset.pillar === pillar.dataset.id) {
            playSound('slam');
            stone.classList.add('sorted');
            stone.draggable = false;
            stone.onclick = null;
            pillar.querySelector('.pillar-slots').appendChild(stone);

            state.sortedCount++;
            updateIntegrity();
            deselectStone();

            // Final completion check
            if (state.sortedCount === state.totalToSort) triggerStressTest();
        } else {
            playSound('error');
            pillar.classList.add('shake');
            setTimeout(() => pillar.classList.remove('shake'), 400);
        }
    }

    function updateIntegrity() {
        const p = Math.floor((state.sortedCount / state.totalToSort) * 100);
        el.integrityScore.textContent = `${p}%`;
    }

    function triggerStressTest() {
        setTimeout(() => {
            el.flash.classList.add('surge-anim');
            playSound('surge');

            setTimeout(() => {
                el.overlay.classList.remove('hidden');
            }, 1000);
        }, 500);
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
