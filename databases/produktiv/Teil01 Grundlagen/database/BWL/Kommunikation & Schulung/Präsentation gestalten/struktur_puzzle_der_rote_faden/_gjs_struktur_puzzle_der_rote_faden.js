(function () {
  'use strict';

  const state = {
    cfg: null,
    selectedIndices: [],
    score: 0,
    done: false,
    feedback: '',
    feedbackState: '',
    remainingMs: 0,
    elapsedMs: 0,
    lastTickAt: 0,
    timerId: 0,
    evaluated: false
  };

  const el = {
    root: document.getElementById('root'),
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    rate: document.getElementById('kpi-rate'),
    time: document.getElementById('kpi-time'),
    fill: document.getElementById('time-fill')
  };

  init();

  async function init() {
    try {
      const response = await fetch('_data/_gg01_struktur_puzzle_der_rote_faden.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await response.json();
      restart();
    } catch (error) {
      if (el.root) el.root.innerHTML = '<p>Fehler: ' + escapeHtml(error.message) + '</p>';
    }
  }

  function totalMs() {
    const value = Number(state.cfg && state.cfg.timing && state.cfg.timing.total_ms);
    return Number.isFinite(value) && value > 0 ? value : 90000;
  }

  function blocks() {
    return state.cfg && Array.isArray(state.cfg.blocks) ? state.cfg.blocks : [];
  }

  function targetOrder() {
    return state.cfg && Array.isArray(state.cfg.targetOrder) ? state.cfg.targetOrder : [];
  }

  function startTimer() {
    stopTimer();
    state.lastTickAt = Date.now();
    state.timerId = window.setInterval(function () {
      const now = Date.now();
      tick(now - state.lastTickAt);
      state.lastTickAt = now;
    }, 100);
  }

  function stopTimer() {
    if (!state.timerId) return;
    window.clearInterval(state.timerId);
    state.timerId = 0;
  }

  function tick(deltaMs) {
    if (state.done || state.evaluated) return;
    const delta = Number(deltaMs);
    if (!Number.isFinite(delta) || delta <= 0) return;

    state.remainingMs = Math.max(0, state.remainingMs - delta);
    state.elapsedMs += delta;

    if (state.remainingMs <= 0) {
      evaluateOrder();
      return;
    }

    renderKpis();
  }

  function addBlock(index) {
    if (state.done || state.evaluated) return;
    if (!Number.isInteger(index) || index < 0) return;
    if (state.selectedIndices.includes(index)) return;
    state.selectedIndices.push(index);
    render();
  }

  function removeBlock(position) {
    if (state.done || state.evaluated) return;
    if (!Number.isInteger(position) || position < 0 || position >= state.selectedIndices.length) return;
    state.selectedIndices.splice(position, 1);
    render();
  }

  function clearOrder() {
    if (state.done || state.evaluated) return;
    if (state.selectedIndices.length === 0) return;
    state.selectedIndices = [];
    render();
  }

  function evaluateOrder() {
    if (state.done || state.evaluated) return;

    const order = state.selectedIndices.map(function (idx) {
      return String(blocks()[idx] || '');
    });

    state.evaluated = true;
    stopTimer();

    const target = targetOrder();
    const complete = order.length === target.length;
    const match = complete && order.every(function (entry, index) {
      return entry === target[index];
    });

    if (match) {
      state.score = Number(state.cfg && state.cfg.scoring && state.cfg.scoring.perfect) || 100;
      state.feedbackState = 'ok';
      state.feedback = 'Perfekt: Die Reihenfolge ist logisch und schlüssig.';
    } else {
      state.score = Number(state.cfg && state.cfg.scoring && state.cfg.scoring.wrong) || 0;
      state.feedbackState = 'bad';
      state.feedback = 'Noch nicht korrekt. Zielreihenfolge: ' + target.join(' → ');
    }

    state.done = true;
    render();
  }

  function restart() {
    stopTimer();
    state.selectedIndices = [];
    state.score = 0;
    state.done = false;
    state.feedback = '';
    state.feedbackState = '';
    state.remainingMs = totalMs();
    state.elapsedMs = 0;
    state.lastTickAt = 0;
    state.evaluated = false;
    startTimer();
    render();
  }

  function progressPercent() {
    const total = targetOrder().length;
    if (!total) return 0;
    if (state.done) {
      return state.score >= 100 ? 100 : 0;
    }
    return Math.round((state.selectedIndices.length / total) * 100);
  }

  function renderKpis() {
    const total = targetOrder().length;
    const ratio = totalMs() > 0 ? Math.max(0, Math.min(1, state.remainingMs / totalMs())) : 0;

    if (el.round) el.round.textContent = String(state.selectedIndices.length) + '/' + String(total);
    if (el.score) el.score.textContent = String(state.score);
    if (el.rate) el.rate.textContent = String(progressPercent()) + '%';
    if (el.time) el.time.textContent = (state.remainingMs / 1000).toFixed(1) + 's';

    if (el.fill) {
      el.fill.style.width = Math.round(ratio * 100) + '%';
      if (ratio > 0.5) {
        el.fill.style.background = 'linear-gradient(90deg, #35d08a, #ffb347)';
      } else if (ratio > 0.2) {
        el.fill.style.background = 'linear-gradient(90deg, #ffb347, #ff8f57)';
      } else {
        el.fill.style.background = 'linear-gradient(90deg, #ff8f57, #ff6f7a)';
      }
    }
  }

  function render() {
    renderKpis();
    if (!state.cfg || !el.root) return;

    const blockList = blocks();
    const chosenSet = new Set(state.selectedIndices);

    let html = '';
    html += '<section class="instructions">';
    html += '<p>Bringe die 6 Abschnitte in die richtige Reihenfolge.</p>';
    html += '<p><strong>Hinweise:</strong> ' + (state.cfg.hints || []).map(escapeHtml).join(' | ') + '</p>';
    html += '</section>';

    html += '<h3 class="zone-title">Aktuelle Reihenfolge (klicken zum Entfernen)</h3>';
    html += '<section class="order-zone">';
    if (state.selectedIndices.length === 0) {
      html += '<span class="placeholder">Noch keine Abschnitte gesetzt.</span>';
    } else {
      state.selectedIndices.forEach(function (idx, pos) {
        html += '<button class="block-btn placed" type="button" data-order-pos="' + pos + '"' + (state.done ? ' disabled' : '') + '>' + escapeHtml(blockList[idx]) + '</button>';
      });
    }
    html += '</section>';

    html += '<h3 class="zone-title">Bausteine</h3>';
    html += '<section class="pool">';
    blockList.forEach(function (name, idx) {
      html += '<button class="block-btn" type="button" data-block-index="' + idx + '"' + ((chosenSet.has(idx) || state.done) ? ' disabled' : '') + '>' + escapeHtml(name) + '</button>';
    });
    html += '</section>';

    html += '<div class="actions">';
    html += '<button id="clear-btn" class="btn" type="button"' + ((state.done || state.selectedIndices.length === 0) ? ' disabled' : '') + '>Leeren</button>';
    html += '<button id="check-btn" class="btn" type="button"' + (state.done ? ' disabled' : '') + '>Reihenfolge prüfen</button>';
    html += '</div>';

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">' + escapeHtml(state.feedback) + '</section>';
      html += '<div class="actions"><button id="restart-btn" class="btn" type="button">Nochmal sortieren</button></div>';
    }

    el.root.innerHTML = html;

    Array.from(el.root.querySelectorAll('[data-block-index]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        addBlock(Number(btn.getAttribute('data-block-index')));
      });
    });

    Array.from(el.root.querySelectorAll('[data-order-pos]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        removeBlock(Number(btn.getAttribute('data-order-pos')));
      });
    });

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', clearOrder);

    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) checkBtn.addEventListener('click', evaluateOrder);

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', restart);
  }

  function asStatePayload() {
    const currentOrder = state.selectedIndices.map(function (idx) {
      return String(blocks()[idx] || '');
    });
    const progress = progressPercent();

    return {
      mode: state.done ? 'result' : 'struktur_puzzle_der_rote_faden',
      measurable: true,
      coordinate_system: 'origin top-left, x right, y down',
      total_blocks: targetOrder().length,
      placed_blocks: currentOrder.length,
      current_order: currentOrder,
      target_order: targetOrder(),
      score: state.score,
      progress_percent: progress,
      rate_percent: progress,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs)
    };
  }

  window.render_game_to_text = function () {
    const payload = asStatePayload();
    payload.simulated_ms = window.__simulatedMs || 0;
    return JSON.stringify(payload);
  };

  window.advanceTime = function (ms) {
    const safeMs = Math.max(0, Number(ms) || 0);
    window.__simulatedMs = (window.__simulatedMs || 0) + safeMs;
    if (safeMs <= 0) {
      renderKpis();
      return;
    }

    const step = 1000 / 60;
    let remaining = safeMs;
    while (remaining > 0) {
      const delta = Math.min(step, remaining);
      tick(delta);
      remaining -= delta;
      if (state.done) break;
    }
    renderKpis();
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
