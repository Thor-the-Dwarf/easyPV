(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        linearSteps: 0,
        indexSteps: 0,
        isRacing: false
    };

    const el = {
        missionTitle: document.getElementById('mission-title'),
        missionDesc: document.getElementById('mission-desc'),
        valLinear: document.getElementById('val-linear'),
        valIndex: document.getElementById('val-index'),
        markerLinear: document.getElementById('marker-linear'),
        treeArea: document.getElementById('tree-area'),
        btnStart: document.getElementById('btn-start'),
        resultOverlay: document.getElementById('result-overlay'),
        resLinear: document.getElementById('res-linear'),
        resIndex: document.getElementById('res-index'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTick(freq = 400, type = 'sine') {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }

    async function init() {
        try {
            const resp = await fetch('game_btree_simulator.json');
            state.config = await resp.json();

            el.btnStart.addEventListener('click', startRace);
            el.btnNext.addEventListener('click', () => {
                el.resultOverlay.classList.add('hidden');
                if (state.levelIdx < state.config.levels.length - 1) {
                    startLevel(state.levelIdx + 1);
                } else {
                    location.reload();
                }
            });

            startLevel(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        state.linearSteps = 0;
        state.indexSteps = 0;
        state.isRacing = false;

        el.valLinear.textContent = '0';
        el.valIndex.textContent = '0';
        el.markerLinear.style.left = '0%';
        el.btnStart.disabled = false;

        const level = state.config.levels[idx];
        el.missionTitle.textContent = level.title;
        el.missionDesc.textContent = level.description;

        renderTree(level.tree);
    }

    function renderTree(tree) {
        el.treeArea.innerHTML = '';
        const containerWidth = el.treeArea.offsetWidth;
        const containerHeight = el.treeArea.offsetHeight;

        // Simple visual tree rendering (not a full layout engine)
        drawNode(tree, containerWidth / 2, 40, containerWidth / 4, 1);
    }

    function drawNode(node, x, y, offset, depth) {
        if (!node) return;

        const div = document.createElement('div');
        div.className = 'node';
        if (node.values) div.classList.add('leaf');
        div.style.left = `${x - 30}px`;
        div.style.top = `${y}px`;
        div.textContent = node.value || (node.values ? node.values.join(',') : '?');

        if (node.value) div.dataset.val = node.value;
        else if (node.values) div.dataset.vals = node.values.join(',');

        el.treeArea.appendChild(div);

        if (node.left) drawNode(node.left, x - offset, y + 80, offset / 1.8, depth + 1);
        if (node.right) drawNode(node.right, x + offset, y + 80, offset / 1.8, depth + 1);
    }

    async function startRace() {
        if (state.isRacing) return;
        state.isRacing = true;
        el.btnStart.disabled = true;

        const level = state.config.levels[state.levelIdx];

        // Run searches in "parallel" visually (simplified)
        const linearPromise = animateLinear(level.targetId, level.datasetSize);
        const indexPromise = animateIndex(level.targetId, level.tree);

        await Promise.all([linearPromise, indexPromise]);

        setTimeout(() => {
            el.resLinear.textContent = state.linearSteps;
            el.resIndex.textContent = state.indexSteps;
            el.resultOverlay.classList.remove('hidden');
            playTick(800, 'square');
        }, 1000);
    }

    async function animateLinear(targetId, size) {
        // Linear scan simulation
        const speed = size > 100 ? 5 : 50; // Faster for large datasets
        for (let i = 1; i <= targetId; i++) {
            state.linearSteps = i;
            el.valLinear.textContent = i;
            el.markerLinear.style.left = `${(i / size) * 100}%`;

            if (i % (size / 10 || 1) === 0 || size < 100) playTick(200);
            await new Promise(r => setTimeout(r, speed));
        }
    }

    async function animateIndex(targetId, tree) {
        // B-Tree seek simulation
        let current = tree;
        while (current) {
            state.indexSteps++;
            el.valIndex.textContent = state.indexSteps;

            // Highlight node
            let selector = current.value ? `.node[data-val="${current.value}"]` : `.node[data-vals*="${targetId}"]`;
            let nodeEl = el.treeArea.querySelector(selector);
            if (nodeEl) {
                nodeEl.classList.add('active');
                playTick(600);
                await new Promise(r => setTimeout(r, 600));
            }

            // Logic
            if (current.values && current.values.includes(targetId)) break;
            if (current.value === targetId) break;

            if (targetId < current.value) current = current.left;
            else current = current.right;

            if (!current) break;
        }
    }

    init();
})();
