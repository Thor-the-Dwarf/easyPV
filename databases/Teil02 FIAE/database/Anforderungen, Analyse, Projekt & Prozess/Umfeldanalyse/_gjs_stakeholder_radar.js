(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        score: 0,
        targetsFound: 0,
        activeBlips: [],
        gameOver: false,
        intervalId: null
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudTargets: document.getElementById('targets-val'),
        radarScope: document.getElementById('radar-scope'),
        sweepLine: document.getElementById('radar-sweep'),
        infoPanel: document.getElementById('info-panel'),
        targetLabel: document.getElementById('target-label'),
        btnInternal: document.getElementById('btn-internal'),
        btnExternal: document.getElementById('btn-external'),
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

        if (type === 'ping') {
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'lock') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_stakeholder_radar.json');
            state.config = await resp.json();

            el.restartBtn.addEventListener('click', restartGame);
            el.btnInternal.addEventListener('click', () => classifyTarget('internal'));
            el.btnExternal.addEventListener('click', () => classifyTarget('external'));

            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function restartGame() {
        state.levelIdx = 0;
        state.score = 0;
        state.targetsFound = 0;
        state.activeBlips = [];
        state.gameOver = false;

        el.resultScreen.classList.add('hidden');
        el.infoPanel.classList.add('hidden');

        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true);
            return;
        }

        state.levelIdx = idx;
        const level = state.config.levels[idx];

        // Set Radar Speed
        el.sweepLine.style.animationDuration = `${level.scan_speed}s`;

        updateHUD();

        // Spawn Loop
        if (state.intervalId) clearInterval(state.intervalId);
        state.intervalId = setInterval(spawnBlip, 2000);
    }

    function spawnBlip() {
        if (state.gameOver) return;

        const level = state.config.levels[state.levelIdx];
        if (state.targetsFound >= level.target_count) {
            // Level Complete
            clearInterval(state.intervalId);
            setTimeout(() => {
                alert("Level Complete! Increasing Speed.");
                startLevel(state.levelIdx + 1);
            }, 1000);
            return;
        }

        // Pick random target
        const target = state.config.targets[Math.floor(Math.random() * state.config.targets.length)];

        // Create Blip Element
        const blip = document.createElement('div');
        blip.className = 'blip';
        // Random position within circle
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * 40 + 10; // 10% to 50%
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);

        blip.style.left = x + '%';
        blip.style.top = y + '%';
        blip.textContent = '?'; // Hidden initially

        blip.dataset.id = target.id;

        blip.addEventListener('click', (e) => {
            e.stopPropagation(); // Avoid other clicks
            onBlipClick(blip, target);
        });

        el.radarScope.appendChild(blip);
        playTone('ping');

        // Auto remove after duration
        setTimeout(() => {
            if (blip.parentElement) blip.remove();
        }, level.blip_duration);
    }

    function onBlipClick(blipEl, target) {
        if (state.selectedBlip) return; // One at a time

        state.selectedBlip = { el: blipEl, data: target };
        playTone('lock');

        // Show Info
        el.targetLabel.innerHTML = `${target.icon} ${target.label}`;
        el.infoPanel.style.left = blipEl.style.left;
        el.infoPanel.style.top = blipEl.style.top;

        // Adjust if too close to edge
        // Simple clamp? 
        // Ideally center over blip

        el.infoPanel.classList.remove('hidden');
        blipEl.style.backgroundColor = 'yellow';
    }

    function classifyTarget(choice) {
        if (!state.selectedBlip) return;

        const target = state.selectedBlip.data;
        const isCorrect = target.category === choice;

        if (isCorrect) {
            state.score += 200;
            state.targetsFound++;
            playTone('lock');
            // Visual Feedback
            state.selectedBlip.el.style.backgroundColor = '#0f0';
            state.selectedBlip.el.textContent = '✓';
        } else {
            state.score = Math.max(0, state.score - 50);
            playTone('error');
            state.selectedBlip.el.style.backgroundColor = '#f00';
            state.selectedBlip.el.textContent = '✗';
        }

        el.infoPanel.classList.add('hidden');

        // Remove the blip after short delay
        const blipToRemove = state.selectedBlip.el;
        setTimeout(() => {
            if (blipToRemove.parentElement) blipToRemove.remove();
        }, 500);

        state.selectedBlip = null;
        updateHUD();
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        // el.hudTargets.textContent = state.targetsFound; // if we want to show progress
    }

    function endGame(win) {
        state.gameOver = true;
        clearInterval(state.intervalId);
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "Mission Accomplished" : "Signal Lost";
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
