(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        filledSlots: 0,
        isComplete: false,
        selectedCrate: null // For tap-mapping
    };

    const el = {
        title: document.getElementById('level-title'),
        ramp: document.getElementById('loading-ramp'),
        yard: document.getElementById('package-yard'),
        syntax: document.getElementById('syntax-line'),
        overlay: document.getElementById('overlay'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'clunk') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'buzz') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'truck') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(150, audioCtx.currentTime + 1);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 1.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_g01_value_match.json');
            state.config = await resp.json();

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
        state.filledSlots = 0;
        state.isComplete = false;
        state.selectedCrate = null;

        const lv = state.config.levels[idx];
        el.title.textContent = `LOADING_UNIT // ${lv.title}`;
        el.ramp.classList.remove('drive-away');

        renderDock(lv);
        renderYard(lv);
        updateSyntax(lv);
    }

    function renderDock(lv) {
        el.ramp.innerHTML = '';
        lv.columns.forEach((col, i) => {
            const bay = document.createElement('div');
            bay.className = 'column-bay';
            bay.innerHTML = `
        <div class="bay-header">
          <div class="bay-name">${col.name}</div>
          <div class="bay-type">${col.type}</div>
        </div>
        <div class="drop-zone" data-type="${col.type}" data-idx="${i}">
           <div style="font-size: 2rem; opacity: 0.1;">${col.icon || '📦'}</div>
        </div>
      `;

            const zone = bay.querySelector('.drop-zone');
            zone.ondragover = e => { e.preventDefault(); zone.classList.add('hover'); };
            zone.ondragleave = () => zone.classList.remove('hover');
            zone.ondrop = e => handleDrop(e, zone);
            zone.onclick = () => handleBayClick(zone);

            el.ramp.appendChild(bay);
        });
    }

    function renderYard(lv) {
        el.yard.innerHTML = '';
        const shuffled = [...lv.packages].sort(() => Math.random() - 0.5);

        shuffled.forEach(pkg => {
            const crate = document.createElement('div');
            crate.className = 'data-crate';
            crate.draggable = true;
            crate.textContent = pkg.label;
            crate.dataset.type = pkg.type;

            crate.ondragstart = e => {
                e.dataTransfer.setData('application/json', JSON.stringify(pkg));
                crate.style.opacity = '0.5';
            };
            crate.ondragend = () => crate.style.opacity = '1';

            crate.onclick = (e) => {
                e.stopPropagation();
                selectCrate(pkg, crate);
            };

            el.yard.appendChild(crate);
        });
    }

    function selectCrate(pkg, crateEl) {
        if (state.selectedCrate && state.selectedCrate.el === crateEl) {
            crateEl.style.boxShadow = '5px 5px 0 #5d2b00';
            state.selectedCrate = null;
        } else {
            if (state.selectedCrate) state.selectedCrate.el.style.boxShadow = '5px 5px 0 #5d2b00';
            state.selectedCrate = { pkg, el: crateEl };
            crateEl.style.boxShadow = '0 0 20px var(--warning-yellow)';
        }
    }

    function handleBayClick(zone) {
        if (state.selectedCrate && !zone.classList.contains('filled')) {
            const pkg = state.selectedCrate.pkg;
            if (pkg.type === zone.dataset.type) {
                acceptPackage(zone, pkg, state.selectedCrate.el);
                state.selectedCrate = null;
            } else {
                rejectPackage(zone, state.selectedCrate.el);
            }
        }
    }

    function handleDrop(e, zone) {
        e.preventDefault();
        zone.classList.remove('hover');
        const pkg = JSON.parse(e.dataTransfer.getData('application/json'));

        if (pkg.type === zone.dataset.type) {
            // Find the crate element that was dragged
            const crates = document.querySelectorAll('.data-crate');
            const crateEl = [...crates].find(c => c.textContent === pkg.label);
            acceptPackage(zone, pkg, crateEl);
        } else {
            rejectPackage(zone);
        }
    }

    function acceptPackage(zone, pkg, crateEl) {
        if (zone.classList.contains('filled')) return;

        playSound('clunk');
        zone.classList.add('filled');
        zone.innerHTML = `<div class="data-crate" style="width:100%; height:100%; margin:0; cursor:default;">${pkg.label}</div>`;
        if (crateEl) crateEl.remove();

        state.filledSlots++;
        updateSyntaxValue(zone.dataset.idx, pkg.label);
        checkWin();
    }

    function rejectPackage(zone, crateEl) {
        playSound('buzz');
        zone.classList.add('shake');
        setTimeout(() => zone.classList.remove('shake'), 400);

        if (crateEl) {
            crateEl.classList.add('bounce');
            setTimeout(() => crateEl.classList.remove('bounce'), 500);
        }
    }

    function updateSyntax(lv) {
        const cols = lv.columns.map(c => c.name).join(', ');
        el.syntax.innerHTML = `
      <span class="syntax-keyword">INSERT INTO</span> ${lv.tableName} (${cols}) 
      <span class="syntax-keyword">VALUES</span> (
      ${lv.columns.map((c, i) => `<span id="val-${i}" class="syntax-val">?</span>`).join(', ')}
      );
    `;
    }

    function updateSyntaxValue(idx, val) {
        const slot = document.getElementById(`val-${idx}`);
        if (slot) slot.textContent = val;
    }

    function checkWin() {
        const lv = state.config.levels[state.levelIdx];
        if (state.filledSlots === lv.columns.length) {
            state.isComplete = true;
            setTimeout(() => {
                playSound('truck');
                el.ramp.classList.add('drive-away');
                setTimeout(() => el.overlay.classList.remove('hidden'), 1500);
            }, 500);
        }
    }

    init();
})();
