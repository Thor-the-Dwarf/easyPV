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
    timerId: 0,
    highscore: 0,
    madeHighscore: false
  };

  const el = {
    root: document.getElementById('root'),
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    rate: document.getElementById('kpi-rate'),
    time: document.getElementById('kpi-time'),
    highscore: document.getElementById('kpi-highscore'),
    fill: document.getElementById('time-fill')
  };

  init();

  async function init() {
    try {
      const response = await fetch('_data/_gg01_it_vocab_sprint.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await response.json();
      state.highscore = readHighscore();
      restart();
    } catch (error) {
      if (el.root) {
        el.root.innerHTML = '<p>Fehler: ' + escapeHtml(error.message) + '</p>';
      }
    }
  }

  function totalMs() {
    const value = Number(state.cfg && state.cfg.timing && state.cfg.timing.total_ms);
    return Number.isFinite(value) && value > 0 ? value : 120000;
  }

  function tickMs() {
    const value = Number(state.cfg && state.cfg.timing && state.cfg.timing.tick_ms);
    return Number.isFinite(value) && value > 0 ? value : 100;
  }

  function currentRound() {
    if (!state.cfg || !Array.isArray(state.cfg.rounds)) return null;
    return state.cfg.rounds[state.roundIndex] || null;
  }

  function startTimer() {
    stopTimer();
    state.lastTickAt = Date.now();
    state.timerId = window.setInterval(function () {
      const now = Date.now();
      tick(now - state.lastTickAt);
      state.lastTickAt = now;
    }, tickMs());
  }

  function stopTimer() {
    if (!state.timerId) return;
    window.clearInterval(state.timerId);
    state.timerId = 0;
  }

  function tick(deltaMs) {
    if (state.done) return;
    const delta = Number(deltaMs);
    if (!Number.isFinite(delta) || delta <= 0) return;

    state.remainingMs = Math.max(0, state.remainingMs - delta);
    state.elapsedMs += delta;

    if (state.remainingMs <= 0) {
      finishGame(false);
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

    const round = currentRound();
    if (!round) return;

    const selected = String(optionId || '').trim();
    const correctId = String(round.correctOptionId || '').trim();
    const option = (round.options || []).find(function (entry) {
      return String(entry.id || '') === selected;
    });
    const correctOption = (round.options || []).find(function (entry) {
      return String(entry.id || '') === correctId;
    });

    if (!option) return;

    state.answered = true;
    state.selectedOptionId = selected;

    if (selected === correctId) {
      state.correctCount += 1;
      state.score += scoringValue('correct', 10);
      state.feedbackState = 'ok';
      state.feedback = 'Richtig: "' + (correctOption ? correctOption.text : '-') + '".';
    } else {
      state.score += scoringValue('wrong', -4);
      state.feedbackState = 'bad';
      state.feedback = 'Nicht korrekt. Richtig waere: "' + (correctOption ? correctOption.text : '-') + '".';
    }

    render();
  }

  function nextRound() {
    if (state.done || !state.answered || !state.cfg) return;

    if (state.roundIndex >= state.cfg.rounds.length - 1) {
      finishGame(true);
      return;
    }

    state.roundIndex += 1;
    state.answered = false;
    state.selectedOptionId = null;
    state.feedback = '';
    state.feedbackState = '';
    render();
  }

  function finishGame(completedAllRounds) {
    if (state.done) return;

    stopTimer();
    state.done = true;

    if (completedAllRounds) {
      state.score += scoringValue('completion_bonus', 20);
    }

    if (state.score > state.highscore) {
      state.highscore = state.score;
      state.madeHighscore = true;
      writeHighscore(state.highscore);
    }

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
    state.remainingMs = totalMs();
    state.elapsedMs = 0;
    state.lastTickAt = 0;
    state.madeHighscore = false;

    startTimer();
    render();
  }

  function progressPercent() {
    if (!state.cfg || !Array.isArray(state.cfg.rounds) || state.cfg.rounds.length === 0) return 0;
    return Math.round((state.correctCount / state.cfg.rounds.length) * 100);
  }

  function answeredRounds() {
    if (!state.cfg || !Array.isArray(state.cfg.rounds) || state.cfg.rounds.length === 0) return 0;
    const inCurrent = state.answered ? 1 : 0;
    return Math.min(state.cfg.rounds.length, state.roundIndex + inCurrent);
  }

  function renderKpis() {
    const total = state.cfg && Array.isArray(state.cfg.rounds) ? state.cfg.rounds.length : 0;
    const shownRound = state.done ? total : Math.min(total, state.roundIndex + 1);
    const ratio = totalMs() > 0 ? Math.max(0, Math.min(1, state.remainingMs / totalMs())) : 0;

    if (el.round) el.round.textContent = String(shownRound) + '/' + String(total);
    if (el.score) el.score.textContent = String(state.score);
    if (el.rate) el.rate.textContent = String(progressPercent()) + '%';
    if (el.time) el.time.textContent = (state.remainingMs / 1000).toFixed(1) + 's';
    if (el.highscore) el.highscore.textContent = String(state.highscore);

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
      const rounds = Array.isArray(state.cfg.rounds) ? state.cfg.rounds.length : 0;
      const solved = answeredRounds();
      const status = state.remainingMs <= 0 ? 'Zeit ist abgelaufen.' : 'Alle Begriffe bearbeitet.';
      const highscoreHint = state.madeHighscore
        ? '<p><strong>Neuer Highscore!</strong></p>'
        : '<p>Bester Wert: <strong>' + escapeHtml(String(state.highscore)) + '</strong></p>';

      el.root.innerHTML = [
        '<section class="result">',
        '<h2>Sprint beendet</h2>',
        '<p>' + escapeHtml(status) + '</p>',
        '<p>Score: <strong>' + escapeHtml(String(state.score)) + '</strong></p>',
        '<p>Korrekt: <strong>' + escapeHtml(String(state.correctCount)) + '/' + escapeHtml(String(rounds)) + '</strong></p>',
        '<p>Bearbeitet: <strong>' + escapeHtml(String(solved)) + '/' + escapeHtml(String(rounds)) + '</strong></p>',
        highscoreHint,
        '<div class="restart-wrap"><button id="restart-btn" class="btn" type="button">Nochmal starten</button></div>',
        '</section>'
      ].join('');

      const restartBtn = document.getElementById('restart-btn');
      if (restartBtn) restartBtn.addEventListener('click', restart);
      return;
    }

    const round = currentRound();
    if (!round) {
      finishGame(true);
      return;
    }

    let html = '';
    html += '<section class="term-zone">';
    html += '<div class="term-label">Begriff in Bewegung</div>';
    html += '<h2 class="term-fly">' + escapeHtml(round.en || '') + '</h2>';
    html += '<p class="term-context">' + escapeHtml(round.context || '') + '</p>';
    html += '</section>';

    html += '<section class="buckets" aria-label="Antwortziele">';
    (round.options || []).forEach(function (option) {
      const chosen = state.selectedOptionId === option.id;
      const isCorrect = chosen && option.id === round.correctOptionId;
      const isWrong = chosen && option.id !== round.correctOptionId;
      const stateClass = isCorrect ? ' correct' : (isWrong ? ' wrong' : '');
      const disabled = state.answered ? ' disabled' : '';
      html += '<button class="bucket-btn' + stateClass + '" type="button" data-option-id="' + escapeHtml(option.id) + '"' + disabled + '>' + escapeHtml(option.text) + '</button>';
    });
    html += '</section>';

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">' + escapeHtml(state.feedback) + '</section>';
      html += '<div class="next-wrap"><button id="next-btn" class="btn" type="button">';
      html += state.roundIndex >= state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechster Begriff';
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

  function readHighscore() {
    const key = String(state.cfg && state.cfg.storage && state.cfg.storage.highscore_key || 'easy_pv_it_vocab_sprint_highscore');
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  function writeHighscore(value) {
    const key = String(state.cfg && state.cfg.storage && state.cfg.storage.highscore_key || 'easy_pv_it_vocab_sprint_highscore');
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Ignore storage failures in private modes.
    }
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
      mode: state.done ? 'result' : 'it_vocab_sprint',
      measurable: true,
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.roundIndex,
      total_rounds: state.cfg && Array.isArray(state.cfg.rounds) ? state.cfg.rounds.length : 0,
      answered_rounds: answeredRounds(),
      score: state.score,
      progress_percent: progress,
      rate_percent: progress,
      answered: state.answered,
      selected_option_id: state.selectedOptionId,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs),
      highscore: state.highscore,
      current_round: round ? {
        id: round.id,
        en: round.en,
        correct_option_id: round.correctOptionId
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
})();
