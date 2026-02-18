(function () {
  'use strict';

  const state = {
    cfg: null,
    roundIndex: 0,
    score: 0,
    answered: false,
    selectedAction: null,
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
    time: document.getElementById('kpi-time'),
    fill: document.getElementById('time-fill')
  };

  init();

  async function init() {
    try {
      const response = await fetch('_data/_gg01_anhang_vergesser_alarm.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await response.json();
      startRound();
      render();
    } catch (error) {
      el.root.innerHTML = '<p>Fehler: ' + escapeHtml(error.message) + '</p>';
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
    return 9000;
  }

  function startRound() {
    const round = currentRound();
    if (!round) {
      finishGame();
      return;
    }

    state.answered = false;
    state.selectedAction = null;
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

  function evaluate(action) {
    if (state.done || state.answered) return;

    const round = currentRound();
    if (!round) return;

    const scoring = state.cfg && state.cfg.scoring ? state.cfg.scoring : {};
    const expected = String(round.expectedAction || '').trim();
    const selected = String(action || '').trim();
    const correct = selected === expected;

    state.answered = true;
    state.selectedAction = selected;
    stopTimer();

    if (selected === 'timeout') {
      state.score += Number(scoring.timeout) || 0;
      state.feedbackState = 'bad';
      state.feedback = 'Zeit abgelaufen. ' + round.reason;
    } else if (correct) {
      state.score += Number(scoring.correct) || 0;
      state.feedbackState = 'ok';
      state.feedback = 'Korrekt entschieden. ' + round.reason;
    } else {
      state.score += Number(scoring.wrong) || 0;
      state.feedbackState = 'bad';
      state.feedback = 'Nicht korrekt. ' + round.reason;
    }

    render();
  }

  function nextRound() {
    if (!state.answered || state.done) return;

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
    const bonus = Number(state.cfg && state.cfg.scoring && state.cfg.scoring.completion_bonus) || 0;
    state.score += bonus;
    render();
  }

  function restart() {
    stopTimer();
    state.roundIndex = 0;
    state.score = 0;
    state.answered = false;
    state.selectedAction = null;
    state.done = false;
    state.feedback = '';
    state.feedbackState = '';
    state.remainingMs = 0;
    state.elapsedMs = 0;
    startRound();
    render();
  }

  function renderKpis() {
    const total = state.cfg && state.cfg.rounds ? state.cfg.rounds.length : 0;
    const shownRound = state.done ? total : state.roundIndex + 1;
    const current = currentRound();
    const limitMs = getRoundLimitMs(current);
    const ratio = limitMs > 0 ? Math.max(0, Math.min(1, state.remainingMs / limitMs)) : 0;

    el.round.textContent = String(shownRound) + '/' + String(total);
    el.score.textContent = String(state.score);
    el.time.textContent = (state.remainingMs / 1000).toFixed(1) + 's';
    el.fill.style.width = Math.round(ratio * 100) + '%';

    if (ratio > 0.5) {
      el.fill.style.background = 'linear-gradient(90deg, #35d08a, #ffb347)';
    } else if (ratio > 0.2) {
      el.fill.style.background = 'linear-gradient(90deg, #ffb347, #ff8f57)';
    } else {
      el.fill.style.background = 'linear-gradient(90deg, #ff8f57, #ff6f7a)';
    }
  }

  function render() {
    renderKpis();

    if (!state.cfg) return;

    if (state.done) {
      const total = state.cfg.rounds.length;
      const maxWithoutPenalty = total * (Number(state.cfg.scoring.correct) || 0);
      const scorePercent = maxWithoutPenalty > 0 ? Math.max(0, Math.round((state.score / maxWithoutPenalty) * 100)) : 0;

      el.root.innerHTML = [
        '<section class="result">',
        '<h2>Durchlauf abgeschlossen</h2>',
        '<p>Score: <strong>' + escapeHtml(String(state.score)) + '</strong></p>',
        '<p>Qualitaetsquote: <strong>' + escapeHtml(String(scorePercent)) + '%</strong></p>',
        '<button id="restart-btn" class="btn" type="button">Nochmal spielen</button>',
        '</section>'
      ].join('');

      const restartBtn = document.getElementById('restart-btn');
      if (restartBtn) restartBtn.addEventListener('click', restart);
      return;
    }

    const round = currentRound();
    if (!round) return;

    const attachmentClass = round.hasAttachment ? 'attachment-badge on' : 'attachment-badge';
    const attachmentText = round.hasAttachment ? 'Anhang vorhanden' : 'Kein Anhang';
    const disabledAttr = state.answered ? ' disabled' : '';

    let html = '';
    html += '<article class="mail">';
    html += '<header class="mail-head">';
    html += '<div class="mail-subject">Betreff: ' + escapeHtml(round.subject) + '</div>';
    html += '<span class="' + attachmentClass + '">' + escapeHtml(attachmentText) + '</span>';
    html += '</header>';
    html += '<p class="mail-body">' + escapeHtml(round.body) + '</p>';
    html += '</article>';

    html += '<div class="actions">';
    html += '<button class="btn" type="button" id="send-btn"' + disabledAttr + '>Senden</button>';
    html += '<button class="btn" type="button" id="block-btn"' + disabledAttr + '>Stopp: Anhang fehlt!</button>';
    html += '</div>';

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">';
      html += escapeHtml(state.feedback);
      html += '</section>';
      html += '<div class="next-wrap"><button id="next-btn" class="btn" type="button">';
      html += state.roundIndex >= state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde';
      html += '</button></div>';
    }

    el.root.innerHTML = html;

    const sendBtn = document.getElementById('send-btn');
    const blockBtn = document.getElementById('block-btn');
    const nextBtn = document.getElementById('next-btn');

    if (sendBtn) sendBtn.addEventListener('click', function () { evaluate('send'); });
    if (blockBtn) blockBtn.addEventListener('click', function () { evaluate('block'); });
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
    return {
      mode: state.done ? 'result' : 'email_attachment_check',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.roundIndex,
      total_rounds: state.cfg && state.cfg.rounds ? state.cfg.rounds.length : 0,
      score: state.score,
      answered: state.answered,
      selected_action: state.selectedAction,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs),
      current_mail: round
        ? {
            id: round.id,
            subject: round.subject,
            has_attachment: !!round.hasAttachment,
            expected_action: round.expectedAction
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
