/**
 * SortingGame Engine
 * Handles "Category Sorting" gameplay.
 * Loads configuration from a JSON file specified in URL parameters or defaults to a local test file.
 */

class SortingGame {
    constructor() {
        this.config = null;
        this.score = 0;
        this.currentRound = 0;
        this.maxRounds = 10;
        this.items = [];
        this.currentItem = null;
        this.gameLoopId = null;
        this.simulatedMs = 0;
        this.dropZoneLeft = document.getElementById('drop-zone-left');
        this.dropZoneRight = document.getElementById('drop-zone-right');
        this.spawner = document.getElementById('item-spawner');
        this.scoreDisplay = document.getElementById('score-display');
        this.feedbackMessage = document.getElementById('feedback-message');
        this.finalScoreDisplay = document.getElementById('final-score');

        // Bind methods
        this.startGame = this.startGame.bind(this);
        this.loop = this.loop.bind(this);
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);

        this.init();
    }

    // ... (previous code)

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        const requestedConfigPath = urlParams.get('config') || 'config.json';
        const configPath = this.resolveConfigPath(requestedConfigPath);

        // Handle relative paths from deep nested structures if needed
        // Assuming configPath is relative to the *caller* or absolute

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

    resolveConfigPath(configPath) {
        const rawPath = String(configPath || '').trim() || 'config.json';
        if (/^(https?:)?\/\//i.test(rawPath) || rawPath.startsWith('/')) {
            return rawPath;
        }
        const baseCandidates = [document.referrer, window.location.href].filter(Boolean);
        for (const base of baseCandidates) {
            try {
                return new URL(rawPath, base).href;
            } catch (_) {
                // Try next candidate
            }
        }
        return rawPath;
    }

    normalizeConfig(raw) {
        // Support for "terms" array (legacy/existing format)
        if (raw.terms && !raw.items) {
            raw.items = raw.terms.map(t => ({
                text: t.text,
                category: t.category,
                explanation: t.explanation
            }));
        }

        // Support for "categories" with key/label
        if (raw.categories) {
            raw.categories = raw.categories.map(c => ({
                id: c.key || c.id,
                name: c.label || c.name,
                color: c.color
            }));
        }

        // Support for subtitle as instruction
        if (raw.subtitle && !raw.instruction) {
            raw.instruction = raw.subtitle;
        }

        return raw;
    }

    setupUI() {
        // ... (rest of the code)
        document.getElementById('game-title').innerText = this.config.title || "Sortier-Spiel";
        document.getElementById('instruction-text').innerText = this.config.instruction || "Ordne die Begriffe zu!";

        // Setup categories
        if (this.config.categories && this.config.categories.length >= 2) {
            document.getElementById('label-left').innerText = this.config.categories[0].name;
            this.dropZoneLeft.dataset.category = this.config.categories[0].id;

            document.getElementById('label-right').innerText = this.config.categories[1].name;
            this.dropZoneRight.dataset.category = this.config.categories[1].id;
        }

        // Attach event listeners
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('start-screen').classList.add('hidden');
            this.startGame();
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            document.getElementById('end-screen').classList.add('hidden');
            this.resetGame();
            this.startGame();
        });
    }

    resetGame() {
        this.score = 0;
        this.currentRound = 0;
        this.updateScore();
        this.spawner.innerHTML = '';
        this.items = [...this.config.items]; // Copy items from config
        // Shuffle items
        this.items.sort(() => Math.random() - 0.5);
    }

    startGame() {
        if (!this.items || this.items.length === 0) this.resetGame();
        this.nextItem();
    }

    nextItem() {
        if (this.currentRound >= this.maxRounds || this.items.length === 0) {
            this.endGame();
            return;
        }

        const itemData = this.items.pop();
        this.currentItem = document.createElement('div');
        this.currentItem.classList.add('sort-item');
        this.currentItem.innerText = itemData.text;
        this.currentItem.dataset.category = itemData.category; // Store correct category ID

        // Initial Position (Center Top)
        this.currentItem.style.top = '10px';
        this.currentItem.style.left = '50%';
        this.currentItem.style.transform = 'translateX(-50%)';

        // Add Draggable capability
        this.currentItem.draggable = true;
        this.currentItem.addEventListener('dragstart', this.handleDragStart);
        this.currentItem.addEventListener('dragend', this.handleDragEnd);

        // Touch support (basic implementation)
        this.currentItem.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.currentItem.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.currentItem.addEventListener('touchend', this.handleTouchEnd.bind(this));

        this.spawner.appendChild(this.currentItem);

        // Start falling animation loop
        this.lastTime = performance.now();
        this.gameLoopId = requestAnimationFrame(this.loop);
    }

    loop(timestamp) {
        if (!this.currentItem) return;

        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Move Item down
        const speed = 0.05 * (1 + (this.currentRound * 0.1)); // Increase speed slightly each round
        let currentTop = parseFloat(this.currentItem.style.top) || 0;

        if (!this.isDragging) {
            // Only move if not being dragged
            // currentTop += speed * deltaTime; 
            // Logic simplified for Demo: Item stays until manipulated or time runs out?
            // Let's implement slow fall.
            currentTop += 0.5; // pixel per frame
            this.currentItem.style.top = currentTop + 'px';

            // Check if out of bounds (bottom)
            if (currentTop > window.innerHeight - 100) {
                this.handleFail("Zu langsam!");
                return;
            }
        }

        this.gameLoopId = requestAnimationFrame(this.loop);
    }

    handleFail(reason) {
        cancelAnimationFrame(this.gameLoopId);
        this.feedbackMessage.innerText = reason || "Falsch!";
        this.currentItem.classList.add('fail');
        setTimeout(() => {
            if (this.currentItem) this.currentItem.remove();
            this.currentRound++;
            this.nextItem();
        }, 1000);
    }

    handleSuccess() {
        cancelAnimationFrame(this.gameLoopId);
        this.score += 10;
        this.updateScore();
        this.currentItem.classList.add('success');
        setTimeout(() => {
            if (this.currentItem) this.currentItem.remove();
            this.currentRound++;
            this.nextItem();
        }, 500);
    }

    handleDragStart(e) {
        this.isDragging = true;
        e.dataTransfer.setData('text/plain', this.currentItem.dataset.category);
        e.target.classList.add('dragging');
    }

    handleDragEnd(e) {
        this.isDragging = false;
        e.target.classList.remove('dragging');
    }

    // Drop Zone Logic
    setupDropZones() {
        [this.dropZoneLeft, this.dropZoneRight].forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault(); // Allow drop
                zone.classList.add('highlight');
            });

            zone.addEventListener('dragleave', () => {
                zone.classList.remove('highlight');
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('highlight');
                const correctCategory = this.currentItem.dataset.category;
                const droppedCategory = zone.dataset.category;

                if (correctCategory === droppedCategory) {
                    this.handleSuccess();
                } else {
                    this.handleFail("Falsche Kategorie!");
                }
            });
        });
    }

    // Touch Handling (simplified)
    handleTouchStart(e) {
        this.isDragging = true;
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        e.preventDefault();
    }

    handleTouchMove(e) {
        if (!this.isDragging) return;
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;

        this.currentItem.style.left = x + 'px';
        this.currentItem.style.top = y + 'px';
        e.preventDefault();
    }

    handleTouchEnd(e) {
        this.isDragging = false;
        // Check collision with drop zones manually
        const itemRect = this.currentItem.getBoundingClientRect();
        const leftRect = this.dropZoneLeft.getBoundingClientRect();
        const rightRect = this.dropZoneRight.getBoundingClientRect();

        if (this.isColliding(itemRect, leftRect)) {
            this.checkDrop(this.dropZoneLeft.dataset.category);
        } else if (this.isColliding(itemRect, rightRect)) {
            this.checkDrop(this.dropZoneRight.dataset.category);
        }
    }

    isColliding(rect1, rect2) {
        return !(rect1.right < rect2.left ||
            rect1.left > rect2.right ||
            rect1.bottom < rect2.top ||
            rect1.top > rect2.bottom);
    }

    checkDrop(targetCategoryId) {
        if (this.currentItem.dataset.category === targetCategoryId) {
            this.handleSuccess();
        } else {
            this.handleFail("Falsche Kategorie!");
        }
    }

    updateScore() {
        this.scoreDisplay.innerText = `Score: ${this.score}`;
    }

    endGame() {
        cancelAnimationFrame(this.gameLoopId);
        document.getElementById('end-screen').classList.remove('hidden');
        this.finalScoreDisplay.innerText = `Dein Score: ${this.score} / ${this.maxRounds * 10}`;

        if (this.score >= 80) {
            this.feedbackMessage.innerText = "Super gemacht!";
            this.feedbackMessage.style.color = "green";
        } else {
            this.feedbackMessage.innerText = "Übe noch etwas...";
            this.feedbackMessage.style.color = "orange";
        }
    }

    getMode() {
        const startHidden = document.getElementById('start-screen')?.classList.contains('hidden');
        const endVisible = !document.getElementById('end-screen')?.classList.contains('hidden');
        if (!startHidden) return 'start';
        if (endVisible) return 'end';
        return this.currentItem ? 'active' : 'loading';
    }

    getProgressPercent() {
        if (!this.maxRounds || this.maxRounds <= 0) return 0;
        const clamped = Math.max(0, Math.min(this.currentRound, this.maxRounds));
        return Math.round((clamped / this.maxRounds) * 100);
    }

    renderGameToText() {
        const payload = {
            mode: this.getMode(),
            coordinate_system: 'origin top-left, x right, y down',
            score: this.score,
            current_round: this.currentRound,
            max_rounds: this.maxRounds,
            progress_percent: this.getProgressPercent(),
            simulated_ms: this.simulatedMs,
            current_item: this.currentItem
                ? {
                    text: this.currentItem.innerText || '',
                    category: this.currentItem.dataset.category || '',
                    top: parseFloat(this.currentItem.style.top) || 0
                }
                : null
        };
        return JSON.stringify(payload);
    }

    advanceTime(ms) {
        const deltaMs = Math.max(0, Number(ms) || 0);
        this.simulatedMs += deltaMs;
        return this.simulatedMs;
    }
}

// Start the engine
const gameEngine = new SortingGame();
gameEngine.setupDropZones();
window.render_game_to_text = () => gameEngine.renderGameToText();
window.advanceTime = (ms) => gameEngine.advanceTime(ms);
