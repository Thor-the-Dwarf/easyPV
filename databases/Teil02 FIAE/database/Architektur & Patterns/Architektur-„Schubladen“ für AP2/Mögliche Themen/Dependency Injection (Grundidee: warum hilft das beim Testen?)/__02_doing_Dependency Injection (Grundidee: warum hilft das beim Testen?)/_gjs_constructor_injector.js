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
            const resp = await fetch('_gg01_constructor_injector.json');
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

    init();
})();
