(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        selectedCol: null,
        isSlimmed: false
    };

    const el = {
        meterFill: document.getElementById('meter-fill'),
        sizeValue: document.getElementById('size-value'),
        tableHeader: document.getElementById('table-header'),
        tableBody: document.getElementById('table-body'),
        btnCut: document.getElementById('btn-cut'),
        overlay: document.getElementById('overlay'),
        resultText: document.getElementById('result-text'),
        btnNext: document.getElementById('btn-next'),
        tablePanel: document.getElementById('table-panel')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'click') {
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'cut') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_space_waster.json');
            state.config = await resp.json();

            el.btnCut.addEventListener('click', performCut);
            el.btnNext.addEventListener('click', nextScenario);

            startScenario(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.isSlimmed = false;
        state.selectedCol = null;
        const s = state.config.scenarios[idx];

        el.tablePanel.classList.remove('slimmed');
        el.overlay.classList.add('hidden');
        el.btnCut.classList.remove('active');

        renderTable(s);
        updateSizeMeter(100);
    }

    function renderTable(scenario) {
        el.tableHeader.innerHTML = '';
        el.tableBody.innerHTML = '';

        scenario.headers.forEach((h, i) => {
            const th = document.createElement('th');
            th.textContent = h;
            if (h === scenario.redundantColumn) {
                th.classList.add('column-highlight');
                th.addEventListener('click', () => selectColumn(h));
            }
            el.tableHeader.appendChild(th);
        });

        scenario.data.forEach(row => {
            const tr = document.createElement('tr');
            scenario.headers.forEach(h => {
                const td = document.createElement('td');
                td.textContent = row[h];
                if (h === scenario.redundantColumn) {
                    td.classList.add('column-highlight');
                }
                tr.appendChild(td);
            });
            el.tableBody.appendChild(tr);
        });
    }

    function selectColumn(name) {
        if (state.isSlimmed) return;
        playSound('click');
        state.selectedCol = name;

        document.querySelectorAll('.column-highlight').forEach(el => el.classList.add('selected'));
        el.btnCut.classList.add('active');
    }

    function updateSizeMeter(percent) {
        el.meterFill.style.width = `${percent}%`;
        el.sizeValue.textContent = `TABLE_WEIGHT: ${percent}%`;
        el.sizeValue.style.color = percent > 60 ? '#e74c3c' : '#2ecc71';
    }

    function performCut() {
        if (!state.selectedCol || state.isSlimmed) return;
        state.isSlimmed = true;
        playSound('cut');

        el.tablePanel.classList.add('slimmed');

        // Simulate space saving calculation
        const s = state.config.scenarios[state.scenarioIdx];
        const originalSize = calculateSize(s.data, s.headers);

        // Transform table visually
        setTimeout(() => {
            const uniqueValues = [...new Set(s.data.map(r => r[s.redundantColumn]))];
            const masterSize = uniqueValues.join('').length * s.bytePerChar;
            const mainSizeSlim = s.data.length * (originalSize / s.data.length - s.headers.find(h => h === s.redundantColumn).length + s.idByteSize);
            const totalSlim = mainSizeSlim + masterSize;
            const ratio = Math.round((totalSlim / originalSize) * 100);

            updateSizeMeter(ratio);
            renderSlimTable(s);

            setTimeout(() => {
                el.resultText.textContent = s.successMessage + ` Final weight reduced to ${ratio}%.`;
                el.overlay.classList.remove('hidden');
            }, 1200);
        }, 800);
    }

    function calculateSize(data, headers) {
        let size = 0;
        data.forEach(row => {
            headers.forEach(h => {
                size += (row[h].toString().length);
            });
        });
        return size;
    }

    function renderSlimTable(scenario) {
        const rows = el.tableBody.querySelectorAll('tr');
        const colIdx = scenario.headers.indexOf(scenario.redundantColumn);

        const uniqueMap = new Map();
        let idCounter = 1;

        rows.forEach((tr, i) => {
            const td = tr.children[colIdx];
            const val = td.textContent;
            if (!uniqueMap.has(val)) uniqueMap.set(val, idCounter++);

            td.textContent = `FK_${uniqueMap.get(val)}`;
            td.style.fontFamily = 'monospace';
            td.style.color = '#4a90e2';
        });
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
