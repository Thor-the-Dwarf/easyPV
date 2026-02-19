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
      const response = await fetch('_data/_gg01_email_translate_race.json');
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

  function roundLimitMs(round) {
    const perRound = Number(round && round.roundMs);
    if (Number.isFinite(perRound) && perRound > 0) return perRound;
    const fallback = Number(state.cfg && state.cfg.timing && state.cfg.timing.default_round_ms);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 10000;
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
    state.remainingMs = roundLimitMs(round);
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
    if (!round) return;

    const scoring = state.cfg && state.cfg.scoring ? state.cfg.scoring : {};
    const selected = String(optionId || '').trim();
    const correctId = String(round.correctOptionId || '').trim();

    const option = (round.options || []).find(function (entry) {
      return String(entry.id || '') === selected;
    });
    const correctOption = (round.options || []).find(function (entry) {
      return String(entry.id || '') === correctId;
    });

    if (selected !== 'timeout' && !option) return;

    state.answered = true;
    state.selectedOptionId = selected;
    stopTimer();

    if (selected === 'timeout') {
      state.score += Number(scoring.timeout) || 0;
      state.feedbackState = 'bad';
      state.feedback = 'Zeit abgelaufen. Korrekt waere: ' + (correctOption ? correctOption.text : '-');
    } else if (selected === correctId) {
      state.score += Number(scoring.correct) || 0;
      state.correctCount += 1;
      state.feedbackState = 'ok';
      state.feedback = option && option.reason ? option.reason : 'Korrekte Uebersetzung.';
    } else {
      state.score += Number(scoring.wrong) || 0;
      state.feedbackState = 'bad';
      state.feedback = (option && option.reason ? option.reason + ' ' : '') + 'Korrekt waere: ' + (correctOption ? correctOption.text : '-');
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

    startRound();
    render();
  }

  function progressPercent() {
    if (!state.cfg || !Array.isArray(state.cfg.rounds) || state.cfg.rounds.length === 0) return 0;
    return Math.round((state.correctCount / state.cfg.rounds.length) * 100);
  }

  function renderKpis() {
    const total = state.cfg && state.cfg.rounds ? state.cfg.rounds.length : 0;
    const shownRound = state.done ? total : state.roundIndex + 1;
    const round = currentRound();
    const ratio = roundLimitMs(round) > 0 ? Math.max(0, Math.min(1, state.remainingMs / roundLimitMs(round))) : 0;

    if (el.round) el.round.textContent = String(shownRound) + '/' + String(total);
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
        '<h2>Translate-Race abgeschlossen</h2>',
        '<p>Score: <strong>' + escapeHtml(String(state.score)) + '</strong></p>',
        '<p>Trefferquote: <strong>' + escapeHtml(String(progressPercent())) + '%</strong></p>',
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
    html += '<article class="prompt-card">';
    html += '<div class="prompt-label">Deutsch</div>';
    html += '<h2 class="prompt-text">' + escapeHtml(round.de || '') + '</h2>';
    html += '<p class="prompt-context">' + escapeHtml(round.context || '') + '</p>';
    html += '</article>';

    html += '<div class="options">';
    (round.options || []).forEach(function (option) {
      const disabled = state.answered ? ' disabled' : '';
      const chosenClass = state.selectedOptionId === option.id ? ' chosen' : '';
      html += '<button class="option-btn' + chosenClass + '" type="button" data-option-id="' + escapeHtml(option.id) + '"' + disabled + '>' + escapeHtml(option.text) + '</button>';
    });
    html += '</div>';

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">' + escapeHtml(state.feedback) + '</section>';
      html += '<div class="next-wrap"><button id="next-btn" class="btn" type="button">' + (state.roundIndex >= state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Phrase') + '</button></div>';
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
    const progress = progressPercent();
    return {
      mode: state.done ? 'result' : 'email_translate_race',
      measurable: true,
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.roundIndex,
      total_rounds: state.cfg && state.cfg.rounds ? state.cfg.rounds.length : 0,
      score: state.score,
      progress_percent: progress,
      rate_percent: progress,
      answered: state.answered,
      selected_option_id: state.selectedOptionId,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs),
      current_round: round
        ? {
            id: round.id,
            de: round.de,
            correct_option_id: round.correctOptionId
          }
        : null
    };
  }

  const __baseRenderToText = function renderGameToTextBase() {
    return JSON.stringify(asStatePayload());
  };
  let __simulatedMs = 0;

  window.render_game_to_text = function renderGameToText() {
    const raw = __baseRenderToText();
    try {
      const payload = JSON.parse(raw);
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        payload.simulated_ms = __simulatedMs;
      }
      return JSON.stringify(payload);
    } catch (err) {
      return raw;
    }
  };

  window.advanceTime = function advanceTime(ms) {
    const delta = Number(ms);
    if (!Number.isFinite(delta) || delta <= 0) return true;
    __simulatedMs += delta;
    tick(delta);
    render();
    return true;
  };
})();
