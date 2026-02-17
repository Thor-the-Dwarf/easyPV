(function () {
    'use strict';

    const state = {
        config: null,
        level: 1,
        score: 0,
        streak: 0,
        activeComet: null,
        queue: [],
        gameOver: false,
        gameSpeed: 1,
        animationFrame: null,
        history: []
    };

    const el = {
        stage: document.querySelector('.game-stage'),
        grid: document.querySelector('.stacey-grid'),
        arsenal: document.querySelector('.arsenal'),
        hudScore: document.getElementById('score-val'),
        hudLevel: document.getElementById('level-val'),
        radar: document.getElementById('radar-msg'),
        targetInfo: document.getElementById('target-info'),
        targetTitle: document.getElementById('target-title'),
        targetReq: document.getElementById('target-req'),
        targetTech: document.getElementById('target-tech'),
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

        if (type === 'hit') {
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'miss') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'spawn') {
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.02, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        }
    }

    async function init() {
        try {
            const resp = await fetch('data/_gg01_pm_methoden_match.json');
            if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
            state.config = await resp.json();

            initMethods();
            el.restartBtn.addEventListener('click', startGame);
            startGame();
        } catch (e) {
            console.error(e);
            el.stage.innerHTML = `<div style="color:red; padding:2rem">Fehler: ${e.message}</div>`;
        }
    }

    function initMethods() {
        el.arsenal.innerHTML = state.config.methods.map(m => `
      <button class="method-btn" data-id="${m.id}" style="--btn-color: ${m.color}">
        ${m.label}
      </button>
    `).join('');

        el.arsenal.querySelectorAll('.method-btn').forEach(btn => {
            btn.addEventListener('click', () => fireMethod(btn.dataset.id));
        });
    }

    function startGame() {
        state.score = 0;
        state.streak = 0;
        state.level = 1;
        state.gameOver = false;
        state.queue = buildQueue();
        state.history = [];

        el.resultScreen.classList.add('hidden');
        updateHUD();
        spawnNext();
    }

    function buildQueue() {
        // Flatten all scenarios from current level config?
        // Game plan said 12 scenarios. JSON has 3 levels x 4 scenarios.
        // Let's queue them all sequentially or level by level.
        // For simplicity, queue all.
        let q = [];
        state.config.levels.forEach(l => {
            l.scenarios.forEach(s => {
                q.push({ ...s, levelSpeed: l.speed });
            });
        });
        return q;
    }

    function spawnNext() {
        if (state.queue.length === 0) {
            endGame();
            return;
        }

        const data = state.queue.shift();
        state.activeComet = {
            data: data,
            x: 50, // Start center? No, Stacey grid.
            // We want them to animate FROM somewhere TO their Stacey position.
            // Stacey Position:
            // X axis: Req Clarity (0-100). On Grid: 0=Right(Unclear), 100=Left(Clear)?
            // JSON: req_clarity: 100 (Clear/Simple) -> 0 (Unclear/Chaos).
            // Matrix:
            // X: Uncertainty (Low -> High). So 100 Clarity = Low Uncertainty.
            // Let's map: x% = (100 - Clarity). 0% = Left (Clear), 100% = Right (Unclear).
            // Y: Tech Uncertainty (Low -> High). Certainty 100% = Low Uncertainty.
            // map: y% = (100 - Certainty). 0% = Bottom (Known), 100% = Top (Unknown).
            finalX: 100 - data.req_clarity,
            finalY: 100 - data.tech_certainty,
            currentProgress: 0,
            speed: 0.5 * data.levelSpeed
        };

        // Show Radar
        el.radar.classList.add('active');
        playTone('spawn');

        // Update Target Info
        el.targetInfo.classList.add('active');
        el.targetTitle.textContent = data.title;
        el.targetReq.textContent = `Req: ${data.req_clarity}%`;
        el.targetTech.textContent = `Tech: ${data.tech_certainty}%`;

        // Visual Element
        const comet = document.createElement('div');
        comet.className = 'comet';
        comet.textContent = '☄️';
        el.grid.appendChild(comet);
        state.activeComet.el = comet;

        gameLoop();
    }

    function gameLoop() {
        if (state.gameOver || !state.activeComet) return;

        const comet = state.activeComet;
        comet.currentProgress += comet.speed;

        // Movement: Fly from Center-Out or Edge-In?
        // "Projekte fliegen als Kometen auf das Gitter zu."
        // Let's start from Top-Right (Chaos) and fly to their specific pont?
        // Or just fly from "outside" to the point.
        // Let's spawn at (120, 120) and fly to (finalX, finalY).

        // Lerp
        const startX = 120; // Offscreen
        const startY = -20; // Offscreen

        const t = Math.min(1, comet.currentProgress / 100);
        const curX = startX + (comet.finalX - startX) * t;
        const curY = startY + (comet.finalY - startY) * t;

        comet.el.style.left = `${curX}%`;
        comet.el.style.bottom = `${curY}%`; // Grid calculates logic from bottom-left for simplicity?
        // CSS Grid: x=left, y=bottom (using bottom/left absolute pos inside stacey-grid)

        if (t >= 1) {
            // Landed - Wait for player or fail?
            // "Der Spieler muss sie ... abfangen".
            // If it stays too long, maybe "Impact"? 
            // For now, let it sit and pulse.
            comet.el.style.animation = 'pulse 0.5s infinite';
        } else {
            state.animationFrame = requestAnimationFrame(gameLoop);
        }
    }

    function fireMethod(methodId) {
        if (!state.activeComet) return;
        if (state.gameOver) return;

        const data = state.activeComet.data;
        const isHit = data.allowed_methods.includes(methodId);

        // Score
        if (isHit) {
            const isBest = methodId === data.best_method;
            const points = isBest ? 1000 : 500;
            state.score += points + (state.streak * 100);
            state.streak++;
            showFeedback('HIT!', 'msg-hit');
            playTone('hit');
        } else {
            state.streak = 0;
            state.score = Math.max(0, state.score - 200);
            showFeedback('MISS!', 'msg-miss');
            playTone('miss');
        }

        state.history.push({
            scenario: data.title,
            chosen: methodId,
            best: data.best_method,
            success: isHit
        });

        updateHUD();

        // Remove comet
        state.activeComet.el.remove();
        state.activeComet = null;
        el.targetInfo.classList.remove('active');
        el.radar.classList.remove('active');
        cancelAnimationFrame(state.animationFrame);

        // Delay next
        setTimeout(spawnNext, 1000);
    }

    function showFeedback(text, cls) {
        el.feedback.textContent = text;
        el.feedback.className = `feedback-msg show ${cls}`;
        setTimeout(() => {
            el.feedback.className = 'feedback-msg';
        }, 800);
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
    }

    function endGame() {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.classList.remove('hidden');
    }

    // Debug/Window
    window.render_game_to_text = function () {
        return JSON.stringify({
            state: state.gameOver ? 'result' : 'playing',
            score: state.score,
            queue: state.queue.length,
            history: state.history
        }, null, 2);
    };

    window.advanceTime = () => true;

    init();
})();
