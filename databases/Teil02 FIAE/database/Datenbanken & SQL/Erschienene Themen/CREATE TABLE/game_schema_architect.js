(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        columns: [],
        activeColIdx: -1,
        gameOver: false
    };

    const el = {
        projectTitle: document.getElementById('project-title'),
        reqList: document.getElementById('req-list'),
        sqlEditor: document.getElementById('sql-editor'),
        toolbox: document.getElementById('toolbox'),
        btnValidate: document.getElementById('btn-validate'),
        resultOverlay: document.getElementById('result-overlay'),
        finalResult: document.getElementById('final-result'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'click') {
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start();
            osc.stop(now + 0.05);
        } else if (type === 'success') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_schema_architect.json');
            state.config = await resp.json();

            renderToolbox();

            el.btnValidate.addEventListener('click', validateSchema);
            el.btnNext.addEventListener('click', () => {
                el.resultOverlay.classList.add('hidden');
                if (state.levelIdx < state.config.levels.length - 1) {
                    startLevel(state.levelIdx + 1);
                } else {
                    location.reload();
                }
            });

            startLevel(0);
        } catch (e) {
            console.error(e);
        }
    }

    function renderToolbox() {
        // Types
        const groupTypes = document.createElement('div');
        groupTypes.className = 'tool-group';
        state.config.toolbox.types.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            btn.textContent = t;
            btn.addEventListener('click', () => applyType(t));
            groupTypes.appendChild(btn);
        });
        el.toolbox.appendChild(groupTypes);

        // Constraints
        const groupConst = document.createElement('div');
        groupConst.className = 'tool-group';
        state.config.toolbox.constraints.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn constraint';
            btn.textContent = c;
            btn.addEventListener('click', () => toggleConstraint(c));
            groupConst.appendChild(btn);
        });
        el.toolbox.appendChild(groupConst);
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        state.columns = [];
        state.activeColIdx = -1;

        const level = state.config.levels[idx];
        el.projectTitle.textContent = `Blueprint: ${level.title}`;

        renderRequirements();
        renderSQL();
    }

    function renderRequirements() {
        el.reqList.innerHTML = `<div class="section-title">Specs</div>`;
        const level = state.config.levels[state.levelIdx];

        level.requirements.forEach(req => {
            const div = document.createElement('div');
            div.className = 'req-item';
            div.textContent = `${req.name}: ${req.desc} (${req.type})`;
            // Simple heuristic to check if done
            const col = state.columns.find(c => c.name === req.name);
            if (col && col.type === req.type) {
                // specific check for constraints?
                // simplified logic: roughly matching
                div.classList.add('done');
            }
            el.reqList.appendChild(div);
        });
    }

    function renderSQL() {
        el.sqlEditor.innerHTML = '';

        const lineStart = document.createElement('div');
        lineStart.className = 'sql-line';
        lineStart.innerHTML = `<span class="sql-keyword">CREATE TABLE</span> <span class="sql-identifier">Results</span> (`;
        el.sqlEditor.appendChild(lineStart);

        // Render columns
        state.columns.forEach((col, idx) => {
            const row = document.createElement('div');
            row.className = 'column-row';
            if (state.activeColIdx === idx) row.classList.add('active');

            row.innerHTML = `
            <span class="sql-identifier">${col.name}</span>
            <span class="sql-type">${col.type || 'TYPE?'}</span>
            ${col.constraints.map(c => `<span class="sql-constraint">${c}</span>`).join(' ')}
            <span style="color:#555">,</span>
          `;

            row.addEventListener('click', (e) => {
                e.stopPropagation();
                activateColumn(idx);
            });

            // Delete btn
            const delBtn = document.createElement('span');
            delBtn.textContent = ' ✖';
            delBtn.style.color = 'red';
            delBtn.style.cursor = 'pointer';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                state.columns.splice(idx, 1);
                state.activeColIdx = -1;
                renderSQL();
                renderRequirements();
            };
            row.appendChild(delBtn);

            el.sqlEditor.appendChild(row);
        });

        // Add Column Button
        const addRow = document.createElement('div');
        addRow.className = 'sql-line';
        addRow.style.cursor = 'pointer';
        addRow.style.color = '#555';
        addRow.textContent = '+ Add Column';
        addRow.onclick = addColumn;
        el.sqlEditor.appendChild(addRow);

        const lineEnd = document.createElement('div');
        lineEnd.className = 'sql-line';
        lineEnd.textContent = ');';
        el.sqlEditor.appendChild(lineEnd);
    }

    function addColumn() {
        const name = prompt("Column Name (e.g. user_id):");
        if (name) {
            state.columns.push({
                name: name.toLowerCase(),
                type: null,
                constraints: []
            });
            state.activeColIdx = state.columns.length - 1;
            renderSQL();
            renderRequirements();
        }
    }

    function activateColumn(idx) {
        state.activeColIdx = idx;
        renderSQL();
        playTone('click');
    }

    function applyType(t) {
        if (state.activeColIdx === -1) return;
        state.columns[state.activeColIdx].type = t;
        renderSQL();
        renderRequirements();
        playTone('click');
    }

    function toggleConstraint(c) {
        if (state.activeColIdx === -1) return;
        const col = state.columns[state.activeColIdx];
        const idx = col.constraints.indexOf(c);
        if (idx > -1) col.constraints.splice(idx, 1);
        else col.constraints.push(c);

        renderSQL();
        renderRequirements();
        playTone('click');
    }

    function validateSchema() {
        const level = state.config.levels[state.levelIdx];
        let correct = true;
        let missing = [];

        level.requirements.forEach(req => {
            const col = state.columns.find(c => c.name === req.name);
            if (!col) {
                correct = false;
                missing.push(`Missing column: ${req.name}`);
                return;
            }
            if (col.type !== req.type) {
                correct = false;
                missing.push(`${req.name}: Wrong type (Expected ${req.type}, got ${col.type})`);
            }

            // Check constraints
            // Ensure all req constraints are present
            req.constraints.forEach(rc => {
                if (!col.constraints.includes(rc)) {
                    correct = false;
                    missing.push(`${req.name}: Missing ${rc}`);
                }
            });
        });

        if (correct) {
            playTone('success');
            el.finalResult.textContent = "Blueprint Approved! Building Table...";
            el.resultOverlay.classList.remove('hidden');
        } else {
            alert("Validation Failed:\n" + missing.join("\n"));
        }
    }

    init();
})();
