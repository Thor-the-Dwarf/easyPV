(function () {
    'use strict';

    const state = {
        config: null,
        points: 0,
        totalToSort: 0,
        sortedCount: 0,
        selectedStone: null
    };

    const el = {
        integrityScore: document.getElementById('integrity-score'),
        pillarGrid: document.getElementById('pillar-grid'),
        quarry: document.getElementById('quarry'),
        overlay: document.getElementById('result-overlay'),
        flash: document.getElementById('flash-effect'),
        btnRestart: document.getElementById('btn-restart')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'slam') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'error') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'surge') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.8);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.8);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_acid_sorter.json');
            state.config = await resp.json();
            state.totalToSort = state.config.definitions.length;

            initPillars();
            initQuarry();

            el.btnRestart.onclick = () => location.reload();

            // Tap-to-map fallback
            document.body.onclick = () => { if (state.selectedStone) deselectStone(); };
        } catch (e) { console.error(e); }
    }

    function initPillars() {
        el.pillarGrid.innerHTML = '';
        state.config.pillars.forEach(p => {
            const div = document.createElement('div');
            div.className = 'pillar';
            div.dataset.id = p.id;
            div.innerHTML = `
            <div class="pillar-header">
                <div class="pillar-icon">${p.icon}</div>
                <div class="pillar-name">${p.name}</div>
                <div style="font-size:0.55rem; color:var(--gold-primary); margin-top:5px;">"${p.slogan}"</div>
            </div>
            <div class="pillar-slots" id="slots-${p.id}"></div>
        `;

            div.onclick = (e) => {
                e.stopPropagation();
                if (state.selectedStone) handleDrop(div, state.selectedStone);
            };

            // Drag events
            div.ondragover = e => { e.preventDefault(); div.classList.add('highlight'); };
            div.ondragleave = () => div.classList.remove('highlight');
            div.ondrop = e => {
                e.preventDefault();
                div.classList.remove('highlight');
                const stoneId = e.dataTransfer.getData('text/plain');
                const stone = document.getElementById(stoneId);
                handleDrop(div, stone);
            };

            el.pillarGrid.appendChild(div);
        });
    }

    function initQuarry() {
        el.quarry.innerHTML = '';
        const shuffled = [...state.config.definitions].sort(() => Math.random() - 0.5);
        shuffled.forEach((def, i) => {
            const s = document.createElement('div');
            s.className = 'stone';
            s.id = `stone-${i}`;
            s.textContent = def.text;
            s.dataset.pillar = def.pillar;
            s.draggable = true;

            s.onclick = (e) => {
                e.stopPropagation();
                selectStone(s);
            };

            s.ondragstart = e => {
                e.dataTransfer.setData('text/plain', s.id);
                s.style.opacity = '0.5';
            };
            s.ondragend = () => s.style.opacity = '1';

            el.quarry.appendChild(s);
        });
    }

    function selectStone(s) {
        if (state.selectedStone) state.selectedStone.classList.remove('selected');
        state.selectedStone = s;
        s.classList.add('selected');
        s.style.borderColor = 'var(--gold-primary)';
    }

    function deselectStone() {
        if (state.selectedStone) {
            state.selectedStone.classList.remove('selected');
            state.selectedStone.style.borderColor = '';
        }
        state.selectedStone = null;
    }

    function handleDrop(pillar, stone) {
        if (stone.dataset.pillar === pillar.dataset.id) {
            playSound('slam');
            stone.classList.add('sorted');
            stone.draggable = false;
            stone.onclick = null;
            pillar.querySelector('.pillar-slots').appendChild(stone);

            state.sortedCount++;
            updateIntegrity();
            deselectStone();

            // Final completion check
            if (state.sortedCount === state.totalToSort) triggerStressTest();
        } else {
            playSound('error');
            pillar.classList.add('shake');
            setTimeout(() => pillar.classList.remove('shake'), 400);
        }
    }

    function updateIntegrity() {
        const p = Math.floor((state.sortedCount / state.totalToSort) * 100);
        el.integrityScore.textContent = `${p}%`;
    }

    function triggerStressTest() {
        setTimeout(() => {
            el.flash.classList.add('surge-anim');
            playSound('surge');

            setTimeout(() => {
                el.overlay.classList.remove('hidden');
            }, 1000);
        }, 500);
    }

    init();
})();
