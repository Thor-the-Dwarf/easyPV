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
