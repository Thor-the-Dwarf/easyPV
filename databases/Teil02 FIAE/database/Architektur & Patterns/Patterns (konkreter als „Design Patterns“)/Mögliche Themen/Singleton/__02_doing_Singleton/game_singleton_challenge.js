(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        score: 0,
        integrity: 100,
        instances: 0,
        maxInstances: 1, // Singleton Rule
        gameOver: false,
        waveInterval: null
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudIntegrity: document.getElementById('integrity-val'),
        vaultArea: document.getElementById('vault-area'),
        corePulse: document.getElementById('core-pulse'),
        instanceLabel: document.getElementById('instance-label'),
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

        if (type === 'block') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'access') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1000, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        } else if (type === 'breach') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.5);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_singleton_challenge.json');
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
        state.integrity = 100;
        state.instances = 0; // Starts with 0, created on first access or static init
        state.gameOver = false;

        // Clear hackers
        document.querySelectorAll('.hacker-request').forEach(n => n.remove());

        // Reset Core
        el.corePulse.style.display = 'block';
        el.instanceLabel.textContent = "INSTANCE: NULL";
        el.resultScreen.classList.add('hidden');

        updateHUD();
        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true);
            return;
        }
        state.levelIdx = idx;

        // Init Singleton (Lazy Load Simulation)
        // Actually let's say the instance exists from start for simplicity, or first successful get creates it
        state.instances = 1;
        el.instanceLabel.textContent = "INSTANCE: " + state.config.scenarios[0].instanceId; // Pick scenario 1 for now

        startWave();
    }

    function startWave() {
        if (state.waveInterval) clearInterval(state.waveInterval);

        const level = state.config.levels[state.levelIdx];
        let wavesLeft = level.waves;

        state.waveInterval = setInterval(() => {
            if (state.gameOver) return;
            if (wavesLeft <= 0) {
                clearInterval(state.waveInterval);
                // Level Complete check
                setTimeout(() => {
                    if (!state.gameOver) startLevel(state.levelIdx + 1);
                }, 2000);
                return;
            }

            spawnHacker(level);
            wavesLeft--;
        }, level.speed);
    }

    function spawnHacker(level) {
        const thread = level.threads[Math.floor(Math.random() * level.threads.length)];
        const hacker = document.createElement('div');
        hacker.className = 'hacker-request ' + (thread.valid ? 'valid' : '');
        hacker.textContent = thread.label;
        hacker.dataset.type = thread.type;

        // Random Position on perimeter
        const angle = Math.random() * Math.PI * 2;
        const radius = 250; // px from center
        const x = Math.cos(angle) * radius + el.vaultArea.offsetWidth / 2 - 40;
        const y = Math.sin(angle) * radius + el.vaultArea.offsetHeight / 2 - 40;

        hacker.style.left = x + 'px';
        hacker.style.top = y + 'px';

        // Animate towards center
        hacker.animate([
            { transform: 'scale(0.8)' },
            { left: (el.vaultArea.offsetWidth / 2 - 40) + 'px', top: (el.vaultArea.offsetHeight / 2 - 40) + 'px', transform: 'scale(0.2)' }
        ], {
            duration: 4000,
            easing: 'linear',
            fill: 'forwards'
        }).onfinish = () => {
            if (hacker.isConnected) {
                evaluateHit(hacker, thread);
                hacker.remove();
            }
        };

        // Click Interaction
        hacker.addEventListener('mousedown', () => {
            if (thread.valid) {
                // User blocked a valid request -> Bad?
                // Wait, game logic: "Security system (Schild) muss... blocken... und alle auf den einen... umlenken"
                // The text says "Blocke einfache new Aufrufe" (Level 1).
                // So valid = getInstance(), invalid = new().
                // If user clicks, they are BLOCKING manually.

                if (thread.type === 'get') {
                    // User blocked a valid get instance -> Penalty? Or maybe user should click to "Authorize"?
                    // Let's go with: Click to DESTROY threatening packets. Let valid ones pass.

                    // If I destroy valid packet -> Score penalty
                    state.score -= 50;
                    playTone('block');
                    hacker.remove();
                } else {
                    // User destroyed invalid packet -> Good!
                    state.score += 100;
                    playTone('block');
                    createBoom(hacker);
                    hacker.remove();
                }
                updateHUD();
            } else {
                // User destroyed invalid packet -> Good
                state.score += 100;
                playTone('block');
                createBoom(hacker);
                hacker.remove();
                updateHUD();
            }
        });

        el.vaultArea.appendChild(hacker);
    }

    function evaluateHit(hacker, thread) {
        // Reached center
        if (thread.valid) {
            // Allowed access -> Good
            playTone('access');
            state.score += 50;

            // Visual Pulse
            el.corePulse.animate([
                { transform: 'translate(-50%, -50%) scale(1)' },
                { transform: 'translate(-50%, -50%) scale(1.5)' },
                { transform: 'translate(-50%, -50%) scale(1)' }
            ], { duration: 200 });

        } else {
            // Breach! Invalid creation reached core
            playTone('breach');
            state.integrity -= 20;
            state.instances++; // Falsely created another instance

            if (state.instances > state.maxInstances) {
                // Flash Red
                document.body.style.backgroundColor = '#500';
                setTimeout(() => document.body.style.backgroundColor = 'var(--void-bg)', 100);
            }

            if (state.integrity <= 0) endGame(false);
        }
        updateHUD();
    }

    function createBoom(el) {
        const boom = document.createElement('div');
        boom.className = 'boom';
        boom.style.left = el.style.left;
        boom.style.top = el.style.top;
        document.body.appendChild(boom);
        setTimeout(() => boom.remove(), 500);
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudIntegrity.textContent = state.integrity + '%';

        if (state.integrity < 50) el.hudIntegrity.style.color = 'var(--neon-red)';
        else el.hudIntegrity.style.color = 'var(--neon-blue)';
    }

    function endGame(win) {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "System Secure!" : "Root Compromised!";
        el.resultScreen.classList.remove('hidden');
    }

    init();
})();
