/**
 * Risiko-Waage Game Logic
 * Implements Drag & Drop sorting for Risk Management (Make or Buy).
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const gameTitle = document.getElementById('game-title');
    const gameSubtitle = document.getElementById('game-subtitle');
    const itemsCount = document.getElementById('items-count');
    const scoreDisplay = document.getElementById('score-display');
    const zonesArea = document.getElementById('zones-area');
    const itemPool = document.getElementById('item-pool');
    const feedbackArea = document.getElementById('feedback-area');
    const checkBtn = document.getElementById('check-btn');
    const resetBtn = document.getElementById('reset-btn');

    // State
    let gameState = {
        items: [],
        categories: [],
        placements: new Map(), // itemId -> categoryId
        isChecked: false
    };

    // Load Game Data
    fetch('data/_g01_fremdvergabe_risiko_waage.json')
        .then(response => response.json())
        .then(data => initGame(data))
        .catch(err => {
            console.error('Error loading game data:', err);
            gameSubtitle.innerText = 'Fehler beim Laden der Spieldaten.';
            gameSubtitle.style.color = 'var(--error)';
        });

    function initGame(data) {
        // Set Meta
        gameTitle.innerText = data.gameTitle;
        gameSubtitle.innerText = data.gameSubtitle || data.instruction;
        gameState.categories = data.categories;
        gameState.items = data.items; // Shuffle items?
        gameState.feedbackTemplates = data.feedbackTemplates;

        renderBoard();
        updateStats();

        // Event Listeners
        checkBtn.addEventListener('click', checkSolution);
        resetBtn.addEventListener('click', resetGame);
    }

    function renderBoard() {
        // Render Zones
        zonesArea.innerHTML = '';
        gameState.categories.forEach(cat => {
            const zone = document.createElement('div');
            zone.className = 'drop-zone';
            zone.dataset.categoryId = cat.id;
            // Set dynamic border color for branding but adhere to glassmorphism in default
            zone.style.setProperty('--zone-color', cat.color);

            zone.innerHTML = `
                <div class="zone-header">
                    <h2 class="zone-title" style="color: ${cat.color}">${cat.icon || ''} ${cat.label}</h2>
                    <div class="zone-subtitle">${cat.subLabel}</div>
                </div>
                <div class="zone-items-container" style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;"></div>
            `;

            // Drop Events
            zone.addEventListener('dragover', handleDragOver);
            zone.addEventListener('dragleave', handleDragLeave);
            zone.addEventListener('drop', handleDrop);

            zonesArea.appendChild(zone);
        });

        // Render Items (Shuffled)
        renderPool();
    }

    function renderPool() {
        itemPool.innerHTML = '';
        gameState.placements.clear();

        const shuffledItems = [...gameState.items].sort(() => Math.random() - 0.5);

        shuffledItems.forEach(item => {
            const el = createDraggableElement(item);
            itemPool.appendChild(el);
        });
    }

    function createDraggableElement(item) {
        const el = document.createElement('div');
        el.className = 'draggable-item';
        el.draggable = true;
        el.id = item.id;
        el.innerText = item.text;
        el.title = item.explanation || ''; // Tooltip hint

        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragend', handleDragEnd);

        return el;
    }

    // Drag & Drop Handlers
    function handleDragStart(e) {
        if (gameState.isChecked) return; // Lock if checked
        e.dataTransfer.setData('text/plain', e.target.id);
        e.target.classList.add('dragging');
        setTimeout(() => e.target.style.display = 'none', 0); // Hide visual but keep drag image
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        e.target.style.display = 'block';
    }

    function handleDragOver(e) {
        if (gameState.isChecked) return;
        e.preventDefault();
        const zone = e.target.closest('.drop-zone');
        if (zone) zone.classList.add('hovered');
    }

    function handleDragLeave(e) {
        const zone = e.target.closest('.drop-zone');
        if (zone) zone.classList.remove('hovered');
    }

    function handleDrop(e) {
        if (gameState.isChecked) return;
        e.preventDefault();

        const zone = e.target.closest('.drop-zone');
        if (!zone) return;

        zone.classList.remove('hovered');
        const itemId = e.dataTransfer.getData('text/plain');
        const itemEl = document.getElementById(itemId);

        // Move to Zone or back to Pool?
        // Actually, we just append to the zone's container
        const container = zone.querySelector('.zone-items-container');
        container.appendChild(itemEl);

        // Update State
        gameState.placements.set(itemId, zone.dataset.categoryId);
        updateStats();
    }

    // Allow dropping back to pool
    itemPool.addEventListener('dragover', e => {
        if (gameState.isChecked) return;
        e.preventDefault();
        itemPool.style.background = 'hsl(var(--bg-surface) / 0.8)';
    });

    itemPool.addEventListener('dragleave', e => {
        itemPool.style.background = '';
    });

    itemPool.addEventListener('drop', e => {
        if (gameState.isChecked) return;
        e.preventDefault();
        itemPool.style.background = '';
        const itemId = e.dataTransfer.getData('text/plain');
        const itemEl = document.getElementById(itemId);
        itemPool.appendChild(itemEl);
        gameState.placements.delete(itemId);
        updateStats();
    });


    // Game Logic
    function checkSolution() {
        if (gameState.placements.size === 0) {
            showFeedback("Bitte ordne zuerst Güter zu!", "error");
            return;
        }

        let correctCount = 0;
        let errors = [];

        gameState.items.forEach(item => {
            const placedCategory = gameState.placements.get(item.id);
            const el = document.getElementById(item.id);

            // Add Explanation Tooltip/Text
            /* Optional: Add explanation visual */

            if (placedCategory === item.category) {
                correctCount++;
                el.classList.add('correct');
            } else if (placedCategory) {
                el.classList.add('wrong');
                // Create a mini badge for correction
                const badge = document.createElement('div');
                badge.style.fontSize = '0.7em';
                badge.style.marginTop = '0.5em';
                badge.style.color = 'hsl(var(--txt-muted))';
                badge.innerText = `Richtig wäre: "${getCategoryLabel(item.category)}"`;
                el.appendChild(badge);
            }
        });

        const score = Math.round((correctCount / gameState.items.length) * 100);
        scoreDisplay.innerText = `${score}%`;

        if (score === 100) {
            showFeedback(gameState.feedbackTemplates.correct, "success");
        } else {
            showFeedback(gameState.feedbackTemplates.wrong, "error");
        }

        gameState.isChecked = true;
        checkBtn.disabled = true;
    }

    function resetGame() {
        gameState.isChecked = false;
        gameState.placements.clear();
        checkBtn.disabled = false;

        // Move all items back to pool and clear classes
        const allItems = document.querySelectorAll('.draggable-item');
        allItems.forEach(el => {
            el.className = 'draggable-item'; // Reset classes
            // Remove badges
            const badge = el.querySelector('div');
            if (badge) badge.remove();

            itemPool.appendChild(el);
        });

        // Hide feedback
        feedbackArea.className = 'feedback-area';
        feedbackArea.innerText = '';

        updateStats();

        // Reshuffle
        renderPool();
    }

    function updateStats() {
        const placed = gameState.placements.size;
        const total = gameState.items.length;
        itemsCount.innerText = `${placed}/${total}`;

        if (!gameState.isChecked) {
            scoreDisplay.innerText = "0%";
        }
    }

    function showFeedback(msg, type) {
        feedbackArea.innerText = msg;
        feedbackArea.className = `feedback-area show`;
        if (type === 'error') feedbackArea.style.color = 'hsl(var(--error))';
        if (type === 'success') feedbackArea.style.color = 'hsl(var(--success))';
    }

    function getCategoryLabel(id) {
        const cat = gameState.categories.find(c => c.id === id);
        return cat ? cat.label : id;
    }
});
