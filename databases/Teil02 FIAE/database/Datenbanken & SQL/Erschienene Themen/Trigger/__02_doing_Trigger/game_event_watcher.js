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
            const resp = await fetch('game_event_watcher.json');
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

    init();
})();
