(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        selectedCols: new Set(),
        currentWeight: 0,
        totalLevelWeight: 0
    };

    const el = {
        missionTitle: document.getElementById('mission-title'),
        missionText: document.getElementById('mission-text'),
        blueprint: document.getElementById('blueprint'),
        gauge: document.getElementById('gauge-fill'),
        kbCounter: document.getElementById('kb-counter'),
        rankDisplay: document.getElementById('rank-display'),
        btnRun: document.getElementById('btn-run'),
        btnAsterisk: document.getElementById('btn-asterisk'),
        resultOverlay: document.getElementById('result-overlay'),
        resultText: document.getElementById('result-text'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(freq, type = 'sine', duration = 0.2, gainVal = 0.1) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    async function init() {
        try {
            const resp = await fetch('game_column_sieve.json');
            state.config = await resp.json();

            el.btnRun.addEventListener('click', runQuery);
            el.btnAsterisk.addEventListener('click', selectAll);
            el.btnNext.addEventListener('click', nextLevel);

            startLevel(0);
        } catch (e) {
            console.error("Initialization failed:", e);
        }
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        state.selectedCols.clear();

        const level = state.config.levels[idx];
        el.missionTitle.textContent = level.title;
        el.missionText.textContent = level.mission;
        el.resultOverlay.classList.add('hidden');

        state.totalLevelWeight = level.columns.reduce((sum, col) => sum + col.weight, 0);

        renderColumns(level.columns);
        updatePerformance();
    }

    function renderColumns(columns) {
        el.blueprint.innerHTML = '';
        columns.forEach(col => {
            const card = document.createElement('div');
            card.className = 'column-card';
            card.dataset.name = col.name;
            card.dataset.weight = col.weight;
            card.innerHTML = `
        <div class="col-header">${col.name}</div>
        <div class="col-type">${col.type}</div>
        <div style="font-size:0.7rem; color:#888; margin-top:5px;">${col.desc}</div>
        <div class="col-weight">${col.weight} KB</div>
      `;

            card.addEventListener('click', () => toggleColumn(card, col));
            el.blueprint.appendChild(card);
        });
    }

    function toggleColumn(card, col) {
        if (state.selectedCols.has(col.name)) {
            state.selectedCols.delete(col.name);
            card.classList.remove('selected');
            playTone(300, 'sine', 0.1, 0.05);
        } else {
            state.selectedCols.add(col.name);
            card.classList.add('selected');
            playTone(600, 'sine', 0.1, 0.05);
        }
        updatePerformance();
    }

    function selectAll() {
        playTone(150, 'sawtooth', 0.5, 0.2);
        document.querySelectorAll('.column-card').forEach(card => {
            const name = card.dataset.name;
            if (!state.selectedCols.has(name)) {
                state.selectedCols.add(name);
                card.classList.add('selected');
            }
        });
        // Visual warning
        el.kbCounter.parentElement.classList.add('shake');
        setTimeout(() => el.kbCounter.parentElement.classList.remove('shake'), 500);
        updatePerformance();
    }

    function updatePerformance() {
        const level = state.config.levels[state.levelIdx];
        let weight = 0;
        level.columns.forEach(col => {
            if (state.selectedCols.has(col.name)) weight += col.weight;
        });

        state.currentWeight = weight;
        el.kbCounter.textContent = weight.toLocaleString();

        const percent = state.totalLevelWeight > 0 ? (weight / state.totalLevelWeight) * 100 : 0;
        el.gauge.style.width = `${percent}%`;

        // Aesthetic feedback
        if (percent > 80) {
            el.gauge.classList.add('warning');
        } else {
            el.gauge.classList.remove('warning');
        }
    }

    function runQuery() {
        const level = state.config.levels[state.levelIdx];

        // 1. Check if required columns are present
        const missing = level.requiredColumns.filter(c => !state.selectedCols.has(c));

        if (missing.length > 0) {
            playTone(100, 'sawtooth', 0.3, 0.3);
            alert(`QUERY ERROR: Missing required data for mission: ${missing.join(', ')}`);
            return;
        }

        // 2. Assess efficiency
        let rank = 'C';
        let message = "";

        const extraColsCount = state.selectedCols.size - level.requiredColumns.length;

        if (extraColsCount === 0) {
            rank = 'S';
            message = "PERFORMANCE PRO! You selected only the required columns. Minimal latency achieved.";
        } else if (extraColsCount <= 2) {
            rank = 'A';
            message = "GOOD WORK. A few extra columns, but still very efficient.";
        } else if (state.selectedCols.size === level.columns.length) {
            rank = 'D';
            message = "DATA WASTE DETECTED! You performed a SELECT *. The network is struggling.";
        } else {
            rank = 'B';
            message = "Functional, but could be leaner. Avoid 'Data Overfetching'.";
        }

        showResult(rank, message);
    }

    function showResult(rank, message) {
        playTone(800, 'square', 0.1);
        el.rankDisplay.textContent = rank;
        el.resultText.textContent = message;

        // Set color based on rank
        const colors = { 'S': '#39ff14', 'A': '#00d4ff', 'B': '#ffcc00', 'C': '#ff6600', 'D': '#ff3131' };
        el.rankDisplay.style.color = colors[rank] || '#fff';

        el.resultOverlay.classList.remove('hidden');
    }

    function nextLevel() {
        if (state.levelIdx < state.config.levels.length - 1) {
            startLevel(state.levelIdx + 1);
        } else {
            location.reload();
        }
    }

    init();
})();
