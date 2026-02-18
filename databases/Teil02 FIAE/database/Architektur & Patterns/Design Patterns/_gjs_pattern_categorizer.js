(function () {
    'use strict';

    const state = {
        config: null,
        score: 0,
        time: 60,
        cards: [],
        currentCard: null,
        gameOver: false,
        intervalId: null
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudTime: document.getElementById('time-val'),
        deckArea: document.getElementById('deck-area'),
        pillars: document.querySelectorAll('.pillar'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'magic') {
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'dust') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_pattern_categorizer.json');
            state.config = await resp.json();

            el.restartBtn.addEventListener('click', restartGame);
            setupDragDrop();

            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function restartGame() {
        state.score = 0;
        state.time = 90; // longer for deck
        state.gameOver = false;
        state.cards = [...state.config.patterns];
        shuffle(state.cards);

        el.resultScreen.classList.add('hidden');
        // Clear old cards
        el.deckArea.innerHTML = '';

        updateHUD();
        spawnCard();

        if (state.intervalId) clearInterval(state.intervalId);
        state.intervalId = setInterval(gameTick, 1000);
    }

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function gameTick() {
        if (state.gameOver) return;
        state.time--;
        if (state.time <= 0) endGame(false);
        updateHUD();
    }

    function spawnCard() {
        if (state.cards.length === 0) {
            endGame(true);
            return;
        }

        const cardData = state.cards.pop();
        const cardEl = document.createElement('div');
        cardEl.className = 'pattern-card';
        cardEl.draggable = true;
        cardEl.dataset.type = cardData.type;

        cardEl.innerHTML = `
        <div class="card-title">${cardData.name}</div>
        <div class="card-summary">${cardData.summary}</div>
      `;

        // Random rotation
        const rot = Math.random() * 10 - 5;
        cardEl.style.transform = `rotate(${rot}deg)`;

        // Events
        cardEl.addEventListener('dragstart', handleDragStart);
        cardEl.addEventListener('dragend', handleDragEnd);

        el.deckArea.appendChild(cardEl);
        state.currentCard = cardEl;
    }

    let draggedItem = null;

    function handleDragStart(e) {
        draggedItem = this;
        setTimeout(() => this.style.opacity = '0.5', 0);
    }

    function handleDragEnd(e) {
        setTimeout(() => {
            if (this.style.opacity === '0.5') this.style.opacity = '1';
            draggedItem = null;
            el.pillars.forEach(p => p.classList.remove('drag-over'));
        }, 0);
    }

    function setupDragDrop() {
        el.pillars.forEach(pillar => {
            pillar.addEventListener('dragover', e => {
                e.preventDefault(); // Necessary
                pillar.classList.add('drag-over');
            });

            pillar.addEventListener('dragleave', e => {
                pillar.classList.remove('drag-over');
            });

            pillar.addEventListener('drop', e => {
                e.preventDefault();
                pillar.classList.remove('drag-over');
                if (draggedItem) {
                    const droppedType = draggedItem.dataset.type;
                    const zoneType = pillar.dataset.id;

                    if (droppedType === zoneType) {
                        successDrop(draggedItem, pillar);
                    } else {
                        failDrop(draggedItem);
                    }
                }
            });
        });
    }

    function successDrop(card, zone) {
        state.score += 100;
        playTone('magic');

        // Animation
        card.classList.add('card-vanishing');
        createParticles(zone);

        setTimeout(() => {
            if (card.parentElement) card.remove();
            spawnCard();
            updateHUD();
        }, 500);
    }

    function failDrop(card) {
        state.score = Math.max(0, state.score - 50);
        playTone('dust');

        card.classList.add('card-error');
        setTimeout(() => card.classList.remove('card-error'), 500);
        updateHUD();
    }

    function createParticles(zone) {
        for (let i = 0; i < 10; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = (zone.offsetLeft + zone.offsetWidth / 2 + (Math.random() * 100 - 50)) + 'px';
            p.style.top = (zone.offsetTop + zone.offsetHeight / 2) + 'px';
            p.style.width = Math.random() * 10 + 'px';
            p.style.height = p.style.width;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 1000);
        }
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudTime.textContent = state.time;
    }

    function endGame(win) {
        state.gameOver = true;
        clearInterval(state.intervalId);
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "Archive Sorted!" : "Library Closed!";
        el.resultScreen.classList.remove('hidden');
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
            const remainingKeys = ['cards', 'components'];
            for (const key of remainingKeys) {
                const value = state?.[key];
                if (Array.isArray(value) && value.length <= totalUnits) {
                    return Math.max(idx, Math.max(0, totalUnits - value.length));
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
        if (el?.statusVal?.textContent) payload.status = el.statusVal.textContent.trim();

        return JSON.stringify(payload);
    }

    window.render_game_to_text = renderGameToText;
    window.advanceTime = function advanceTime(ms) {
        return ms;
    };

    init();
})();
