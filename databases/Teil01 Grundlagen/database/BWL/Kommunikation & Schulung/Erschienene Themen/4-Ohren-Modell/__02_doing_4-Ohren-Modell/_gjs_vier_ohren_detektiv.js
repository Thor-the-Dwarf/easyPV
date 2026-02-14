(function () {
    'use strict';

    /**
     * Vier-Ohren-Detektiv
     * Zweck: Analyse-Spiel für Kommunikationsmodelle.
     * Inputs: config.json (_gg01_vier_ohren_detektiv.json)
     * Outputs: UI-Updates, Scoring, Test-Hooks.
     */

    const state = {
        cfg: null,
        targetType: '',
        score: 0,
        timeLeft: 60,
        active: false,
        spawnIntervalId: null,
        timerIntervalId: null,
        messagePool: []
    };

    const el = {
        timer: document.getElementById('timer'),
        score: document.getElementById('score'),
        targetKpi: document.getElementById('kpi-target'),
        targetDisplay: document.getElementById('current-target'),
        flyingArea: document.getElementById('flying-area'),
        startScreen: document.getElementById('start-screen'),
        gameContainer: document.getElementById('game-container'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        resultText: document.getElementById('result-text'),
        startBtn: document.getElementById('start-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    init();

    async function init() {
        try {
            const resp = await fetch('./_gg01_vier_ohren_detektiv.json');
            if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
            state.cfg = await resp.json();

            state.messagePool = state.cfg.messages || [];
            state.timeLeft = state.cfg.duration || 60;

            bindEvents();
        } catch (err) {
            console.error('Initialisierungsfehler:', err);
            if (el.resultText) el.resultText.textContent = 'Fehler beim Laden: ' + err.message;
        }
    }

    function bindEvents() {
        el.startBtn.addEventListener('click', startGame);
        el.restartBtn.addEventListener('click', startGame);
    }

    function startGame() {
        state.score = 0;
        state.timeLeft = state.cfg.duration || 60;
        state.active = true;
        state.targetType = state.cfg.targetTypes[Math.floor(Math.random() * state.cfg.targetTypes.length)];

        el.startScreen.style.display = 'none';
        el.resultScreen.style.display = 'none';
        el.gameContainer.style.display = 'block';
        el.flyingArea.innerHTML = '';

        updateUI();
        startLoops();
    }

    function startLoops() {
        clearInterval(state.spawnIntervalId);
        clearInterval(state.timerIntervalId);

        state.spawnIntervalId = setInterval(spawnRandomMessage, 1200);
        state.timerIntervalId = setInterval(tick, 1000);
    }

    function tick() {
        state.timeLeft--;
        if (state.timeLeft <= 0) {
            endGame();
        }
        updateUI();
    }

    function endGame() {
        state.active = false;
        clearInterval(state.spawnIntervalId);
        clearInterval(state.timerIntervalId);

        el.gameContainer.style.display = 'none';
        el.resultScreen.style.display = 'block';
        el.finalScore.textContent = state.score;

        const messages = [
            "Gute Arbeit, Detektiv!",
            "Ein scharfes Gehör!",
            "Das war erstklassig.",
            "Detektivarbeit vom Feinsten."
        ];
        el.resultText.textContent = messages[Math.floor(Math.random() * messages.length)];
    }

    function spawnRandomMessage() {
        if (!state.active) return;
        const msg = state.messagePool[Math.floor(Math.random() * state.messagePool.length)];
        spawnMessage(msg.text, msg.type);
    }

    function spawnMessage(text, type) {
        const msgEl = document.createElement('div');
        msgEl.className = 'flying-message';
        msgEl.textContent = text;
        msgEl.dataset.type = type;

        const top = Math.random() * (el.flyingArea.offsetHeight - 50);
        msgEl.style.setProperty('--top', `${top}px`);

        // Zufällige Geschwindigkeit
        const duration = 4 + Math.random() * 4;
        msgEl.style.animation = `fly-across ${duration}s linear forwards`;

        msgEl.addEventListener('click', () => handleCapture(msgEl, type));

        el.flyingArea.appendChild(msgEl);

        // Aufräumen nach Animation
        msgEl.addEventListener('animationend', () => {
            msgEl.remove();
        });
    }

    function handleCapture(msgEl, type) {
        if (!state.active || msgEl.classList.contains('correct') || msgEl.classList.contains('wrong')) return;

        if (type === state.targetType) {
            state.score += (state.cfg.pointsPerHit || 10);
            msgEl.classList.add('correct');
            spawnParticles(msgEl, '#22c55e');
        } else {
            state.score += (state.cfg.pointsPerMiss || -5);
            msgEl.classList.add('wrong');
            spawnParticles(msgEl, '#ef4444');
        }

        updateUI();
        setTimeout(() => msgEl.remove(), 300);
    }

    function spawnParticles(originEl, color) {
        const rect = originEl.getBoundingClientRect();
        const areaRect = el.flyingArea.getBoundingClientRect();

        for (let i = 0; i < 8; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.backgroundColor = color;
            p.style.left = (rect.left - areaRect.left + rect.width / 2) + 'px';
            p.style.top = (rect.top - areaRect.top + rect.height / 2) + 'px';

            const destX = (Math.random() - 0.5) * 100;
            const destY = (Math.random() - 0.5) * 100;
            p.style.setProperty('--x', `${destX}px`);
            p.style.setProperty('--y', `${destY}px`);

            el.flyingArea.appendChild(p);
            setTimeout(() => p.remove(), 500);
        }
    }

    function updateUI() {
        el.timer.textContent = state.timeLeft + 's';
        el.score.textContent = state.score;
        el.targetKpi.textContent = capitalize(state.targetType);
        el.targetKpi.className = state.targetType;
        el.targetDisplay.textContent = capitalize(state.targetType);
        el.targetDisplay.className = 'current-target ' + state.targetType;
    }

    function capitalize(s) {
        if (!s) return '--';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    // Test Hooks
    window.render_game_to_text = function () {
        return JSON.stringify({
            targetType: state.targetType,
            currentScore: state.score,
            timeRemaining: state.timeLeft,
            active: state.active
        });
    };

    window.spawnMessage = function (text, type) {
        if (state.active) {
            spawnMessage(text, type);
        }
    };
})();
