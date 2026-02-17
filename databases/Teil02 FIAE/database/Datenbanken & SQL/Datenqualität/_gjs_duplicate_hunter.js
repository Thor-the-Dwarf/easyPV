(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        pairIdx: 0,
        currentPair: null,
        selection: {},
        points: 0,
        roi: 0,
        isComplete: false
    };

    const el = {
        title: document.getElementById('level-title'),
        strandA: document.getElementById('record-a'),
        strandB: document.getElementById('record-b'),
        scorePct: document.getElementById('match-pct-val'),
        masterPreview: document.getElementById('master-preview-row'),
        btnMerge: document.getElementById('merge-btn'),
        btnKeep: document.getElementById('skip-btn'),
        roiVal: document.getElementById('roi-val'),
        pointsVal: document.getElementById('points-val'),
        overlay: document.getElementById('overlay'),
        resFinal: document.getElementById('res-final'),
        btnNext: document.getElementById('btn-next')
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
            const resp = await fetch('_data/_gg01_duplicate_hunter.json');
            state.config = await resp.json();

            el.btnMerge.onclick = attemptFusion;
            el.btnKeep.onclick = skipPair;
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
        state.pairIdx = 0;

        const lv = state.config.levels[idx];
        el.title.textContent = `MDM_LAB // BATCH_${lv.title}`;

        loadPair();
    }

    function loadPair() {
        const lv = state.config.levels[state.levelIdx];
        if (state.pairIdx >= lv.pairs.length) {
            showResult("BATCH_ANALYSIS_COMPLETE");
            return;
        }

        state.currentPair = lv.pairs[state.pairIdx];
        state.selection = {};

        // Reset visuals
        el.strandA.classList.remove('record-merge-anim');
        el.strandB.classList.remove('record-merge-anim');

        renderStrands();
        updateMasterPreview();
        updateMatchScore();
    }

    function renderStrands() {
        const p = state.currentPair;
        renderStrand(el.strandA, p.recordA, 'A', p.conflicts);
        renderStrand(el.strandB, p.recordB, 'B', p.conflicts);
    }

    function renderStrand(container, record, side, conflicts) {
        container.innerHTML = `<div class="strand-header">DATA_SOURCE_${side} [REC_${record.id}]</div>`;
        const keys = Object.keys(record).filter(k => k !== 'id');

        keys.forEach(key => {
            const isConflict = conflicts.includes(key);
            const val = record[key];
            const div = document.createElement('div');
            div.className = `field-cell ${state.selection[key] === side ? 'selected' : ''}`;

            let statusClass = 'match';
            if (isConflict) statusClass = 'conflict';
            // fuzzy check?
            if (isConflict && isFuzzyMatch(key)) statusClass = 'fuzzy';

            div.innerHTML = `
            <div class="f-key">${key}</div>
            <div class="f-val ${statusClass}">${val === null ? 'NULL' : val}</div>
          `;

            div.onclick = () => selectField(key, side);
            container.appendChild(div);
        });
    }

    function isFuzzyMatch(key) {
        const a = String(state.currentPair.recordA[key]).toLowerCase();
        const b = String(state.currentPair.recordB[key]).toLowerCase();
        if (a === b) return false;
        return a.includes(b) || b.includes(a) || (a.length > 3 && b.startsWith(a.substring(0, 3)));
    }

    function selectField(key, side) {
        state.selection[key] = side;
        playSound(800, 'sine', 0.05);
        renderStrands();
        updateMasterPreview();
    }

    function updateMasterPreview() {
        el.masterPreview.innerHTML = '';
        const p = state.currentPair;
        const keys = Object.keys(p.recordA).filter(k => k !== 'id');

        keys.forEach(key => {
            const side = state.selection[key] || (p.conflicts.includes(key) ? null : 'A');
            const val = side ? (side === 'A' ? p.recordA[key] : p.recordB[key]) : '??';

            const div = document.createElement('div');
            div.className = 'prev-pill';
            div.innerHTML = `
            <div class="pill-label">${key}</div>
            <div class="pill-val">${val}</div>
          `;
            el.masterPreview.appendChild(div);
        });
    }

    function updateMatchScore() {
        const p = state.currentPair;
        const total = Object.keys(p.recordA).length - 1;
        const conflicts = p.conflicts.length;
        const score = Math.round(((total - conflicts) / total) * 100);
        el.scorePct.textContent = `${score}%`;
    }

    async function attemptFusion() {
        const p = state.currentPair;
        const unresolved = p.conflicts.filter(k => !state.selection[k]);

        if (unresolved.length > 0) {
            playSound(110, 'sawtooth');
            alert(`UNRESOLVED_CONFLICTS: ${unresolved.join(', ')}`);
            return;
        }

        // Validation against solution (if exists) or simple "correct choice" logic
        let correct = true;
        if (p.solution) {
            p.conflicts.forEach(k => {
                const val = state.selection[k] === 'A' ? p.recordA[k] : p.recordB[k];
                if (String(val) !== String(p.solution[k])) correct = false;
            });
        }

        if (correct) {
            playSound(440, 'triangle', 0.5);
            state.points += 100;
            state.roi += 15.50; // Arbitrary € saved
            updateHUD();

            el.strandA.classList.add('record-merge-anim');
            el.strandB.classList.add('record-merge-anim');

            setTimeout(() => {
                state.pairIdx++;
                loadPair();
            }, 600);
        } else {
            playSound(110, 'sawtooth', 0.5);
            alert("FUSION_ERROR: SUBOPTIMAL_FIELD_SELECTED");
            state.points -= 50;
            updateHUD();
        }
    }

    function skipPair() {
        playSound(220, 'sine');
        state.pairIdx++;
        loadPair();
    }

    function updateHUD() {
        el.pointsVal.textContent = state.points;
        el.roiVal.textContent = `€${state.roi.toFixed(2)}`;
    }

    function showResult(msg) {
        el.resFinal.textContent = msg;
        el.overlay.classList.remove('hidden');
    }

    init();
})();
