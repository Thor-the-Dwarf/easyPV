(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        completedLevels: 0,
        isComplete: false,
        lastResult: 'none',
        revokedIds: new Set(),
        currentSyntax: {
            privilege: null,
            table: null,
            user: null
        }
    };

    const el = {
        missionDesc: document.getElementById('mission-desc'),
        userName: document.getElementById('user-name'),
        reasonBox: document.getElementById('reason-box'),
        grantsGrid: document.getElementById('grants-grid'),
        syntaxLine: document.getElementById('syntax-line'),
        btnExecute: document.getElementById('btn-execute'),
        deniedOverlay: document.getElementById('denied-overlay'),
        btnNext: document.getElementById('btn-next'),
        finalResult: document.getElementById('final-result')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(freq, type = 'sine', duration = 0.2, gainVal = 0.1) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_rights_revoke.json');
            state.config = await resp.json();

            initControls();

            el.btnExecute.addEventListener('click', executeRevoke);
            el.btnNext.addEventListener('click', nextLevel);

            startLevel(0);
        } catch (e) {
            console.error("Initialization failed:", e);
        }
    }

    function initControls() {
        // Command building logic via buttons
        document.querySelectorAll('.btn-terminal[data-cmd]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                const type = btn.dataset.type;

                if (type === 'privilege') state.currentSyntax.privilege = cmd;
                if (type === 'table') state.currentSyntax.table = cmd;
                if (type === 'user') state.currentSyntax.user = cmd;

                updateSyntaxDisplay();
                playTone(400, 'square', 0.05, 0.05);
            });
        });
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        state.revokedIds.clear();
        state.isComplete = false;
        state.lastResult = 'in_progress';
        state.currentSyntax = { privilege: null, table: null, user: null };

        const level = state.config.levels[idx];
        el.missionDesc.textContent = level.description;
        el.userName.textContent = level.target.user;
        el.reasonBox.textContent = `REASON: ${level.reason}`;

        updateSyntaxDisplay();
        renderGrants(level.activeGrants);

        // Auto-fill target user in syntax for better UX as it's the only choice usually
        state.currentSyntax.user = level.target.user;
        updateSyntaxDisplay();
    }

    function renderGrants(grants) {
        el.grantsGrid.innerHTML = '';
        grants.forEach(g => {
            const div = document.createElement('div');
            div.className = 'grant-item';
            div.dataset.id = g.id;
            div.innerHTML = `
        <span>${g.privilege} on ${g.table}</span>
        <span class="btn-revoke-tiny">Active</span>
      `;
            div.addEventListener('click', () => {
                // Quick select for syntax
                state.currentSyntax.privilege = g.privilege;
                state.currentSyntax.table = g.table;
                updateSyntaxDisplay();
                playTone(600, 'sine', 0.1);
            });
            el.grantsGrid.appendChild(div);
        });
    }

    function updateSyntaxDisplay() {
        const { privilege, table, user } = state.currentSyntax;
        let html = `<span>REVOKE</span> `;
        html += privilege ? `<span style="color:#fff">${privilege}</span> ` : `___ `;
        html += `<span>ON</span> `;
        html += table ? `<span style="color:#fff">${table}</span> ` : `___ `;
        html += `<span>FROM</span> `;
        html += user ? `<span style="color:#fff">${user}</span>` : `___`;

        el.syntaxLine.innerHTML = html;
    }

    function executeRevoke() {
        const level = state.config.levels[state.levelIdx];
        const { privilege, table, user } = state.currentSyntax;
        const target = level.target;

        if (!privilege || !table || !user) {
            state.lastResult = 'incomplete';
            playTone(100, 'sawtooth', 0.3, 0.3);
            alert("COMMAND INCOMPLETE: Check all parameters.");
            return;
        }

        // Validation
        const isSuccess = (
            (privilege === target.privilege || target.privilege === 'ALL') &&
            (table === target.table) &&
            (user === target.user)
        );

        if (isSuccess) {
            state.isComplete = true;
            state.lastResult = 'success';
            state.completedLevels = Math.max(state.completedLevels, state.levelIdx + 1);
            playTone(800, 'square', 0.1);
            setTimeout(() => playTone(200, 'square', 0.5, 0.2), 100);

            // Visual feedback: Stamp
            el.deniedOverlay.classList.add('active');

            // Tag revoked items
            document.querySelectorAll('.grant-item').forEach(item => {
                const text = item.querySelector('span').textContent;
                // If ALL was revoked, all matching table grants are revoked
                if (privilege === 'ALL' && text.includes(`on ${table}`)) {
                    item.classList.add('revoked');
                } else if (text === `${privilege} on ${table}`) {
                    item.classList.add('revoked');
                }
            });

        } else {
            state.lastResult = 'failed';
            playTone(150, 'sawtooth', 0.5, 0.4);
            // Screen shake
            document.body.style.animation = 'shake 0.2s 3';
            setTimeout(() => document.body.style.animation = '', 600);
            alert("PERMISSION DENIED: Command does not match security requirements.");
        }
    }

    function nextLevel() {
        el.deniedOverlay.classList.remove('active');
        if (state.levelIdx < state.config.levels.length - 1) {
            startLevel(state.levelIdx + 1);
        } else {
            // Victory/Reset
            location.reload();
        }
    }

    function computeSyntaxReadiness() {
        const fields = [
            state.currentSyntax.privilege,
            state.currentSyntax.table,
            state.currentSyntax.user
        ];
        const filled = fields.filter((v) => !!v).length;
        return filled / fields.length;
    }

    function computeProgressPercent() {
        const total = state.config && Array.isArray(state.config.levels) ? state.config.levels.length : 0;
        if (total <= 0) return 0;
        const done = Math.max(0, Math.min(state.completedLevels, total));
        const inLevel = state.isComplete ? 0 : computeSyntaxReadiness() * 0.5;
        return Math.round(Math.max(0, Math.min(1, (done + inLevel) / total)) * 100);
    }

    window.render_game_to_text = function renderGameToText() {
        const level = state.config && state.config.levels ? state.config.levels[state.levelIdx] : null;
        return JSON.stringify({
            mode: state.isComplete ? 'result' : 'command_building',
            measurable: true,
            coordinate_system: 'origin top-left, x right, y down',
            current_level: state.levelIdx + 1,
            total_levels: state.config && state.config.levels ? state.config.levels.length : 0,
            completed_levels: state.completedLevels,
            syntax: { ...state.currentSyntax },
            target: level ? level.target : null,
            overlay_open: el.deniedOverlay ? el.deniedOverlay.classList.contains('active') : false,
            last_result: state.lastResult,
            progress_percent: computeProgressPercent()
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
