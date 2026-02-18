(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        currentItems: [],
        placedCount: 0,
        draggingCard: null,
        dragOffset: { x: 0, y: 0 }
    };

    const el = {
        stage: document.getElementById('stage'),
        boundary: document.getElementById('boundary-box'),
        deck: document.getElementById('casting-deck'),
        spotlight: document.getElementById('spotlight'),
        safety: document.getElementById('safety-val'),
        overlay: document.getElementById('overlay'),
        btnNext: document.getElementById('btn-next'),
        instruction: document.getElementById('instruction')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'zap') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'applause') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_actor_match.json');
            state.config = await resp.json();

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            el.btnNext.addEventListener('click', nextScenario);

            startScenario(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.placedCount = 0;
        state.currentItems = [...state.config.scenarios[idx].items];

        el.instruction.textContent = state.config.scenarios[idx].instruction;
        el.overlay.classList.add('hidden');
        el.deck.innerHTML = '';
        el.safety.textContent = '100%';

        // Clear any settled cards in boundary
        const settled = el.stage.querySelectorAll('.card.settled');
        settled.forEach(s => s.remove());

        state.currentItems.forEach(item => {
            const card = createCard(item);
            el.deck.appendChild(card);
        });
    }

    function createCard(item) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = item.id;

        const icon = document.createElement('div');
        icon.className = 'card-icon';
        icon.textContent = getIcon(item.type);

        const label = document.createElement('div');
        label.className = 'card-label';
        label.textContent = item.label;

        card.appendChild(icon);
        card.appendChild(label);

        card.addEventListener('mousedown', (e) => startDrag(e, card, item));

        return card;
    }

    function getIcon(type) {
        switch (type) {
            case 'actor': return '👤';
            case 'system': return '⚙️';
            case 'usecase': return '🔘';
            default: return '🃏';
        }
    }

    function startDrag(e, cardEl, item) {
        if (e.button !== 0) return;

        state.draggingCard = { el: cardEl, item: item };
        const rect = cardEl.getBoundingClientRect();
        state.dragOffset.x = e.clientX - rect.left;
        state.dragOffset.y = e.clientY - rect.top;

        cardEl.style.position = 'fixed';
        cardEl.style.width = rect.width + 'px';
        cardEl.style.height = rect.height + 'px';
        cardEl.style.left = rect.left + 'px';
        cardEl.style.top = rect.top + 'px';
        cardEl.style.zIndex = 1000;
        cardEl.style.cursor = 'grabbing';

        el.spotlight.style.display = 'block';
        updateSpotlight(e.clientX, e.clientY);
    }

    function onMouseMove(e) {
        if (!state.draggingCard) return;

        const x = e.clientX - state.dragOffset.x;
        const y = e.clientY - state.dragOffset.y;

        state.draggingCard.el.style.left = x + 'px';
        state.draggingCard.el.style.top = y + 'px';

        updateSpotlight(e.clientX, e.clientY);
    }

    function updateSpotlight(x, y) {
        el.spotlight.style.left = (x - 150) + 'px';
        el.spotlight.style.top = (y - 150) + 'px';
    }

    function onMouseUp(e) {
        if (!state.draggingCard) return;

        const cardRect = state.draggingCard.el.getBoundingClientRect();
        const boxRect = el.boundary.getBoundingClientRect();

        const isOverBox = (
            cardRect.left < boxRect.right &&
            cardRect.right > boxRect.left &&
            cardRect.top < boxRect.bottom &&
            cardRect.bottom > boxRect.top
        );

        const item = state.draggingCard.item;
        const isValid = (item.isExternal === !isOverBox);

        if (isValid) {
            finalizeCard(state.draggingCard.el, isOverBox);
        } else {
            zapCard(state.draggingCard.el);
        }

        el.spotlight.style.display = 'none';
        state.draggingCard = null;
    }

    function finalizeCard(cardEl, inside) {
        playSound('applause');
        cardEl.classList.add('success');
        state.placedCount++;

        if (inside) {
            cardEl.classList.add('settled');
            // Ensure it's relative to stage for final positioning
            el.stage.appendChild(cardEl);
            const stageRect = el.stage.getBoundingClientRect();
            const cardRect = cardEl.getBoundingClientRect();
            cardEl.style.position = 'absolute';
            cardEl.style.left = (cardRect.left - stageRect.left) + 'px';
            cardEl.style.top = (cardRect.top - stageRect.top) + 'px';
        } else {
            // Outside actors just disappear with thanks
            cardEl.style.transition = 'all 0.5s ease-out';
            cardEl.style.opacity = '0';
            cardEl.style.transform = 'scale(0.5)';
            setTimeout(() => cardEl.remove(), 500);
        }

        checkWin();
    }

    function zapCard(cardEl) {
        playSound('zap');
        el.boundary.classList.add('zap');
        setTimeout(() => el.boundary.classList.remove('zap'), 500);

        cardEl.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        cardEl.style.left = (window.innerWidth / 2 - 60) + 'px';
        cardEl.style.top = (window.innerHeight - 150) + 'px';

        setTimeout(() => {
            cardEl.style.position = '';
            cardEl.style.left = '';
            cardEl.style.top = '';
            cardEl.style.width = '';
            cardEl.style.height = '';
            cardEl.style.zIndex = '';
            cardEl.style.cursor = '';
            el.deck.appendChild(cardEl);
        }, 400);

        // Penalty
        const current = parseInt(el.safety.textContent);
        el.safety.textContent = Math.max(0, current - 10) + '%';
    }

    function checkWin() {
        if (state.placedCount >= state.currentItems.length) {
            setTimeout(() => el.overlay.classList.remove('hidden'), 1000);
        }
    }

    function nextScenario() {
        if (state.scenarioIdx < state.config.scenarios.length - 1) {
            startScenario(state.scenarioIdx + 1);
        } else {
            location.reload();
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
        if (el?.statusVal?.textContent) payload.status = el.statusVal.textContent.trim();

        return JSON.stringify(payload);
    }

    window.render_game_to_text = renderGameToText;
    window.advanceTime = function advanceTime(ms) {
        return ms;
    };

    init();
})();
