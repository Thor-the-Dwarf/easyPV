(function () {
    'use strict';

    const state = {
        config: null,
        score: 0,
        stability: 100,
        components: [],
        currentComponent: null,
        gameOver: false
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudStability: document.getElementById('stability-val'),
        craneArea: document.getElementById('crane-area'),
        layers: document.querySelectorAll('.layer-floor'),
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

        if (type === 'snap') {
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'crack') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.linearRampToValueAtTime(40, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_layer_sorter.json');
            state.config = await resp.json();

            el.restartBtn.addEventListener('click', restartGame);
            setupDragDrop();

            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function restartGame() {
        state.score = 0;
        state.stability = 100;
        state.gameOver = false;
        state.components = [...state.config.components];
        shuffle(state.components);

        // Clear layers
        el.layers.forEach(l => {
            const container = l.querySelector('.blocks-container');
            if (container) container.innerHTML = '';
            l.classList.remove('error');
        });

        el.resultScreen.classList.add('hidden');

        updateHUD();
        spawnComponent();
    }

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function spawnComponent() {
        // Clear old
        const old = el.craneArea.querySelector('.component-box');
        if (old) old.remove();

        if (state.components.length === 0 || state.stability <= 0) {
            endGame(state.stability > 0);
            return;
        }

        const compData = state.components.pop();
        const compEl = document.createElement('div');
        compEl.className = 'component-box';
        compEl.draggable = true;
        compEl.textContent = compData.label;
        compEl.dataset.id = compData.id;
        compEl.dataset.type = compData.type;

        compEl.addEventListener('dragstart', handleDragStart);
        compEl.addEventListener('dragend', handleDragEnd);

        el.craneArea.appendChild(compEl);
        state.currentComponent = compEl;
    }

    let draggedItem = null;

    function handleDragStart(e) {
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        draggedItem = null;
        el.layers.forEach(l => l.classList.remove('drag-over'));
    }

    function setupDragDrop() {
        el.layers.forEach(layer => {
            layer.addEventListener('dragover', e => {
                e.preventDefault();
                layer.classList.add('drag-over');
            });

            layer.addEventListener('dragleave', e => {
                layer.classList.remove('drag-over');
            });

            layer.addEventListener('drop', e => {
                e.preventDefault();
                layer.classList.remove('drag-over');
                if (draggedItem) {
                    const compType = draggedItem.dataset.type;
                    const layerType = layer.dataset.id;

                    if (compType === layerType) {
                        successDrop(draggedItem, layer);
                    } else {
                        failDrop(draggedItem, layer);
                    }
                }
            });
        });
    }

    function successDrop(comp, layer) {
        state.score += 100;
        playTone('snap');

        // Visuals
        const block = document.createElement('div');
        block.className = 'installed-block';
        block.textContent = comp.textContent;

        const container = layer.querySelector('.blocks-container');
        container.appendChild(block);

        comp.remove();
        updateHUD();

        setTimeout(spawnComponent, 500);
    }

    function failDrop(comp, layer) {
        state.stability = Math.max(0, state.stability - 20);
        playTone('crack');

        layer.classList.add('error');
        setTimeout(() => layer.classList.remove('error'), 500);

        updateHUD();
        if (state.stability <= 0) endGame(false);
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudStability.textContent = state.stability + '%';
        el.hudStability.style.color = state.stability > 50 ? 'var(--neon-blue)' : 'var(--error-red)';
    }

    function endGame(win) {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "Structure Stable!" : "Collapsing!";
        el.resultScreen.classList.remove('hidden');
    }

    init();
})();
