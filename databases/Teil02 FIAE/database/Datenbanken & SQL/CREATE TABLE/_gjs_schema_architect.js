(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        columns: [],
        activeColIdx: -1,
        isComplete: false
    };

    const el = {
        title: document.getElementById('project-title'),
        reqList: document.getElementById('req-list'),
        sqlBody: document.getElementById('sql-body'),
        toolbox: document.getElementById('toolbox'),
        previewTable: document.getElementById('preview-table'),
        btnValidate: document.getElementById('btn-validate'),
        overlay: document.getElementById('result-overlay'),
        resFinal: document.getElementById('final-result'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'success') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_schema_architect.json');
            state.config = await resp.json();

            initToolbox();
            el.btnValidate.onclick = validateSchema;
            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                startLevel(state.levelIdx + 1);
            };

            startLevel(0);
        } catch (e) { console.error(e); }
    }

    function initToolbox() {
        el.toolbox.innerHTML = '';

        const typeCluster = createCluster("DATATYPES", state.config.toolbox.types, applyType);
        const constCluster = createCluster("CONSTRAINTS", state.config.toolbox.constraints, toggleConstraint);

        el.toolbox.appendChild(typeCluster);
        el.toolbox.appendChild(constCluster);
    }

    function createCluster(label, items, callback) {
        const container = document.createElement('div');
        container.className = 'tool-cluster';
        container.innerHTML = `<div class="cluster-label">${label}</div>`;

        const grid = document.createElement('div');
        grid.className = 'btn-grid';

        items.forEach(it => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            btn.textContent = it;
            btn.onclick = () => callback(it);
            grid.appendChild(btn);
        });

        container.appendChild(grid);
        return container;
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            location.reload();
            return;
        }
        state.levelIdx = idx;
        state.columns = [];
        state.activeColIdx = -1;

        const lv = state.config.levels[idx];
        el.title.textContent = `SYSTEM_BLUEPRINT // ${lv.title}`;

        renderRequirements();
        renderSQL();
        renderPreview();
    }

    function renderRequirements() {
        el.reqList.innerHTML = '';
        const lv = state.config.levels[state.levelIdx];
        lv.requirements.forEach(req => {
            const div = document.createElement('div');
            div.className = 'req-item';
            div.innerHTML = `<b>${req.name}</b><br><span style="font-size:0.7rem; color:var(--text-dim)">${req.desc} [${req.type}]</span>`;

            const col = state.columns.find(c => c.name === req.name);
            if (col && col.type === req.type) {
                const allConstraintsMet = req.constraints.every(rc => col.constraints.includes(rc));
                if (allConstraintsMet) div.classList.add('done');
            }

            el.reqList.appendChild(div);
        });
    }

    function renderSQL() {
        el.sqlBody.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'sql-row';
        header.innerHTML = `<span class="kw">CREATE TABLE</span> <span class="id">${state.config.levels[state.levelIdx].title.split(' ')[0]}</span> (`;
        el.sqlBody.appendChild(header);

        state.columns.forEach((col, i) => {
            const row = document.createElement('div');
            row.className = `sql-row ${state.activeColIdx === i ? 'active' : ''}`;
            row.innerHTML = `
            <span style="width:20px; color:#555">${i + 1}</span>
            <span class="id">${col.name}</span>
            <span class="ty">${col.type || '??'}</span>
            ${col.constraints.map(c => `<span class="cn">${c}</span>`).join(' ')}
            <span style="color:#555">,</span>
          `;
            row.onclick = () => { activateRow(i); };
            el.sqlBody.appendChild(row);
        });

        const addRow = document.createElement('div');
        addRow.className = 'btn-add-col';
        addRow.textContent = '+ ADD_FIELD_DEFINITION';
        addRow.onclick = showColPrompt;
        el.sqlBody.appendChild(addRow);

        const footer = document.createElement('div');
        footer.className = 'sql-row';
        footer.innerHTML = `);`;
        el.sqlBody.appendChild(footer);
    }

    function renderPreview() {
        const thead = el.previewTable.querySelector('thead tr');
        const tbody = el.previewTable.querySelector('tbody tr');
        thead.innerHTML = '';
        tbody.innerHTML = '';

        state.columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.name;
            thead.appendChild(th);

            const td = document.createElement('td');
            td.textContent = col.type || 'NULL';
            tbody.appendChild(td);
        });
    }

    function showColPrompt() {
        const name = prompt("FIELD_NAME:");
        if (name) {
            state.columns.push({ name: name.toLowerCase(), type: null, constraints: [] });
            state.activeColIdx = state.columns.length - 1;
            syncUI();
        }
    }

    function activateRow(i) {
        state.activeColIdx = i;
        playSound('click');
        syncUI();
    }

    function applyType(t) {
        if (state.activeColIdx === -1) return;
        state.columns[state.activeColIdx].type = t;
        playSound('click');
        syncUI();
    }

    function toggleConstraint(c) {
        if (state.activeColIdx === -1) return;
        const col = state.columns[state.activeColIdx];
        const pos = col.constraints.indexOf(c);
        if (pos > -1) col.constraints.splice(pos, 1);
        else col.constraints.push(c);
        playSound('click');
        syncUI();
    }

    function syncUI() {
        renderSQL();
        renderRequirements();
        renderPreview();
    }

    function validateSchema() {
        const reqs = state.config.levels[state.levelIdx].requirements;
        let valid = true;
        let errs = [];

        reqs.forEach(r => {
            const col = state.columns.find(c => c.name === r.name);
            if (!col) { valid = false; errs.push(`MISSING_FIELD: ${r.name}`); return; }
            if (col.type !== r.type) { valid = false; errs.push(`TYPE_MISMATCH: ${r.name} EXPECTED ${r.type}`); }
            r.constraints.forEach(rc => {
                if (!col.constraints.includes(rc)) { valid = false; errs.push(`MISSING_CONSTRAINT: ${rc} ON ${r.name}`); }
            });
        });

        if (valid) {
            playSound('success');
            el.resFinal.textContent = "VALIDATION_PASSED_//_SCHEMA_SOLID";
            el.overlay.classList.remove('hidden');
        } else {
            alert(`VALIDATION_FAILED:\n${errs.join('\n')}`);
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
