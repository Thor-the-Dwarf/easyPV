(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        itemIdx: 0,
        totalItems: 0,
        completedItems: 0,
        score: 0,
        efficiency: 100,
        currentItem: null,
        isComplete: false,
        finished: false,
        lastResult: 'none'
    };

    const el = {
        title: document.getElementById('level-title'),
        spawner: document.getElementById('item-spawner'),
        slabs: document.getElementById('slabs-grid'),
        score: document.getElementById('score-val'),
        efficiency: document.getElementById('efficiency-val'),
        toast: document.getElementById('feed-toast'),
        overlay: document.getElementById('overlay'),
        resFinal: document.getElementById('res-final'),
        btnNext: document.getElementById('btn-next')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(freq, type = 'sine', duration = 0.1) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_type_match.json');
            state.config = await resp.json();
            state.totalItems = state.config.levels.reduce((sum, level) => {
                return sum + (Array.isArray(level.items) ? level.items.length : 0);
            }, 0);

            el.btnNext.onclick = () => {
                el.overlay.classList.add('hidden');
                if (state.finished) {
                    location.reload();
                    return;
                }
                startLevel(state.levelIdx + 1);
            };

            renderSlabs();
            startLevel(0);
        } catch (e) { console.error(e); }
    }

    function renderSlabs() {
        el.slabs.innerHTML = '';
        state.config.slots.forEach(slot => {
            const div = document.createElement('div');
            div.className = 'type-slab';
            div.dataset.id = slot.id;
            div.innerHTML = `
            <div class="slab-title">${slot.label}</div>
            <div class="slab-desc">${slot.description}</div>
          `;

            div.ondragover = e => { e.preventDefault(); div.classList.add('hover'); };
            div.ondragleave = () => div.classList.remove('hover');
            div.ondrop = e => handleDrop(div, slot.id);
            div.onclick = () => { if (state.currentItem) handleSelection(div, slot.id); };

            el.slabs.appendChild(div);
        });
    }

    function startLevel(idx) {
        if (idx >= state.config.levels.length) {
            state.finished = true;
            state.isComplete = true;
            state.lastResult = 'archive_secured';
            endGame("ARCHIVE_SECURED");
            return;
        }
        state.levelIdx = idx;
        state.itemIdx = 0;
        state.isComplete = false;
        state.lastResult = 'in_progress';

        const lv = state.config.levels[idx];
        el.title.textContent = `LAB_PROCEDURE // ${lv.title}`;

        spawnItem();
    }

    function spawnItem() {
        const lv = state.config.levels[state.levelIdx];
        if (state.itemIdx >= lv.items.length) {
            startLevel(state.levelIdx + 1);
            return;
        }

        state.currentItem = lv.items[state.itemIdx];
        el.spawner.innerHTML = '';

        const div = document.createElement('div');
        div.className = 'data-item';
        div.textContent = state.currentItem.value;
        div.draggable = true;
        div.ondragstart = e => {
            e.dataTransfer.setData('text/plain', div.textContent);
            div.style.opacity = '0.5';
        };
        div.ondragend = () => div.style.opacity = '1';

        el.spawner.appendChild(div);
    }

    function handleDrop(slab, slotId) {
        slab.classList.remove('hover');
        handleSelection(slab, slotId);
    }

    function handleSelection(slab, slotId) {
        if (!state.currentItem) return;
        const item = state.currentItem;

        if (item.best === slotId) {
            playSound(880);
            showToast("PERFECT_FIT", "var(--green-fit)");
            state.score += 100;
            advanceItem();
        } else if (item.ok.includes(slotId)) {
            playSound(440, 'triangle');
            showToast("INEFFICIENT_ALLOCATION", "var(--gold-primary)");
            state.score += 40;
            state.efficiency -= 10;
            advanceItem();
        } else {
            playSound(110, 'sawtooth', 0.3);
            slab.classList.add('shake');
            setTimeout(() => slab.classList.remove('shake'), 400);
            showToast("TYPE_OVERFLOW_ERROR", "var(--red-overflow)");
            state.score -= 50;
            state.efficiency -= 20;
        }

        updateHUD();
        if (state.efficiency <= 0) endGame("CRITICAL_STORAGE_FAILURE");
    }

    function advanceItem() {
        const itemEl = el.spawner.firstChild;
        if (itemEl) itemEl.classList.add('item-fit');

        state.completedItems++;
        state.itemIdx++;
        state.currentItem = null;
        setTimeout(spawnItem, 600);
    }

    function showToast(txt, color) {
        el.toast.textContent = txt;
        el.toast.style.borderColor = color;
        el.toast.style.color = color;
        el.toast.style.display = 'block';
        setTimeout(() => el.toast.style.display = 'none', 1000);
    }

    function updateHUD() {
        el.score.textContent = state.score;
        el.efficiency.textContent = `${state.efficiency}%`;
        el.efficiency.style.color = state.efficiency < 40 ? 'var(--red-overflow)' : 'var(--text-bright)';
    }

    function endGame(msg) {
        state.isComplete = true;
        if (msg === 'ARCHIVE_SECURED') state.finished = true;
        if (msg === 'CRITICAL_STORAGE_FAILURE') state.lastResult = 'critical_failure';
        el.resFinal.textContent = msg;
        el.overlay.classList.remove('hidden');
    }

    function computeProgressPercent() {
        if (state.totalItems <= 0) return 0;
        return Math.round(Math.max(0, Math.min(1, state.completedItems / state.totalItems)) * 100);
    }

    window.render_game_to_text = function renderGameToText() {
        const level = state.config && state.config.levels ? state.config.levels[state.levelIdx] : null;
        return JSON.stringify({
            mode: state.isComplete ? 'result' : 'type_assignment',
            measurable: true,
            coordinate_system: 'origin top-left, x right, y down',
            current_level: state.levelIdx + 1,
            total_levels: state.config && state.config.levels ? state.config.levels.length : 0,
            level_item_index: state.itemIdx,
            level_total_items: level && Array.isArray(level.items) ? level.items.length : 0,
            completed_items: state.completedItems,
            total_items: state.totalItems,
            score: state.score,
            efficiency_percent: state.efficiency,
            current_item_value: state.currentItem ? state.currentItem.value : null,
            finished: state.finished,
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
