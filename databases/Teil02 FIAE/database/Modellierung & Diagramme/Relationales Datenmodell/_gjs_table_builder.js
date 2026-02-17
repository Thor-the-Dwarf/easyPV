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
            const resp = await fetch('data/_gg01_table_builder.json');
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

    init();
})();
