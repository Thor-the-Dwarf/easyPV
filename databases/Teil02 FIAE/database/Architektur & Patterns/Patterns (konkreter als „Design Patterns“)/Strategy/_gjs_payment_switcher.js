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
            const resp = await fetch('_data/_gg01_payment_switcher.json');
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
