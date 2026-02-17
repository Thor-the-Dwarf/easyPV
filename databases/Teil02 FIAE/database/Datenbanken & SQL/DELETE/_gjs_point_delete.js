(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        selectedId: null,
        isComplete: false
    };

    const el = {
        mission: document.getElementById('mission-text'),
        list: document.getElementById('record-list'),
        btnDelete: document.getElementById('btn-delete'),
        whereClause: document.getElementById('where-clause'),
        overlay: document.getElementById('overlay'),
        btnNext: document.getElementById('btn-next'),
        status: document.getElementById('status-val')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'beep') {
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'shred') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(60, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_point_delete.json');
            state.config = await resp.json();

            el.btnDelete.onclick = executeDelete;
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
        state.selectedId = null;
        state.isComplete = false;
        el.btnDelete.disabled = true;
        el.whereClause.innerHTML = `WHERE id = <b>?</b>`;
        el.status.textContent = 'READY_FOR_OPERATION';

        const lv = state.config.levels[idx];
        el.mission.textContent = `TARGET_PROFILE: ${lv.description}`;

        renderRecords(lv.data);
    }

    function renderRecords(data) {
        el.list.innerHTML = '';
        data.forEach(row => {
            const div = document.createElement('div');
            div.className = 'record-row';
            if (row.locked) div.classList.add('locked');

            let attrsHtml = '';
            for (const [k, v] of Object.entries(row)) {
                if (k !== 'id' && k !== 'locked' && k !== 'reason') {
                    attrsHtml += `
                <div class="attribute">
                    <span class="attr-key">${k}</span>
                    <span class="attr-val">${v}</span>
                </div>`;
                }
            }

            div.innerHTML = `
        <div class="col-id">#${row.id}</div>
        <div class="col-data">${attrsHtml}</div>
        ${row.locked ? `<div class="constraint-badge">CASCADE_RESTRICT</div>` : ''}
      `;

            div.onclick = () => selectRow(row, div);
            el.list.appendChild(div);
        });
    }

    function selectRow(row, rowEl) {
        if (state.isComplete) return;

        const all = document.querySelectorAll('.record-row');
        all.forEach(r => r.classList.remove('selected'));

        if (row.locked) {
            playSound('error');
            rowEl.classList.add('shake');
            setTimeout(() => rowEl.classList.remove('shake'), 400);
            el.status.textContent = `INTEGRITY_HALT: ${row.reason}`;
            state.selectedId = null;
            el.btnDelete.disabled = true;
            el.whereClause.innerHTML = `WHERE id = <b>?</b>`;
            return;
        }

        playSound('beep');
        rowEl.classList.add('selected');
        state.selectedId = row.id;
        el.btnDelete.disabled = false;
        el.whereClause.innerHTML = `WHERE id = <b>${row.id}</b>`;
        el.status.textContent = 'TARGET_ACQUIRED';
    }

    function executeDelete() {
        if (!state.selectedId || state.isComplete) return;

        const lv = state.config.levels[state.levelIdx];
        if (state.selectedId !== lv.target.id) {
            playSound('error');
            el.status.textContent = 'ERROR: COLLATERAL_DAMAGE_PREVENTED';
            const rows = document.querySelectorAll('.record-row');
            rows.forEach(r => r.classList.add('shake'));
            setTimeout(() => rows.forEach(r => r.classList.remove('shake')), 400);
            return;
        }

        state.isComplete = true;
        playSound('shred');
        el.status.textContent = 'ELIMINATING_RECORD...';

        const selectedRow = document.querySelector('.record-row.selected');
        selectedRow.classList.add('fade-out');

        setTimeout(() => {
            el.overlay.classList.remove('hidden');
        }, 1000);
    }

    init();
})();
