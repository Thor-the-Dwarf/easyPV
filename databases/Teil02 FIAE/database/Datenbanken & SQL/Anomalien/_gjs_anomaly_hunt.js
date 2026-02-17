(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        isComplete: false
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        tableContainer: document.querySelector('.table-container'),
        tableHead: document.getElementById('table-head'),
        tableBody: document.getElementById('table-body'),
        cardDesc: document.getElementById('card-desc'),
        btnExecute: document.getElementById('btn-execute'),
        btnReject: document.getElementById('btn-reject'),
        overlay: document.getElementById('overlay'),
        alertTitle: document.getElementById('alert-title'),
        alertDesc: document.getElementById('alert-desc'),
        btnNext: document.getElementById('btn-next'),
        statusVal: document.getElementById('status-val')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('data/_gg01_anomaly_hunt.json');
            state.config = await resp.json();

            el.btnExecute.onclick = () => handleChoice(true);
            el.btnReject.onclick = () => handleChoice(false);
            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                el.tableContainer.classList.remove('shake');
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
        state.isComplete = false;

        const lv = state.config.levels[idx];
        el.levelTitle.textContent = `DIAGNOSTIC_MODE // ${lv.title}`;
        el.statusVal.textContent = 'SYSTEM_VULNERABLE';
        el.statusVal.style.color = 'var(--anomaly-orange)';

        renderTable(lv.table);

        const action = lv.action;
        let desc = '';
        if (action.type === 'INSERT') {
            desc = `REQUEST: <span style="color:var(--safe-cyan);">INSERT</span><br>Project: <b>${action.data.Project_Name}</b><br>Employee: <b style="color:var(--anomaly-orange)">NULL</b>`;
        } else if (action.type === 'UPDATE') {
            desc = `REQUEST: <span style="color:var(--safe-cyan);">UPDATE</span><br>TargetID: <b>${action.target_id}</b><br>NewValue: <b>${action.new_value}</b>`;
        } else if (action.type === 'DELETE') {
            desc = `REQUEST: <span style="color:var(--safe-cyan);">DELETE</span><br>ProjectRow: <b>${action.target_row + 1}</b>`;
        }
        el.cardDesc.innerHTML = desc;
    }

    function renderTable(tableData) {
        el.tableHead.innerHTML = '';
        el.tableBody.innerHTML = '';

        const hTr = document.createElement('tr');
        tableData.headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            hTr.appendChild(th);
        });
        el.tableHead.appendChild(hTr);

        tableData.data.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell === null ? 'NULL' : cell;
                tr.appendChild(td);
            });
            el.tableBody.appendChild(tr);
        });
    }

    function handleChoice(isExecute) {
        if (state.isComplete) return;
        const lv = state.config.levels[state.levelIdx];

        if (isExecute) {
            // This game implies all scenarios are anomalies
            playSound('error');
            el.tableContainer.classList.add('shake');

            // Final "Heatmap" highlight for problematic columns
            highlightAnomalies(lv);

            showOverlay(lv.action.error, lv.action.explanation, true);
        } else {
            playSound('success');
            showOverlay("ANOMALY_AVERTED", `Structural flaw detected: ${lv.title}. Integrity preserved.`, false);
        }
        state.isComplete = true;
    }

    function highlightAnomalies(lv) {
        const cells = el.tableBody.querySelectorAll('td');
        cells.forEach(td => {
            if (lv.title.includes('Insertion') && td.textContent === 'NULL') {
                td.classList.add('anomaly-glow');
            }
            if (lv.title.includes('Update') && td.textContent === 'Müller') {
                td.classList.add('anomaly-glow');
            }
            if (lv.title.includes('Deletion') && td.textContent === 'Schulze') {
                td.classList.add('anomaly-glow');
            }
        });
    }

    function showOverlay(title, desc, isAnomaly) {
        el.alertTitle.textContent = title;
        el.alertDesc.innerHTML = desc;
        el.overlay.querySelector('.alert-card').className = isAnomaly ? 'alert-card anomaly' : 'alert-card';

        setTimeout(() => {
            el.overlay.classList.remove('hidden');
        }, 600);
    }

    init();
})();
