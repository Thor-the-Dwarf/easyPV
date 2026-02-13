(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        affectedRows: 0,
        isExecuting: false
    };

    const el = {
        affectedCount: document.getElementById('affected-count'),
        hazardLevel: document.getElementById('hazard-level'),
        whereClause: document.getElementById('where-clause'),
        tableBody: document.getElementById('preview-body'),
        btnExecute: document.getElementById('btn-execute'),
        overlay: document.getElementById('result-overlay'),
        outcomeTitle: document.getElementById('outcome-title'),
        outcomeText: document.getElementById('outcome-text'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'warn') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'boom') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(60, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 1.5);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_mass_update.json');
            state.config = await resp.json();

            el.whereClause.addEventListener('input', handleUpdateInput);
            el.btnExecute.addEventListener('click', executeUpdate);
            el.btnNext.addEventListener('click', nextScenario);

            startScenario(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.isExecuting = false;
        const s = state.config.scenarios[idx];

        el.whereClause.textContent = "";
        el.overlay.classList.add('hidden');
        el.btnExecute.classList.remove('ready');
        el.btnExecute.disabled = true;

        renderTable(s);
        calculateAffected();
    }

    function renderTable(scenario) {
        el.tableBody.innerHTML = '';
        scenario.data.forEach(row => {
            const tr = document.createElement('tr');
            tr.id = `row-${row.id}`;
            // Basic columns based on row keys
            Object.keys(row).forEach(key => {
                const td = document.createElement('td');
                td.textContent = row[key];
                tr.appendChild(td);
            });
            el.tableBody.appendChild(tr);
        });
    }

    function handleUpdateInput() {
        if (state.isExecuting) return;
        calculateAffected();
    }

    function calculateAffected() {
        const s = state.config.scenarios[state.scenarioIdx];
        const input = el.whereClause.textContent.trim().toLowerCase();

        let count = s.initialRows;
        let hazard = "CRITICAL";

        // Simple simulation logic
        if (input === "") {
            count = s.initialRows;
            hazard = "EXTREME";
        } else if (input.includes("id =") || input.includes("id=")) {
            count = 1;
            hazard = "LOW";
        } else if (input.includes("id in")) {
            count = 2; // Simulated
            hazard = "MEDIUM";
        }

        state.affectedRows = count;
        el.affectedCount.textContent = count.toLocaleString();
        el.hazardLevel.textContent = hazard;
        el.hazardLevel.className = "hazard-level " + (count > 1 ? "danger" : "");

        if (count > 100) {
            playSound('warn');
            document.body.classList.add('shake');
            setTimeout(() => document.body.classList.remove('shake'), 200);
        }

        el.btnExecute.disabled = (input === "");
        el.btnExecute.classList.toggle('ready', input !== "");

        // Update highlights in the UI table for the first few rows
        updatePreviewHighlights(input);
    }

    function updatePreviewHighlights(input) {
        const s = state.config.scenarios[state.scenarioIdx];
        const rows = el.tableBody.querySelectorAll('tr');

        rows.forEach(tr => {
            tr.className = '';
            if (input === "") {
                tr.classList.add('affected'); // All flash
            } else if (input.includes("id = 1") && tr.id === "row-1") {
                tr.classList.add('surgical');
            } else if (input.includes("id") && !input.includes("id =")) {
                tr.classList.add('affected');
            }
        });
    }

    function executeUpdate() {
        if (state.isExecuting) return;
        state.isExecuting = true;
        el.btnExecute.disabled = true;

        const s = state.config.scenarios[state.scenarioIdx];
        const success = (state.affectedRows === s.targetRows);

        if (success) {
            playSound('success');
            showResult(true);
        } else {
            playSound('boom');
            document.body.classList.add('shake');
            showResult(false);
            setTimeout(() => document.body.classList.remove('shake'), 1000);
        }
    }

    function showResult(success) {
        const s = state.config.scenarios[state.scenarioIdx];
        const card = el.overlay.querySelector('.result-card');

        card.className = "result-card " + (success ? "success" : "fail");
        el.outcomeTitle.textContent = success ? "Surgical Success" : "Data Catastrophe";
        el.outcomeText.textContent = success ? s.successMessage : s.failMessage;

        setTimeout(() => {
            el.overlay.classList.remove('hidden');
        }, 1500);
    }

    function nextScenario() {
        if (state.scenarioIdx < state.config.scenarios.length - 1) {
            startScenario(state.scenarioIdx + 1);
        } else {
            location.reload();
        }
    }

    init();
})();
