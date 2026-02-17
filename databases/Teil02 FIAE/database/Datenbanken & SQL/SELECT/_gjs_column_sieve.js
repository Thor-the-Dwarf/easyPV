(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        completedLevels: 0,
        selectedCols: new Set(),
        currentWeight: 0,
        totalLevelWeight: 0,
        isComplete: false,
        lastRank: null
    };

    const el = {
        missionTitle: document.getElementById('mission-title'),
        missionText: document.getElementById('mission-text'),
        blueprint: document.getElementById('blueprint'),
        gauge: document.getElementById('gauge-fill'),
        kbCounter: document.getElementById('kb-counter'),
        rankDisplay: document.getElementById('rank-display'),
        rankMessage: document.getElementById('rank-message'),
        btnRun: document.getElementById('btn-run'),
        btnAsterisk: document.getElementById('btn-asterisk'),
        overlay: document.getElementById('result-overlay'),
        btnNext: document.getElementById('btn-next'),
        gaugeContainer: document.querySelector('.weight-display')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'toggle') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'warn') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_column_sieve.json');
            state.config = await resp.json();

            el.btnRun.onclick = runQuery;
            el.btnAsterisk.onclick = selectAll;
            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                nextLevel();
            };

            startLevel(0);
        } catch (e) { console.error(e); }
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        state.selectedCols.clear();
        state.isComplete = false;
        state.lastRank = null;

        const lv = state.config.levels[idx];
        el.missionTitle.textContent = `CRITICAL_PROJECTION // ${lv.title}`;
        el.missionText.textContent = lv.mission;
        el.overlay.classList.add('hidden');

        state.totalLevelWeight = lv.columns.reduce((s, c) => s + c.weight, 0);

        renderColumns(lv.columns);
        updatePerformance();
    }

    function renderColumns(cols) {
        el.blueprint.innerHTML = '';
        cols.forEach(c => {
            const card = document.createElement('div');
            card.className = 'column-card';
            card.innerHTML = `
        <div class="col-header">${c.name}</div>
        <div class="col-type">${c.type}</div>
        <div style="font-size:0.65rem; color:var(--text-scifi); opacity:0.6; text-align:center;">${c.desc}</div>
        <div class="col-weight">${c.weight} KB</div>
      `;
            card.onclick = () => toggleColumn(card, c);
            el.blueprint.appendChild(card);
        });
    }

    function toggleColumn(card, col) {
        if (state.isComplete) return;

        if (state.selectedCols.has(col.name)) {
            state.selectedCols.delete(col.name);
            card.classList.remove('selected');
        } else {
            state.selectedCols.add(col.name);
            card.classList.add('selected');
        }

        playSound('toggle');
        updatePerformance();
    }

    function selectAll() {
        if (state.isComplete) return;
        playSound('warn');
        el.gaugeContainer.classList.add('shake');
        setTimeout(() => el.gaugeContainer.classList.remove('shake'), 500);

        const cards = document.querySelectorAll('.column-card');
        cards.forEach((card, i) => {
            const lv = state.config.levels[state.levelIdx];
            const col = lv.columns[i];
            if (!state.selectedCols.has(col.name)) {
                state.selectedCols.add(col.name);
                card.classList.add('selected');
            }
        });
        updatePerformance();
    }

    function updatePerformance() {
        const lv = state.config.levels[state.levelIdx];
        let weight = 0;
        lv.columns.forEach(c => {
            if (state.selectedCols.has(c.name)) weight += c.weight;
        });

        state.currentWeight = weight;
        // Animate counter
        animateCounter(el.kbCounter, parseInt(el.kbCounter.textContent.replace(/,/g, '')), weight);

        const percent = (weight / state.totalLevelWeight) * 100;
        el.gauge.style.width = `${percent}%`;

        if (percent > 70) el.gauge.classList.add('warning');
        else el.gauge.classList.remove('warning');
    }

    function animateCounter(element, start, end) {
        if (start === end) return;
        let current = start;
        const step = (end - start) / 10;
        const timer = setInterval(() => {
            current += step;
            if ((step > 0 && current >= end) || (step < 0 && current <= end)) {
                current = end;
                clearInterval(timer);
            }
            element.textContent = Math.round(current).toLocaleString();
        }, 30);
    }

    function runQuery() {
        const lv = state.config.levels[state.levelIdx];
        const missing = lv.requiredColumns.filter(c => !state.selectedCols.has(c));

        if (missing.length > 0) {
            playSound('warn');
            alert(`PROTOCOL_BREACH: Missing required data fields: ${missing.join(', ')}`);
            return;
        }

        state.isComplete = true;
        evalRank();
    }

    function evalRank() {
        const lv = state.config.levels[state.levelIdx];
        const extra = state.selectedCols.size - lv.requiredColumns.length;

        let rank = 'C';
        let msg = "PROJECTION_FUNCTIONAL but overhead detected.";

        if (extra === 0) {
            rank = 'S';
            msg = "PERFORMANCE_MASTER: Minimum weight, maximum velocity.";
            el.rankDisplay.classList.add('radiance');
        } else if (extra <= 2) {
            rank = 'A';
            msg = "EFFICIENT_WORK: Overhead is within acceptable limits.";
        } else if (state.selectedCols.size === lv.columns.length) {
            rank = 'D';
            msg = "DATA_WASTE_CRITICAL: Full table scan active. Network saturation reached.";
        }

        state.lastRank = rank;
        state.completedLevels = Math.max(state.completedLevels, state.levelIdx + 1);
        showResult(rank, msg);
    }

    function showResult(rank, msg) {
        playSound('success');
        el.rankDisplay.textContent = rank;
        el.rankMessage.textContent = msg;

        const colors = { 'S': '#39ff14', 'A': '#00d4ff', 'B': '#ffcc00', 'C': '#ff6600', 'D': '#ff3131' };
        el.rankDisplay.style.color = colors[rank] || '#fff';

        el.overlay.classList.remove('hidden');
    }

    function nextLevel() {
        if (state.levelIdx < state.config.levels.length - 1) {
            startLevel(state.levelIdx + 1);
        } else {
            location.reload();
        }
    }

    function getRequiredSelectionProgress(lv) {
        if (!lv || !Array.isArray(lv.requiredColumns) || lv.requiredColumns.length === 0) return 0;
        let selectedRequired = 0;
        for (let i = 0; i < lv.requiredColumns.length; i += 1) {
            if (state.selectedCols.has(lv.requiredColumns[i])) selectedRequired += 1;
        }
        return selectedRequired / lv.requiredColumns.length;
    }

    function computeProgressPercent() {
        const totalLevels = state.config && Array.isArray(state.config.levels) ? state.config.levels.length : 0;
        if (totalLevels <= 0) return 0;

        const lv = state.config.levels[state.levelIdx];
        const done = Math.max(0, Math.min(state.completedLevels, totalLevels));
        const inLevel = state.isComplete ? 0 : getRequiredSelectionProgress(lv);
        return Math.round(Math.max(0, Math.min(1, (done + inLevel) / totalLevels)) * 100);
    }

    window.render_game_to_text = function renderGameToText() {
        const lv = state.config && state.config.levels ? state.config.levels[state.levelIdx] : null;
        const requiredTotal = lv && Array.isArray(lv.requiredColumns) ? lv.requiredColumns.length : 0;
        const requiredSelected = lv && Array.isArray(lv.requiredColumns)
            ? lv.requiredColumns.filter((name) => state.selectedCols.has(name)).length
            : 0;

        return JSON.stringify({
            mode: state.isComplete ? 'result' : 'column_selection',
            coordinate_system: 'origin top-left, x right, y down',
            current_level: state.levelIdx + 1,
            total_levels: state.config && state.config.levels ? state.config.levels.length : 0,
            completed_levels: state.completedLevels,
            progress_percent: computeProgressPercent(),
            selected_count: state.selectedCols.size,
            selected_columns: Array.from(state.selectedCols),
            required_selected: requiredSelected,
            required_total: requiredTotal,
            current_weight_kb: state.currentWeight,
            total_weight_kb: state.totalLevelWeight,
            is_complete: state.isComplete,
            last_rank: state.lastRank
        });
    };

    window.advanceTime = function advanceTime() {
        return true;
    };

    init();
})();
