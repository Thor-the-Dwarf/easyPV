(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        isUnionAll: false,
        dragY: 0,
        startRailY: 0,
        isSynced: false
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        levelDesc: document.getElementById('level-desc'),
        railA: document.getElementById('rail-a'),
        railB: document.getElementById('rail-b'),
        btnUnion: document.getElementById('btn-union'),
        btnUnionAll: document.getElementById('btn-union-all'),
        overlay: document.getElementById('overlay'),
        resultReason: document.getElementById('result-reason'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'snap') {
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'bounce') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_union_compat.json');
            state.config = await resp.json();

            setupInteractions();
            startLevel(0);
        } catch (e) {
            console.error(e);
        }
    }

    function setupInteractions() {
        el.railB.addEventListener('mousedown', startDrag);
        el.railB.addEventListener('touchstart', startDrag);

        window.addEventListener('mousemove', drag);
        window.addEventListener('touchmove', drag);

        window.addEventListener('mouseup', stopDrag);
        window.addEventListener('touchend', stopDrag);

        el.btnUnion.addEventListener('click', () => setMode(false));
        el.btnUnionAll.addEventListener('click', () => setMode(true));

        el.btnNext.addEventListener('click', () => {
            if (state.levelIdx < state.config.levels.length - 1) {
                startLevel(state.levelIdx + 1);
            } else {
                location.reload();
            }
        });
    }

    function setMode(isAll) {
        state.isUnionAll = isAll;
        el.btnUnion.classList.toggle('active', !isAll);
        el.btnUnionAll.classList.toggle('active', isAll);
        playSound('snap');
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        state.isSynced = false;
        const level = state.config.levels[idx];

        el.levelTitle.textContent = level.title;
        el.levelDesc.textContent = level.description;
        el.overlay.classList.add('hidden');

        renderRail(el.railA, level.queryA);
        renderRail(el.railB, level.queryB);

        el.railB.style.transform = 'translateY(0)';
        el.railA.classList.remove('synced');
        el.railB.classList.remove('synced');
    }

    function renderRail(rail, query) {
        rail.querySelector('.query-label').textContent = query.label;
        const set = rail.querySelector('.column-set');
        set.innerHTML = '';
        query.columns.forEach(col => {
            const b = document.createElement('div');
            b.className = 'type-badge';
            b.dataset.type = col.type;
            b.textContent = col.type;
            set.appendChild(b);
        });
    }

    let isDragging = false;
    function startDrag(e) {
        if (state.isSynced) return;
        isDragging = true;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        state.dragY = clientY;
    }

    function drag(e) {
        if (!isDragging) return;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        const delta = clientY - state.dragY;

        // Only allow upward drag towards rail A
        const move = Math.min(0, delta);
        if (move < -200) return; // Limit

        el.railB.style.transform = `translateY(${move}px)`;

        // Check for proximity
        if (move < -80) {
            checkProximity();
        }
    }

    function checkProximity() {
        const level = state.config.levels[state.levelIdx];
        if (level.compatible) {
            syncSuccess();
        } else {
            syncFail();
        }
    }

    function syncSuccess() {
        isDragging = false;
        state.isSynced = true;
        el.railB.style.transform = 'translateY(-100px)'; // Snap point
        el.railA.classList.add('synced');
        el.railB.classList.add('synced');
        playSound('snap');

        showOverlay(true);
    }

    function syncFail() {
        isDragging = false;
        el.railB.classList.add('shake');
        playSound('bounce');

        // Bounce back
        setTimeout(() => {
            el.railB.style.transform = 'translateY(0)';
            el.railB.classList.remove('shake');
            showOverlay(false);
        }, 400);
    }

    function showOverlay(success) {
        const level = state.config.levels[state.levelIdx];
        el.resultReason.textContent = level.reason;

        if (success) {
            setTimeout(() => {
                el.overlay.classList.remove('hidden');
            }, 800);
        } else {
            // Just show reason de-brief even if it failed?
            // Let's only show overlay on success, or after few attempts
            // Requirement: "Bounce back" already gives feedback.
        }
    }

    function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        if (!state.isSynced) {
            el.railB.style.transform = 'translateY(0)';
        }
    }

    init();
})();
