(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        activeLink: null, // { fromEl, toEl }
        isComplete: false
    };

    const el = {
        title: document.getElementById('level-title'),
        tableA: document.getElementById('table-a'),
        tableB: document.getElementById('table-b'),
        bridge: document.getElementById('bridge-line'),
        preview: document.getElementById('preview-body'),
        previewHead: document.getElementById('preview-head'),
        overlay: document.getElementById('overlay'),
        resFinal: document.getElementById('res-final'),
        btnNext: document.getElementById('btn-next'),
        canvas: document.querySelector('.design-canvas')
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
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    async function init() {
        try {
            const resp = await fetch('_g01_join_puzzle.json');
            state.config = await resp.json();

            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                startLevel(state.levelIdx + 1);
            };

            window.onresize = updateBridge;
            startLevel(0);
        } catch (e) { console.error(e); }
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            location.reload();
            return;
        }
        state.levelIdx = idx;
        state.activeLink = null;
        state.isComplete = false;

        el.bridge.setAttribute('d', '');
        el.preview.innerHTML = '';
        el.previewHead.innerHTML = '';

        const lv = state.config.levels[idx];
        el.title.textContent = `DESIGN_PHASE_//_JOIN_${lv.id}`;

        renderTable(el.tableA, lv.tableA);
        renderTable(el.tableB, lv.tableB);
    }

    function renderTable(container, data) {
        container.innerHTML = `<div class="table-header">${data.name.toUpperCase()}</div>`;
        data.columns.forEach(col => {
            const row = document.createElement('div');
            row.className = 'table-row';
            row.innerHTML = `
            <span>${col.name}</span>
            <div class="key-slot key-${col.type.toLowerCase()}" 
                 data-table="${data.name}" 
                 data-col="${col.name}" 
                 data-type="${col.type}">
                 ${col.type === 'DATA' ? '' : (col.type === 'PK' ? '🔒' : '🔑')}
            </div>
          `;

            if (col.type !== 'DATA') {
                const slot = row.querySelector('.key-slot');
                slot.onclick = () => handleSlotClick(slot);
            }
            container.appendChild(row);
        });
    }

    function handleSlotClick(slotEl) {
        if (state.isComplete) return;

        const type = slotEl.dataset.type;
        const table = slotEl.dataset.table;

        if (!state.activeLink) {
            // Start link from A (usually PK)
            state.activeLink = { from: slotEl };
            slotEl.classList.add('selected');
            playSound(600, 'sine', 0.1);
        } else {
            // Finish link
            const fromEl = state.activeLink.from;
            if (fromEl === slotEl) {
                state.activeLink = null;
                slotEl.classList.remove('selected');
                return;
            }

            if (fromEl.dataset.table === table) {
                // Same table error
                playSound(150, 'sawtooth');
                return;
            }

            validateJoin(fromEl, slotEl);
        }
    }

    function validateJoin(from, to) {
        const lv = state.config.levels[state.levelIdx];
        const link = `${from.dataset.table}.${from.dataset.col} -> ${to.dataset.table}.${to.dataset.col}`;
        const expected = lv.expected;

        // Check if matches expected PK -> FK
        const match = (from.dataset.table + "." + from.dataset.col === expected.from &&
            to.dataset.table + "." + to.dataset.col === expected.to) ||
            (from.dataset.table + "." + from.dataset.col === expected.to &&
                to.dataset.table + "." + to.dataset.col === expected.from);

        if (match) {
            state.activeLink = { from, to };
            updateBridge();
            renderJoinResult();
            executeSuccess();
        } else {
            playSound(150, 'sawtooth');
            alert("RELATIONAL_ERROR: KEYS_DO_NOT_CORRELATE");
            state.activeLink.from.classList.remove('selected');
            state.activeLink = null;
        }
    }

    function updateBridge() {
        if (!state.activeLink || !state.activeLink.to) return;

        const f = state.activeLink.from.getBoundingClientRect();
        const t = state.activeLink.to.getBoundingClientRect();
        const c = el.canvas.getBoundingClientRect();

        const x1 = f.left + f.width / 2 - c.left;
        const y1 = f.top + f.height / 2 - c.top;
        const x2 = t.left + t.width / 2 - c.left;
        const y2 = t.top + t.height / 2 - c.top;

        // Bezier curve
        const cp = (x1 + x2) / 2;
        el.bridge.setAttribute('d', `M ${x1} ${y1} C ${cp} ${y1}, ${cp} ${y2}, ${x2} ${y2}`);
    }

    function renderJoinResult() {
        const lv = state.config.levels[state.levelIdx];
        const colsA = lv.tableA.columns;
        const colsB = lv.tableB.columns;

        // Header
        el.previewHead.innerHTML = '<tr></tr>';
        const tr = el.previewHead.querySelector('tr');
        [...colsA, ...colsB].forEach(c => {
            const th = document.createElement('th');
            th.textContent = c.name;
            tr.appendChild(th);
        });

        // Simple Inner Join Logic
        const dataA = lv.tableA.columns.find(c => c.type === 'PK').val;
        const dataB = lv.tableB.columns.find(c => c.type === 'FK').val;

        el.preview.innerHTML = '';
        dataB.forEach((fk, bIdx) => {
            const aIdx = dataA.indexOf(fk);
            if (aIdx !== -1) {
                const row = document.createElement('tr');
                colsA.forEach(c => {
                    const td = document.createElement('td');
                    td.textContent = c.val[aIdx];
                    row.appendChild(td);
                });
                colsB.forEach(c => {
                    const td = document.createElement('td');
                    td.textContent = c.val[bIdx];
                    row.appendChild(td);
                });
                el.preview.appendChild(row);
            }
        });
    }

    function executeSuccess() {
        state.isComplete = true;
        playSound(880, 'triangle', 0.5);

        setTimeout(() => {
            el.resFinal.textContent = "RELATIONAL_INTEGRITY_VERIFIED";
            el.overlay.classList.remove('hidden');
        }, 1500);
    }

    init();
})();
