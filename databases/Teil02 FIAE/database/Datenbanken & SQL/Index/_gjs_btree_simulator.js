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
        title: document.getElementById('mission-title'),
        desc: document.getElementById('mission-desc'),
        valLinear: document.getElementById('val-linear'),
        valIndex: document.getElementById('val-index'),
        markerLinear: document.getElementById('marker-linear'),
        treeArea: document.getElementById('tree-area'),
        btnStart: document.getElementById('btn-start'),
        overlay: document.getElementById('overlay'),
        resLinear: document.getElementById('res-linear'),
        resIndex: document.getElementById('res-index'),
        factorBadge: document.getElementById('factor-badge'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(freq, duration = 0.1, type = 'sine') {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_btree_simulator.json');
            state.config = await resp.json();

            el.btnStart.onclick = startRace;
            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                startLevel(state.levelIdx + 1);
            };

            startLevel(0);
        } catch (e) { console.error(e); }
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            location.reload();
            return;
        }
        state.levelIdx = idx;
        state.linearSteps = 0;
        state.indexSteps = 0;
        state.isRacing = false;

        el.valLinear.textContent = '0';
        el.valIndex.textContent = '0';
        el.markerLinear.style.left = '0%';
        el.btnStart.disabled = false;

        const lv = state.config.levels[idx];
        el.title.textContent = `INDEX_OP // ${lv.title}`;
        el.desc.textContent = lv.description;

        renderTree(lv.tree);
    }

    function renderTree(tree) {
        el.treeArea.innerHTML = '';
        const w = el.treeArea.offsetWidth;
        drawNode(tree, w / 2, 40, w / 4);
    }

    function drawNode(node, x, y, offset) {
        if (!node) return;

        const div = document.createElement('div');
        div.className = 'node';
        if (node.values) div.classList.add('leaf');
        div.style.left = `${x - 35}px`;
        div.style.top = `${y}px`;
        div.textContent = node.value || (node.values ? node.values.join(',') : '?');

        if (node.value) div.dataset.val = node.value;
        else if (node.values) div.dataset.vals = node.values.join(',');

        el.treeArea.appendChild(div);

        if (node.left) drawNode(node.left, x - offset, y + 80, offset / 2);
        if (node.right) drawNode(node.right, x + offset, y + 80, offset / 2);
    }

    async function startRace() {
        if (state.isRacing) return;
        state.isRacing = true;
        el.btnStart.disabled = true;

        const lv = state.config.levels[state.levelIdx];

        // Start simulations
        const linearP = animateLinear(lv.targetId, lv.datasetSize);
        const indexP = animateIndex(lv.targetId, lv.tree);

        await Promise.all([linearP, indexP]);

        const factor = (state.linearSteps / state.indexSteps).toFixed(1);
        el.resLinear.textContent = state.linearSteps;
        el.resIndex.textContent = state.indexSteps;
        el.factorBadge.textContent = `${factor}x FASTER`;

        setTimeout(() => {
            playSound(880, 0.5, 'square');
            el.overlay.classList.remove('hidden');
        }, 1000);
    }

    async function animateLinear(targetId, size) {
        const speed = size > 500 ? 5 : 20;
        for (let i = 1; i <= targetId; i++) {
            state.linearSteps = i;
            el.valLinear.textContent = i;
            el.markerLinear.style.left = `${(i / size) * 100}%`;

            if (i % 20 === 0 || i === targetId) playSound(220, 0.05, 'sawtooth');
            await new Promise(r => setTimeout(r, speed));
        }
    }

    async function animateIndex(targetId, tree) {
        let curr = tree;
        while (curr) {
            state.indexSteps++;
            el.valIndex.textContent = state.indexSteps;

            const selector = curr.value ? `.node[data-val="${curr.value}"]` : `.node[data-vals*="${targetId}"]`;
            const nodeEl = el.treeArea.querySelector(selector);

            if (nodeEl) {
                nodeEl.classList.add('active');
                playSound(660, 0.2);
                await new Promise(r => setTimeout(r, 600));
            }

            if (curr.values && curr.values.includes(targetId)) break;
            if (curr.value === targetId) break;

            curr = (targetId < curr.value) ? curr.left : curr.right;
            if (!curr) break;
        }
    }

    init();
})();
