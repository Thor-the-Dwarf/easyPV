(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        itemIdx: 0,
        score: 0,
        efficiency: 100, // Percentage
        currentItem: null,
        gameOver: false
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        itemSpawner: document.getElementById('item-spawner'),
        slotsContainer: document.getElementById('slots-container'),
        scoreVal: document.getElementById('score-val'),
        efficiencyVal: document.getElementById('efficiency-val'),
        feedback: document.getElementById('feedback-overlay'),
        resultScreen: document.getElementById('result-screen'),
        finalResult: document.getElementById('final-result'),
        nextBtn: document.getElementById('next-btn')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'good') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        } else if (type === 'wet') { // Click/Stone sound
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(100, now);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'bad') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_type_match.json');
            state.config = await resp.json();

            el.nextBtn.addEventListener('click', () => {
                window.location.reload();
            });

            renderSlots();
            startLevel(0);
        } catch (e) {
            console.error(e);
        }
    }

    function renderSlots() {
        el.slotsContainer.innerHTML = '';
        state.config.slots.forEach(slot => {
            const div = document.createElement('div');
            div.className = 'type-slot';
            div.dataset.id = slot.id;

            div.innerHTML = `
            <div class="slot-label">${slot.label}</div>
            <div class="slot-capacity">${slot.description}</div>
          `;

            div.addEventListener('dragover', e => {
                e.preventDefault();
                div.classList.add('hover');
            });
            div.addEventListener('dragleave', () => div.classList.remove('hover'));
            div.addEventListener('drop', e => handleDrop(e, slot.id));

            el.slotsContainer.appendChild(div);
        });
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true, "All Data Stored Efficiently!");
            return;
        }
        state.levelIdx = idx;
        state.itemIdx = 0;

        const level = state.config.levels[idx];
        el.levelTitle.textContent = `Level ${idx + 1}: ${level.title}`;

        spawnItem();
    }

    function spawnItem() {
        const level = state.config.levels[state.levelIdx];
        if (state.itemIdx >= level.items.length) {
            startLevel(state.levelIdx + 1);
            return;
        }

        const itemData = level.items[state.itemIdx];
        state.currentItem = itemData;

        el.itemSpawner.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'data-item';
        div.draggable = true;
        div.textContent = itemData.value;
        div.title = itemData.info;

        div.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', itemData.value);
            playTone('wet');
        });

        el.itemSpawner.appendChild(div);
    }

    function handleDrop(e, slotId) {
        e.preventDefault();
        document.querySelectorAll('.type-slot').forEach(s => s.classList.remove('hover'));

        if (!state.currentItem) return;

        const item = state.currentItem;
        let result = 'bad';
        let msg = "";

        if (item.best === slotId) {
            result = 'good';
            msg = "PERFECT FIT!";
            state.score += 100;
        } else if (item.ok.includes(slotId)) {
            result = 'warn';
            msg = "Inefficient but Valid.";
            state.score += 50;
            state.efficiency -= 10;
        } else {
            result = 'bad';
            msg = "TYPE ERROR / OVERFLOW!";
            state.score -= 50;
            state.efficiency -= 20;
        }

        showFeedback(msg, result);
        updateHUD();

        if (result === 'good') playTone('good');
        else playTone('bad');

        state.itemIdx++;

        if (state.efficiency <= 0) {
            endGame(false, "Storage Overflow! Database Crashed.");
        } else {
            setTimeout(spawnItem, 1000);
        }
    }

    function showFeedback(msg, type) {
        el.feedback.textContent = msg;
        el.feedback.style.display = 'block';
        el.feedback.style.borderColor = type === 'good' ? 'var(--neon-green)' : (type === 'warn' ? 'var(--gold)' : 'var(--neon-red)');

        // Animate item removal
        const itemEl = el.itemSpawner.firstChild;
        if (itemEl) {
            itemEl.classList.add(type === 'good' ? 'success' : (type === 'warn' ? 'warn' : 'error'));
            setTimeout(() => itemEl.remove(), 500);
        }

        setTimeout(() => {
            el.feedback.style.display = 'none';
        }, 1000);
    }

    function updateHUD() {
        el.scoreVal.textContent = state.score;
        el.efficiencyVal.textContent = state.efficiency + "%";
        if (state.efficiency < 50) el.efficiencyVal.style.color = 'var(--neon-red)';
    }

    function endGame(win, msg) {
        state.gameOver = true;
        el.itemSpawner.innerHTML = '';
        el.finalResult.textContent = msg;
        el.nextBtn.textContent = win ? "FINISH" : "RETRY";
        el.resultScreen.classList.remove('hidden');
    }

    init();
})();
