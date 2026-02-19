(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        selectedTiming: "BEFORE", // Default
        isAnimating: false
    };

    const el = {
        scenarioTitle: document.getElementById('scenario-title'),
        scenarioDesc: document.getElementById('scenario-desc'),
        chain: document.getElementById('chain-container'),
        glidder: document.getElementById('glidder'),
        timingOptions: document.querySelectorAll('.timing-option'),
        btnTrigger: document.getElementById('btn-main-trigger'),
        overlay: document.getElementById('overlay'),
        resultText: document.getElementById('result-text'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'click') {
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'clack') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_event_watcher.json');
            state.config = await resp.json();

            el.timingOptions.forEach(opt => {
                opt.addEventListener('click', () => {
                    if (state.isAnimating) return;
                    state.selectedTiming = opt.dataset.val;
                    el.glidder.dataset.pos = state.selectedTiming;
                    el.timingOptions.forEach(o => o.classList.toggle('active', o === opt));
                    playSound('click');
                });
            });

            el.btnTrigger.addEventListener('click', startSequence);
            el.btnNext.addEventListener('click', nextScenario);

            startScenario(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.isAnimating = false;
        const s = state.config.scenarios[idx];

        el.scenarioTitle.textContent = s.title;
        el.scenarioDesc.textContent = s.description;
        el.btnTrigger.disabled = false;
        el.overlay.classList.add('hidden');

        renderChain(s.dominoes);
    }

    function renderChain(dominoes) {
        el.chain.innerHTML = '';
        dominoes.forEach(d => {
            const div = document.createElement('div');
            div.className = 'domino';
            div.dataset.type = d.type;
            div.innerHTML = `
        <div class="domino-label">${d.label}</div>
        <div class="domino-icon">${getIcon(d.type)}</div>
      `;
            el.chain.appendChild(div);
        });
    }

    function getIcon(type) {
        switch (type) {
            case 'source': return '⚡';
            case 'trigger': return '⚙️';
            case 'table': return '📊';
            case 'audit': return '📜';
            default: return '📦';
        }
    }

    async function startSequence() {
        if (state.isAnimating) return;
        state.isAnimating = true;
        el.btnTrigger.disabled = true;

        const s = state.config.scenarios[state.scenarioIdx];
        const isSuccess = (state.selectedTiming === s.timing);

        const dominoes = Array.from(el.chain.children);

        for (let i = 0; i < dominoes.length; i++) {
            const d = dominoes[i];

            // Logical check for sequence break
            if (!isSuccess) {
                // If it's the trigger that should have stayed up (wrong timing)
                if (d.dataset.type === 'trigger' && state.selectedTiming !== s.timing) {
                    // Visualize "The desync" or "wrong spot"
                    d.classList.add('blocked');
                    playSound('clack');
                    showResult(false);
                    return;
                }
            }

            // Standard fall
            d.classList.add('fallen');
            playSound('clack');
            await wait(600);
        }

        showResult(true);
    }

    function showResult(success) {
        const s = state.config.scenarios[state.scenarioIdx];
        el.resultText.textContent = success ? s.successMessage : s.failMessage;

        setTimeout(() => {
            el.overlay.classList.remove('hidden');
        }, 1000);
    }

    function nextScenario() {
        if (state.scenarioIdx < state.config.scenarios.length - 1) {
            startScenario(state.scenarioIdx + 1);
        } else {
            location.reload();
        }
    }

    function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

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
