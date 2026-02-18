
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


    function getConfigRoot() {
        return state?.config || state?.cfg || null;
    }

    function getTotalUnits() {
        const cfg = getConfigRoot();
        const arrayKeys = [
            'levels', 'scenarios', 'phases', 'patterns', 'components', 'pillars',
            'definitions', 'pairs', 'items', 'questions', 'tasks', 'steps',
            'orders', 'cards', 'messages', 'events', 'columns'
        ];

        if (cfg) {
            for (const key of arrayKeys) {
                const value = cfg[key];
                if (Array.isArray(value) && value.length > 0) return value.length;
            }
        }

        const numericKeys = ['totalLevels', 'totalScenarios', 'totalRounds', 'totalToSort', 'targetTotal', 'storyTarget', 'maxResistance', 'entityTotal'];
        for (const key of numericKeys) {
            const value = Number(state?.[key]);
            if (Number.isFinite(value) && value > 0) return Math.floor(value);
        }

        return 0;
    }

    function getCurrentIndex(totalUnits) {
        const idxKeys = ['levelIdx', 'scenarioIdx', 'currentPhaseIdx', 'phaseIdx', 'roundIdx', 'stageIdx', 'questionIdx', 'taskIdx', 'pairIdx', 'waveIdx', 'storyIdx', 'targetIdx'];
        for (const key of idxKeys) {
            const value = Number(state?.[key]);
            if (!Number.isFinite(value)) continue;
            const floored = Math.floor(value);
            if (totalUnits > 0) return Math.max(0, Math.min(floored, totalUnits));
            return Math.max(0, floored);
        }
        return 0;
    }

    function getBaseCompleted(totalUnits) {
        const countKeyPairs = [
            ['sortedCount', 'totalToSort'],
            ['placedCount', 'totalItems'],
            ['targetsFound', 'targetTotal'],
            ['scenariosDone', 'scenarioTotal'],
            ['storiesTold', 'storyTarget'],
            ['foundCount', 'maxResistance'],
            ['discovered', 'entityTotal']
        ];

        for (const [doneKey, totalKey] of countKeyPairs) {
            const doneValue = Number(state?.[doneKey]);
            if (!Number.isFinite(doneValue) || doneValue < 0) continue;
            const pairTotal = Number(state?.[totalKey]);
            const cap = Number.isFinite(pairTotal) && pairTotal > 0 ? pairTotal : totalUnits;
            if (cap > 0) return Math.max(0, Math.min(Math.floor(doneValue), Math.floor(cap)));
            return Math.max(0, Math.floor(doneValue));
        }

        if (totalUnits > 0) {
            const idx = getCurrentIndex(totalUnits);

            if (Array.isArray(state?.cards) && state.cards.length <= totalUnits) {
                const inHand = state?.currentCard ? 1 : 0;
                const processed = totalUnits - state.cards.length - inHand;
                if (processed >= 0) {
                    return Math.max(idx, Math.min(totalUnits, processed));
                }
            }

            if (Array.isArray(state?.components) && state.components.length <= totalUnits) {
                const inHand = state?.currentComponent ? 1 : 0;
                const processed = totalUnits - state.components.length - inHand;
                if (processed >= 0) {
                    return Math.max(idx, Math.min(totalUnits, processed));
                }
            }

            return idx;
        }

        return getCurrentIndex(totalUnits);
    }

    function isRoundComplete() {
        const boolKeys = ['isComplete', 'gameOver', 'solved', 'isChecked', 'finished'];
        for (const key of boolKeys) {
            if (Boolean(state?.[key])) return true;
        }

        const overlayVisible = (el?.overlay && !el.overlay.classList.contains('hidden')) ||
            (el?.resultOverlay && !el.resultOverlay.classList.contains('hidden'));
        if (overlayVisible) return true;

        return false;
    }

    function computeProgressPercent() {
        const totalUnits = getTotalUnits();
        const baseCompleted = getBaseCompleted(totalUnits);
        const completionBonus = isRoundComplete() ? 1 : 0;

        if (totalUnits > 0) {
            const solvedUnits = Math.max(0, Math.min(totalUnits, baseCompleted + completionBonus));
            return Math.round((solvedUnits / totalUnits) * 100);
        }

        return isRoundComplete() ? 100 : 0;
    }

    function renderGameToText() {
        const totalUnits = getTotalUnits();
        const payload = {
            mode: isRoundComplete() ? 'result' : 'running',
            level_index: getCurrentIndex(totalUnits),
            level_total: totalUnits,
            progress_percent: computeProgressPercent(),
            level_complete: isRoundComplete(),
            title: (el?.levelTitle?.textContent || el?.title?.textContent || document.title || '').trim()
        };

        const metricKeys = ['points', 'score', 'roi', 'pairIdx', 'activeColIdx'];
        metricKeys.forEach((key) => {
            if (typeof state?.[key] === 'number') payload[key] = state[key];
        });

        if (Array.isArray(state?.columns)) payload.columns_count = state.columns.length;
        if (typeof state?.__simulated_ms === 'number') payload.simulated_ms = state.__simulated_ms;
        if (el?.statusVal?.textContent) payload.status = el.statusVal.textContent.trim();

        return JSON.stringify(payload);
    }

    window.render_game_to_text = renderGameToText;
    window.advanceTime = function advanceTime(ms) {
        const deltaMs = Math.max(0, Number(ms) || 0);
        state.__simulated_ms = (state.__simulated_ms || 0) + deltaMs;

        if (deltaMs >= 1000 && typeof gameTick === 'function') {
            const ticks = Math.floor(deltaMs / 1000);
            for (let i = 0; i < ticks; i++) gameTick();
        }

        return state.__simulated_ms;
    };

})();
