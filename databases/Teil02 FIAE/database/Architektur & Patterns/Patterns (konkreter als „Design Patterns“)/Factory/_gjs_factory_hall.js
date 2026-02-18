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
