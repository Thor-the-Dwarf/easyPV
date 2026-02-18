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
    lastTickAt: 0,
    elapsedMs: 0,
    totalReactionMs: 0,
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
      const response = await fetch('_data/_gg01_cc_blindflug_vermeider.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await response.json();
      startRound();
      render();
    } catch (error) {
      if (el.root) {
        el.root.innerHTML = '<p>Fehler: ' + escapeHtml(error.message) + '</p>';
      }
    }
  }

  function currentRound() {
    if (!state.cfg || !Array.isArray(state.cfg.rounds)) return null;
    return state.cfg.rounds[state.roundIndex] || null;
  }

  function getRoundLimitMs(round) {
    const fromRound = Number(round && round.roundMs);
    if (Number.isFinite(fromRound) && fromRound > 0) return fromRound;
    const fallback = Number(state.cfg && state.cfg.timing && state.cfg.timing.default_round_ms);
    if (Number.isFinite(fallback) && fallback > 0) return fallback;
    return 12000;
  }

  function startRound() {
    const round = currentRound();
    if (!round) {
      finishGame();
      return;
    }

    state.answered = false;
    state.selectedOptionId = null;
    state.feedback = '';
    state.feedbackState = '';
    state.remainingMs = getRoundLimitMs(round);
    state.lastTickAt = Date.now();

    stopTimer();
    state.timerId = window.setInterval(function () {
      tick(Date.now() - state.lastTickAt);
      state.lastTickAt = Date.now();
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

  function evaluate(optionId) {
    if (state.done || state.answered) return;

    const round = currentRound();
    if (!round || !Array.isArray(round.options)) return;

    const scoring = state.cfg && state.cfg.scoring ? state.cfg.scoring : {};
    const selected = String(optionId || '').trim();
    const correctId = String(round.correctOptionId || '').trim();
    const correctOption = round.options.find(function (option) {
      return String(option.id || '') === correctId;
    }) || null;

    if (selected !== 'timeout') {
      const selectedOption = round.options.find(function (option) {
        return String(option.id || '') === selected;
      });
      if (!selectedOption) return;
    }

    state.answered = true;
    state.selectedOptionId = selected;
    stopTimer();

    if (selected === 'timeout') {
      state.score += Number(scoring.timeout) || 0;
      state.feedbackState = 'bad';
      state.feedback = 'Zeit abgelaufen. ' + (correctOption ? 'Korrekt waere Option ' + correctOption.id.toUpperCase() + '.' : '');
      render();
      return;
    }

    const option = round.options.find(function (entry) {
      return String(entry.id || '') === selected;
    });

    const isCorrect = selected === correctId;
    if (isCorrect) {
      state.score += Number(scoring.correct) || 0;
      state.correctCount += 1;
      state.feedbackState = 'ok';
      state.feedback = option && option.feedback ? option.feedback : 'Korrekte Verteilerlogik.';
      const roundMs = getRoundLimitMs(round);
      state.totalReactionMs += Math.max(0, roundMs - state.remainingMs);
    } else {
      state.score += Number(scoring.wrong) || 0;
      state.feedbackState = 'bad';
      state.feedback = option && option.feedback ? option.feedback : 'Nicht korrekt zugeordnet.';
      if (correctOption) {
        state.feedback += ' Korrekt waere Option ' + correctOption.id.toUpperCase() + '.';
      }
    }

    render();
  }

  function nextRound() {
    if (!state.answered || state.done || !state.cfg) return;

    if (state.roundIndex >= state.cfg.rounds.length - 1) {
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
    state.score += Number(state.cfg && state.cfg.scoring && state.cfg.scoring.completion_bonus) || 0;
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
    state.lastTickAt = 0;
    state.elapsedMs = 0;
    state.totalReactionMs = 0;
    startRound();
    render();
  }

  function computeRatePercent() {
    if (!state.cfg || !Array.isArray(state.cfg.rounds) || state.cfg.rounds.length === 0) return 0;
    const perCorrect = Math.max(1, Number(state.cfg.scoring && state.cfg.scoring.correct) || 0);
    const maxScore = state.cfg.rounds.length * perCorrect;
    if (maxScore <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((state.score / maxScore) * 100)));
  }

  function renderKpis() {
    const total = state.cfg && state.cfg.rounds ? state.cfg.rounds.length : 0;
    const shownRound = state.done ? total : state.roundIndex + 1;
    const round = currentRound();
    const limitMs = getRoundLimitMs(round);
    const ratio = limitMs > 0 ? Math.max(0, Math.min(1, state.remainingMs / limitMs)) : 0;

    if (el.round) el.round.textContent = String(shownRound) + '/' + String(total);
    if (el.score) el.score.textContent = String(state.score);
    if (el.rate) el.rate.textContent = String(computeRatePercent()) + '%';
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
      const avgReactionMs = state.correctCount > 0 ? Math.round(state.totalReactionMs / state.correctCount) : 0;

      el.root.innerHTML = [
        '<section class="result">',
        '<h2>Durchlauf abgeschlossen</h2>',
        '<p>Score: <strong>' + escapeHtml(String(state.score)) + '</strong> / 100</p>',
        '<p>Trefferquote: <strong>' + escapeHtml(String(computeRatePercent())) + '%</strong></p>',
        '<p>Durchschnitt Reaktionszeit (korrekte Treffer): <strong>' + escapeHtml(String(avgReactionMs)) + ' ms</strong></p>',
        '<button id="restart-btn" class="btn" type="button">Nochmal spielen</button>',
        '</section>'
      ].join('');

      const restartBtn = document.getElementById('restart-btn');
      if (restartBtn) restartBtn.addEventListener('click', restart);
      return;
    }

    const round = currentRound();
    if (!round) return;

    let html = '';
    html += '<article class="scenario">';
    html += '<header class="scenario-head"><div class="scenario-title">Szenario</div></header>';
    html += '<p class="scenario-body">' + escapeHtml(round.scenario || '') + '</p>';
    html += '</article>';

    html += '<div class="option-list">';
    round.options.forEach(function (option) {
      const disabledAttr = state.answered ? ' disabled' : '';
      const isChosen = state.selectedOptionId === String(option.id || '');
      const chosenClass = isChosen ? ' chosen' : '';
      html += '<button class="option-btn' + chosenClass + '" type="button" data-option-id="' + escapeHtml(String(option.id || '')) + '"' + disabledAttr + '>';
      html += '<div class="option-id">Option ' + escapeHtml(String(option.id || '').toUpperCase()) + '</div>';
      html += '<div class="routing-row"><span>An:</span><strong>' + escapeHtml(formatPeople(option.to)) + '</strong></div>';
      html += '<div class="routing-row"><span>CC:</span><strong>' + escapeHtml(formatPeople(option.cc)) + '</strong></div>';
      html += '<div class="routing-row"><span>BCC:</span><strong>' + escapeHtml(formatPeople(option.bcc)) + '</strong></div>';
      html += '</button>';
    });
    html += '</div>';

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">';
      html += escapeHtml(state.feedback);
      html += '</section>';
      html += '<div class="next-wrap"><button id="next-btn" class="btn" type="button">';
      html += state.roundIndex >= state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechstes Szenario';
      html += '</button></div>';
    }

    el.root.innerHTML = html;

    Array.from(el.root.querySelectorAll('[data-option-id]')).forEach(function (button) {
      button.addEventListener('click', function () {
        evaluate(button.getAttribute('data-option-id'));
      });
    });

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.addEventListener('click', nextRound);
  }

  function formatPeople(value) {
    if (!Array.isArray(value) || value.length === 0) return '-';
    return value.join(', ');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function asStatePayload() {
    const round = currentRound();
    return {
      mode: state.done ? 'result' : 'recipient_routing',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.roundIndex,
      total_rounds: state.cfg && state.cfg.rounds ? state.cfg.rounds.length : 0,
      score: state.score,
      quality_percent: computeRatePercent(),
      answered: state.answered,
      selected_option_id: state.selectedOptionId,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs),
      current_scenario: round
        ? {
            id: round.id,
            scenario: round.scenario,
            correct_option_id: round.correctOptionId
          }
        : null
    };
  }

  window.render_game_to_text = function renderGameToText() {
    return JSON.stringify(asStatePayload());
  };

  window.advanceTime = function advanceTime(ms) {
    const delta = Number(ms);
    if (!Number.isFinite(delta) || delta <= 0) return true;
    tick(delta);
    render();
    return true;
  };
})();
