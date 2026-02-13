(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        itemIdx: 0,
        score: 0,
        efficiency: 100,
        currentItem: null,
        isComplete: false
    };

    const el = {
        title: document.getElementById('level-title'),
        spawner: document.getElementById('item-spawner'),
        slabs: document.getElementById('slabs-grid'),
        score: document.getElementById('score-val'),
        efficiency: document.getElementById('efficiency-val'),
        toast: document.getElementById('feed-toast'),
        overlay: document.getElementById('overlay'),
        resFinal: document.getElementById('res-final'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(freq, type = 'sine', duration = 0.1) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    async function init() {
        try {
            const resp = await fetch('game_type_match.json');
            state.config = await resp.json();

            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                startLevel(state.levelIdx + 1);
            };

            renderSlabs();
            startLevel(0);
        } catch (e) { console.error(e); }
    }

    function renderSlabs() {
        el.slabs.innerHTML = '';
        state.config.slots.forEach(slot => {
            const div = document.createElement('div');
            div.className = 'type-slab';
            div.dataset.id = slot.id;
            div.innerHTML = `
            <div class="slab-title">${slot.label}</div>
            <div class="slab-desc">${slot.description}</div>
          `;

            div.ondragover = e => { e.preventDefault(); div.classList.add('hover'); };
            div.ondragleave = () => div.classList.remove('hover');
            div.ondrop = e => handleDrop(div, slot.id);
            div.onclick = () => { if (state.currentItem) handleSelection(div, slot.id); };

            el.slabs.appendChild(div);
        });
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            location.reload();
            return;
        }
        state.levelIdx = idx;
        state.itemIdx = 0;
        state.isComplete = false;

        const lv = state.config.levels[idx];
        el.title.textContent = `LAB_PROCEDURE // ${lv.title}`;

        spawnItem();
    }

    function spawnItem() {
        const lv = state.config.levels[state.levelIdx];
        if (state.itemIdx >= lv.items.length) {
            startLevel(state.levelIdx + 1);
            return;
        }

        state.currentItem = lv.items[state.itemIdx];
        el.spawner.innerHTML = '';

        const div = document.createElement('div');
        div.className = 'data-item';
        div.textContent = state.currentItem.value;
        div.draggable = true;
        div.ondragstart = e => {
            e.dataTransfer.setData('text/plain', div.textContent);
            div.style.opacity = '0.5';
        };
        div.ondragend = () => div.style.opacity = '1';

        el.spawner.appendChild(div);
    }

    function handleDrop(slab, slotId) {
        slab.classList.remove('hover');
        handleSelection(slab, slotId);
    }

    function handleSelection(slab, slotId) {
        if (!state.currentItem) return;
        const item = state.currentItem;

        if (item.best === slotId) {
            playSound(880);
            showToast("PERFECT_FIT", "var(--green-fit)");
            state.score += 100;
            advanceItem();
        } else if (item.ok.includes(slotId)) {
            playSound(440, 'triangle');
            showToast("INEFFICIENT_ALLOCATION", "var(--gold-primary)");
            state.score += 40;
            state.efficiency -= 10;
            advanceItem();
        } else {
            playSound(110, 'sawtooth', 0.3);
            slab.classList.add('shake');
            setTimeout(() => slab.classList.remove('shake'), 400);
            showToast("TYPE_OVERFLOW_ERROR", "var(--red-overflow)");
            state.score -= 50;
            state.efficiency -= 20;
        }

        updateHUD();
        if (state.efficiency <= 0) endGame("CRITICAL_STORAGE_FAILURE");
    }

    function advanceItem() {
        const itemEl = el.spawner.firstChild;
        if (itemEl) itemEl.classList.add('item-fit');

        state.itemIdx++;
        state.currentItem = null;
        setTimeout(spawnItem, 600);
    }

    function showToast(txt, color) {
        el.toast.textContent = txt;
        el.toast.style.borderColor = color;
        el.toast.style.color = color;
        el.toast.style.display = 'block';
        setTimeout(() => el.toast.style.display = 'none', 1000);
    }

    function updateHUD() {
        el.score.textContent = state.score;
        el.efficiency.textContent = `${state.efficiency}%`;
        el.efficiency.style.color = state.efficiency < 40 ? 'var(--red-overflow)' : 'var(--text-bright)';
    }

    function endGame(msg) {
        el.resFinal.textContent = msg;
        el.overlay.classList.remove('hidden');
    }

    init();
})();
