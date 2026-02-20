(function () {
  'use strict';

  const state = {
    cfg: null,
    roundIndex: 0,
    score: 0,
    correctCount: 0,
    answered: false,
    selectedOptionId: null,
    done: false,
    feedback: '',
    feedbackState: '',
    remainingMs: 0,
    elapsedMs: 0,
    lastTickAt: 0,
    timerId: 0
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
      const response = await fetch('_data/_gg01_chart_chooser.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await response.json();
      startRound();
      render();
    } catch (error) {
      if (el.root) el.root.innerHTML = '<p>Fehler: ' + escapeHtml(error.message) + '</p>';
    }
  }

  function currentScenario() {
    if (!state.cfg || !Array.isArray(state.cfg.scenarios)) return null;
    return state.cfg.scenarios[state.roundIndex] || null;
  }

  function roundLimitMs() {
    const value = Number(state.cfg && state.cfg.timing && state.cfg.timing.default_round_ms);
    return Number.isFinite(value) && value > 0 ? value : 14000;
  }

  function startRound() {
    const scenario = currentScenario();
    if (!scenario) {
      finishGame();
      return;
    }

    state.answered = false;
    state.selectedOptionId = null;
    state.feedback = '';
    state.feedbackState = '';
    state.remainingMs = roundLimitMs();
    state.lastTickAt = Date.now();

    stopTimer();
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
    if (state.done || state.answered) return;
    const delta = Number(deltaMs);
    if (!Number.isFinite(delta) || delta <= 0) return;

    state.remainingMs = Math.max(0, state.remainingMs - delta);
    state.elapsedMs += delta;

    if (state.remainingMs <= 0) {
      evaluate('timeout');
      return;
    }

    renderKpis();
  }

  function scoringValue(key, fallback) {
    const value = Number(state.cfg && state.cfg.scoring && state.cfg.scoring[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  function evaluate(optionId) {
    if (state.done || state.answered) return;

    const scenario = currentScenario();
    if (!scenario) return;

    const selected = String(optionId || '').trim();
    const correctId = String(scenario.correctOptionId || '').trim();
    const option = (scenario.options || []).find(function (entry) {
      return String(entry.id || '') === selected;
    });
    const correctOption = (scenario.options || []).find(function (entry) {
      return String(entry.id || '') === correctId;
    });

    if (selected !== 'timeout' && !option) return;

    state.answered = true;
    state.selectedOptionId = selected;
    stopTimer();

    if (selected === 'timeout') {
      state.score += scoringValue('timeout', -8);
      state.feedbackState = 'bad';
      state.feedback = 'Zeit abgelaufen. Passend wäre: ' + (correctOption ? correctOption.label : '-');
    } else if (selected === correctId) {
      state.score += scoringValue('correct', 20);
      state.correctCount += 1;
      state.feedbackState = 'ok';
      state.feedback = option.reason || 'Richtige Diagrammwahl.';
    } else {
      state.score += scoringValue('wrong', -6);
      state.feedbackState = 'bad';
      state.feedback = (option.reason || 'Diese Wahl passt nicht optimal.') + ' Richtiger wäre: ' + (correctOption ? correctOption.label : '-');
    }

    render();
  }

  function nextRound() {
    if (!state.answered || state.done || !state.cfg) return;

    if (state.roundIndex >= state.cfg.scenarios.length - 1) {
      finishGame();
      return;
    }

    state.roundIndex += 1;
    startRound();
    render();
  }

  function finishGame() {
    stopTimer();
    state.done = true;
    state.score += scoringValue('completion_bonus', 10);
    render();
  }

  function restart() {
    stopTimer();
    state.roundIndex = 0;
    state.score = 0;
    state.correctCount = 0;
    state.answered = false;
    state.selectedOptionId = null;
    state.done = false;
    state.feedback = '';
    state.feedbackState = '';
    state.remainingMs = 0;
    state.elapsedMs = 0;
    state.lastTickAt = 0;
    startRound();
    render();
  }

  function progressPercent() {
    if (!state.cfg || !Array.isArray(state.cfg.scenarios) || state.cfg.scenarios.length === 0) return 0;
    return Math.round((state.correctCount / state.cfg.scenarios.length) * 100);
  }

  function renderKpis() {
    const total = state.cfg && state.cfg.scenarios ? state.cfg.scenarios.length : 0;
    const shown = state.done ? total : state.roundIndex + 1;
    const ratio = roundLimitMs() > 0 ? Math.max(0, Math.min(1, state.remainingMs / roundLimitMs())) : 0;

    if (el.round) el.round.textContent = String(shown) + '/' + String(total);
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

    if (state.done) {
      el.root.innerHTML = [
        '<section class="result">',
        '<h2>Chart-Chooser abgeschlossen</h2>',
        '<p>Score: <strong>' + escapeHtml(String(state.score)) + '</strong></p>',
        '<p>Trefferquote: <strong>' + escapeHtml(String(progressPercent())) + '%</strong></p>',
        '<button id="restart-btn" class="btn" type="button">Nochmal spielen</button>',
        '</section>'
      ].join('');
      const restartBtn = document.getElementById('restart-btn');
      if (restartBtn) restartBtn.addEventListener('click', restart);
      return;
    }

    const scenario = currentScenario();
    if (!scenario) return;

    let html = '';
    html += '<section class="scenario">';
    html += '<div>Datensatz</div>';
    html += '<h2>' + escapeHtml(scenario.dataDesc || '') + '</h2>';
    html += '<p class="hint">Hinweis: ' + escapeHtml(scenario.hint || '-') + '</p>';
    html += '</section>';

    html += '<div class="options">';
    (scenario.options || []).forEach(function (option) {
      const chosen = state.selectedOptionId === option.id ? ' chosen' : '';
      const disabled = state.answered ? ' disabled' : '';
      html += '<button class="option-btn' + chosen + '" type="button" data-option-id="' + escapeHtml(option.id) + '"' + disabled + '>';
      html += '<span class="icon">' + escapeHtml(option.icon || '') + '</span>';
      html += escapeHtml(option.label || 'Option');
      html += '</button>';
    });
    html += '</div>';

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">' + escapeHtml(state.feedback) + '</section>';
      html += '<div class="actions"><button id="next-btn" class="btn" type="button">' + (state.roundIndex >= state.cfg.scenarios.length - 1 ? 'Auswertung' : 'Nächstes Szenario') + '</button></div>';
    }

    el.root.innerHTML = html;

    Array.from(el.root.querySelectorAll('[data-option-id]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        evaluate(btn.getAttribute('data-option-id'));
      });
    });

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.addEventListener('click', nextRound);
  }

  function asStatePayload() {
    const scenario = currentScenario();
    const progress = progressPercent();
    return {
      mode: state.done ? 'result' : 'chart_chooser',
      measurable: true,
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.roundIndex,
      total_rounds: state.cfg && state.cfg.scenarios ? state.cfg.scenarios.length : 0,
      score: state.score,
      progress_percent: progress,
      rate_percent: progress,
      answered: state.answered,
      selected_option_id: state.selectedOptionId,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs),
      current_scenario: scenario ? {
        id: scenario.id,
        data_desc: scenario.dataDesc,
        correct_option_id: scenario.correctOptionId
      } : null
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
