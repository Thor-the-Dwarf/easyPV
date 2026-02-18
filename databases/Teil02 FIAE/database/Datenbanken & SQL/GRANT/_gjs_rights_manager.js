(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        completedLevels: 0,
        activePerms: new Set(),
        isComplete: false,
        lastResult: 'none'
    };

    const el = {
        userName: document.getElementById('user-name'),
        userAvatar: document.getElementById('user-avatar'),
        accessReq: document.getElementById('access-req'),
        tableTarget: document.getElementById('table-target'),
        permSwitches: document.getElementById('perm-switches'),
        btnCommit: document.getElementById('btn-commit'),
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

        if (type === 'toggle') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start();
            osc.stop(now + 0.05);
        } else if (type === 'denied') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'granted') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_rights_manager.json');
            state.config = await resp.json();

            initSwitches();

            el.btnCommit.addEventListener('click', checkAccess);
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

    function initSwitches() {
        const perms = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
        el.permSwitches.innerHTML = '';

        perms.forEach(p => {
            const div = document.createElement('div');
            div.className = 'perm-switch';
            div.textContent = p;
            div.dataset.perm = p;

            div.addEventListener('click', () => {
                if (state.activePerms.has(p)) {
                    state.activePerms.delete(p);
                    div.classList.remove('active');
                } else {
                    state.activePerms.add(p);
                    div.classList.add('active');
                }
                playTone('toggle');
            });

            el.permSwitches.appendChild(div);
        });
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        state.activePerms.clear();
        state.isComplete = false;
        state.lastResult = 'in_progress';
        document.querySelectorAll('.perm-switch').forEach(s => s.classList.remove('active'));

        const level = state.config.levels[idx];
        el.userName.textContent = level.user;
        el.userAvatar.textContent = "👤"; // Simple text icon
        el.accessReq.textContent = level.description;
        el.tableTarget.textContent = `TARGET: ${level.targetTable}`;
    }

    function checkAccess() {
        const level = state.config.levels[state.levelIdx];
        let errors = [];

        // Check Required
        level.required.forEach(r => {
            if (!state.activePerms.has(r)) {
                errors.push(`Missing privilege: ${r}`);
            }
        });

        // Check Forbidden
        level.forbidden.forEach(f => {
            if (state.activePerms.has(f)) {
                errors.push(`Excessive privilege: ${f} (Security Risk!)`);
            }
        });

        // Check if user selected something not relevant but not explicitly forbidden?
        // Assuming only relevant perms matter.

        if (errors.length === 0) {
            state.isComplete = true;
            state.lastResult = 'granted';
            state.completedLevels = Math.max(state.completedLevels, state.levelIdx + 1);
            playTone('granted');
            el.finalResult.innerHTML = `<span style="color:#0f9d58">ACCESS GRANTED</span><br><br>Principle of Least Privilege observed.`;
            el.resultOverlay.classList.remove('hidden');
        } else {
            state.lastResult = 'denied';
            playTone('denied');
            alert("SECURITY AUDIT FAILED:\n\n" + errors.join("\n"));
        }
    }

    function computeCurrentReadiness() {
        const level = state.config && state.config.levels ? state.config.levels[state.levelIdx] : null;
        if (!level) return 0;

        const required = Array.isArray(level.required) ? level.required : [];
        const forbidden = Array.isArray(level.forbidden) ? level.forbidden : [];
        const requiredHit = required.filter((perm) => state.activePerms.has(perm)).length;
        const forbiddenHit = forbidden.filter((perm) => state.activePerms.has(perm)).length;

        const requiredRatio = required.length > 0 ? requiredHit / required.length : 0;
        const forbiddenPenalty = forbidden.length > 0 ? forbiddenHit / forbidden.length : 0;
        return Math.max(0, Math.min(1, requiredRatio - forbiddenPenalty));
    }

    function computeProgressPercent() {
        const total = state.config && Array.isArray(state.config.levels) ? state.config.levels.length : 0;
        if (total <= 0) return 0;
        const done = Math.max(0, Math.min(state.completedLevels, total));
        const inLevel = state.isComplete ? 0 : computeCurrentReadiness();
        return Math.round(Math.max(0, Math.min(1, (done + inLevel) / total)) * 100);
    }

    window.render_game_to_text = function renderGameToText() {
        const level = state.config && state.config.levels ? state.config.levels[state.levelIdx] : null;
        return JSON.stringify({
            mode: state.isComplete ? 'result' : 'privilege_selection',
            measurable: true,
            coordinate_system: 'origin top-left, x right, y down',
            current_level: state.levelIdx + 1,
            total_levels: state.config && state.config.levels ? state.config.levels.length : 0,
            completed_levels: state.completedLevels,
            active_permissions: Array.from(state.activePerms),
            required_permissions: level ? level.required : [],
            forbidden_permissions: level ? level.forbidden : [],
            last_result: state.lastResult,
            progress_percent: computeProgressPercent()
        });
    };

    window.advanceTime = function advanceTime() {
        return true;
    };

    init();
})();
