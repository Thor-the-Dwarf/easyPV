(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        score: 0,
        devices: [], // { id, subs: [] }
        selectedDeviceId: null,
        gameOver: false
    };

    const el = {
        hudScore: document.getElementById('score-val'),
        hudLevel: document.getElementById('level-val'),
        grid: document.getElementById('sub-grid'),
        console: document.getElementById('broadcaster-console'),
        configPanel: document.getElementById('config-panel'),
        toggleBtns: document.getElementById('subs-toggles'),
        deviceName: document.getElementById('device-name'),
        resultScreen: document.getElementById('result-screen'),
        finalScore: document.getElementById('final-score'),
        restartBtn: document.getElementById('restart-btn')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'broadcast') {
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'ping') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        }
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_observer_simulation.json');
            state.config = await resp.json();

            setupConsole();
            el.restartBtn.addEventListener('click', restartGame);

            restartGame();
        } catch (e) {
            console.error(e);
        }
    }

    function setupConsole() {
        // Generate broadcast buttons based on channels
        el.console.innerHTML = '';

        state.config.channels.forEach(ch => {
            const ctrl = document.createElement('div');
            ctrl.className = 'channel-ctrl';
            ctrl.innerHTML = `
            <div class="channel-icon" style="color: ${ch.color}">${ch.icon}</div>
            <div style="font-size:0.8rem; color:${ch.color}">${ch.label}</div>
            <button class="broadcast-btn">Broadcast</button>
        `;

            ctrl.querySelector('button').addEventListener('click', (e) => {
                e.stopPropagation();
                broadcast(ch.id);
            });

            el.console.appendChild(ctrl);
        });
    }

    function restartGame() {
        state.levelIdx = 0;
        state.score = 0;
        state.gameOver = false;

        el.resultScreen.classList.add('hidden');
        startLevel(0);
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            endGame(true);
            return;
        }

        state.levelIdx = idx;
        const level = state.config.levels[idx];

        updateHUD();

        // Setup Devices
        state.devices = [];
        el.grid.innerHTML = '';

        for (let i = 0; i < level.devices; i++) {
            const dev = { id: i, subs: [] };
            // Apply required initial subs
            const req = level.required_subs.filter(r => r.deviceId === i);
            req.forEach(r => dev.subs.push(r.channelId));

            state.devices.push(dev);

            createDeviceNode(dev);
        }

        selectDevice(null);
    }

    function createDeviceNode(dev) {
        const node = document.createElement('div');
        node.className = 'device-node';
        node.dataset.id = dev.id;
        node.innerHTML = `
        <div class="device-icon">📱</div>
        <div style="font-size:0.8rem">Dev-${dev.id}</div>
        <div class="sub-badges"></div>
      `;

        node.addEventListener('click', () => selectDevice(dev.id));

        el.grid.appendChild(node);
        updateDeviceVisual(dev.id);
    }

    function selectDevice(id) {
        state.selectedDeviceId = id;

        // UI Update
        el.grid.querySelectorAll('.device-node').forEach(n => n.classList.remove('selected'));

        if (id === null) {
            el.configPanel.classList.remove('open');
            return;
        }

        const node = el.grid.querySelector(`.device-node[data-id="${id}"]`);
        if (node) node.classList.add('selected');

        el.deviceName.textContent = `Device-${id} Configuration`;
        el.configPanel.classList.add('open');

        renderToggles();
    }

    function renderToggles() {
        const dev = state.devices.find(d => d.id === state.selectedDeviceId);
        if (!dev) return;

        el.toggleBtns.innerHTML = '';
        state.config.channels.forEach(ch => {
            const btn = document.createElement('button');
            btn.className = 'toggle-btn';
            if (dev.subs.includes(ch.id)) btn.classList.add('active');
            btn.textContent = ch.label;
            btn.onclick = () => toggleSub(ch.id);
            el.toggleBtns.appendChild(btn);
        });
    }

    function toggleSub(channelId) {
        const dev = state.devices.find(d => d.id === state.selectedDeviceId);
        if (!dev) return;

        if (dev.subs.includes(channelId)) {
            dev.subs = dev.subs.filter(s => s !== channelId);
        } else {
            dev.subs.push(channelId);
        }
        playTone('ping');
        renderToggles();
        updateDeviceVisual(dev.id);
    }

    function updateDeviceVisual(devId) {
        const dev = state.devices[devId];
        const node = el.grid.querySelector(`.device-node[data-id="${devId}"]`);
        if (!node) return;

        const badgeContainer = node.querySelector('.sub-badges');
        badgeContainer.innerHTML = '';

        dev.subs.forEach(subId => {
            const ch = state.config.channels.find(c => c.id === subId);
            if (ch) {
                const b = document.createElement('div');
                b.className = 'sub-badge';
                b.style.backgroundColor = ch.color;
                badgeContainer.appendChild(b);
            }
        });
    }

    function broadcast(channelId) {
        playTone('broadcast');

        // Check effects
        let correct = 0;
        let incorrect = 0; // if we had logic for "should calculate"

        state.devices.forEach(dev => {
            const node = el.grid.querySelector(`.device-node[data-id="${dev.id}"]`);

            if (dev.subs.includes(channelId)) {
                // Received!
                node.classList.add('pulse-good');
                setTimeout(() => node.classList.remove('pulse-good'), 500);
                correct++;
            } else {
                // Should not receive
                // If we wanted to test leaks, we could check if it "should" have received but didn't
                // For now simpler: Just show activity
            }
        });

        state.score += (correct * 10);
        updateHUD();

        // Implicit level progression / tasks? 
        // For simulation: Every 5 broadcasts, move to next level?
        // Or simple "Next Level" button?
        // Let's go with threshold for now
        if (state.score > (state.levelIdx + 1) * 200) {
            setTimeout(() => startLevel(state.levelIdx + 1), 1000);
        }
    }

    function updateHUD() {
        el.hudScore.textContent = state.score;
        el.hudLevel.textContent = state.levelIdx + 1;
    }

    function endGame(win) {
        state.gameOver = true;
        el.finalScore.textContent = state.score;
        el.resultScreen.querySelector('h2').textContent = win ? "Network Stable!" : "System Crash!";
        el.resultScreen.classList.remove('hidden');
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
