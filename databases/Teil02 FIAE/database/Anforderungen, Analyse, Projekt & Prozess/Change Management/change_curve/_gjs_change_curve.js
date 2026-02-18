(function () {
    'use strict';

    const state = {
        config: null,
        currentPhaseIdx: 0,
        currentScenario: null,
        score: 0,
        health: 100,
        weather: 'calm',
        gameOver: false,
        scenariosDone: []
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudPhase: document.getElementById('phase-val'),
        hudHealth: document.getElementById('health-fill'),
        oceanTrack: document.getElementById('ocean-track'),
        boat: document.getElementById('boat'),
        quoteCard: document.getElementById('quote-card'),
        quoteText: document.getElementById('quote-text'),
        quoteSource: document.getElementById('quote-source'),
        toolDeck: document.getElementById('tool-deck'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn'),
        fxLayer: document.getElementById('fx-layer') // dynamic
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'good') {
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'bad') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'move') {
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(200, now + 1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 1);
            osc.start();
            osc.stop(now + 1);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_change_curve.json');
            state.config = await resp.json();

            setupOcean();
            setupTools();
            el.restartBtn.addEventListener('click', restartGame);

            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function setupOcean() {
        el.oceanTrack.innerHTML = '';
        state.config.phases.forEach((p, i) => {
            const island = document.createElement('div');
            island.className = 'phase-island';
            island.style.setProperty('--phase-color', getPhaseColor(i));
            island.innerHTML = `
            <div class="island-marker">${p.icon}</div>
            <div class="island-label">${p.label}</div>
            <div style="font-size:0.8rem; opacity:0.7">${p.description}</div>
        `;
            el.oceanTrack.appendChild(island);
        });
    }

    function getPhaseColor(idx) {
        const colors = ['#ef5350', '#ffa726', '#ffca28', '#7e57c2', '#29b6f6', '#66bb6a', '#00e676'];
        return colors[idx] || '#fff';
    }

    function setupTools() {
        el.toolDeck.innerHTML = state.config.tools.map(t => `
        <div class="tool-card" data-id="${t.id}">
            <div class="tool-icon">${t.icon}</div>
            <div class="tool-label">${t.label}</div>
        </div>
      `).join('');

        el.toolDeck.querySelectorAll('.tool-card').forEach(card => {
            card.addEventListener('click', () => onToolUse(card.dataset.id));
        });
    }

    function restartGame() {
        state.currentPhaseIdx = 0;
        state.score = 0;
        state.health = 100;
        state.gameOver = false;
        state.scenariosDone = [];

        el.resultScreen.classList.add('hidden');
        updateHUD();
        updateView();
        spawnScenario();
    }

    function updateView() {
        // Scroll Ocean
        const percent = -(state.currentPhaseIdx * (100 / 7));
        // Wait, oceanTrack width is 700%. 
        // To show phase 0: translateX(0).
        // To show phase 1: translateX(-14.28%).
        el.oceanTrack.style.transform = `translateX(${percent}%)`;

        const phase = state.config.phases[state.currentPhaseIdx];
        el.hudPhase.textContent = phase.label;
    }

    function spawnScenario() {
        if (state.gameOver) return;

        const phase = state.config.phases[state.currentPhaseIdx];
        // Find scenario for this phase
        const candidates = state.config.scenarios.filter(s => s.phase_id === phase.id);
        // Pick random not done
        // For prototype, pick first found.
        const scenario = candidates[0];

        if (!scenario) {
            // No scenario for this phase? Auto advance or win?
            if (state.currentPhaseIdx >= 6) {
                endGame(true);
            } else {
                advancePhase();
            }
            return;
        }

        state.currentScenario = scenario;

        // Show Quote
        el.quoteText.textContent = `"${scenario.text}"`;
        el.quoteSource.textContent = "Team Member"; // or specific role
        el.quoteCard.classList.remove('hidden');
        el.toolDeck.classList.remove('hidden');
    }

    function onToolUse(toolId) {
        if (state.gameOver || !state.currentScenario) return;

        const correct = state.currentScenario.correct_tool;

        // Feedback
        // We could show a toast or change weather

        if (toolId === correct) {
            // Success
            state.score += 500;
            state.health = Math.min(100, state.health + 10);
            playTone('good');
            showFx('sun');
            alert(`Correct! ${state.currentScenario.feedback_ok}`); // Replace with nicer UI later
            advancePhase();
        } else {
            // Fail
            state.health -= 20;
            state.score = Math.max(0, state.score - 100);
            playTone('bad');
            showFx('storm');
            alert(`Careful! ${state.currentScenario.feedback_fail}`);

            if (state.health <= 0) endGame(false);
        }

        updateHUD();
    }

    function advancePhase() {
        el.quoteCard.classList.add('hidden');
        el.toolDeck.classList.add('hidden');

        if (state.currentPhaseIdx < 6) {
            playTone('move');
            state.currentPhaseIdx++;
            updateView();

            setTimeout(() => {
                spawnScenario();
            }, 1500); // Travel time
        } else {
            endGame(true);
        }
    }

    function showFx(type) {
        // Logic to toggle CSS classes on an FX layer
        // For now simple log
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudHealth.style.width = state.health + '%';
        el.hudHealth.style.background = state.health > 50 ? '#00e676' : '#ef5350';
    }

    function endGame(win) {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "Transformation Complete!" : "Capsized!";
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
