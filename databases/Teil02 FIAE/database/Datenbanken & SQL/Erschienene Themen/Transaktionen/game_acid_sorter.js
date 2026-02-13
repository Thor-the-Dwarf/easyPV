(function () {
    'use strict';

    const state = {
        config: null,
        points: 0,
        totalToSort: 0,
        sortedCount: 0
    };

    const el = {
        integrityScore: document.getElementById('integrity-score'),
        pillarGrid: document.getElementById('pillar-grid'),
        quarry: document.getElementById('quarry'),
        overlay: document.getElementById('result-overlay'),
        flash: document.getElementById('flash-effect')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'sort') {
            osc.frequency.setValueAtTime(500, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'crash') {
            osc.type = 'brown';
            // Simplified noise
            osc.frequency.setValueAtTime(60, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
            osc.start();
            osc.stop(audioCtx.currentTime + 1);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_acid_sorter.json');
            state.config = await resp.json();
            state.totalToSort = state.config.definitions.length;

            initPillars();
            initDefinitions();

            document.getElementById('btn-restart').addEventListener('click', () => location.reload());
        } catch (e) {
            console.error(e);
        }
    }

    function initPillars() {
        el.pillarGrid.innerHTML = '';
        state.config.pillars.forEach(p => {
            const div = document.createElement('div');
            div.className = 'pillar';
            div.dataset.id = p.id;
            div.innerHTML = `
        <div class="pillar-header">
          <span class="pillar-id">${p.id}</span>
          <span class="pillar-name">${p.name}</span>
          <div style="font-size:0.6rem; color:var(--gold-glow); margin-top:5px;">${p.slogan}</div>
        </div>
        <div class="pillar-slots" id="slots-${p.id}"></div>
      `;
            setupDropTarget(div);
            el.pillarGrid.appendChild(div);
        });
    }

    function initDefinitions() {
        el.quarry.innerHTML = '';
        const shuffled = [...state.config.definitions].sort(() => Math.random() - 0.5);
        shuffled.forEach((def, idx) => {
            const stone = document.createElement('div');
            stone.className = 'definition-stone';
            stone.textContent = def.text;
            stone.draggable = true;
            stone.id = `def-${idx}`;
            stone.dataset.pillar = def.pillar;

            stone.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', stone.id);
            });
            el.quarry.appendChild(stone);
        });
    }

    function setupDropTarget(target) {
        target.addEventListener('dragover', (e) => {
            e.preventDefault();
            target.classList.add('highlight');
        });

        target.addEventListener('dragleave', () => target.classList.remove('highlight'));

        target.addEventListener('drop', (e) => {
            e.preventDefault();
            target.classList.remove('highlight');

            const id = e.dataTransfer.getData('text/plain');
            const stone = document.getElementById(id);
            const targetPillar = target.dataset.id;

            if (stone.dataset.pillar === targetPillar) {
                handleSuccess(target, stone);
            } else {
                handleError(target);
            }
        });
    }

    function handleSuccess(pillar, stone) {
        playSound('sort');
        stone.classList.add('sorted');
        stone.draggable = false;
        pillar.querySelector('.pillar-slots').appendChild(stone);

        state.sortedCount++;
        updateIntegrity();

        // Check pillar completion
        const slots = pillar.querySelector('.pillar-slots');
        const reqPerPillar = state.totalToSort / 4;
        if (slots.children.length >= reqPerPillar) {
            pillar.classList.add('completed');
        }

        if (state.sortedCount === state.totalToSort) {
            triggerEndSequence();
        }
    }

    function handleError(pillar) {
        playSound('error');
        pillar.classList.add('shake');
        setTimeout(() => pillar.classList.remove('shake'), 400);
    }

    function updateIntegrity() {
        const percent = Math.floor((state.sortedCount / state.totalToSort) * 100);
        el.integrityScore.textContent = `${percent}%`;
    }

    function triggerEndSequence() {
        setTimeout(async () => {
            // Simulate Stresstest
            el.flash.classList.add('crash-anim');
            playSound('crash');

            setTimeout(() => {
                el.overlay.classList.remove('hidden');
            }, 1000);
        }, 800);
    }

    init();
})();
