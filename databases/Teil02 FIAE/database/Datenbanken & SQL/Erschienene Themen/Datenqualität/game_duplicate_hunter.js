(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        pairIdx: 0,
        currentPair: null,
        selection: {}, // { fieldName: 'A' or 'B' }
        score: 0,
        gameOver: false
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        cardA: document.getElementById('record-a'),
        cardB: document.getElementById('record-b'),
        matchScore: document.getElementById('match-score'),
        mergeBtn: document.getElementById('merge-btn'),
        skipBtn: document.getElementById('skip-btn'),
        resultScreen: document.getElementById('result-screen'),
        finalResult: document.getElementById('final-result'),
        nextBtn: document.getElementById('next-btn')
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
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);
            osc.start();
            osc.stop(now + 0.05);
        } else if (type === 'merge') {
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.3);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_duplicate_hunter.json');
            state.config = await resp.json();

            el.nextBtn.addEventListener('click', () => {
                if (state.levelIdx < state.config.levels.length - 1) {
                    el.resultScreen.classList.add('hidden');
                    startLevel(state.levelIdx + 1);
                } else {
                    window.location.reload();
                }
            });

            el.mergeBtn.addEventListener('click', attemptMerge);
            el.skipBtn.addEventListener('click', () => loadNextPair()); // Simple skip for now

            startLevel(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        state.pairIdx = 0;

        const level = state.config.levels[idx];
        el.levelTitle.textContent = `Level ${idx + 1}: ${level.title}`;

        loadPair();
    }

    function loadPair() {
        const level = state.config.levels[state.levelIdx];
        if (state.pairIdx >= level.pairs.length) {
            showResult(true, "Level Cleared! Data Quality Improved.");
            return;
        }

        state.currentPair = level.pairs[state.pairIdx];
        state.selection = {};

        // Auto-select non-conflicting fields? 
        // For game purpose, let user see them, maybe pre-select if identical

        renderCards(state.currentPair);
        updateMatchScore();
    }

    function renderCards(pair) {
        renderCard(el.cardA, pair.recordA, 'A', pair.conflicts);
        renderCard(el.cardB, pair.recordB, 'B', pair.conflicts);
    }

    function renderCard(container, record, side, conflicts) {
        container.innerHTML = `<div class="card-header">Record ${side} (${record.id})</div>`;

        // Merge fields from both records to ensure alignment
        // Actually we should iterate over keys of A (or B if keys same)
        const keys = Object.keys(record).filter(k => k !== 'id');

        keys.forEach(key => {
            const val = record[key];
            const isConflict = conflicts.includes(key);
            const row = document.createElement('div');

            row.className = 'field-row';
            if (state.selection[key] === side) row.classList.add('selected');

            row.innerHTML = `
            <div class="field-label">${key}</div>
            <div class="field-value ${isConflict ? 'diff' : 'match'}">${val === null ? '<em>null</em>' : val}</div>
          `;

            row.addEventListener('click', () => {
                selectField(key, side);
            });

            container.appendChild(row);
        });
    }

    function selectField(key, side) {
        state.selection[key] = side;
        playTone('select');
        renderCards(state.currentPair); // Re-render to update highlights
    }

    function updateMatchScore() {
        // Fake score calculation
        const pair = state.currentPair;
        const totalFields = Object.keys(pair.recordA).length - 1; // minus id
        const conflictCount = pair.conflicts.length;
        const match = Math.round(((totalFields - conflictCount) / totalFields) * 100);

        el.matchScore.textContent = match + "%";

        // Color code
        if (match > 80) el.matchScore.style.color = 'var(--dna-green)';
        else if (match > 50) el.matchScore.style.color = 'var(--diff-orange)';
        else el.matchScore.style.color = 'red';
    }

    function attemptMerge() {
        const pair = state.currentPair;

        // Check if all conflicts resolved
        const unresolved = pair.conflicts.filter(c => !state.selection[c]);

        if (unresolved.length > 0) {
            playTone('error');
            alert(`Please resolve conflicts for: ${unresolved.join(', ')}`);
            return;
        }

        // Verify correctness (against solution or master logic)
        let correct = true;

        if (pair.solution) {
            // Check if selected values match solution
            pair.conflicts.forEach(key => {
                const selectedSide = state.selection[key];
                const selectedValue = selectedSide === 'A' ? pair.recordA[key] : pair.recordB[key];
                // Simple string comparison
                if (String(selectedValue) !== String(pair.solution[key])) {
                    correct = false;
                }
            });
        } else if (pair.master) {
            // If a master record is defined, check if we picked from it?
            // Or maybe we treat "Master" as "The one with correct values"
            // Let's assume for typo level, Master has correct values
            if (pair.master === 'A') {
                // all conflicts should be A
                const pickedB = pair.conflicts.some(c => state.selection[c] === 'B');
                if (pickedB) correct = false; // Simplified logic
            }
        }

        if (correct) {
            playTone('merge');
            // Animation
            el.cardA.style.transform = 'translateX(50%) scale(0.8) opacity(0)';
            el.cardB.style.transform = 'translateX(-50%) scale(0.8) opacity(0)';

            setTimeout(() => {
                el.cardA.style.transform = '';
                el.cardB.style.transform = '';
                state.pairIdx++;
                loadPair(); // Next pair
            }, 500);
        } else {
            playTone('error');
            alert("Incorrect merge! You selected inferior data.");
        }
    }

    function loadNextPair() {
        state.pairIdx++;
        loadPair();
    }

    function showResult(win, msg) {
        el.nextBtn.textContent = state.levelIdx < state.config.levels.length - 1 ? "NEXT BATCH" : "FINISH";
        el.finalResult.textContent = msg;
        el.resultScreen.classList.remove('hidden');
    }

    init();
})();
