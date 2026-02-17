(function () {
    'use strict';

    const STATE = {
        config: null,
        items: [],
        placedItems: {}, // map slotIndex -> itemId
        checked: false
    };

    const DOM = {
        poolList: document.getElementById('pool-list'),
        agendaList: document.getElementById('agenda-list'),
        checkBtn: document.getElementById('check-btn'),
        resetBtn: document.getElementById('reset-btn'),
        feedback: document.getElementById('feedback-area'),
        score: document.getElementById('score-display'),
        progress: document.getElementById('progress-display')
    };

    let draggedItem = null;

    async function init() {
        try {
            const resp = await fetch('data/_gg01_workshop_agenda_puzzle.json');
            if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
            STATE.config = await resp.json();
            STATE.items = [...STATE.config.items];
            renderGame();
        } catch (err) {
            console.error(err);
            DOM.feedback.textContent = 'Fehler beim Laden des Spiels: ' + err.message;
            DOM.feedback.className = 'feedback-msg error show';
        }
    }

    function renderGame() {
        // Clear lists
        DOM.poolList.innerHTML = '';
        DOM.agendaList.innerHTML = '';
        STATE.placedItems = {};
        STATE.checked = false;

        // Reset UI
        DOM.feedback.className = 'feedback-msg';
        DOM.checkBtn.disabled = false;
        DOM.score.textContent = 'Score: 0%';
        DOM.progress.textContent = `Items: 0/${STATE.items.length}`;

        // Render Pool Items (shuffled)
        const shuffled = [...STATE.items].sort(() => Math.random() - 0.5);
        shuffled.forEach(item => {
            const el = createItemElement(item);
            DOM.poolList.appendChild(el);
        });

        // Render Agenda Slots
        STATE.items.forEach((_, index) => {
            const slot = document.createElement('div');
            slot.className = 'agenda-list-item';
            slot.innerHTML = `
                <div class="agenda-slot" data-index="${index}">
                    <span>Platziere Schritt ${index + 1} hier</span>
                </div>
            `;

            const dropZone = slot.querySelector('.agenda-slot');
            setupDropZone(dropZone);
            DOM.agendaList.appendChild(slot);
        });

        updateProgress();
    }

    function createItemElement(item) {
        const el = document.createElement('div');
        el.className = 'agenda-item';
        el.draggable = true;
        el.dataset.id = item.id;
        el.innerHTML = `
            <h3 class="item-title">${escapeHtml(item.title)}</h3>
            <div class="item-meta">
                <span>${escapeHtml(item.text)}</span>
                <span>${escapeHtml(item.duration)}</span>
            </div>
        `;

        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragend', handleDragEnd);

        // Touch support would go here (using Pointer Events or Touch API mapping)

        return el;
    }

    function setupDropZone(el) {
        el.addEventListener('dragover', e => {
            e.preventDefault();
            el.classList.add('drag-over');
        });

        el.addEventListener('dragleave', () => {
            el.classList.remove('drag-over');
        });

        el.addEventListener('drop', handleDrop);
    }

    function handleDragStart(e) {
        draggedItem = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        draggedItem = null;
        document.querySelectorAll('.agenda-slot').forEach(slot => slot.classList.remove('drag-over'));
    }

    function handleDrop(e) {
        e.preventDefault();
        const slot = e.target.closest('.agenda-slot');
        const pool = DOM.poolList;

        if (!slot || !draggedItem) return;
        slot.classList.remove('drag-over');

        // If slot already has an item, return it to pool? Or swap? 
        // For simplicity: if slot has item, move existing item back to pool
        const existingItem = slot.querySelector('.agenda-item');
        if (existingItem) {
            pool.appendChild(existingItem);
        }

        slot.innerHTML = ''; // Clear placeholder text or existing item
        slot.appendChild(draggedItem);

        // Update state
        STATE.placedItems[slot.dataset.index] = draggedItem.dataset.id;
        updateProgress();
    }

    function updateProgress() {
        const placedCount = Object.keys(STATE.placedItems).length;
        DOM.progress.textContent = `Items: ${placedCount}/${STATE.items.length}`;
    }

    function checkSolution() {
        if (STATE.checked) return;

        const solution = STATE.config.solution;
        let correctCount = 0;
        let isComplete = true;

        // Check each slot
        document.querySelectorAll('.agenda-slot').forEach((slot, index) => {
            const itemId = STATE.placedItems[index];
            const itemEl = slot.querySelector('.agenda-item');

            if (!itemId) {
                isComplete = false;
                return;
            }

            if (itemId === solution[index]) {
                correctCount++;
                if (itemEl) itemEl.classList.add('correct');
            } else {
                if (itemEl) itemEl.classList.add('wrong');
            }
        });

        if (!isComplete && correctCount < solution.length) {
            showFeedback('Bitte fülle alle Plätze der Agenda aus!', 'error');
            // Remove styling if incomplete check
            document.querySelectorAll('.agenda-item').forEach(el => {
                el.classList.remove('correct', 'wrong');
            });
            return;
        }

        const score = Math.round((correctCount / solution.length) * 100);
        DOM.score.textContent = `Score: ${score}%`;

        if (score === 100) {
            showFeedback(STATE.config.feedbackTemplates.correct, 'success');
            STATE.checked = true;
            DOM.checkBtn.disabled = true;
        } else {
            showFeedback(STATE.config.feedbackTemplates.wrong, 'error');
        }
    }

    function showFeedback(msg, type) {
        DOM.feedback.textContent = msg;
        DOM.feedback.className = `feedback-msg ${type} show`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Event Listeners
    DOM.checkBtn.addEventListener('click', checkSolution);
    DOM.resetBtn.addEventListener('click', renderGame);

    // Allow items to be dropped back to pool
    DOM.poolList.addEventListener('dragover', e => e.preventDefault());
    DOM.poolList.addEventListener('drop', e => {
        e.preventDefault();
        if (draggedItem) {
            // Find if it came from a slot
            const parentSlot = draggedItem.parentElement;
            if (parentSlot && parentSlot.classList.contains('agenda-slot')) {
                delete STATE.placedItems[parentSlot.dataset.index];
                // Restore placeholder if empty? 
                // Actually, renderGame handles re-init, here we just append. 
                // We might lose the "Platziere hier" text if we don't restore it.
                // A simple way is to just let renderGame handle resets, but for individual moves:
                parentSlot.innerHTML = `<span>Platziere Schritt ${parseInt(parentSlot.dataset.index) + 1} hier</span>`;
            }
            DOM.poolList.appendChild(draggedItem);
            updateProgress();

            // Remove status classes
            draggedItem.classList.remove('correct', 'wrong');
        }
    });

    init();

})();
