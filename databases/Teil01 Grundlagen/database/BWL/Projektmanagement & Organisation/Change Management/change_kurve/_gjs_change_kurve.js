/**
 * Die Kurve der Veränderung - Game Logic
 * Sorting employee statements into the 7 phases of the change curve.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const canvas = document.getElementById('canvas');
    const dropContainer = document.getElementById('drop-points-container');
    const pool = document.getElementById('statement-pool');
    const progressVal = document.getElementById('progress-val');
    const checkBtn = document.getElementById('check-btn');
    const resetBtn = document.getElementById('reset-btn');
    const overlay = document.getElementById('feedback-overlay');
    const resultTitle = document.getElementById('result-title');
    const resultText = document.getElementById('result-text');

    // State
    let gameState = {
        data: null,
        selectedStatement: null,
        assignments: {}, // phaseId -> statementId
        solved: false
    };

    // Load Data
    fetch('data/_g01_change_kurve.json')
        .then(r => r.json())
        .then(data => initGame(data))
        .catch(err => console.error("Load failed:", err));

    function initGame(data) {
        gameState.data = data;
        document.getElementById('game-title').innerText = data.gameTitle;
        document.getElementById('game-subtitle').innerText = data.gameSubtitle;

        renderPhases();
        renderPool();

        checkBtn.addEventListener('click', checkSolution);
        resetBtn.addEventListener('click', resetGame);
        document.getElementById('close-feedback').addEventListener('click', () => overlay.style.display = 'none');
    }

    function renderPhases() {
        dropContainer.innerHTML = '';
        gameState.data.phases.forEach(phase => {
            const dp = document.createElement('div');
            dp.className = 'drop-point';
            dp.style.left = `${phase.x}%`;
            dp.style.top = `${phase.y}%`;
            dp.dataset.id = phase.id;
            dp.innerText = phase.order;

            const label = document.createElement('div');
            label.className = 'phase-label';
            label.innerText = phase.name;
            dp.appendChild(label);

            dp.addEventListener('click', () => handleDropPointClick(phase.id));
            dropContainer.appendChild(dp);
        });
    }

    function renderPool() {
        pool.innerHTML = '';
        gameState.data.statements.forEach(msg => {
            const card = document.createElement('div');
            card.className = 'statement-card';
            card.id = `card-${msg.id}`;
            card.innerText = `"${msg.text}"`;
            card.addEventListener('click', () => handleStatementClick(msg.id));
            pool.appendChild(card);
        });
    }

    function handleStatementClick(id) {
        if (gameState.solved) return;

        // Deselect previous
        if (gameState.selectedStatement === id) {
            gameState.selectedStatement = null;
            document.querySelectorAll('.statement-card').forEach(c => c.classList.remove('selected'));
            return;
        }

        gameState.selectedStatement = id;
        document.querySelectorAll('.statement-card').forEach(c => {
            c.classList.toggle('selected', c.id === `card-${id}`);
        });
    }

    function handleDropPointClick(phaseId) {
        if (!gameState.selectedStatement || gameState.solved) return;

        // Check if statement already assigned elsewhere
        Object.keys(gameState.assignments).forEach(pid => {
            if (gameState.assignments[pid] === gameState.selectedStatement) {
                delete gameState.assignments[pid];
                const prevDp = document.querySelector(`.drop-point[data-id="${pid}"]`);
                prevDp.classList.remove('active');
            }
        });

        // Assign to this point
        gameState.assignments[phaseId] = gameState.selectedStatement;

        // Update UI
        const dp = document.querySelector(`.drop-point[data-id="${phaseId}"]`);
        dp.classList.add('active');

        // Highlight in pool (maybe dim it?)
        // document.getElementById(`card-${gameState.selectedStatement}`).classList.add('hidden');

        gameState.selectedStatement = null;
        document.querySelectorAll('.statement-card').forEach(c => c.classList.remove('selected'));

        updateStatus();
    }

    function updateStatus() {
        const count = Object.keys(gameState.assignments).length;
        progressVal.innerText = `${count}/7`;
        checkBtn.disabled = count < 7;
    }

    function checkSolution() {
        let correctCount = 0;
        gameState.data.phases.forEach(phase => {
            const assignedId = gameState.assignments[phase.id];
            const statement = gameState.data.statements.find(s => s.id === assignedId);
            const dp = document.querySelector(`.drop-point[data-id="${phase.id}"]`);

            if (statement && statement.targetPhase === phase.id) {
                correctCount++;
                dp.classList.add('correct');
            } else {
                dp.style.borderColor = 'hsl(var(--error))';
            }
        });

        gameState.solved = true;
        checkBtn.disabled = true;

        const score = Math.round((correctCount / 7) * 100);
        resultTitle.innerText = score === 100 ? "Perfekt!" : "Ergebnis";
        resultText.innerText = `${score}% Korrekt zugeordnet.\n\n` +
            (score === 100 ? gameState.data.scoring.perfect : gameState.data.scoring.good);

        overlay.style.display = 'block';
    }

    function resetGame() {
        gameState.solved = false;
        gameState.assignments = {};
        gameState.selectedStatement = null;

        updateStatus();
        renderPhases();
        renderPool();
        overlay.style.display = 'none';
        checkBtn.disabled = true;
    }

    initGame();
});
