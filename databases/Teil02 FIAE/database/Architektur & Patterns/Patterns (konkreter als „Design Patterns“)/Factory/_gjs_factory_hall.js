(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        currentOrder: null,
        score: 0,
        uptime: 100,
        isProducing: false,
        gameOver: false
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudUptime: document.getElementById('uptime-val'),
        orderDisplay: document.getElementById('order-display'),
        controlPanel: document.getElementById('control-panel'),
        machineGate: document.getElementById('machine-gate'),
        statusLight: document.getElementById('status-light'),
        shippingBay: document.getElementById('shipping-bay'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'start') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.5);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'error') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_factory_hall.json');
            state.config = await resp.json();

            setupControlPanel();
            el.restartBtn.addEventListener('click', restartGame);

            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function setupControlPanel() {
        el.controlPanel.innerHTML = '';
        state.config.factories.forEach(factory => {
            const btn = document.createElement('button');
            btn.className = 'factory-btn';
            btn.textContent = factory.label;
            btn.style.borderColor = factory.color;
            btn.addEventListener('click', () => triggerProduction(factory.id));
            el.controlPanel.appendChild(btn);
        });
    }

    function restartGame() {
        state.levelIdx = 0;
        state.score = 0;
        state.uptime = 100;
        state.gameOver = false;

        el.resultScreen.classList.add('hidden');
        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true);
            return;
        }

        state.levelIdx = idx;
        updateHUD();
        nextOrder();
    }

    function nextOrder() {
        const level = state.config.levels[state.levelIdx];
        const order = level.orders[Math.floor(Math.random() * level.orders.length)];
        state.currentOrder = order;

        el.orderDisplay.innerHTML = `
        <div>CLIENT REQUEST:</div>
        <div style="color:#fff">Target OS: ${order.os.toUpperCase()}</div>
        <div style="color:#fff">Component: ${order.product.toUpperCase()}</div>
      `;
    }

    async function triggerProduction(factoryId) {
        if (state.isProducing) return;
        state.isProducing = true;
        playTone('start');

        // Factory Animation
        el.statusLight.className = 'status-light working';
        el.machineGate.style.top = '0'; // Ensure closed

        await wait(500);

        // Logic Check
        // Does this factory support the requested OS?
        const factory = state.config.factories.find(f => f.id === factoryId);
        const isCompatible = factory.supported_families.includes(state.currentOrder.os);

        if (isCompatible) {
            produceSuccess(state.currentOrder.targetId);
        } else {
            produceError();
        }
    }

    async function produceSuccess(productId) {
        const product = state.config.products.find(p => p.id === productId);

        // Open Gate and Show Product
        el.machineGate.style.top = '-100%';
        el.statusLight.className = 'status-light active';
        playTone('success');

        // Create visual product
        const crate = document.createElement('div');
        crate.className = 'product-crate';
        crate.innerHTML = `
          <div class="product-icon">${product.icon}</div>
          <div class="product-label">${product.label}</div>
      `;
        // Position inside machine
        const machineRect = document.querySelector('.machine-inner').getBoundingClientRect();
        const bayRect = el.shippingBay.getBoundingClientRect();
        el.shippingBay.appendChild(crate);

        // Animate out
        await wait(100);
        crate.classList.add('shipped');

        state.score += 100;
        updateHUD();

        await wait(1500);
        crate.remove();
        el.machineGate.style.top = '0';
        state.isProducing = false;

        // Check level progress (simple endless for demo? or score based)
        if (state.score >= (state.levelIdx + 1) * 300) {
            startLevel(state.levelIdx + 1);
        } else {
            nextOrder();
        }
    }

    async function produceError() {
        el.statusLight.className = 'status-light error';
        playTone('error');
        state.uptime = Math.max(0, state.uptime - 20);
        updateHUD();

        // Shake
        el.machineGate.parentElement.animate([
            { transform: 'translate(0)' },
            { transform: 'translate(-5px)' },
            { transform: 'translate(5px)' },
            { transform: 'translate(0)' }
        ], { duration: 500 });

        await wait(1000);
        state.isProducing = false;
        el.statusLight.className = 'status-light';

        if (state.uptime <= 0) endGame(false);
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudUptime.textContent = state.uptime + '%';
    }

    function endGame(win) {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "Production Quota Met!" : "Factory Shutdown!";
        el.resultScreen.classList.remove('hidden');
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
