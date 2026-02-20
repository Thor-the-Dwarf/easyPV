(function () {
  'use strict';

  const state = {
    cfg: null,
    roundIndex: 0,
    score: 0,
    correctCount: 0,
    answered: false,
    selectedRating: null,
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
      const response = await fetch('_data/_gg01_body_language_coach.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await response.json();
      startRound();
      render();
    } catch (error) {
      if (el.root) el.root.innerHTML = '<p>Fehler: ' + escapeHtml(error.message) + '</p>';
    }
  }

  function currentPose() {
    if (!state.cfg || !Array.isArray(state.cfg.poses)) return null;
    return state.cfg.poses[state.roundIndex] || null;
  }

  function roundLimitMs() {
    const value = Number(state.cfg && state.cfg.timing && state.cfg.timing.default_round_ms);
    return Number.isFinite(value) && value > 0 ? value : 12000;
  }

  function scoringValue(key, fallback) {
    const value = Number(state.cfg && state.cfg.scoring && state.cfg.scoring[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  function startRound() {
    const pose = currentPose();
    if (!pose) {
      finishGame();
      return;
    }

    state.answered = false;
    state.selectedRating = null;
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

  function evaluate(rating) {
    if (state.done || state.answered) return;

    const pose = currentPose();
    if (!pose) return;

    const selected = String(rating || '').trim();
    const correct = String(pose.rating || '').trim();

    state.answered = true;
    state.selectedRating = selected;
    stopTimer();

    if (selected === 'timeout') {
      state.score += scoringValue('timeout', -8);
      state.feedbackState = 'bad';
      state.feedback = 'Zeit abgelaufen. Bewertung: ' + toRatingLabel(correct) + '. ' + pose.feedback;
    } else if (selected === correct) {
      state.score += scoringValue('correct', 20);
      state.correctCount += 1;
      state.feedbackState = 'ok';
      state.feedback = 'Richtig (' + toRatingLabel(correct) + '). ' + pose.feedback;
    } else {
      state.score += scoringValue('wrong', -5);
      state.feedbackState = 'bad';
      state.feedback = 'Nicht optimal. Korrekt wäre: ' + toRatingLabel(correct) + '. ' + pose.feedback;
    }

    render();
  }

  function nextRound() {
    if (!state.answered || state.done || !state.cfg) return;

    if (state.roundIndex >= state.cfg.poses.length - 1) {
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
    state.selectedRating = null;
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
    if (!state.cfg || !Array.isArray(state.cfg.poses) || state.cfg.poses.length === 0) return 0;
    return Math.round((state.correctCount / state.cfg.poses.length) * 100);
  }

  function renderKpis() {
    const total = state.cfg && state.cfg.poses ? state.cfg.poses.length : 0;
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

  function avatarEmoji(rating) {
    return rating === 'do' ? '🧍‍♂️' : '🙅';
  }

  function toRatingLabel(rating) {
    return rating === 'do' ? 'Do' : "Don't";
  }

  function render() {
    renderKpis();
    if (!state.cfg || !el.root) return;

    if (state.done) {
      el.root.innerHTML = [
        '<section>',
        '<h2>Body-Language-Coach abgeschlossen</h2>',
        '<p>Score: <strong>' + escapeHtml(String(state.score)) + '</strong></p>',
        '<p>Trefferquote: <strong>' + escapeHtml(String(progressPercent())) + '%</strong></p>',
        '<button id="restart-btn" class="next-btn" type="button">Nochmal trainieren</button>',
        '</section>'
      ].join('');
      const restartBtn = document.getElementById('restart-btn');
      if (restartBtn) restartBtn.addEventListener('click', restart);
      return;
    }

    const pose = currentPose();
    if (!pose) return;

    let html = '';
    html += '<section class="pose">';
    html += '<h2>' + escapeHtml(pose.title || '') + '</h2>';
    html += '<p>' + escapeHtml(pose.scene || '') + '</p>';
    html += '<div class="avatar">' + avatarEmoji(pose.rating) + '</div>';
    html += '</section>';

    html += '<div class="actions">';
    html += '<button class="btn btn-do" id="btn-do" type="button"' + (state.answered ? ' disabled' : '') + '>DO</button>';
    html += '<button class="btn btn-dont" id="btn-dont" type="button"' + (state.answered ? ' disabled' : '') + ">DON'T</button>";
    html += '</div>';

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">' + escapeHtml(state.feedback) + '</section>';
      html += '<div class="next-wrap"><button id="next-btn" class="next-btn" type="button">' + (state.roundIndex >= state.cfg.poses.length - 1 ? 'Auswertung' : 'Nächste Pose') + '</button></div>';
    }

    el.root.innerHTML = html;

    const doBtn = document.getElementById('btn-do');
    if (doBtn) doBtn.addEventListener('click', function () { evaluate('do'); });

    const dontBtn = document.getElementById('btn-dont');
    if (dontBtn) dontBtn.addEventListener('click', function () { evaluate('dont'); });

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.addEventListener('click', nextRound);
  }

  function asStatePayload() {
    const pose = currentPose();
    const progress = progressPercent();
    return {
      mode: state.done ? 'result' : 'body_language_coach',
      measurable: true,
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.roundIndex,
      total_rounds: state.cfg && state.cfg.poses ? state.cfg.poses.length : 0,
      score: state.score,
      progress_percent: progress,
      rate_percent: progress,
      answered: state.answered,
      selected_rating: state.selectedRating,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs),
      current_pose: pose ? {
        id: pose.id,
        title: pose.title,
        rating: pose.rating
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
