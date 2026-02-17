(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        score: 0,
        foundFlaws: [],
        timeLeft: 60,
        timer: null,
        gameOver: false,
        activeFlawId: null // Flaw currently being tagged
    };

    const el = {
        blueprintWrapper: document.querySelector('.blueprint-wrapper'),
        layerBase: document.querySelector('.layer-base'),
        layerReveal: document.querySelector('.layer-reveal'),
        cursor: document.querySelector('.scanner-cursor'),
        tagMenu: document.getElementById('tag-menu'),
        hudScore: document.getElementById('score-val'),
        hudTime: document.getElementById('time-val'),
        hudLevel: document.getElementById('level-val'),
        progressBar: document.getElementById('efficiency-bar'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn'),
        feedback: document.getElementById('feedback-msg')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'scan') {
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);
            osc.start();
            osc.stop(now + 0.05);
        } else if (type === 'found') {
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('data/_gg01_ist_zustand_detektiv.json');
            state.config = await resp.json();

            // Setup Move Listener
            el.blueprintWrapper.addEventListener('mousemove', onMouseMove);
            el.blueprintWrapper.addEventListener('touchmove', onTouchMove); // TODO: Add touch logic

            // Setup Tag Menu
            el.tagMenu.addEventListener('click', onTagClick);

            el.restartBtn.addEventListener('click', restartGame);

            loadLevel(0);
        } catch (e) {
            console.error(e);
        }
    }

    function restartGame() {
        loadLevel(0);
    }

    function loadLevel(idx) {
        if (idx >= state.config.levels.length) {
            // Game Complete
            showResult();
            return;
        }

        state.levelIdx = idx;
        const level = state.config.levels[idx];

        state.score = 0;
        state.timeLeft = level.time_budget;
        state.foundFlaws = [];
        state.gameOver = false;

        // UI Update
        el.hudLevel.textContent = level.id;
        updateHUD();
        el.resultScreen.classList.add('hidden');
        el.tagMenu.classList.add('hidden');

        // Render Blueprint
        // Base Layer
        el.layerBase.innerHTML = `<img src="${level.blueprint_bg}" class="blueprint-img">`;
        // Reveal Layer
        el.layerReveal.style.backgroundImage = 'none'; // Clear style
        el.layerReveal.innerHTML = `<img src="${level.blueprint_bg}" class="blueprint-img">`; // Image matches

        // Flaws
        level.flaws.forEach(flaw => {
            const marker = document.createElement('div');
            marker.className = 'flaw-marker'; // Hidden by default opacity in Reveal Layer? 
            // Actually, standard markers inside reveal layer are fully opaque, 
            // but the reveal layer *itself* is masked. 
            // So putting markers inside layerReveal makes them visible only under cursor.

            marker.style.left = flaw.x + 'px';
            marker.style.top = flaw.y + 'px';
            marker.dataset.id = flaw.id;

            // Icon
            // Find type
            const typeDef = state.config.flaw_types.find(t => t.id === flaw.type);
            marker.innerHTML = typeDef ? typeDef.icon : '?';

            marker.addEventListener('click', (e) => onFlawClick(e, flaw));

            el.layerReveal.appendChild(marker);
        });

        // Start Timer
        if (state.timer) clearInterval(state.timer);
        state.timer = setInterval(tick, 1000);
    }

    function tick() {
        if (state.gameOver) return;
        state.timeLeft--;
        updateHUD();
        if (state.timeLeft <= 0) {
            endLevel(false);
        }
    }

    function onMouseMove(e) {
        if (state.gameOver) return;

        const rect = el.blueprintWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Update CSS variables for mask
        el.blueprintWrapper.style.setProperty('--x', x + 'px');
        el.blueprintWrapper.style.setProperty('--y', y + 'px');
        el.cursor.style.setProperty('--x', x + 'px');
        el.cursor.style.setProperty('--y', y + 'px');
    }

    function onTouchMove(e) {
        // Simple wrapper for touch
        if (state.gameOver) return;
        e.preventDefault();
        const rect = el.blueprintWrapper.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        el.blueprintWrapper.style.setProperty('--x', x + 'px');
        el.blueprintWrapper.style.setProperty('--y', y + 'px');
        el.cursor.style.setProperty('--x', x + 'px');
        el.cursor.style.setProperty('--y', y + 'px');
    }

    function onFlawClick(e, flaw) {
        if (state.gameOver || state.foundFlaws.includes(flaw.id)) return;
        e.stopPropagation(); // Don't trigger other clicks

        // Show Menu
        state.activeFlawId = flaw.id;

        // Position Menu near Flaw
        const rect = el.blueprintWrapper.getBoundingClientRect();
        // flaw.x/y is relative to wrapper.
        // Menu is fixed/absolute relative to body or game-app?
        // Let's place it relative to wrapper.

        el.tagMenu.style.left = (flaw.x + rect.left + 20) + 'px';
        el.tagMenu.style.top = (flaw.y + rect.top) + 'px';
        el.tagMenu.classList.remove('hidden');

        // Render Options
        const flawDef = state.config.flaw_types;
        el.tagMenu.innerHTML = flawDef.map(t => `
        <button class="tag-btn" data-type="${t.id}">
            ${t.icon} ${t.label}
        </button>
    `).join('');
    }

    function onTagClick(e) {
        const btn = e.target.closest('.tag-btn');
        if (!btn) return;

        const type = btn.dataset.type;
        submitTag(type);
        el.tagMenu.classList.add('hidden');
    }

    function submitTag(selectedType) {
        if (!state.activeFlawId) return;

        const level = state.config.levels[state.levelIdx];
        const flaw = level.flaws.find(f => f.id === state.activeFlawId);

        if (flaw.type === selectedType) {
            // Success
            state.score += 500;
            state.foundFlaws.push(flaw.id);
            playTone('found');
            showFeedback(`Korrekt! +500`, 'success');

            // Mark visual
            const marker = el.layerReveal.querySelector(`.flaw-marker[data-id="${flaw.id}"]`);
            if (marker) marker.classList.add('found');

            // Check Completion
            if (state.foundFlaws.length === level.flaws.length) {
                endLevel(true);
            }
        } else {
            // Fail
            state.score = Math.max(0, state.score - 200);
            state.timeLeft -= 5; // Penalty time
            playTone('error');
            showFeedback(`Falsch! -200`, 'error');
        }

        updateHUD();
    }

    function endLevel(success) {
        state.gameOver = true;
        clearInterval(state.timer);

        if (success) {
            setTimeout(() => {
                alert("Level Complete! Next Level...");
                loadLevel(state.levelIdx + 1);
            }, 1000);
        } else {
            showResult();
        }
    }

    function showResult() {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.classList.remove('hidden');
    }

    function showFeedback(text, type) {
        // Basic alert/toast logic
        console.log(text); // TODO visual toast
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudTime.textContent = state.timeLeft + 's';

        const level = state.config.levels[state.levelIdx];
        if (level) {
            const percent = (state.foundFlaws.length / level.flaws.length) * 100;
            el.progressBar.style.width = percent + '%';
        }
    }

    // Debug
    window.render_game_to_text = function () {
        return JSON.stringify({ state: state });
    }

    init();
})();
