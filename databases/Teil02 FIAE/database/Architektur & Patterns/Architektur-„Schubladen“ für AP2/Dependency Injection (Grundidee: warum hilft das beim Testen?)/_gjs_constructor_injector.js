(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        filledSlots: {}, // { slotName: dependencyId }
        isSurgeryActive: true,
        startTime: 0,
        gameOver: false
    };

    const el = {
        timer: document.getElementById('timer-val'),
        stability: document.getElementById('stability-val'),
        patientSchema: document.getElementById('patient-schema'),
        slotsContainer: document.getElementById('injection-slots'),
        className: document.getElementById('class-name'),
        tray: document.getElementById('instrument-tray'),
        resultScreen: document.getElementById('result-screen'),
        finalResult: document.getElementById('final-result'),
        restartBtn: document.getElementById('restart-btn'),
        messageOverlay: document.getElementById('message-overlay')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'snap') {
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);
            osc.start();
            osc.stop(now + 0.05);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_constructor_injector.json');
            state.config = await resp.json();

            el.restartBtn.addEventListener('click', restartGame);
            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function restartGame() {
        state.levelIdx = 0;
        state.gameOver = false;
        el.resultScreen.classList.add('hidden');
        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true, "All Surgeries Successful!");
            return;
        }
        state.levelIdx = idx;
        state.filledSlots = {};
        state.isSurgeryActive = true;
        state.startTime = Date.now();

        const level = state.config.levels[idx];
        showOverlay(level.title + ": " + level.description);

        el.className.textContent = `class ${level.patient}`;
        renderSlots(level);
        renderTray(level);
        updateStatus();
    }

    function renderSlots(level) {
        el.slotsContainer.innerHTML = '';
        level.slots.forEach(slot => {
            const div = document.createElement('div');
            div.className = 'slot';
            div.dataset.name = slot.name;
            div.dataset.type = slot.type;

            div.innerHTML = `
            <div class="slot-label">${slot.name}:</div>
            <div class="slot-type">${slot.type}</div>
          `;

            // Drop Events
            div.addEventListener('dragover', e => {
                e.preventDefault();
                div.classList.add('hover');
            });
            div.addEventListener('dragleave', () => div.classList.remove('hover'));
            div.addEventListener('drop', e => handleDrop(e, div));

            el.slotsContainer.appendChild(div);
        });
    }

    function renderTray(level) {
        el.tray.innerHTML = '';
        // Show all dependencies? Or filter?
        // Let's show all for challenge
        state.config.dependencies.forEach(dep => {
            const item = document.createElement('div');
            item.className = `instrument ${dep.type}`; // real vs mock
            item.draggable = true;
            item.dataset.id = dep.id;

            item.innerHTML = `
            <div class="inst-icon">${dep.icon}</div>
            <div class="inst-label">${dep.label}</div>
          `;

            item.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', dep.id);
                item.style.opacity = '0.5';
            });
            item.addEventListener('dragend', () => item.style.opacity = '1');

            el.tray.appendChild(item);
        });
    }

    function handleDrop(e, slotEl) {
        e.preventDefault();
        slotEl.classList.remove('hover');
        if (!state.isSurgeryActive) return;

        const depId = e.dataTransfer.getData('text/plain');
        const dep = state.config.dependencies.find(d => d.id === depId);
        const requiredType = slotEl.dataset.type;

        if (dep.interface === requiredType) {
            // Interface Match!
            state.filledSlots[slotEl.dataset.name] = depId;

            slotEl.classList.add('filled');
            slotEl.innerHTML = `
            <div class="slot-label">Injected:</div>
            <div style="flex:1">${dep.icon} ${dep.label} <span style="opacity:0.5">(${dep.type})</span></div>
          `;
            playTone('snap');
            checkLevelCompletion();
        } else {
            // Interface Mismatch
            playTone('error');
            showOverlay("Type Mismatch! Organ rejection!");
            slotEl.style.borderColor = 'red';
            setTimeout(() => slotEl.style.borderColor = '', 500);
        }
    }

    function checkLevelCompletion() {
        const level = state.config.levels[state.levelIdx];
        const allFilled = level.slots.every(s => state.filledSlots[s.name]);

        if (allFilled) {
            validateSurgery(level);
        }
    }

    function validateSurgery(level) {
        state.isSurgeryActive = false;
        const reqMode = level.requirements.mode; // 'production' or 'test'

        let success = true;
        let failureReason = "";

        for (const slotName in state.filledSlots) {
            const depId = state.filledSlots[slotName];
            const dep = state.config.dependencies.find(d => d.id === depId);

            if (reqMode === 'test' && dep.type === 'real') {
                success = false;
                failureReason = "Failed! Used Real Service in Unit Test (Side Effects!)";
                break;
            }
            if (reqMode === 'production' && dep.type === 'mock') {
                success = false;
                failureReason = "Failed! Deployed Mock to Production (No functionality!)";
                break;
            }
        }

        if (success) {
            playTone('success');
            showOverlay("SURGERY SUCCESSFUL");
            setTimeout(() => startLevel(state.levelIdx + 1), 2000);
        } else {
            playTone('error');
            endGame(false, failureReason);
        }
    }

    function showOverlay(msg) {
        el.messageOverlay.textContent = msg;
        el.messageOverlay.style.display = 'block';
        el.messageOverlay.style.animation = 'none';
        el.messageOverlay.offsetHeight; /* trigger reflow */
        el.messageOverlay.style.animation = 'slideIn 0.3s forwards';
        setTimeout(() => el.messageOverlay.style.display = 'none', 3000);
    }

    function updateStatus() {
        if (state.isSurgeryActive) {
            requestAnimationFrame(updateStatus);
            const elapsed = (Date.now() - state.startTime) / 1000;
            el.timer.textContent = elapsed.toFixed(1) + "s";
        }
    }

    function endGame(win, msg) {
        state.gameOver = true;
        el.finalResult.textContent = msg || (win ? "You are a DI Master!" : "Patient Lost.");
        el.resultScreen.querySelector('h2').textContent = win ? "CERTIFIED" : "MALPRACTICE";
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
