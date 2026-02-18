(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        connections: [], // { source, target, el }
        dragStart: null, // { x, y, header, dotEl }
        selectedSource: null, // for tap-mapping
        isComplete: false
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        sourceList: document.getElementById('source-list'),
        targetList: document.getElementById('target-list'),
        svg: document.getElementById('cable-svg'),
        dragLine: document.getElementById('drag-line'),
        log: document.getElementById('log-console'),
        overlay: document.getElementById('overlay'),
        score: document.getElementById('final-result'),
        btnNext: document.getElementById('next-btn')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'plug') {
            osc.frequency.setValueAtTime(500, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'zap') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_csv_mapper.json');
            state.config = await resp.json();

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);

            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                startLevel(state.levelIdx + 1);
            };

            startLevel(0);
        } catch (e) { console.error(e); }
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            location.reload();
            return;
        }
        state.levelIdx = idx;
        state.connections = [];
        state.isComplete = false;
        state.selectedSource = null;

        const lv = state.config.levels[idx];
        el.levelTitle.textContent = `ADAPTER_UNIT // ${lv.title}`;
        el.log.innerHTML = '<div class="log-entry info">> CA.B.L.E System ready...</div>';
        el.svg.innerHTML = '<path id="drag-line" class="cable dragging" d="M0,0 L0,0" style="display:none"></path>';
        el.dragLine = document.getElementById('drag-line');

        renderSource(lv.source);
        renderTarget(lv.target);
    }

    function renderSource(source) {
        el.sourceList.innerHTML = '';
        source.headers.forEach(h => {
            const item = document.createElement('div');
            item.className = 'field-item';
            item.innerHTML = `<div class="field-name">${h}</div><div class="field-type">CSV_RAW</div>`;

            const socket = document.createElement('div');
            socket.className = 'connector-socket source-socket';
            socket.onmousedown = (e) => onStart(e, h, socket);
            socket.onclick = (e) => { e.stopPropagation(); toggleSourceSelection(h, socket); };

            item.appendChild(socket);
            el.sourceList.appendChild(item);
        });
    }

    function renderTarget(target) {
        el.targetList.innerHTML = '';
        target.fields.forEach(f => {
            const item = document.createElement('div');
            item.className = 'field-item';
            item.innerHTML = `<div class="field-name">${f.name}</div><div class="field-type">${f.type}</div>`;

            const socket = document.createElement('div');
            socket.className = 'connector-socket target-socket';
            socket.onclick = () => handleTargetClick(f.name, socket);

            item.appendChild(socket);
            el.targetList.appendChild(item);
        });
    }

    function toggleSourceSelection(header, el) {
        if (state.selectedSource && state.selectedSource.header === header) {
            state.selectedSource.el.classList.remove('socket-glow');
            state.selectedSource = null;
        } else {
            if (state.selectedSource) state.selectedSource.el.classList.remove('socket-glow');
            state.selectedSource = { header, el };
            el.classList.add('socket-glow');
            log(`> Selected source: ${header}`, 'info');
        }
    }

    function handleTargetClick(fieldName, socketEl) {
        if (state.selectedSource) {
            createConnection(state.selectedSource.header, fieldName, state.selectedSource.el, socketEl);
            state.selectedSource.el.classList.remove('socket-glow');
            state.selectedSource = null;
        }
    }

    function onStart(e, header, dot) {
        e.preventDefault();
        const rect = dot.getBoundingClientRect();
        const svgRect = el.svg.getBoundingClientRect();
        state.dragStart = {
            x: rect.left + rect.width / 2 - svgRect.left,
            y: rect.top + rect.height / 2 - svgRect.top,
            header: header,
            dot: dot
        };
        el.dragLine.style.display = 'block';
    }

    function onMove(e) {
        if (!state.dragStart) return;
        const svgRect = el.svg.getBoundingClientRect();
        const x = e.clientX - svgRect.left;
        const y = e.clientY - svgRect.top;

        // Vertical Bezier
        const sx = state.dragStart.x;
        const sy = state.dragStart.y;
        const cp1y = sy + (y - sy) / 2;
        const cp2y = y - (y - sy) / 2;

        el.dragLine.setAttribute('d', `M${sx},${sy} C${sx},${cp1y} ${x},${cp2y} ${x},${y}`);
    }

    function onEnd(e) {
        if (!state.dragStart) return;
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (target && target.classList.contains('target-socket')) {
            const field = target.parentElement.querySelector('.field-name').textContent;
            createConnection(state.dragStart.header, field, state.dragStart.dot, target);
        }
        state.dragStart = null;
        el.dragLine.style.display = 'none';
    }

    function createConnection(source, target, sDot, tDot) {
        const lv = state.config.levels[state.levelIdx];
        const correctTarget = lv.mapping[source];

        const svgRect = el.svg.getBoundingClientRect();
        const sRect = sDot.getBoundingClientRect();
        const tRect = tDot.getBoundingClientRect();

        const sx = sRect.left + sRect.width / 2 - svgRect.left;
        const sy = sRect.top + sRect.height / 2 - svgRect.top;
        const tx = tRect.left + tRect.width / 2 - svgRect.left;
        const ty = tRect.top + tRect.height / 2 - svgRect.top;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute('class', 'cable');
        const cp1y = sy + (ty - sy) / 2;
        const cp2y = ty - (ty - sy) / 2;
        path.setAttribute('d', `M${sx},${sy} C${sx},${cp1y} ${tx},${cp2y} ${tx},${ty}`);

        if (correctTarget === target) {
            playSound('plug');
            el.svg.appendChild(path);
            state.connections.push({ source, target, el: path });
            log(`> Link established: [${source}] -> [${target}]`, 'success');
            checkWin();
        } else {
            playSound('zap');
            path.classList.add('error');
            el.svg.appendChild(path);
            document.body.classList.add('shake');
            log(`> ERROR: Mismatch [${source}] -> [${target}]`, 'error');
            setTimeout(() => {
                path.remove();
                document.body.classList.remove('shake');
            }, 1000);
        }
    }

    function checkWin() {
        const lv = state.config.levels[state.levelIdx];
        const total = Object.keys(lv.mapping).length;
        if (state.connections.length === total) {
            state.isComplete = true;
            el.score.textContent = "DATA_STREAMS_SYNCHRONIZED_100%";
            setTimeout(() => el.overlay.classList.remove('hidden'), 1000);
        }
    }

    function log(msg, type) {
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        div.textContent = msg;
        el.log.appendChild(div);
        el.log.scrollTop = el.log.scrollHeight;
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
