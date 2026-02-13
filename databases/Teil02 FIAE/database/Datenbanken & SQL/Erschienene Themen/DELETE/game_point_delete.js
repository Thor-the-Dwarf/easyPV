(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        selectedId: null
    };

    const el = {
        missionText: document.getElementById('mission-text'),
        recordList: document.getElementById('record-list'),
        btnDelete: document.getElementById('btn-delete'),
        resultOverlay: document.getElementById('result-overlay'),
        finalResult: document.getElementById('final-result'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'select') {
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start();
            osc.stop(now + 0.05);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'shred') {
            // Noise buffer for shredder sound
            const bufferSize = audioCtx.sampleRate * 0.5; // 0.5s
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            const noiseGain = audioCtx.createGain();
            noiseGain.gain.setValueAtTime(0.5, now);
            noiseGain.gain.linearRampToValueAtTime(0, now + 0.5);
            noise.connect(noiseGain);
            noiseGain.connect(audioCtx.destination);
            noise.start();
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_point_delete.json');
            state.config = await resp.json();

            el.btnDelete.addEventListener('click', executeDelete);
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
        state.selectedId = null;
        el.btnDelete.disabled = true;

        const level = state.config.levels[idx];
        el.missionText.textContent = `mission: ${level.description}`;

        renderRecords(level.data);
    }

    function renderRecords(data) {
        el.recordList.innerHTML = '';

        data.forEach(row => {
            const div = document.createElement('div');
            div.className = 'record-row';
            div.dataset.id = row.id;

            if (row.locked) div.classList.add('locked');

            let html = `<div class="col-id">ID:${row.id}</div><div class="col-data">`;
            for (const [k, v] of Object.entries(row)) {
                if (k !== 'id' && k !== 'locked' && k !== 'reason') {
                    html += `<span>${k}: <b>${v}</b></span>`;
                }
            }
            html += `</div>`;

            if (row.locked) {
                html += `<span class="constraint-badge">LOCKED (${row.orders || 'FK'})</span>`;
            }

            div.innerHTML = html;

            div.addEventListener('click', () => selectRow(row.id));
            el.recordList.appendChild(div);
        });
    }

    function selectRow(id) {
        // Find row
        const rows = document.querySelectorAll('.record-row');
        rows.forEach(r => r.classList.remove('selected'));

        const target = document.querySelector(`.record-row[data-id="${id}"]`);
        if (target) target.classList.add('selected');

        state.selectedId = id;
        el.btnDelete.disabled = false;
        playTone('select');
    }

    function executeDelete() {
        if (!state.selectedId) return;

        const level = state.config.levels[state.levelIdx];
        const targetId = level.target.id;

        // Check validation
        if (state.selectedId !== targetId) {
            playTone('error');
            alert("WRONG TARGET! Check the Mission content.");
            return;
        }

        // Check lock
        const rowData = level.data.find(r => r.id === state.selectedId);
        if (rowData.locked) {
            playTone('error');
            alert("INTEGRITY ERROR: " + rowData.reason);
            return;
        }

        // Success
        playTone('shred');
        const rowEl = document.querySelector(`.record-row[data-id="${state.selectedId}"]`);
        rowEl.classList.add('fade-out');

        setTimeout(() => {
            el.finalResult.textContent = "TARGET ELIMINATED. DB CLEAN.";
            el.resultOverlay.classList.remove('hidden');
        }, 600);
    }

    init();
})();
