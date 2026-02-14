/**
 * Vier-Ohren-Detektiv - Core Game Logic
 * Zweck: Analyse von Nachrichten im Flug nach dem 4-Ohren-Modell.
 * Inputs: _gg01_vier_ohren_detektiv.json
 * Outputs: Punkte-Score, Lernstand-Feedback
 */

(function () {
    let config = null;
    let score = 0;
    let timeRemaining = 60;
    let timerInterval = null;
    let spawnInterval = null;
    let currentTarget = "";
    let isPlaying = false;

    // DOM Elements
    const elements = {
        timer: document.getElementById('timer'),
        score: document.getElementById('score'),
        kpiTarget: document.getElementById('kpi-target'),
        currentTarget: document.getElementById('current-target'),
        flyingArea: document.getElementById('flying-area'),
        startScreen: document.getElementById('start-screen'),
        gameContainer: document.getElementById('game-container'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        resultText: document.getElementById('result-text'),
        startBtn: document.getElementById('start-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    // Load Config
    async function init() {
        try {
            const response = await fetch('_gg01_vier_ohren_detektiv.json');
            config = await response.json();
            elements.timer.textContent = config.duration + "s";
            timeRemaining = config.duration;

            elements.startBtn.addEventListener('click', startGame);
            elements.restartBtn.addEventListener('click', () => location.reload());
        } catch (err) {
            console.error("Config Load Error:", err);
            alert("Konnte Spieldaten nicht laden.");
        }
    }

    function startGame() {
        isPlaying = true;
        score = 0;
        timeRemaining = config.duration;
        elements.score.textContent = "0";
        elements.startScreen.style.display = "none";
        elements.gameContainer.style.display = "block";

        pickNewTarget();

        timerInterval = setInterval(() => {
            timeRemaining--;
            elements.timer.textContent = timeRemaining + "s";
            if (timeRemaining <= 0) endGame();
            if (timeRemaining % 15 === 0) pickNewTarget(); // Change target every 15s
        }, 1000);

        spawnInterval = setInterval(spawnMessage, 1200);
        spawnMessage(); // Immediate first spawn
    }

    function pickNewTarget() {
        const types = config.targetTypes;
        currentTarget = types[Math.floor(Math.random() * types.length)];
        elements.kpiTarget.textContent = currentTarget.toUpperCase();
        elements.currentTarget.textContent = currentTarget.toUpperCase();
        elements.currentTarget.className = "current-target " + currentTarget;
    }

    function spawnMessage() {
        if (!isPlaying) return;

        const msgData = config.messages[Math.floor(Math.random() * config.messages.length)];
        const el = document.createElement('div');
        el.className = 'flying-message';
        el.textContent = msgData.text;
        el.style.setProperty('--top', Math.random() * 80 + 10 + "%");
        el.style.animation = `fly-across ${4 + Math.random() * 3}s linear forwards`;

        el.addEventListener('click', (e) => handleHit(e, msgData, el));

        elements.flyingArea.appendChild(el);

        // Remove after animation
        el.addEventListener('animationend', () => el.remove());
    }

    function handleHit(e, data, el) {
        if (el.classList.contains('correct') || el.classList.contains('wrong')) return;

        if (data.type === currentTarget) {
            score += config.pointsPerHit;
            el.classList.add('correct');
            createParticles(e.clientX, e.clientY, 'var(--good)');
        } else {
            score = Math.max(0, score + config.pointsPerMiss);
            el.classList.add('wrong');
            createParticles(e.clientX, e.clientY, 'var(--bad)');
        }
        elements.score.textContent = score;
    }

    function createParticles(x, y, color) {
        for (let i = 0; i < 5; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = (x - 5) + "px";
            p.style.top = (y - 5) + "px";
            p.style.backgroundColor = color;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 500);
        }
    }

    function endGame() {
        isPlaying = false;
        clearInterval(timerInterval);
        clearInterval(spawnInterval);

        elements.gameContainer.style.display = "none";
        elements.resultScreen.style.display = "block";
        elements.finalScore.textContent = score;

        if (score > 100) elements.resultText.textContent = "Meister-Detektiv! Exzellente Analyse.";
        else if (score > 50) elements.resultText.textContent = "Gute Arbeit, Detektiv. Weiter so!";
        else elements.resultText.textContent = "Das geht noch besser. Bleib dran!";
    }

    // Expose Hooks for Tests
    window.render_game_to_text = () => ({
        target: currentTarget,
        score: score,
        timeLeft: timeRemaining,
        status: isPlaying ? "playing" : "finished"
    });

    window.spawnMessage = spawnMessage;

    init();
})();
