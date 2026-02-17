(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        successfulScenarios: 0,
        affectedRows: 0,
        isComplete: false,
        lastResult: 'none'
    };

    const el = {
        monitor: document.getElementById('safety-monitor'),
        count: document.getElementById('affected-count'),
        hazard: document.getElementById('hazard-level'),
        whereSlot: document.getElementById('where-slot'),
        previewBody: document.getElementById('preview-body'),
        btnExecute: document.getElementById('btn-execute'),
        overlay: document.getElementById('overlay'),
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

        if (type === 'click') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'warn') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        } else if (type === 'critical') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(60, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 1);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 1.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_mass_update.json');
            state.config = await resp.json();

            el.whereSlot.oninput = handleInput;
            el.btnExecute.onclick = executeUpdate;
            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                startScenario(state.scenarioIdx + 1);
            };

            startScenario(0);
        } catch (e) { console.error(e); }
    }

    function startScenario(idx) {
        if (idx >= state.config.scenarios.length) {
            location.reload();
            return;
        }
        state.scenarioIdx = idx;
        state.isComplete = false;
        state.lastResult = 'in_progress';

        const sc = state.config.scenarios[idx];
        el.whereSlot.textContent = '';
        el.overlay.classList.add('hidden');
        el.btnExecute.disabled = true;

        renderTable(sc);
        calculateImpact();
    }

    function renderTable(sc) {
        el.previewBody.innerHTML = '';
        sc.data.forEach(row => {
            const tr = document.createElement('tr');
            tr.id = `row-${row.id}`;
            // Use keys from data
            Object.keys(row).forEach(k => {
                const td = document.createElement('td');
                td.textContent = row[k];
                tr.appendChild(td);
            });
            el.previewBody.appendChild(tr);
        });
    }

    function handleInput() {
        if (state.isComplete) return;
        calculateImpact();
    }

    function calculateImpact() {
        const sc = state.config.scenarios[state.scenarioIdx];
        const val = el.whereSlot.textContent.trim().toLowerCase();

        let count = sc.initialRows;
        let hazard = 'EXTREME';

        if (val.length === 0) {
            count = sc.initialRows;
            hazard = 'EXTREME';
        } else if (val.includes('id =') || val.includes('id=')) {
            const parts = val.split('=');
            const id = parseInt(parts[1]);
            if (!isNaN(id)) {
                count = sc.data.some(r => r.id === id) ? 1 : 0;
                hazard = count === 1 ? 'LOW' : 'SAFE';
            }
        } else if (val.includes('id >') || val.includes('id <')) {
            count = Math.floor(sc.initialRows / 2); // Simulated impact
            hazard = 'MEDIUM';
        }

        state.affectedRows = count;
        el.count.textContent = count.toLocaleString();
        el.hazard.textContent = hazard;

        // UI Feedback
        if (count > 1) {
            el.monitor.classList.add('critical');
            el.hazard.className = 'hazard-level extreme';
            if (val.length > 5) playSound('warn');
        } else {
            el.monitor.classList.remove('critical');
            el.hazard.className = 'hazard-level low';
        }

        el.btnExecute.disabled = val.length === 0;

        updateTableHighlights(val, sc);
    }

    function updateTableHighlights(val, sc) {
        const rows = el.previewBody.querySelectorAll('tr');
        rows.forEach(tr => {
            tr.className = '';
            if (val.length === 0) {
                tr.classList.add('affected');
            } else if (val.includes('id =')) {
                const id = parseInt(val.split('=')[1]);
                if (tr.id === `row-${id}`) tr.classList.add('surgical');
            } else if (val.includes('id')) {
                tr.classList.add('affected');
            }
        });
    }

    function executeUpdate() {
        if (state.isComplete) return;
        const sc = state.config.scenarios[state.scenarioIdx];

        state.isComplete = true;
        el.btnExecute.disabled = true;

        if (state.affectedRows === sc.targetRows) {
            playSound('success');
            state.successfulScenarios = Math.max(state.successfulScenarios, state.scenarioIdx + 1);
            state.lastResult = 'success';
            showOutcome(true, sc);
        } else {
            playSound('critical');
            document.body.classList.add('shake');
            setTimeout(() => document.body.classList.remove('shake'), 1000);
            state.lastResult = 'fail';
            showOutcome(false, sc);
        }
    }

    function showOutcome(success, sc) {
        el.outcomeTitle.textContent = success ? 'SURGICAL_SUCCESS' : 'DATA_CATASTROPHE';
        el.outcomeText.textContent = success ? sc.successMessage : sc.failMessage;
        el.overlay.querySelector('.result-card').className = success ? 'result-card' : 'result-card fail';

        setTimeout(() => {
            el.overlay.classList.remove('hidden');
        }, 1500);
    }

    function computeProgressPercent() {
        const total = state.config && Array.isArray(state.config.scenarios) ? state.config.scenarios.length : 0;
        if (total <= 0) return 0;
        const inScenario = state.isComplete ? 0 : (el.whereSlot && el.whereSlot.textContent.trim().length > 0 ? 0.5 : 0);
        const ratio = (state.successfulScenarios + inScenario) / total;
        return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
    }

    window.render_game_to_text = function renderGameToText() {
        const total = state.config && Array.isArray(state.config.scenarios) ? state.config.scenarios.length : 0;
        const sc = state.config && state.config.scenarios ? state.config.scenarios[state.scenarioIdx] : null;
        return JSON.stringify({
            mode: state.isComplete ? 'result' : 'where_clause',
            measurable: true,
            coordinate_system: 'origin top-left, x right, y down',
            current_scenario: state.scenarioIdx + 1,
            total_scenarios: total,
            successful_scenarios: state.successfulScenarios,
            affected_rows: state.affectedRows,
            target_rows: sc ? sc.targetRows : null,
            hazard_level: el.hazard ? el.hazard.textContent : '',
            last_result: state.lastResult,
            progress_percent: computeProgressPercent()
        });
    };

    window.advanceTime = function advanceTime() {
        return true;
    };

    init();
})();
