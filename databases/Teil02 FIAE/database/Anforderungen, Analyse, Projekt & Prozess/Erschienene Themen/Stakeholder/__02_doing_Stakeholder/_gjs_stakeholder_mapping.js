(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        score: 0,
        heat: 0,
        queue: [],
        activeCard: null,
        gameOver: false
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudHeat: document.getElementById('heat-bar'),
        hudLevel: document.getElementById('level-val'),
        cardStack: document.getElementById('card-stack'),
        quadrants: document.querySelectorAll('.quadrant'),
        strategySelector: document.getElementById('strategy-selector'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn'),
        feedback: document.getElementById('feedback-overlay'),
        stampMark: document.getElementById('stamp-mark')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'drop') {
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        } else if (type === 'fail') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_gg01_stakeholder_mapping.json');
            state.config = await resp.json();

            el.restartBtn.addEventListener('click', restartGame);
            setupDragDrop();
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
            endGame(true);
            return;
        }

        state.levelIdx = idx;
        const level = state.config.levels[idx];

        // Level Reset
        state.heat = 0;
        if (idx === 0) state.score = 0; // Only reset score at absolute start
        state.gameOver = false;
        state.queue = [...level.stakeholders];

        el.hudLevel.textContent = level.id;
        updateHUD();
        el.resultScreen.classList.add('hidden');
        el.strategySelector.classList.add('hidden');

        renderNextCard();
    }

    function renderNextCard() {
        el.cardStack.innerHTML = '';
        if (state.queue.length === 0) {
            // Level Done
            setTimeout(() => {
                alert("Level Complete!");
                loadLevel(state.levelIdx + 1);
            }, 1000);
            return;
        }

        const data = state.queue[0];
        const card = document.createElement('div');
        card.className = 'stakeholder-card';
        card.draggable = true;
        card.innerHTML = `
      <div class="card-role">${data.role}</div>
      <div class="card-name">${data.name}</div>
      <div class="card-quote">"${data.quote}"</div>
    `;

        // Attach drag events
        card.addEventListener('dragstart', (e) => onDragStart(e, data));
        card.addEventListener('dragend', onDragEnd);

        // Touch support (simple implementation logic needed for complex touch drag, 
        // relying on HTML5 DnD for desktop mainly, touch shim would be needed for full mobile)
        // For this prototype, we'll assume desktop or shim.

        el.cardStack.appendChild(card);
        state.activeCard = data;
    }

    function onDragStart(e, data) {
        e.dataTransfer.setData('text/plain', JSON.stringify(data));
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => e.target.classList.add('hidden'), 0);
    }

    function onDragEnd(e) {
        e.target.classList.remove('hidden');
    }

    function setupDragDrop() {
        el.quadrants.forEach(q => {
            q.addEventListener('dragover', (e) => {
                e.preventDefault();
                q.classList.add('drag-over');
            });
            q.addEventListener('dragleave', () => q.classList.remove('drag-over'));
            q.addEventListener('drop', (e) => onDrop(e, q));
        });
    }

    function onDrop(e, quadrant) {
        e.preventDefault();
        quadrant.classList.remove('drag-over');

        if (state.gameOver) return;

        const stratId = quadrant.dataset.id; // defined in HTML
        const stratKey = Object.keys(state.config.strategies).find(k => state.config.strategies[k].id === stratId);

        // Prompt for confirmation or auto-select based on drop?
        // Game Mechanic: "Precise placement on 2x2".
        // Actually, quadrant determines the strategy. 
        // So dropping on "High/High" implies "Manage Closely".

        // Check correctness
        validateMove(stratKey);
    }

    function validateMove(quadrantKey) {
        const data = state.activeCard;
        const correct = data.correct_quadrant;

        if (quadrantKey === correct) {
            // Correct
            state.score += 500;
            state.heat = Math.max(0, state.heat - 10);
            playTone('success');
            showFeedback("SUCCESS", "success");
        } else {
            // Fail
            state.heat += 25;
            playTone('fail');
            showFeedback("ERROR", "fail");
        }

        // Remove current card
        state.queue.shift();
        updateHUD();

        // Check Game Over
        if (state.heat >= 100) {
            endGame(false);
        } else {
            renderNextCard();
        }
    }

    function showFeedback(text, type) {
        el.stampMark.textContent = text;
        el.stampMark.style.color = type === 'success' ? '#0f0' : '#f00';
        el.stampMark.classList.add('show');
        setTimeout(() => el.stampMark.classList.remove('show'), 800);
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        // Heat Bar
        const heatPercent = Math.min(100, Math.max(0, state.heat));
        el.hudHeat.style.width = heatPercent + '%';
        // Color shift
        if (heatPercent > 80) el.hudHeat.style.background = 'red';
        else el.hudHeat.style.background = 'hsl(var(--heat-color))';
    }

    function endGame(win) {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "Mission Accomplished" : "Project Failed";
        el.resultScreen.classList.remove('hidden');
    }

    window.render_game_to_text = () => JSON.stringify(state);

    init();
})();
