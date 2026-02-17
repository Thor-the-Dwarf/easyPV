/**
 * Outsourcing-Vertrags-Puzzle Game Logic
 * Interactive gap-fill contract builder with validation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const gameTitle = document.getElementById('game-title');
    const gameSubtitle = document.getElementById('game-subtitle');
    const instruction = document.getElementById('instruction');
    const contractDisplay = document.getElementById('contract-display');
    const gapsFilled = document.getElementById('gaps-filled');
    const securityScore = document.getElementById('security-score');
    const feedbackArea = document.getElementById('feedback-area');
    const checkBtn = document.getElementById('check-btn');
    const resetBtn = document.getElementById('reset-btn');

    // State
    let gameState = {
        gaps: [],
        selections: new Map(), // gapId -> selectedOptionId
        isChecked: false
    };

    // Load Game Data
    fetch('_data/_g01_fremdvergabe_outsourcing_vertrag.json')
        .then(response => response.json())
        .then(data => initGame(data))
        .catch(err => {
            console.error('Error loading game data:', err);
            gameSubtitle.innerText = 'Fehler beim Laden der Spieldaten.';
            gameSubtitle.style.color = 'hsl(var(--error))';
        });

    function initGame(data) {
        // Set Meta
        gameTitle.innerText = data.gameTitle;
        gameSubtitle.innerText = data.gameSubtitle;
        instruction.innerText = data.instruction;
        gameState.gaps = data.gaps;
        gameState.scoring = data.scoring;

        renderContract(data.contractTemplate);
        updateStats();

        // Event Listeners
        checkBtn.addEventListener('click', checkSolution);
        resetBtn.addEventListener('click', resetGame);
    }

    function renderContract(template) {
        // Replace placeholders with interactive gaps
        let htmlContent = template;

        gameState.gaps.forEach((gap, index) => {
            const gapHtml = createGapElement(gap, index);
            htmlContent = htmlContent.replace(`__${gap.id}__`, gapHtml);
        });

        contractDisplay.innerHTML = htmlContent;

        // Attach event listeners to option buttons
        gameState.gaps.forEach(gap => {
            gap.options.forEach(option => {
                const btn = document.getElementById(option.id);
                if (btn) {
                    btn.addEventListener('click', () => selectOption(gap.id, option.id));
                }
            });
        });
    }

    function createGapElement(gap, index) {
        const optionsHtml = gap.options.map(opt =>
            `<div class="gap-option" id="${opt.id}" data-gap="${gap.id}">
                ${opt.text}
            </div>`
        ).join('');

        return `<span class="gap-container">
            <span class="gap-label">${gap.label}</span>
            <span class="gap-options" id="gap-${gap.id}">
                ${optionsHtml}
            </span>
        </span>`;
    }

    function selectOption(gapId, optionId) {
        if (gameState.isChecked) return; // Lock after checking

        // Clear previous selection for this gap
        const gapContainer = document.getElementById(`gap-${gapId}`);
        gapContainer.querySelectorAll('.gap-option').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Mark new selection
        const selectedBtn = document.getElementById(optionId);
        selectedBtn.classList.add('selected');

        gameState.selections.set(gapId, optionId);
        updateStats();
    }

    function checkSolution() {
        if (gameState.selections.size < gameState.gaps.length) {
            showFeedback("⚠ Bitte fülle alle Lücken aus!", "error");
            return;
        }

        let correctCount = 0;

        gameState.gaps.forEach(gap => {
            const selectedOptionId = gameState.selections.get(gap.id);
            const selectedOption = gap.options.find(opt => opt.id === selectedOptionId);
            const optionBtn = document.getElementById(selectedOptionId);

            // Visual feedback
            if (selectedOption.correct) {
                correctCount++;
                optionBtn.classList.add('correct');
                optionBtn.classList.remove('wrong');
            } else {
                optionBtn.classList.add('wrong');
                optionBtn.classList.remove('correct');
            }

            // Show explanation
            const explanation = document.createElement('div');
            explanation.className = 'explanation show';
            explanation.innerHTML = selectedOption.explanation;

            // Remove old explanations
            const gapContainer = document.getElementById(`gap-${gap.id}`);
            const oldExplanation = gapContainer.querySelector('.explanation');
            if (oldExplanation) oldExplanation.remove();

            gapContainer.appendChild(explanation);
        });

        const score = Math.round((correctCount / gameState.gaps.length) * 100);
        securityScore.innerText = `${score}%`;

        // Apply score color
        const scoreEl = document.getElementById('security-score').parentElement;
        scoreEl.className = 'section-status';
        if (score >= 80) {
            scoreEl.style.background = 'hsl(var(--success) / 0.2)';
            scoreEl.style.borderColor = 'hsl(var(--success))';
        } else if (score >= 60) {
            scoreEl.style.background = 'hsl(195 100% 60% / 0.2)';
        } else {
            scoreEl.style.background = 'hsl(var(--error) / 0.2)';
            scoreEl.style.borderColor = 'hsl(var(--error))';
        }

        // Overall feedback
        let feedbackMsg;
        if (score === 100) feedbackMsg = gameState.scoring.perfect;
        else if (score >= 80) feedbackMsg = gameState.scoring.good;
        else if (score >= 60) feedbackMsg = gameState.scoring.medium;
        else feedbackMsg = gameState.scoring.poor;

        showFeedback(feedbackMsg, score >= 80 ? 'success' : 'error');

        gameState.isChecked = true;
        checkBtn.disabled = true;
    }

    function resetGame() {
        gameState.isChecked = false;
        gameState.selections.clear();
        checkBtn.disabled = false;

        // Clear all selections and feedback
        document.querySelectorAll('.gap-option').forEach(btn => {
            btn.className = 'gap-option';
        });

        document.querySelectorAll('.explanation').forEach(exp => {
            exp.remove();
        });

        // Reset score display
        securityScore.innerText = '0%';
        const scoreEl = document.getElementById('security-score').parentElement;
        scoreEl.className = 'section-status';
        scoreEl.style.background = '';
        scoreEl.style.borderColor = '';

        feedbackArea.className = 'feedback-area';
        feedbackArea.innerText = '';

        updateStats();
    }

    function updateStats() {
        const filled = gameState.selections.size;
        const total = gameState.gaps.length;
        gapsFilled.innerText = `${filled}/${total}`;

        if (!gameState.isChecked) {
            securityScore.innerText = '0%';
        }
    }

    function showFeedback(msg, type) {
        feedbackArea.innerText = msg;
        feedbackArea.className = 'feedback-area show';
        if (type === 'error') feedbackArea.style.color = 'hsl(var(--error))';
        if (type === 'success') feedbackArea.style.color = 'hsl(var(--success))';
    }
});
