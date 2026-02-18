(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        currentStateId: null,
        retries: 0,
        isComplete: false,
        history: []
    };

    const el = {
        prism: document.getElementById('state-prism'),
        label: document.getElementById('state-label'),
        board: document.getElementById('trigger-board'),
        stability: document.getElementById('stability-val'),
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

        if (type === 'warp') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'buzz') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(100, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_state_machine.json');
            state.config = await resp.json();

            el.btnNext.addEventListener('click', nextScenario);
            startScenario(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.retries = 0;
        state.isComplete = false;
        state.history = [];

        const s = state.config.scenarios[idx];
        state.currentStateId = s.startState;

        el.instruction.textContent = s.instruction;
        el.overlay.classList.add('hidden');
        el.stability.textContent = 'STABLE';
        el.stability.style.color = 'var(--hologram-cyan)';

        updateDisplay();
        renderButtons();
    }

    function renderButtons() {
        el.board.innerHTML = '';
        const s = state.config.scenarios[state.scenarioIdx];

        // Get all unique events defined for this scenario
        const events = [...new Set(s.transitions.map(t => t.event))];

        events.forEach(eventName => {
            const btn = document.createElement('button');
            btn.className = 'event-btn';
            btn.textContent = eventName;
            btn.onclick = () => triggerEvent(eventName);

            // Add guard preview if applicable for current state
            const trans = s.transitions.find(t => t.from === state.currentStateId && t.event === eventName);
            if (trans && trans.guard) {
                const tip = document.createElement('div');
                tip.className = 'guard-tooltip';
                tip.textContent = `GUARD: ${trans.guard}`;
                btn.appendChild(tip);
            }

            el.board.appendChild(btn);
        });
    }

    function triggerEvent(eventName) {
        if (state.isComplete) return;

        const s = state.config.scenarios[state.scenarioIdx];
        const trans = s.transitions.find(t => t.from === state.currentStateId && t.event === eventName);

        if (trans) {
            // Evaluate Guard
            let guardPassed = true;
            if (trans.guard) {
                if (trans.guard.includes('retries < 3') && state.retries >= 3) guardPassed = false;
                if (trans.guard.includes('retries >= 3') && state.retries < 3) guardPassed = false;
            }

            if (guardPassed) {
                transitionTo(trans.to);
            } else {
                buzz();
            }
        } else {
            // Logical Error: Event not allowed in this state
            buzz();
        }

        // Tracker for retries if we are in a fail state
        if (eventName === 'SUBMIT_WRONG') {
            state.retries++;
        }
    }

    function transitionTo(nextStateId) {
        playSound('warp');
        state.currentStateId = nextStateId;
        state.history.push(nextStateId);

        el.prism.classList.add('warp-anim');
        setTimeout(() => {
            el.prism.classList.remove('warp-anim');
            updateDisplay();
            renderButtons(); // Re-render to update guards
            checkWin();
        }, 500);
    }

    function buzz() {
        playSound('buzz');
        document.body.classList.add('buzz-flash');
        el.stability.textContent = 'INVALID_TRIGGER';
        el.stability.style.color = 'var(--error-red)';

        setTimeout(() => {
            document.body.classList.remove('buzz-flash');
            el.stability.textContent = 'STABLE';
            el.stability.style.color = 'var(--hologram-cyan)';
        }, 300);
    }

    function updateDisplay() {
        const s = state.config.scenarios[state.scenarioIdx];
        const st = s.states.find(x => x.id === state.currentStateId);

        el.label.textContent = st.label;
        el.prism.style.borderColor = st.color;
        el.prism.style.boxShadow = `0 0 40px ${st.color}`;
        el.label.style.color = st.color;
        el.label.style.textShadow = `0 0 15px ${st.color}`;
    }

    function checkWin() {
        const s = state.config.scenarios[state.scenarioIdx];

        let won = false;
        if (s.winState && state.currentStateId === s.winState) {
            won = true;
        } else if (s.winCondition) {
            if (s.winCondition.type === 'sequence') {
                if (state.history.includes('DONE')) won = true;
            }
        }

        if (won) {
            state.isComplete = true;
            el.stability.textContent = 'PROTOCOL_COMPLETE';
            setTimeout(() => el.overlay.classList.remove('hidden'), 1000);
        }
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
