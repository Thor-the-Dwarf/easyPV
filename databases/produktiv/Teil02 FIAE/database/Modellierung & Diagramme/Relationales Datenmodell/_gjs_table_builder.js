(function () {
    'use strict';

    const state = {
        config: null,
        scenarioIdx: 0,
        draggingTable: null,
        activeConnection: null, // {fromNode, fromTableId, fromCol}
        connections: [], // {fromTable, fromCol, toTable, toCol}
        dragOffset: { x: 0, y: 0 }
    };

    const el = {
        canvas: document.getElementById('blueprint-canvas'),
        svg: document.getElementById('svg-layer'),
        integrity: document.getElementById('integrity-val'),
        overlay: document.getElementById('overlay'),
        instruction: document.getElementById('instruction'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'snap') {
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'click') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.05);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_table_builder.json');
            state.config = await resp.json();

            el.btnNext.addEventListener('click', nextScenario);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            startScenario(0);
        } catch (e) {
            console.error(e);
        }
    }

    function startScenario(idx) {
        state.scenarioIdx = idx;
        state.connections = [];
        state.activeConnection = null;
        const s = state.config.scenarios[idx];

        el.instruction.textContent = s.instruction;
        el.overlay.classList.add('hidden');
        el.canvas.innerHTML = '';
        el.svg.innerHTML = '';

        s.tables.forEach(renderTable);
        updateHUD();
    }

    function renderTable(table) {
        const box = document.createElement('div');
        box.className = 'table-box';
        box.id = `table-${table.id}`;
        box.style.left = `${table.x}px`;
        box.style.top = `${table.y}px`;

        const header = document.createElement('div');
        header.className = 'table-header';
        header.textContent = table.name;
        header.addEventListener('mousedown', (e) => startDragTable(e, box, table.id));
        box.appendChild(header);

        const list = document.createElement('div');
        list.className = 'column-list';

        table.columns.forEach(col => {
            const item = document.createElement('div');
            item.className = `column-item ${col.isPK ? 'is-pk' : ''}`;
            item.innerHTML = `<span><span class="pk-icon">🔑</span>${col.name} <small style="opacity:0.5">${col.type}</small></span>`;

            const pin = document.createElement('div');
            pin.className = 'col-pin';
            pin.addEventListener('mousedown', (e) => startConnection(e, pin, table.id, col.name));
            pin.addEventListener('mouseup', (e) => endConnection(e, table.id, col.name));

            item.addEventListener('click', (e) => {
                if (e.target.className !== 'col-pin') togglePK(table.id, col.name, item);
            });

            item.appendChild(pin);
            list.appendChild(item);
        });

        box.appendChild(list);
        el.canvas.appendChild(box);
    }

    function startDragTable(e, box, id) {
        if (e.button !== 0) return;
        state.draggingTable = { id, el: box };
        state.dragOffset.x = e.clientX - box.offsetLeft;
        state.dragOffset.y = e.clientY - box.offsetTop;
        box.style.zIndex = 100;
    }

    function onMouseMove(e) {
        if (state.draggingTable) {
            const x = e.clientX - state.dragOffset.x;
            const y = e.clientY - state.dragOffset.y;
            state.draggingTable.el.style.left = `${x}px`;
            state.draggingTable.el.style.top = `${y}px`;
            updateLines();
        }

        if (state.activeConnection) {
            updateActiveLine(e.clientX, e.clientY);
        }
    }

    function onMouseUp() {
        if (state.draggingTable) {
            state.draggingTable.el.style.zIndex = 10;
            state.draggingTable = null;
        }
        if (state.activeConnection) {
            removeActiveLine();
            state.activeConnection = null;
        }
    }

    function togglePK(tableId, colName, element) {
        const s = state.config.scenarios[state.scenarioIdx];
        const table = s.tables.find(t => t.id === tableId);
        const col = table.columns.find(c => c.name === colName);

        playSound('click');
        col.isPK = !col.isPK;
        element.classList.toggle('is-pk', col.isPK);

        checkWin();
    }

    function startConnection(e, pin, tableId, colName) {
        e.stopPropagation();
        state.activeConnection = { fromNode: pin, fromTableId: tableId, fromCol: colName };
        const rect = pin.getBoundingClientRect();
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute('id', 'temp-line');
        line.setAttribute('x1', rect.left + 5);
        line.setAttribute('y1', rect.top + 5);
        line.setAttribute('x2', rect.left + 5);
        line.setAttribute('y2', rect.top + 5);
        line.setAttribute('stroke', 'var(--accent-sql)');
        line.setAttribute('stroke-width', '2');
        el.svg.appendChild(line);
    }

    function updateActiveLine(x, y) {
        const line = document.getElementById('temp-line');
        if (line) {
            line.setAttribute('x2', x);
            line.setAttribute('y2', y);
        }
    }

    function removeActiveLine() {
        const line = document.getElementById('temp-line');
        if (line) line.remove();
    }

    function endConnection(e, toTableId, toColName) {
        if (!state.activeConnection) return;
        if (state.activeConnection.fromTableId === toTableId) return;

        playSound('snap');
        state.connections.push({
            fromTable: state.activeConnection.fromTableId,
            fromCol: state.activeConnection.fromCol,
            toTable: toTableId,
            toCol: toColName
        });

        renderLines();
        checkWin();
    }

    function renderLines() {
        el.svg.innerHTML = '';
        state.connections.forEach(conn => {
            const fromPin = getPin(conn.fromTable, conn.fromCol);
            const toPin = getPin(conn.toTable, conn.toCol);
            if (fromPin && toPin) {
                const r1 = fromPin.getBoundingClientRect();
                const r2 = toPin.getBoundingClientRect();
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.className.baseVal = 'conn-line';
                line.setAttribute('x1', r1.left + 5);
                line.setAttribute('y1', r1.top + 5);
                line.setAttribute('x2', r2.left + 5);
                line.setAttribute('y2', r2.top + 5);
                el.svg.appendChild(line);
            }
        });
    }

    function updateLines() {
        renderLines();
    }

    function getPin(tableId, colName) {
        const tableEl = document.getElementById(`table-${tableId}`);
        if (!tableEl) return null;
        const colSpans = tableEl.querySelectorAll('.column-item span');
        for (let span of colSpans) {
            if (span.textContent.includes(colName)) {
                return span.parentElement.querySelector('.col-pin');
            }
        }
        return null;
    }

    function updateHUD() {
        el.integrity.textContent = 'STABLE';
    }

    function checkWin() {
        const s = state.config.scenarios[state.scenarioIdx];
        const condition = s.winCondition;

        let won = false;
        if (condition.type === 'pk_set') {
            const table = s.tables.find(t => t.id === condition.tableId);
            const col = table.columns.find(c => c.name === condition.column);
            if (col.isPK) won = true;
        } else if (condition.type === 'fk_link') {
            const [fromT, fromC] = condition.from.split('.');
            const [toT, toC] = condition.to.split('.');
            won = state.connections.some(c =>
                (c.fromTable === fromT && c.fromCol === fromC && c.toTable === toT && c.toCol === toC) ||
                (c.fromTable === toT && c.fromCol === toC && c.toTable === fromT && c.toCol === fromC)
            );
        }

        if (won) {
            setTimeout(() => {
                el.overlay.classList.remove('hidden');
            }, 800);
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

    init();
})();
