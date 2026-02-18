(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        completedLevels: 0,
        selectedId: null,
        isComplete: false,
        constraintInsight: false,
        lastOutcome: 'none'
    };

    const el = {
        mission: document.getElementById('mission-text'),
        list: document.getElementById('record-list'),
        btnDelete: document.getElementById('btn-delete'),
        whereClause: document.getElementById('where-clause'),
        overlay: document.getElementById('overlay'),
        btnNext: document.getElementById('btn-next'),
        status: document.getElementById('status-val'),
        resultTitle: document.getElementById('result-title'),
        resultDetails: document.getElementById('result-details')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'beep') {
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'shred') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(60, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_point_delete.json');
            state.config = await resp.json();

            el.btnDelete.onclick = executeDelete;
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
        state.selectedId = null;
        state.isComplete = false;
        state.constraintInsight = false;
        state.lastOutcome = 'none';
        el.btnDelete.disabled = true;
        el.whereClause.innerHTML = 'WHERE id = <b>?</b>';
        el.status.textContent = 'READY_FOR_OPERATION';

        const lv = state.config.levels[idx];
        el.mission.textContent = `TARGET_PROFILE: ${lv.description}`;

        renderRecords(lv.data);
    }

    function renderRecords(data) {
        el.list.innerHTML = '';
        data.forEach(row => {
            const div = document.createElement('div');
            div.className = 'record-row';
            if (row.locked) div.classList.add('locked');

            let attrsHtml = '';
            for (const [k, v] of Object.entries(row)) {
                if (k !== 'id' && k !== 'locked' && k !== 'reason') {
                    attrsHtml += `
                <div class="attribute">
                    <span class="attr-key">${k}</span>
                    <span class="attr-val">${v}</span>
                </div>`;
                }
            }

            div.innerHTML = `
        <div class="col-id">#${row.id}</div>
        <div class="col-data">${attrsHtml}</div>
        ${row.locked ? '<div class="constraint-badge">CASCADE_RESTRICT</div>' : ''}
      `;

            div.onclick = () => selectRow(row, div);
            el.list.appendChild(div);
        });
    }

    function selectRow(row, rowEl) {
        if (state.isComplete) return;

        const lv = state.config.levels[state.levelIdx];
        const all = document.querySelectorAll('.record-row');
        all.forEach(r => r.classList.remove('selected'));

        if (row.locked) {
            playSound('error');
            rowEl.classList.add('shake');
            setTimeout(() => rowEl.classList.remove('shake'), 400);
            el.status.textContent = `INTEGRITY_HALT: ${row.reason}`;
            state.selectedId = null;
            el.btnDelete.disabled = true;
            el.whereClause.innerHTML = 'WHERE id = <b>?</b>';

            if (row.id === lv.target.id) {
                state.constraintInsight = true;
                completeLevel('constraint_blocked', row.reason);
            }
            return;
        }

        playSound('beep');
        rowEl.classList.add('selected');
        state.selectedId = row.id;
        el.btnDelete.disabled = false;
        el.whereClause.innerHTML = `WHERE id = <b>${row.id}</b>`;
        el.status.textContent = 'TARGET_ACQUIRED';
    }

    function executeDelete() {
        if (!state.selectedId || state.isComplete) return;

        const lv = state.config.levels[state.levelIdx];
        if (state.selectedId !== lv.target.id) {
            playSound('error');
            el.status.textContent = 'ERROR: COLLATERAL_DAMAGE_PREVENTED';
            const rows = document.querySelectorAll('.record-row');
            rows.forEach(r => r.classList.add('shake'));
            setTimeout(() => rows.forEach(r => r.classList.remove('shake')), 400);
            return;
        }

        state.isComplete = true;
        playSound('shred');
        el.status.textContent = 'ELIMINATING_RECORD...';
        state.lastOutcome = 'record_deleted';
        state.completedLevels = Math.max(state.completedLevels, state.levelIdx + 1);

        const selectedRow = document.querySelector('.record-row.selected');
        if (selectedRow) selectedRow.classList.add('fade-out');

        setTimeout(() => {
            showOverlay('RECORD_REMOVED', [
                '> OPERATION_SUCCESS: 100%',
                '> COLLATERAL_DAMAGE: 0',
                '> INTEGRITY_VERIFIED: YES'
            ]);
        }, 1000);
    }

    function completeLevel(outcome, reason) {
        state.isComplete = true;
        state.lastOutcome = outcome;
        state.completedLevels = Math.max(state.completedLevels, state.levelIdx + 1);
        setTimeout(() => {
            showOverlay('CONSTRAINT_CONFIRMED', [
                '> OPERATION_SUCCESS: SAFE_ABORT',
                '> COLLATERAL_DAMAGE: 0',
                `> REASON: ${reason || 'Foreign key restriction detected.'}`
            ]);
        }, 300);
    }

    function showOverlay(title, lines) {
        if (el.resultTitle) el.resultTitle.textContent = title;
        if (el.resultDetails) {
            el.resultDetails.innerHTML = (Array.isArray(lines) ? lines : [])
                .map((line) => `${line}<br>`)
                .join('');
        }
        el.overlay.classList.remove('hidden');
    }

    function computeProgressPercent() {
        const totalLevels = state.config && Array.isArray(state.config.levels) ? state.config.levels.length : 0;
        if (totalLevels <= 0) return 0;

        const lv = state.config.levels[state.levelIdx];
        const inLevel = state.isComplete ? 0 : (state.selectedId !== null || state.constraintInsight ? 0.5 : 0);
        const done = Math.max(0, Math.min(state.completedLevels, totalLevels));
        const ratio = (done + inLevel) / totalLevels;
        return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
    }

    window.render_game_to_text = function renderGameToText() {
        const lv = state.config && state.config.levels ? state.config.levels[state.levelIdx] : null;
        const targetId = lv && lv.target ? lv.target.id : null;
        const targetRow = lv && Array.isArray(lv.data) ? lv.data.find((row) => row.id === targetId) : null;

        return JSON.stringify({
            mode: state.isComplete ? 'result' : 'target_selection',
            measurable: true,
            coordinate_system: 'origin top-left, x right, y down',
            current_level: state.levelIdx + 1,
            total_levels: state.config && state.config.levels ? state.config.levels.length : 0,
            completed_levels: state.completedLevels,
            progress_percent: computeProgressPercent(),
            selected_id: state.selectedId,
            target_id: targetId,
            target_locked: !!(targetRow && targetRow.locked),
            constraint_insight: state.constraintInsight,
            status_text: el.status ? el.status.textContent : '',
            last_outcome: state.lastOutcome,
            is_complete: state.isComplete
        });
    };

    window.advanceTime = function advanceTime() {
        return true;
    };

    init();

  const __baseRenderToTextForSim = window.render_game_to_text;
  const __baseAdvanceTimeForSim = window.advanceTime;
  let __simulatedMs = 0;

  window.render_game_to_text = function renderGameToTextWithSimulatedMs() {
    const raw = typeof __baseRenderToTextForSim === "function" ? __baseRenderToTextForSim() : "{}";
    try {
      const payload = JSON.parse(raw);
      if (payload && typeof payload === "object" && !Array.isArray(payload) && !Object.prototype.hasOwnProperty.call(payload, "simulated_ms")) {
        payload.simulated_ms = __simulatedMs;
      }
      return JSON.stringify(payload);
    } catch (err) {
      return raw;
    }
  };

  window.advanceTime = function advanceTimeWithSimulatedMs(ms) {
    if (Number.isFinite(ms) && ms > 0) __simulatedMs += ms;
    if (typeof __baseAdvanceTimeForSim === "function") {
      try {
        return __baseAdvanceTimeForSim(ms);
      } catch (err) {
        return true;
      }
    }
    return true;
  };
})();
