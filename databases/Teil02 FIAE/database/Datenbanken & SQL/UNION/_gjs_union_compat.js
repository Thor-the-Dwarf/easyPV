(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        isUnionAll: false,
        isFused: false,
        dragY: 0,
        originY: 0,
        score: 0,
        integrity: 100
    };

    const el = {
        title: document.getElementById('level-title'),
        poleN: document.getElementById('pole-n'),
        poleS: document.getElementById('pole-s'),
        operator: document.getElementById('op-toggle'),
        score: document.getElementById('score-val'),
        integrity: document.getElementById('integrity-val'),
        overlay: document.getElementById('overlay'),
        resFinal: document.getElementById('res-final'),
        btnNext: document.getElementById('btn-next'),
        chamber: document.querySelector('.fusion-chamber')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(freq, type = 'sine', duration = 0.2) {
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
            const resp = await fetch('_data/_gg01_union_compat.json');
            state.config = await resp.json();

            el.operator.onclick = toggleOperator;
            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                startLevel(state.levelIdx + 1);
            };

            initDraggable();
            startLevel(0);
        } catch (e) { console.error(e); }
    }

    function toggleOperator() {
        state.isUnionAll = !state.isUnionAll;
        el.operator.textContent = state.isUnionAll ? 'UNION ALL' : 'UNION';
        playSound(600, 'square', 0.1);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            location.reload();
            return;
        }
        state.levelIdx = idx;
        state.isFused = false;
        state.integrity = 100;

        // Reset positions
        el.poleS.style.transform = `translateY(0)`;
        el.poleS.classList.remove('fuse-glow');
        el.poleN.classList.remove('fuse-glow');

        const lv = state.config.levels[idx];
        el.title.textContent = `REACTOR_CORE_//_SEQ_${lv.id || 'X'}`;

        renderPoles(lv);
        updateHUD();
    }

    function renderPoles(lv) {
        el.poleN.innerHTML = '';
        el.poleS.innerHTML = '';

        lv.queryA.columns.forEach(col => el.poleN.appendChild(createNode(col)));
        lv.queryB.columns.forEach(col => el.poleS.appendChild(createNode(col)));
    }

    function createNode(col) {
        const div = document.createElement('div');
        div.className = `column-node type-${col.type.toLowerCase()}`;
        div.innerHTML = `
        <div class="node-label">${col.name}</div>
        <div class="node-type">${col.type.toUpperCase()}</div>
      `;
        return div;
    }

    function initDraggable() {
        let isDragging = false;
        let startY = 0;

        const onStart = (e) => {
            if (state.isFused) return;
            isDragging = true;
            startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
            el.poleS.style.transition = 'none';
        };

        const onMove = (e) => {
            if (!isDragging) return;
            const currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startY;

            // Clamp to move upwards
            const moveY = Math.min(0, deltaY);
            el.poleS.style.transform = `translateY(${moveY}px)`;

            checkFusion(moveY);
        };

        const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            if (!state.isFused) {
                el.poleS.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                el.poleS.style.transform = `translateY(0)`;
            }
        };

        el.poleS.addEventListener('mousedown', onStart);
        el.poleS.addEventListener('touchstart', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);
    }

    function checkFusion(y) {
        // Logic: if dist < 50px, try to fuse
        const threshold = -160;
        if (y < threshold && !state.isFused) {
            validateFusion();
        }
    }

    function validateFusion() {
        const lv = state.config.levels[state.levelIdx];
        const colsA = lv.queryA.columns;
        const colsB = lv.queryB.columns;

        let compatible = true;
        if (colsA.length !== colsB.length) compatible = false;
        else {
            for (let i = 0; i < colsA.length; i++) {
                if (colsA[i].type !== colsB[i].type) compatible = false;
            }
        }

        if (compatible) {
            executeFusion();
        } else {
            abortFusion();
        }
    }

    function executeFusion() {
        state.isFused = true;
        playSound(880, 'square', 0.4);
        el.poleS.style.transform = `translateY(-200px)`;
        el.poleS.classList.add('fuse-glow');
        el.poleN.classList.add('fuse-glow');

        state.score += 100;
        updateHUD();

        createSparks();
        setTimeout(() => endGame("FUSION_STABLE"), 1000);
    }

    function abortFusion() {
        state.isFused = true; // Temporary lock
        playSound(110, 'sawtooth', 0.5);
        el.poleS.classList.add('shake');
        state.integrity -= 25;
        updateHUD();

        setTimeout(() => {
            el.poleS.classList.remove('shake');
            el.poleS.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            el.poleS.style.transform = `translateY(0)`;
            state.isFused = false;
            if (state.integrity <= 0) endGame("REACTOR_MELTDOWN");
        }, 500);
    }

    function createSparks() {
        for (let i = 0; i < 20; i++) {
            const spark = document.createElement('div');
            spark.className = 'electric-spark';
            spark.style.left = `${50 + (Math.random() - 0.5) * 80}%`;
            spark.style.top = `40%`;
            el.chamber.appendChild(spark);
            setTimeout(() => spark.remove(), 400);
        }
    }

    function updateHUD() {
        el.score.textContent = state.score;
        el.integrity.textContent = `${state.integrity}%`;
        el.integrity.style.color = state.integrity < 40 ? 'var(--magnetic-red)' : 'var(--magnetic-blue)';
    }

    function endGame(msg) {
        el.resFinal.textContent = msg;
        el.overlay.classList.remove('hidden');
    }

    init();
})();
