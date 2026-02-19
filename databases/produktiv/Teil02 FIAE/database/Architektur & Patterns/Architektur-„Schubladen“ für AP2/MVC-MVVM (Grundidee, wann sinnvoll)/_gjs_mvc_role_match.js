(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        score: 0,
        harmony: 100,
        isConducting: false,
        gameInterval: null,
        gameOver: false,
        activeTasks: []
    };

    const el = {
        harmonyVal: document.getElementById('harmony-val'),
        bpmVal: document.getElementById('bpm-val'),
        notesStream: document.getElementById('notes-stream'),
        rolesContainer: document.getElementById('orchestra-pit'),
        resultScreen: document.getElementById('result-screen'),
        finalResult: document.getElementById('final-result'),
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

        if (type === 'success') {
            // Major Chord Arpeggio
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now); // A4
            osc.frequency.setValueAtTime(554.37, now + 0.1); // C#5
            osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'error') {
            // Dissonant Cluster
            const osc2 = audioCtx.createOscillator();
            osc2.connect(gain);
            osc.type = 'sawtooth';
            osc2.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc2.frequency.setValueAtTime(105, now); // Dissonance
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start();
            osc2.start();
            osc.stop(now + 0.5);
            osc2.stop(now + 0.5);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_mvc_role_match.json');
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
        state.harmony = 100;
        state.gameOver = false;

        el.resultScreen.classList.add('hidden');
        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true, "Standing Ovation!");
            return;
        }
        state.levelIdx = idx;

        const level = state.config.levels[idx];
        el.bpmVal.textContent = Math.round(60000 / level.speed) + " BPM";

        setupZones();
        startConducting();
    }

    function setupZones() {
        el.rolesContainer.innerHTML = '';
        state.config.roles.forEach(role => {
            const zone = document.createElement('div');
            zone.className = `role-zone zone-${role.id}`;
            zone.dataset.role = role.id;

            zone.innerHTML = `
            <div class="role-desc">${role.description}</div>
            <div class="role-label">${role.label}</div>
          `;

            // Drop Logic
            zone.addEventListener('dragover', e => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', e => handleDrop(e, role.id));

            el.rolesContainer.appendChild(zone);
        });
    }

    function startConducting() {
        if (state.gameInterval) clearInterval(state.gameInterval);
        el.notesStream.innerHTML = ''; // Clear old notes

        const level = state.config.levels[state.levelIdx];
        let taskQueue = [...level.tasks];
        // Shuffle tasks?
        taskQueue.sort(() => Math.random() - 0.5);

        state.isConducting = true;
        let taskIndex = 0;

        state.gameInterval = setInterval(() => {
            if (state.gameOver) return;

            if (taskIndex >= taskQueue.length) {
                clearInterval(state.gameInterval);
                // Wait for all active notes to be cleared?
                setTimeout(() => {
                    if (!state.gameOver) startLevel(state.levelIdx + 1);
                }, 3000);
                return;
            }

            spawnTask(taskQueue[taskIndex]);
            taskIndex++;

        }, level.speed);
    }

    function spawnTask(taskDef) {
        const note = document.createElement('div');
        note.className = 'task-note';
        note.textContent = taskDef.text;
        note.draggable = true;
        note.dataset.role = taskDef.role;

        // Random position scatter slightly
        const rot = (Math.random() - 0.5) * 10;
        note.style.transform = `rotate(${rot}deg)`;

        note.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', JSON.stringify(taskDef));
            note.style.opacity = '0.5';
            state.currentDragNode = note; // hack for removal
        });
        note.addEventListener('dragend', () => {
            note.style.opacity = '1';
            state.currentDragNode = null;
        });

        el.notesStream.appendChild(note);

        // Auto-fail timer? "Task Stream" moves?
        // For now, let them pile up, but maybe max pile size?
        if (el.notesStream.children.length > 5) {
            // Stress! Harmony drops
            state.harmony -= 5;
            updateHUD();
            if (state.harmony <= 0) endGame(false, "Cacophony! Too many open tasks.");
        }
    }

    function handleDrop(e, targetRole) {
        e.preventDefault();
        document.querySelectorAll('.role-zone').forEach(z => z.classList.remove('drag-over'));

        const data = e.dataTransfer.getData('text/plain');
        if (!data) return;
        const task = JSON.parse(data);

        if (task.role === targetRole) {
            // Correct
            playTone('success');
            state.score += 100;
            state.harmony = Math.min(100, state.harmony + 5);

            // Visuals
            createSparkles(e.clientX, e.clientY);

        } else {
            // Wrong
            playTone('error');
            state.harmony -= 15;
            document.body.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(-5px)' },
                { transform: 'translateX(5px)' },
                { transform: 'translateX(0)' }
            ], { duration: 200 });
        }

        // Remove note
        if (state.currentDragNode) state.currentDragNode.remove();

        updateHUD();
        if (state.harmony <= 0) endGame(false, "Architecture Collapse!");
    }

    function createSparkles(x, y) {
        for (let i = 0; i < 5; i++) {
            const s = document.createElement('div');
            s.style.position = 'fixed';
            s.style.left = x + 'px';
            s.style.top = y + 'px';
            s.style.width = '10px';
            s.style.height = '10px';
            s.style.background = 'var(--theater-gold)';
            s.style.borderRadius = '50%';
            s.style.pointerEvents = 'none';
            document.body.appendChild(s);

            const destX = (Math.random() - 0.5) * 100;
            const destY = (Math.random() - 0.5) * 100;

            s.animate([
                { transform: 'translate(0,0) scale(1)', opacity: 1 },
                { transform: `translate(${destX}px, ${destY}px) scale(0)`, opacity: 0 }
            ], { duration: 500, easing: 'ease-out' }).onfinish = () => s.remove();
        }
    }

    function updateHUD() {
        el.harmonyVal.textContent = state.harmony + "%";
        if (state.harmony < 40) el.harmonyVal.style.color = 'red';
        else el.harmonyVal.style.color = 'var(--theater-gold)';
    }

    function endGame(win, msg) {
        state.gameOver = true;
        clearInterval(state.gameInterval);
        el.finalResult.textContent = msg;
        el.resultScreen.querySelector('h2').textContent = win ? "MASTERPIECE" : "DISASTER";
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
