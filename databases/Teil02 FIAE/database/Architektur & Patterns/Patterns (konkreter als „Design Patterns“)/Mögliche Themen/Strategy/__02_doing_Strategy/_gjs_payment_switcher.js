(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        currentContext: null,
        activeStrategyId: null,
        score: 0,
        speed: 0,
        isProcessing: false,
        gameOver: false,
        gameInterval: null
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudSpeed: document.getElementById('speed-val'),
        simulationWindow: document.getElementById('simulation-window'),
        gearShifter: document.getElementById('gear-shifter'),
        feedbackBar: document.getElementById('feedback-bar'),
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

        if (type === 'shift') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'success') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'error') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.3);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_gg01_payment_switcher.json');
            state.config = await resp.json();

            el.restartBtn.addEventListener('click', restartGame);
            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function restartGame() {
        state.levelIdx = 0;
        state.score = 0;
        state.speed = 0;
        state.gameOver = false;
        state.activeStrategyId = null;

        el.resultScreen.classList.add('hidden');
        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true);
            return;
        }
        state.levelIdx = idx;
        setupGearShifter();
        startGameLoop();
    }

    function setupGearShifter() {
        const level = state.config.levels[state.levelIdx];

        // Filter strategies relevant to this level's scenarios
        // Strategy type must match context type
        // But let's simplify: Show all available strategies? 
        // Or just filter by level types?
        // Let's filter by scenarios in the level -> get contexts -> get requiredStrategy IDs
        const relevantStrategies = new Set();
        level.scenarios.forEach(scenId => {
            const ctx = state.config.contexts.find(c => c.id === scenId);
            relevantStrategies.add(ctx.requiredStrategy);
            // And maybe some distractors if we want harder?
            // For now just the required ones + 1 distractor?
        });

        // Get strategy objects
        const strats = state.config.strategies.filter(s => relevantStrategies.has(s.id));

        el.gearShifter.innerHTML = '';
        strats.forEach(strat => {
            const btn = document.createElement('div');
            btn.className = 'gear-btn';
            btn.innerHTML = `${strat.icon}<span>${strat.label}</span>`;
            btn.dataset.id = strat.id;
            btn.style.borderColor = strat.color;

            btn.addEventListener('mousedown', () => shiftGear(strat.id, btn));
            el.gearShifter.appendChild(btn);
        });
    }

    function shiftGear(stratId, btnEl) {
        state.activeStrategyId = stratId;
        playTone('shift');

        // Visuals
        document.querySelectorAll('.gear-btn').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');

        // Check immediate validity? No, check on processing time
    }

    function startGameLoop() {
        if (state.gameInterval) clearInterval(state.gameInterval);

        const level = state.config.levels[state.levelIdx];
        let timeLeft = 30000; // 30s per level? Or based on contexts handled?
        // Let's go with number of contexts spawning

        spawnContextLoop(level);
    }

    function spawnContextLoop(level) {
        let scenarios = [...level.scenarios, ...level.scenarios]; // Double batch
        // Shuffle
        scenarios.sort(() => Math.random() - 0.5);

        let i = 0;
        const interval = setInterval(() => {
            if (state.gameOver || i >= scenarios.length) {
                clearInterval(interval);
                if (!state.gameOver) {
                    setTimeout(() => startLevel(state.levelIdx + 1), 2000);
                }
                return;
            }

            const ctxId = scenarios[i];
            const context = state.config.contexts.find(c => c.id === ctxId);
            spawnContextCard(context, level.speed);
            i++;
        }, level.speed);

        state.gameInterval = interval;
    }

    function spawnContextCard(context, speed) {
        const card = document.createElement('div');
        card.className = 'context-card';
        card.textContent = context.text;
        card.style.borderColor = state.config.strategies.find(s => s.id === context.requiredStrategy).color;

        el.simulationWindow.appendChild(card);

        // Animate In
        requestAnimationFrame(() => card.classList.add('active'));

        // Wait for player reaction time
        setTimeout(() => {
            evaluateStrategy(context, card);
        }, speed * 0.5); // Evaluation happens halfway through or end?
        // "Du musst das Getriebe umschalten, damit der richtige Algorithmus greift."
        // Let's say we evaluate when the card "passes through" the logic gate.
        // So visual animation moves it, then we check.
    }

    function evaluateStrategy(context, card) {
        if (state.gameOver) return;

        if (state.activeStrategyId === context.requiredStrategy) {
            // Success
            state.score += 1000;
            state.speed = Math.min(100, state.speed + 10);
            playTone('success');

            card.style.backgroundColor = 'rgba(0, 255, 0, 0.5)';
            card.textContent += " [OK]";
            el.feedbackBar.style.width = '100%';
            el.feedbackBar.style.backgroundColor = 'var(--neon-green)';

            setTimeout(() => card.remove(), 500);
        } else {
            // Fail
            state.score -= 500;
            state.speed = Math.max(0, state.speed - 20);
            playTone('error');

            card.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            card.textContent += " [MISMATCH]";
            el.feedbackBar.style.width = '100%';
            el.feedbackBar.style.backgroundColor = 'red';

            // Shake UI
            document.body.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(-10px)' },
                { transform: 'translateX(10px)' },
                { transform: 'translateX(0)' }
            ], { duration: 200 });

            const btn = document.querySelector(`.gear-btn[data-id="${state.activeStrategyId}"]`);
            if (btn) btn.classList.add('wrong');
            setTimeout(() => { if (btn) btn.classList.remove('wrong'); }, 500);

            setTimeout(() => card.remove(), 500);
        }

        updateHUD();
        setTimeout(() => el.feedbackBar.style.width = '0%', 200);

        if (state.score < -1000) endGame(false);
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudSpeed.textContent = state.speed + ' MIPS';
    }

    function endGame(win) {
        state.gameOver = true;
        clearInterval(state.gameInterval);
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "Perfect Logic!" : "System Crash!";
        el.resultScreen.classList.remove('hidden');
    }

    init();
})();
