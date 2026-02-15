/**
 * DecisionGame Engine
 * Handles "Scenario -> Options" gameplay.
 * Loads configuration from a JSON file.
 */

class DecisionGame {
    constructor() {
        this.config = null;
        this.score = 0;
        this.currentRound = 0;
        this.streak = 0; // Bonus for consecutive correct answers
        this.maxRounds = 0;
        this.rounds = [];
        this.currentScenario = null;
        this.gameUI = {
            title: document.getElementById('game-title'),
            instruction: document.getElementById('instruction-text'),
            startScreen: document.getElementById('start-screen'),
            endScreen: document.getElementById('end-screen'),
            card: document.getElementById('scenario-card'),
            imageContainer: document.getElementById('image-container'),
            image: document.getElementById('scenario-image'),
            phase: document.getElementById('scenario-phase'),
            text: document.getElementById('scenario-text'),
            options: document.getElementById('options-container'),
            feedbackArea: document.getElementById('feedback-area'),
            feedbackMsg: document.getElementById('feedback-message'),
            feedbackReason: document.getElementById('feedback-reason'),
            nextBtn: document.getElementById('next-btn'),
            score: document.getElementById('score-display'),
            round: document.getElementById('round-display'),
            progress: document.getElementById('progress-fill'),
            finalScore: document.getElementById('final-score'),
            finalFeedback: document.getElementById('final-feedback')
        };

        this.init();
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        let configPath = urlParams.get('config') || 'config.json';

        try {
            const response = await fetch(configPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawConfig = await response.json();
            this.config = this.normalizeConfig(rawConfig);
            this.setupUI();
        } catch (e) {
            console.error("Failed to load game config:", e);
            document.body.innerHTML = "<h1>Fehler beim Laden der Konfiguration</h1><p>" + e.message + "</p>";
        }
    }

    normalizeConfig(raw) {
        // Special Handling for "Defect Types / Cases" Format (e.g. Leasing Gutachter)
        if (raw.defectTypes && raw.cases && (!raw.rounds || raw.rounds.length === 0)) {
            console.log("Converting DefectTypes/Cases format to Rounds...");
            raw.rounds = raw.cases.map(c => {
                // Each case becomes a round
                // Options are ALL defect types
                const options = raw.defectTypes.map(dt => ({
                    id: dt.key || dt.id,
                    text: dt.label || dt.name,
                    correct: (dt.key === c.defectType || dt.id === c.defectType),
                    reason: (dt.key === c.defectType || dt.id === c.defectType) ? c.explanation : (dt.examHint || "")
                }));

                return {
                    phase: `Fall ${c.id}`,
                    situation: c.description,
                    imageUrl: c.imageUrl,
                    options: options
                };
            });
        }

        // Ensure "rounds" array exists
        if (!raw.rounds || !Array.isArray(raw.rounds)) {
            raw.rounds = [];
        }
        return raw;
    }

    setupUI() {
        this.gameUI.title.innerText = this.config.title || "Entscheidungs-Spiel";
        if (this.config.subtitle) {
            this.gameUI.instruction.innerText = this.config.subtitle;
        }

        document.getElementById('start-btn').addEventListener('click', () => {
            this.gameUI.startScreen.classList.add('hidden');
            this.startGame();
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.gameUI.endScreen.classList.add('hidden');
            this.resetGame();
            this.startGame();
        });

        this.gameUI.nextBtn.addEventListener('click', () => {
            this.currentRound++;
            this.nextRound();
        });
    }

    resetGame() {
        this.score = 0;
        this.currentRound = 0;
        this.streak = 0;
        this.updateStats();
        this.rounds = [...this.config.rounds];
        this.maxRounds = this.rounds.length;
        // Optionally shuffle rounds? Let's keep order for story progression if needed.
    }

    startGame() {
        if (!this.rounds || this.rounds.length === 0) {
            this.resetGame();
        } else {
            this.maxRounds = this.rounds.length;
        }
        this.nextRound();
    }

    nextRound() {
        if (this.currentRound >= this.maxRounds) {
            this.endGame();
            return;
        }

        this.currentScenario = this.rounds[this.currentRound];
        this.renderScenario();
    }

    renderScenario() {
        // Reset View
        this.gameUI.options.innerHTML = '';
        this.gameUI.feedbackArea.classList.add('hidden');
        this.gameUI.nextBtn.classList.add('hidden'); // Only show Next button after answer? Or auto-advance? Let's use manual advance.
        this.gameUI.imageContainer.classList.add('hidden'); // Hide image by default

        // Update Content
        this.gameUI.phase.innerText = this.currentScenario.phase || `Szenario ${this.currentRound + 1}`;
        this.gameUI.text.innerText = this.currentScenario.situation;

        // Image Handling
        if (this.currentScenario.imageUrl) {
            this.gameUI.image.src = this.currentScenario.imageUrl;
            this.gameUI.imageContainer.classList.remove('hidden');
        }

        // Render Options
        const options = this.currentScenario.options;
        // Shuffle options display order
        const shuffledOptions = [...options].sort(() => Math.random() - 0.5);

        shuffledOptions.forEach(opt => {
            const btn = document.createElement('div');
            btn.classList.add('option-btn');
            btn.innerText = opt.text;
            btn.dataset.id = opt.id;
            btn.addEventListener('click', () => this.handleAnswer(opt, btn));
            this.gameUI.options.appendChild(btn);
        });

        this.updateStats();
    }

    handleAnswer(selectedOption, btnElement) {
        // Prevent multiple clicks
        const allBtns = this.gameUI.options.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.style.pointerEvents = 'none'); // Disable further clicks

        const isCorrect = selectedOption.correct === true;

        // Visual Feedback
        if (isCorrect) {
            btnElement.classList.add('correct');
            this.score += 20 + (this.streak * 10); // Bonus
            this.streak++;
            this.gameUI.feedbackMsg.innerText = "Richtig!";
            this.gameUI.feedbackMsg.style.color = "green";
        } else {
            btnElement.classList.add('wrong');
            // Highlight correct one
            allBtns.forEach(b => {
                // Find original option object for this button to check correctness
                // But we don't have direct link back easily unless we store it.
                // Let's iterate config options again or check ID.
                const optId = b.dataset.id;
                const optData = this.currentScenario.options.find(o => o.id === optId);
                if (optData && optData.correct) b.classList.add('correct');
            });

            this.score = Math.max(0, this.score - 10);
            this.streak = 0;
            this.gameUI.feedbackMsg.innerText = "Leider falsch...";
            this.gameUI.feedbackMsg.style.color = "red";
        }

        this.gameUI.feedbackReason.innerText = selectedOption.reason || "";
        this.gameUI.feedbackArea.classList.remove('hidden');
        this.gameUI.nextBtn.classList.remove('hidden');

        this.updateStats();
    }

    updateStats() {
        this.gameUI.score.innerText = ` Punkte: ${this.score}`;
        this.gameUI.round.innerText = `Runde ${this.currentRound + 1}/${this.maxRounds}`;
        const progress = ((this.currentRound) / this.maxRounds) * 100;
        this.gameUI.progress.style.width = `${progress}%`;
    }

    endGame() {
        this.gameUI.endScreen.classList.remove('hidden');
        this.gameUI.finalScore.innerText = `Dein Score: ${this.score}`;

        // Simple rating
        let feedback = "Versuch es nochmal!";
        const percent = this.score / (this.maxRounds * 20); // Approx max score
        if (percent > 0.8) feedback = "Hervorragende Leistung!";
        else if (percent > 0.5) feedback = "Gute Arbeit!";

        this.gameUI.finalFeedback.innerText = feedback;
    }
}

// Start Engine
new DecisionGame();
