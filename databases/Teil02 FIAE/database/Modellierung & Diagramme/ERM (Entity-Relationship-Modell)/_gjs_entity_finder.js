(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        discovered: {
            entities: new Map(), // name -> {id, x, y, attrs: []}
            attributes: [] // {text, parent}
        },
        score: 0,
        radarIntensity: 0
    };

    const el = {
        radar: document.getElementById('radar-val'),
        integrity: document.getElementById('integrity-val'),
        storyArea: document.getElementById('story-area'),
        canvas: document.getElementById('canvas'),
        overlay: document.getElementById('overlay'),
        missionTitle: document.getElementById('mission-title'),
        missionText: document.getElementById('mission-text'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'hunt') {
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'error') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_entity_finder.json');
            state.config = await resp.json();

            el.btnNext.addEventListener('click', nextScenario);
            startScenario(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.discovered.entities.clear();
        state.discovered.attributes = [];
        state.score = 0;

        const s = state.config.scenarios[idx];
        el.missionTitle.textContent = s.title;
        el.missionText.textContent = "Analysiere den Text und finde alle Entitäten und Attribute.";
        el.overlay.classList.add('hidden');
        el.canvas.innerHTML = '';

        renderStory(s.story);
        updateHUD();
    }

    function renderStory(text) {
        el.storyArea.innerHTML = '';
        const words = text.split(/\s+/);
        words.forEach(word => {
            const span = document.createElement('span');
            // Clean word for matching but keep original for display
            const clean = word.replace(/[.,!?;:]/g, '');
            span.textContent = word + ' ';
            span.dataset.word = clean;
            span.addEventListener('click', (e) => handleWordClick(e, span, clean));
            el.storyArea.appendChild(span);
        });
    }

    function handleWordClick(e, span, word) {
        if (span.classList.contains('highlight-entity') || span.classList.contains('highlight-attr')) return;

        const s = state.config.scenarios[state.scenarioIdx];
        const target = s.targets.find(t => t.text.toLowerCase() === word.toLowerCase());
        const isNoise = s.noise.includes(word.toLowerCase());

        if (target) {
            processHit(span, target, e.clientX, e.clientY);
        } else if (isNoise) {
            processNoise(span);
        } else {
            processMiss(span);
        }
    }

    function processHit(span, target, mouseX, mouseY) {
        playSound('hunt');

        if (target.type === 'entity') {
            span.classList.add('highlight-entity');
            const name = target.alias || target.text;
            if (!state.discovered.entities.has(name)) {
                const ent = {
                    name: name,
                    x: Math.random() * (el.canvas.clientWidth - 150) + 20,
                    y: Math.random() * (el.canvas.clientHeight - 80) + 20,
                    attrs: []
                };
                state.discovered.entities.set(name, ent);
                createEntityCard(ent, mouseX, mouseY);
            }
        } else if (target.type === 'attribute') {
            span.classList.add('highlight-attr');
            if (state.discovered.entities.has(target.parent)) {
                const ent = state.discovered.entities.get(target.parent);
                if (!ent.attrs.includes(target.text)) {
                    ent.attrs.push(target.text);
                    updateEntityCard(ent);
                }
            }
        }

        state.score += 10;
        updateHUD();
        checkWin();
    }

    function processNoise(span) {
        playSound('error');
        span.classList.add('highlight-noise');
        state.score -= 5;
        updateHUD();
    }

    function processMiss(span) {
        playSound('error');
        span.style.color = 'var(--error-red)';
        setTimeout(() => span.style.color = '', 500);
    }

    function createEntityCard(ent, startX, startY) {
        const card = document.createElement('div');
        card.className = 'entity-card';
        card.id = `ent-${ent.name}`;
        card.textContent = ent.name;
        card.style.left = `${ent.x}px`;
        card.style.top = `${ent.y}px`;

        // Bubble animation from click to canvas
        const bubble = document.createElement('div');
        bubble.className = 'capture-bubble';
        bubble.textContent = ent.name;
        const rect = el.canvas.getBoundingClientRect();
        const tx = ent.x + rect.left - startX;
        const ty = ent.y + rect.top - startY;
        bubble.style.left = `${startX}px`;
        bubble.style.top = `${startY}px`;
        bubble.style.setProperty('--tx', `${tx}px`);
        bubble.style.setProperty('--ty', `${ty}px`);
        document.body.appendChild(bubble);
        setTimeout(() => bubble.remove(), 600);

        el.canvas.appendChild(card);

        const attrList = document.createElement('ul');
        attrList.className = 'attr-dot';
        card.appendChild(attrList);
    }

    function updateEntityCard(ent) {
        const card = document.getElementById(`ent-${ent.name}`);
        const list = card.querySelector('.attr-dot');
        list.innerHTML = '';
        ent.attrs.forEach(attr => {
            const li = document.createElement('li');
            li.textContent = attr;
            list.appendChild(li);
        });
    }

    function updateHUD() {
        const s = state.config.scenarios[state.scenarioIdx];
        const foundCount = state.discovered.entities.size + state.discovered.entities.values().next().value?.attrs.length || 0; // rough
        const totalTargets = s.targets.length;

        const progress = Math.round((state.discovered.entities.size / s.targets.filter(t => t.type === 'entity').length) * 100) || 0;
        el.radar.textContent = `${progress}%`;
        el.integrity.textContent = state.score;
    }

    function checkWin() {
        const s = state.config.scenarios[state.scenarioIdx];
        const totalEntities = s.targets.filter(t => t.type === 'entity' && !t.ignore).length;
        if (state.discovered.entities.size >= totalEntities) {
            // Simple win if all entities found
            setTimeout(() => {
                el.overlay.classList.remove('hidden');
            }, 1000);
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
