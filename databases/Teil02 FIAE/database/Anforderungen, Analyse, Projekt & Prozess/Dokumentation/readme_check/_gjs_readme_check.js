
(function () {
    'use strict';

    const state = {
        cfg: null,
        levelIdx: 0,
        score: 0,
        timer: 0,
        timerId: null,
        slots: [], // Array of block IDs currently placed
        draggedBlockId: null,
        isGameActive: false
    };

    const el = {
        sidebar: document.getElementById('block-list'),
        editor: document.getElementById('editor-slots'),
        lineNumbers: document.getElementById('line-numbers'),
        status: document.getElementById('status-msg'),
        levelDisplay: document.getElementById('level-display'),
        timerDisplay: document.getElementById('timer-display'),
        startScreen: document.getElementById('start-screen'),
        gameOverScreen: document.getElementById('game-over-screen'),
        gameOverTitle: document.getElementById('game-over-title'),
        gameOverMsg: document.getElementById('game-over-msg'),
        actionBtn: document.getElementById('action-btn'),
        startBtn: document.getElementById('start-game-btn'),
        restartBtn: document.getElementById('restart-btn')
    };

    // Init
    init();

    async function init() {
        try {
            const res = await fetch('_data/_gg01_readme_check.json');
            if (!res.ok) throw new Error('Config load failed');
            state.cfg = await res.json();
            
            el.startBtn.addEventListener('click', startGame);
            el.restartBtn.addEventListener('click', startGame);
            el.actionBtn.addEventListener('click', checkBuild);

        } catch (e) {
            console.error(e);
            el.status.textContent = 'Error loading game config.';
        }
    }

    function startGame() {
        state.levelIdx = 0;
        state.score = 0;
        state.isGameActive = true;
        
        el.startScreen.classList.add('hidden');
        el.gameOverScreen.classList.add('hidden');
        
        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.cfg.levels.length) {
            endGame(true);
            return;
        }

        const level = state.cfg.levels[idx];
        state.levelIdx = idx;
        state.slots = new Array(level.correct_order.length).fill(null);
        state.timer = level.time_limit_sec;

        el.levelDisplay.textContent = level.name;
        el.status.textContent = level.description;
        el.actionBtn.textContent = "Check Build";
        el.actionBtn.disabled = false;

        renderSidebar(level.available_blocks);
        renderEditor(level.correct_order.length);
        startTimer();
    }

    function startTimer() {
        clearInterval(state.timerId);
        updateTimerDisplay();
        state.timerId = setInterval(() => {
            state.timer--;
            updateTimerDisplay();
            if (state.timer <= 0) {
                clearInterval(state.timerId);
                checkBuild(true); // Force check on timeout
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const min = Math.floor(state.timer / 60).toString().padStart(2, '0');
        const sec = (state.timer % 60).toString().padStart(2, '0');
        el.timerDisplay.textContent = `${min}:${sec}`;
        if (state.timer < 10) el.timerDisplay.style.color = 'red';
        else el.timerDisplay.style.color = '#ce9178';
    }

    function renderSidebar(blocks) {
        el.sidebar.innerHTML = '';
        // Shuffle blocks
        const shuffled = [...blocks].sort(() => Math.random() - 0.5);
        
        shuffled.forEach(block => {
            const div = document.createElement('div');
            div.className = 'block-source';
            div.textContent = block.label;
            div.draggable = true;
            div.dataset.id = block.id;
            
            div.addEventListener('dragstart', handleDragStart);
            // Touch support
            div.addEventListener('click', () => handleBlockClick(block.id));
            
            el.sidebar.appendChild(div);
        });
    }

    function renderEditor(slotCount) {
        el.editor.innerHTML = '';
        el.lineNumbers.innerHTML = '';

        for (let i = 0; i < slotCount; i++) {
            // Line number
            const line = document.createElement('div');
            line.textContent = i + 1;
            el.lineNumbers.appendChild(line);

            // Slot
            const slot = document.createElement('div');
            slot.className = 'slot';
            slot.dataset.index = i;
            slot.textContent = '// Drop here...';
            
            slot.addEventListener('dragover', handleDragOver);
            slot.addEventListener('drop', handleDrop);
            slot.addEventListener('click', () => handleSlotClick(i));

            el.editor.appendChild(slot);
        }
    }

    // --- Interaction Logic ---
    let selectedBlockId = null;

    function handleDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.id);
        e.dataTransfer.effectAllowed = 'copy';
        selectedBlockId = e.target.dataset.id;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        e.target.classList.add('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        const slotIndex = e.target.closest('.slot').dataset.index;
        const blockId = e.dataTransfer.getData('text/plain');
        e.target.classList.remove('drag-over');
        placeBlock(slotIndex, blockId);
    }
    
    // Tap interaction fallback
    function handleBlockClick(blockId) {
        selectedBlockId = blockId;
        el.status.textContent = "Block selected. Tap a slot to place.";
        // Highlight logic could go here
    }

    function handleSlotClick(slotIndex) {
        if (selectedBlockId) {
            placeBlock(slotIndex, selectedBlockId);
            selectedBlockId = null;
            el.status.textContent = "Block placed.";
        } else {
            // Remove block if clicked empty?
            removeBlock(slotIndex);
        }
    }

    function placeBlock(index, blockId) {
        if (!state.isGameActive) return;
        
        state.slots[index] = blockId;
        
        // Find block label
        const level = state.cfg.levels[state.levelIdx];
        const block = level.available_blocks.find(b => b.id === blockId);
        
        // Update DOM
        const slotNode = el.editor.children[index];
        slotNode.textContent = block.label;
        slotNode.classList.add('filled');
        slotNode.classList.remove('wrong', 'correct');
    }

    function removeBlock(index) {
        if (!state.isGameActive) return;
        state.slots[index] = null;
        const slotNode = el.editor.children[index];
        slotNode.textContent = '// Drop here...';
        slotNode.classList.remove('filled', 'wrong', 'correct');
    }

    function checkBuild(forced = false) {
        if (!state.isGameActive) return;
        
        clearInterval(state.timerId);
        const level = state.cfg.levels[state.levelIdx];
        let correctCount = 0;
        let isFail = false;

        state.slots.forEach((blockId, idx) => {
            const slotNode = el.editor.children[idx];
            slotNode.classList.remove('drag-over');

            if (blockId === level.correct_order[idx]) {
                slotNode.classList.add('correct');
                correctCount++;
            } else {
                slotNode.classList.add('wrong');
                isFail = true;
            }
        });

        if (isFail) {
            if (forced) {
                 endGame(false, "Time's up! Incomplete build.");
            } else {
                 el.status.textContent = "Build Errors detected! Check the red lines.";
                 // Penalty? 
                 // For simpler game flow, let's say: Perfect = Next Level, otherwise Fail/Retry loop?
                 // Or just showing errors is enough.
                 // Let's implement a rigid check: Must be 100% correct to proceed.
                 setTimeout(() => {
                     endGame(false, "Structure Incorrect. Debug and try again.");
                 }, 1000);
            }
        } else {
            // Success
            state.score += 100 + state.timer; // Bonus for time
            el.status.textContent = "Build Successful! Compiling...";
            setTimeout(() => {
                startLevel(state.levelIdx + 1);
            }, 1500);
        }
    }

    function endGame(win, msg) {
        state.isGameActive = false;
        clearInterval(state.timerId);
        el.gameOverScreen.classList.remove('hidden');
        
        if (win) {
            el.gameOverTitle.textContent = "Project Released!";
            el.gameOverMsg.textContent = `All documentation modules built successfully. Final Score: ${state.score}`;
            el.restartBtn.textContent = "New Project";
        } else {
            el.gameOverTitle.textContent = "Build Failed";
            el.gameOverMsg.textContent = msg || "Review the documentation standards.";
            el.restartBtn.textContent = "Try Level Again";
        }
    }


    function computeProgressPercent() {
        const totalLevels = Array.isArray(state?.config?.levels) ? state.config.levels.length : 0;
        if (!totalLevels) return 0;

        const completedLevels = Math.max(0, Math.min(Number(state?.levelIdx) || 0, totalLevels));
        const overlayVisible = (el?.overlay && !el.overlay.classList.contains('hidden')) ||
            (el?.resultOverlay && !el.resultOverlay.classList.contains('hidden'));
        const levelFinished = Boolean(state?.isComplete) || overlayVisible;
        const solved = Math.min(totalLevels, completedLevels + (levelFinished ? 1 : 0));
        return Math.round((solved / totalLevels) * 100);
    }

    function renderGameToText() {
        const payload = {
            mode: 'running',
            level_index: Number(state?.levelIdx) || 0,
            level_total: Array.isArray(state?.config?.levels) ? state.config.levels.length : 0,
            progress_percent: computeProgressPercent(),
            level_complete: Boolean(state?.isComplete),
            title: (el?.levelTitle?.textContent || el?.title?.textContent || document.title || '').trim()
        };

        const metricKeys = ['points', 'score', 'roi', 'pairIdx', 'activeColIdx'];
        metricKeys.forEach((key) => {
            if (typeof state?.[key] === 'number') payload[key] = state[key];
        });

        if (Array.isArray(state?.columns)) payload.columns_count = state.columns.length;
        if (el?.statusVal?.textContent) payload.status = el.statusVal.textContent.trim();

        return JSON.stringify(payload);
    }

    window.render_game_to_text = renderGameToText;
    window.advanceTime = function advanceTime(ms) {
        return ms;
    };

})();
