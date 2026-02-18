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

    function computeProgressPercent() {
        const totalLevels = Array.isArray(state?.config?.levels) ? state.config.levels.length : 0;
        if (!totalLevels) return 0;

        const completedLevels = Math.max(0, Math.min(Number(state?.levelIdx) || 0, totalLevels));
        const overlayVisible = (el?.overlay && !el.overlay.classList.contains('hidden')) ||
            (el?.resultOverlay && !el.resultOverlay.classList.contains('hidden'));
        const levelFinished = Boolean(state?.isComplete) || overlayVisible;
        const solved = Math.min(totalLevels, completedLevels + (levelFinished ? 1 : 0));
        return Math.round((solved / totalLevels) * 100);
    }

    function renderGameToText() {
        const payload = {
            mode: 'running',
            level_index: Number(state?.levelIdx) || 0,
            level_total: Array.isArray(state?.config?.levels) ? state.config.levels.length : 0,
            progress_percent: computeProgressPercent(),
            level_complete: Boolean(state?.isComplete),
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
