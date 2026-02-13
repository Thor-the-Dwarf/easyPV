(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        gameOver: false
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        tableHead: document.getElementById('table-head'),
        tableBody: document.getElementById('table-body'),
        actionCard: document.getElementById('action-card'),
        cardTitle: document.getElementById('card-title'),
        cardDesc: document.getElementById('card-desc'),
        btnExecute: document.getElementById('btn-execute'),
        btnReject: document.getElementById('btn-reject'),
        alertOverlay: document.getElementById('anomaly-alert'),
        alertTitle: document.getElementById('alert-title'),
        alertDesc: document.getElementById('alert-desc'),
        btnNext: document.getElementById('btn-next'),
        resultScreen: document.getElementById('result-screen'),
        finalResult: document.getElementById('final-result'),
        btnFinale: document.getElementById('btn-finale')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'shake') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.5);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_anomaly_hunt.json');
            state.config = await resp.json();

            el.btnExecute.addEventListener('click', () => handleDecision(true));
            el.btnReject.addEventListener('click', () => handleDecision(false));

            el.btnNext.addEventListener('click', () => {
                el.alertOverlay.style.display = 'none';
                document.querySelector('.table-container').classList.remove('shake');

                if (state.levelIdx < state.config.levels.length - 1) {
                    startLevel(state.levelIdx + 1);
                } else {
                    showFinalResult();
                }
            });

            el.btnFinale.addEventListener('click', () => location.reload()); // Or next game

            startLevel(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        const level = state.config.levels[idx];

        el.levelTitle.textContent = `Scenario ${idx + 1}: ${level.title}`;

        // Render Table
        renderTable(level.table);

        // Render Action
        const action = level.action;
        el.cardTitle.textContent = action.type + " REQUEST";

        if (action.type === 'INSERT') {
            el.cardDesc.innerHTML = `Attempting to insert:<br>Project: <b>${action.data.Project_Name}</b><br>Employee: <b>NULL</b>`;
            el.actionCard.className = 'action-card intent-insert';
        } else if (action.type === 'UPDATE') {
            el.cardDesc.innerHTML = `Attempting to update:<br>Row ID: <b>${action.target_id}</b><br>Value: <b>${action.new_value}</b>`;
            el.actionCard.className = 'action-card intent-update';
        } else if (action.type === 'DELETE') {
            el.cardDesc.innerHTML = `Attempting to delete:<br>Project Row: <b>${action.target_row + 1}</b>`;
            el.actionCard.className = 'action-card intent-delete';
        }
    }

    function renderTable(tableData) {
        el.tableBody.innerHTML = '';
        el.tableHead.innerHTML = '';

        // Headers
        const tr = document.createElement('tr');
        tableData.headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            tr.appendChild(th);
        });
        el.tableHead.appendChild(tr);

        // Rows
        tableData.data.forEach((row, i) => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            });
            el.tableBody.appendChild(tr);
        });
    }

    function handleDecision(execute) {
        const level = state.config.levels[state.levelIdx];
        // In this game, ALL levels are anomalies (it's an Anomaly Hunt).
        // So the correct decision is always REJECT.
        // If execute -> show why it failed (The Lesson).
        // If reject -> "Correct! This is an anomaly."

        if (execute) {
            // Player chose to Execute -> Causality -> Anomaly triggers
            playTone('shake');
            document.querySelector('.table-container').classList.add('shake');
            showAlert(level.action.error, level.action.explanation, true);
        } else {
            // Player chose to Reject -> Safe
            playTone('success');
            showAlert("ANOMALY AVERTED!", `Good eye! You prevented a ${level.title}. <br><br>Reasoning: ${level.action.explanation}`, false);
        }
    }

    function showAlert(title, desc, isBad) {
        el.alertTitle.textContent = title;
        el.alertDesc.innerHTML = desc;
        el.alertOverlay.querySelector('.alert-icon').textContent = isBad ? '⚠️' : '🛡️';
        el.alertTitle.style.color = isBad ? 'var(--accent-danger)' : 'var(--accent-safe)';
        el.alertOverlay.style.boxShadow = isBad ? '0 0 50px var(--accent-danger)' : '0 0 50px var(--accent-safe)';

        setTimeout(() => {
            el.alertOverlay.style.display = 'block';
        }, 500); // Wait for shake
    }

    function showFinalResult() {
        el.finalResult.textContent = "Database Integrity Preserved.";
        el.resultScreen.classList.remove('hidden');
    }

    init();
})();
