/**
 * ConstructionGame Engine
 * Handles "Drag and Drop Ordering / Puzzle" gameplay.
 * Loads configuration from a JSON file.
 * Features: Native Drag & Drop, Source -> Target, Verification.
 */

class ConstructionGame {
    constructor() {
        this.config = null;
        this.items = [];
        this.draggedItem = null;
        this.simulatedMs = 0;
        this.gameUI = {
            title: document.getElementById('game-title'),
            instruction: document.getElementById('instruction-text'),
            startScreen: document.getElementById('start-screen'),
            endScreen: document.getElementById('end-screen'),
            sourceContainer: document.getElementById('source-container'),
            targetContainer: document.getElementById('target-container'),
            checkBtn: document.getElementById('check-btn'),
            resetBtn: document.getElementById('reset-btn'),
            feedback: document.getElementById('feedback-area'),
            finalMessage: document.getElementById('final-message')
        };

        this.init();
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        const requestedConfigPath = urlParams.get('config') || 'config.json';
        const configPath = this.resolveConfigPath(requestedConfigPath);

        try {
            const response = await fetch(configPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.config = await response.json();
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

    setupUI() {
        this.gameUI.title.innerText = this.config.title || "Bau-Spiel";
        if (this.gameUI.instruction) this.gameUI.instruction.innerText = this.config.goal || "Ordne die Elemente!";

        // Render Items in Source
        const originalItems = this.config.items || [];
        // Shuffle create a copy and shuffle
        this.items = [...originalItems].sort(() => Math.random() - 0.5);

        this.items.forEach(item => {
            const el = this.createItemElement(item);
            this.gameUI.sourceContainer.appendChild(el);
        });

        // Setup Drag Zones
        this.setupContainer(this.gameUI.sourceContainer);
        this.setupContainer(this.gameUI.targetContainer);

        // Events
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('start-screen').classList.add('hidden');
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            location.reload();
        });

        this.gameUI.checkBtn.addEventListener('click', () => this.checkSolution());
        this.gameUI.resetBtn.addEventListener('click', () => location.reload());
    }

    createItemElement(item) {
        const el = document.createElement('div');
        el.className = 'draggable-item';
        el.draggable = true;
        el.dataset.id = item.id;

        // Content
        el.innerHTML = `
            <span class="item-title">${item.title || item.text}</span>
            ${item.duration ? `<span class="item-badge">${item.duration}</span>` : ''}
        `;

        // Drag Events
        el.addEventListener('dragstart', (e) => {
            this.draggedItem = el;
            el.classList.add('dragging');
            // Firefox requires dataTransfer to be set
            e.dataTransfer.setData('text/plain', item.id);
            e.dataTransfer.effectAllowed = 'move';
        });

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            this.draggedItem = null;
        });

        // Click to Move (Mobile / Accessibility)
        el.addEventListener('click', () => {
            const currentParent = el.parentElement;
            if (currentParent.id === 'source-container') {
                this.gameUI.targetContainer.appendChild(el);
            } else {
                this.gameUI.sourceContainer.appendChild(el);
            }
            this.updatePlaceholder();
        });

        return el;
    }

    setupContainer(container) {
        container.addEventListener('dragover', (e) => {
            e.preventDefault(); // enable drop
            const afterElement = this.getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) {
                    container.appendChild(draggable);
                } else {
                    container.insertBefore(draggable, afterElement);
                }
                this.updatePlaceholder();
            }
        });
    }

    getDragAfterElement(container, y) {
        // Get all draggable elements except the one being dragged
        const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            // Negative offset means mouse is above the center of child
            // We want the closest negative offset (closest above)
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updatePlaceholder() {
        const placeholder = this.gameUI.targetContainer.querySelector('.placeholder-text');
        if (placeholder) {
            // If dragging over, or items present, hide placeholder
            const hasItems = this.gameUI.targetContainer.querySelectorAll('.draggable-item').length > 0;
            placeholder.style.display = hasItems ? 'none' : 'block';
        }
    }

    checkSolution() {
        // Get current order of IDs in target container
        const currentElements = [...this.gameUI.targetContainer.querySelectorAll('.draggable-item')];
        const currentOrder = currentElements.map(el => el.dataset.id);

        // Validation: Must use all items? Assuming yes for puzzle.
        // Config Solution is array of IDs in correct order
        const correctOrder = this.config.solution || [];

        if (currentOrder.length !== correctOrder.length) {
            this.showFeedback(`Du hast ${currentOrder.length} von ${correctOrder.length} Elementen platziert.`, "error");
            return;
        }

        // Check if order matches exactly
        let allCorrect = true;
        let correctCount = 0;

        for (let i = 0; i < correctOrder.length; i++) {
            if (currentOrder[i] !== correctOrder[i]) {
                allCorrect = false;
            } else {
                correctCount++;
            }
        }

        if (allCorrect) {
            this.showFeedback(this.config.feedbackTemplates?.correct || "Richtig! Gut gebaut.", "success");
            setTimeout(() => this.endGame(), 1500);
        } else {
            this.showFeedback(this.config.feedbackTemplates?.wrong || `Leider nicht ganz. ${correctCount} von ${correctOrder.length} richtig.`, "error");
        }
    }

    showFeedback(msg, type) {
        const fb = this.gameUI.feedback;
        fb.innerText = msg;
        fb.className = `feedback-toast show ${type}`;
        fb.classList.remove('hidden');

        // Auto hide after 3 sec
        setTimeout(() => {
            fb.classList.remove('show');
            setTimeout(() => fb.classList.add('hidden'), 300);
        }, 3000);
    }

    endGame() {
        this.gameUI.endScreen.classList.remove('hidden');
        if (this.gameUI.finalMessage) {
            this.gameUI.finalMessage.innerText = this.config.feedbackTemplates?.correct || "Super gemacht!";
        }
    }

    getMode() {
        const startHidden = this.gameUI.startScreen?.classList.contains('hidden');
        const endVisible = !this.gameUI.endScreen?.classList.contains('hidden');
        if (!startHidden) return 'start';
        if (endVisible) return 'end';
        return this.config ? 'building' : 'loading';
    }

    getTargetOrder() {
        const currentElements = [...this.gameUI.targetContainer.querySelectorAll('.draggable-item')];
        return currentElements.map((el) => el.dataset.id);
    }

    getProgressPercent() {
        const solution = this.config?.solution || [];
        if (!solution.length) return 0;
        const currentOrder = this.getTargetOrder();
        let correctAtPosition = 0;
        for (let i = 0; i < Math.min(solution.length, currentOrder.length); i += 1) {
            if (solution[i] === currentOrder[i]) correctAtPosition += 1;
        }
        return Math.round((correctAtPosition / solution.length) * 100);
    }

    renderGameToText() {
        const source = [...this.gameUI.sourceContainer.querySelectorAll('.draggable-item')].map((el) => el.dataset.id);
        const target = this.getTargetOrder();
        return JSON.stringify({
            mode: this.getMode(),
            coordinate_system: 'origin top-left, x right, y down',
            source_order: source,
            target_order: target,
            solution_order: this.config?.solution || [],
            progress_percent: this.getProgressPercent(),
            simulated_ms: this.simulatedMs
        });
    }

    advanceTime(ms) {
        const deltaMs = Math.max(0, Number(ms) || 0);
        this.simulatedMs += deltaMs;
        return this.simulatedMs;
    }
}

// Start Engine
const constructionGame = new ConstructionGame();
window.render_game_to_text = () => constructionGame.renderGameToText();
window.advanceTime = (ms) => constructionGame.advanceTime(ms);
