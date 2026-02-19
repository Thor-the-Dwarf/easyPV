/**
 * Vier-Ohren-Detektiv - Game Logic
 * Zweck: Analyse von Nachrichten nach dem 4-Ohren-Modell in einem temporeichen Setting.
 * Inputs: _gg01_vier_ohren_detektiv.json
 * Outputs: Score, Feedback, Game State via Hooks
 */

(function () {
    "use strict";

    // Game State
    const state = {
        config: null,
        score: 0,
        timeLeft: 0,
        currentTarget: null,
        gameInterval: null,
        spawnInterval: null,
        isGameOver: false,
        spawnRate: 1500, // ms between spawns
    };

    // DOM Elements
    const els = {
        timer: document.getElementById('timer'),
        score: document.getElementById('score'),
        kpiTarget: document.getElementById('kpi-target'),
        currentTargetDisplay: document.getElementById('current-target'),
        flyingArea: document.getElementById('flying-area'),
        gameContainer: document.getElementById('game-container'),
        startScreen: document.getElementById('start-screen'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        startBtn: document.getElementById('start-btn'),
        restartBtn: document.getElementById('restart-btn'),
    };

    // Initialization
    async function init() {
        try {
            const response = await fetch('_data/_gg01_vier_ohren_detektiv.json');
            if (!response.ok) throw new Error("Konfiguration konnte nicht geladen werden.");
            state.config = await response.json();

            els.startBtn.addEventListener('click', startGame);
            els.restartBtn.addEventListener('click', () => {
                els.resultScreen.style.display = 'none';
                els.startScreen.style.display = 'block';
            });

            console.log("Vier-Ohren-Detektiv initialisiert.");
        } catch (error) {
            console.error(error);
            document.getElementById('game-desc').textContent = "Fehler beim Laden: " + error.message;
        }
    }

    function startGame() {
        // Reset State
        state.score = 0;
        state.timeLeft = state.config.duration || 60;
        state.isGameOver = false;
        state.currentTarget = getRandomTarget();

        // UI transitions
        els.startScreen.style.display = 'none';
        els.resultScreen.style.display = 'none';
        els.gameContainer.style.display = 'block';

        updateUI();

        // Intervals
        state.gameInterval = setInterval(tick, 1000);
        state.spawnInterval = setInterval(spawnMessageAuto, state.spawnRate);

        // Spawn first message immediately
        spawnMessageAuto();
    }

    function tick() {
        state.timeLeft--;
        if (state.timeLeft <= 0) {
            endGame();
        }
        updateUI();
    }

    function updateUI() {
        els.timer.textContent = state.timeLeft + "s";
        els.score.textContent = state.score;

        const targetLabel = capitalize(state.currentTarget);
        els.kpiTarget.textContent = targetLabel;
        els.currentTargetDisplay.textContent = targetLabel;

        // Update class for color coding
        els.currentTargetDisplay.className = 'current-target ' + state.currentTarget;
    }

    function getRandomTarget() {
        const types = state.config.targetTypes;
        return types[Math.floor(Math.random() * types.length)];
    }

    function spawnMessageAuto() {
        if (state.isGameOver) return;
        const msg = state.config.messages[Math.floor(Math.random() * state.config.messages.length)];
        createFlyingMessage(msg.text, msg.type);
    }

    function createFlyingMessage(text, type) {
        const msgEl = document.createElement('div');
        msgEl.className = 'flying-message';
        msgEl.textContent = text;

        // Random vertical position (avoid header overlapping if needed, but area is restricted)
        const areaHeight = els.flyingArea.offsetHeight;
        const randomTop = Math.floor(Math.random() * (areaHeight - 60)) + 20;
        msgEl.style.setProperty('--top', randomTop + 'px');

        // Animation duration based on screen width (roughly)
        const duration = Math.max(4, 10 - (window.innerWidth / 400));
        msgEl.style.animation = `fly-across ${duration}s linear forwards`;

        msgEl.addEventListener('click', (e) => handleHit(msgEl, type, e));

        // Clean up when animation ends
        msgEl.addEventListener('animationend', () => {
            if (msgEl.parentElement) msgEl.remove();
        });

        els.flyingArea.appendChild(msgEl);
    }

    function handleHit(el, type, event) {
        if (state.isGameOver) return;
        if (el.classList.contains('correct') || el.classList.contains('wrong')) return;

        const isCorrect = type === state.currentTarget;
        if (isCorrect) {
            state.score += (state.config.pointsPerHit || 10);
            el.classList.add('correct');
            showParticle(event.clientX, event.clientY, 'var(--good)');
        } else {
            state.score += (state.config.pointsPerMiss || -5);
            el.classList.add('wrong');
            showParticle(event.clientX, event.clientY, 'var(--bad)');
        }

        // Remove after short delay to show color
        setTimeout(() => {
            if (el.parentElement) el.remove();
        }, 300);

        updateUI();
    }

    function showParticle(x, y, color) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.background = color;
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 500);
    }

    function endGame() {
        state.isGameOver = true;
        clearInterval(state.gameInterval);
        clearInterval(state.spawnInterval);

        // Clear remaining messages
        els.flyingArea.innerHTML = '';

        // Show result screen
        els.gameContainer.style.display = 'none';
        els.resultScreen.style.display = 'block';
        els.finalScore.textContent = state.score;

        if (state.score > 200) {
            document.getElementById('result-text').textContent = "Exzellente Analyse, Meister-Detektiv!";
        } else if (state.score > 100) {
            document.getElementById('result-text').textContent = "Gute Arbeit, Detektiv!";
        } else {
            document.getElementById('result-text').textContent = "Das geht noch besser. Übung macht den Meister.";
        }
    }

    function capitalize(s) {
        if (typeof s !== 'string') return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    // Public Hooks
    window.render_game_to_text = function () {
        return JSON.stringify({
            mode: state.isGameOver ? 'result' : (state.gameInterval ? 'running' : 'start'),
            targetType: state.currentTarget,
            currentScore: state.score,
            timeRemaining: state.timeLeft
        });
    };

    window.spawnMessage = function (text, type) {
        createFlyingMessage(text, type);
    };

    // Run
    init();

})();
