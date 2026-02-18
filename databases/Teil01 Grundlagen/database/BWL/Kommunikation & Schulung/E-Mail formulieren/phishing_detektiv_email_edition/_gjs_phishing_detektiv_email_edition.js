(function () {
  'use strict';

  const state = {
    cfg: null,
    mails: [],
    selectedMailId: '',
    score: 0,
    correctCount: 0,
    reviewedCount: 0,
    done: false,
    failed: false,
    feedbackState: '',
    feedback: '',
    remainingMs: 0,
    lastTickAt: 0,
    elapsedMs: 0,
    timerId: 0
  };

  const el = {
    root: document.getElementById('root'),
    reviewed: document.getElementById('kpi-reviewed'),
    score: document.getElementById('kpi-score'),
    rate: document.getElementById('kpi-rate'),
    time: document.getElementById('kpi-time'),
    fill: document.getElementById('time-fill')
  };

  init();

  async function init() {
    try {
      const response = await fetch('_data/_gg01_phishing_detektiv_email_edition.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await response.json();
      state.mails = (state.cfg.mails || []).map(function (mail) {
        return Object.assign({}, mail, { decision: '' });
      });
      state.selectedMailId = nextUndecidedMailId() || '';
      startTimerForSelected();
      render();
    } catch (error) {
      if (el.root) {
        el.root.innerHTML = '<p>Fehler: ' + escapeHtml(error.message) + '</p>';
      }
    }
  }

  function defaultDecisionMs() {
    const fallback = Number(state.cfg && state.cfg.timing && state.cfg.timing.default_round_ms);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 12000;
  }

  function stopTimer() {
    if (!state.timerId) return;
    window.clearInterval(state.timerId);
    state.timerId = 0;
  }

  function startTimerForSelected() {
    stopTimer();

    if (state.done) return;

    const mail = selectedMail();
    if (!mail || mail.decision) {
      state.remainingMs = 0;
      return;
    }

    state.remainingMs = defaultDecisionMs();
    state.lastTickAt = Date.now();

    state.timerId = window.setInterval(function () {
      tick(Date.now() - state.lastTickAt);
      state.lastTickAt = Date.now();
    }, 100);
  }

  function tick(deltaMs) {
    if (state.done) return;

    const mail = selectedMail();
    if (!mail || mail.decision) return;

    const delta = Number(deltaMs);
    if (!Number.isFinite(delta) || delta <= 0) return;

    state.remainingMs = Math.max(0, state.remainingMs - delta);
    state.elapsedMs += delta;

    if (state.remainingMs <= 0) {
      classify('timeout');
      return;
    }

    renderKpis();
  }

  function selectedMail() {
    return state.mails.find(function (mail) {
      return mail.id === state.selectedMailId;
    }) || null;
  }

  function nextUndecidedMailId() {
    const next = state.mails.find(function (mail) {
      return !mail.decision;
    });
    return next ? next.id : '';
  }

  function classify(action) {
    if (state.done) return;

    const mail = selectedMail();
    if (!mail || mail.decision) return;

    const scoring = state.cfg && state.cfg.scoring ? state.cfg.scoring : {};
    const gameOverOnWrong = !!(state.cfg && state.cfg.settings && state.cfg.settings.game_over_on_wrong);
    const expected = mail.isPhishing ? 'spam' : 'ok';

    mail.decision = action;
    state.reviewedCount += 1;

    if (action === 'timeout') {
      state.score += Number(scoring.timeout) || 0;
      state.feedbackState = 'bad';
      state.feedback = 'Zeit abgelaufen. Mail wurde nicht bewertet. Hinweise: ' + (mail.clues || []).join(', ');
    } else if (action === expected) {
      state.score += Number(scoring.correct) || 0;
      state.correctCount += 1;
      state.feedbackState = 'ok';
      state.feedback = 'Korrekt. Hinweise: ' + (mail.clues || []).join(', ');
    } else {
      state.score += Number(scoring.wrong) || 0;
      state.feedbackState = 'bad';
      state.feedback = 'Falsch klassifiziert. Erwartet war "' + (expected === 'spam' ? 'Spam' : 'Legitim') + '".';

      if (gameOverOnWrong) {
        state.failed = true;
        state.done = true;
        stopTimer();
        render();
        return;
      }
    }

    if (state.reviewedCount >= state.mails.length) {
      finishGame();
      return;
    }

    state.selectedMailId = nextUndecidedMailId();
    startTimerForSelected();
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

    state.mails = (state.cfg.mails || []).map(function (mail) {
      return Object.assign({}, mail, { decision: '' });
    });
    state.selectedMailId = nextUndecidedMailId() || '';
    state.score = 0;
    state.correctCount = 0;
    state.reviewedCount = 0;
    state.done = false;
    state.failed = false;
    state.feedbackState = '';
    state.feedback = '';
    state.remainingMs = 0;
    state.lastTickAt = 0;
    state.elapsedMs = 0;

    startTimerForSelected();
    render();
  }

  function selectMail(mailId) {
    if (!mailId) return;

    const exists = state.mails.some(function (mail) {
      return mail.id === mailId;
    });
    if (!exists) return;

    state.selectedMailId = mailId;
    startTimerForSelected();
    render();
  }

  function ratePercent() {
    if (state.reviewedCount <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((state.correctCount / state.reviewedCount) * 100)));
  }

  function renderKpis() {
    const total = state.mails.length;
    const ratio = defaultDecisionMs() > 0 ? Math.max(0, Math.min(1, state.remainingMs / defaultDecisionMs())) : 0;

    if (el.reviewed) el.reviewed.textContent = String(state.reviewedCount) + '/' + String(total);
    if (el.score) el.score.textContent = String(state.score);
    if (el.rate) el.rate.textContent = String(ratePercent()) + '%';
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

  function statusLabel(decision) {
    if (decision === 'spam') return 'Spam';
    if (decision === 'ok') return 'Legitim';
    if (decision === 'timeout') return 'Timeout';
    return 'Offen';
  }

  function render() {
    renderKpis();
    if (!el.root || !state.cfg) return;

    if (state.done) {
      const verdict = state.failed ? 'Sicherheitsvorfall' : 'Posteingang geprueft';

      el.root.innerHTML = [
        '<section class="result">',
        '<h2>' + escapeHtml(verdict) + '</h2>',
        '<p>Score: <strong>' + escapeHtml(String(state.score)) + '</strong></p>',
        '<p>Trefferquote: <strong>' + escapeHtml(String(ratePercent())) + '%</strong></p>',
        '<p>Korrekte Entscheidungen: <strong>' + escapeHtml(String(state.correctCount)) + '</strong> / ' + escapeHtml(String(state.mails.length)) + '</p>',
        '<button id="restart-btn" class="action-btn" type="button">Nochmal spielen</button>',
        '</section>'
      ].join('');

      const restartBtn = document.getElementById('restart-btn');
      if (restartBtn) restartBtn.addEventListener('click', restart);
      return;
    }

    const current = selectedMail();
    if (!current) return;

    let html = '';
    html += '<div class="layout">';

    html += '<aside class="mail-list">';
    html += '<div class="mail-list-head">Posteingang</div>';
    state.mails.forEach(function (mail) {
      const selectedClass = mail.id === state.selectedMailId ? ' selected' : '';
      const decidedClass = mail.decision ? ' decided' : '';
      html += '<button class="mail-row' + selectedClass + decidedClass + '" type="button" data-mail-id="' + escapeHtml(mail.id) + '">';
      html += '<div class="mail-sender">' + escapeHtml(mail.sender) + '</div>';
      html += '<div class="mail-subject">' + escapeHtml(mail.subject) + '</div>';
      html += '<div class="mail-status">' + escapeHtml(statusLabel(mail.decision)) + '</div>';
      html += '</button>';
    });
    html += '</aside>';

    const decisionLocked = !!current.decision;

    html += '<section class="mail-detail">';
    html += '<div class="detail-header">';
    html += '<div><span>Von:</span> ' + escapeHtml(current.sender) + '</div>';
    html += '<div><span>Betreff:</span> ' + escapeHtml(current.subject) + '</div>';
    html += '</div>';
    html += '<p class="detail-preview">' + escapeHtml(current.preview || '') + '</p>';
    html += '<p class="detail-body">' + escapeHtml(current.body || '') + '</p>';

    html += '<div class="actions">';
    html += '<button id="mark-spam-btn" class="action-btn danger" type="button" ' + (decisionLocked ? 'disabled' : '') + '>Als Spam markieren</button>';
    html += '<button id="mark-ok-btn" class="action-btn" type="button" ' + (decisionLocked ? 'disabled' : '') + '>Als legitim behalten</button>';
    html += '</div>';

    if (decisionLocked) {
      html += '<p class="locked-note">Bereits bewertet: <strong>' + escapeHtml(statusLabel(current.decision)) + '</strong></p>';
    }

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">' + escapeHtml(state.feedback) + '</section>';
    }

    html += '</section>';
    html += '</div>';

    el.root.innerHTML = html;

    Array.from(el.root.querySelectorAll('[data-mail-id]')).forEach(function (button) {
      button.addEventListener('click', function () {
        const mailId = button.getAttribute('data-mail-id');
        selectMail(mailId || '');
      });
    });

    const markSpamBtn = document.getElementById('mark-spam-btn');
    const markOkBtn = document.getElementById('mark-ok-btn');

    if (markSpamBtn) markSpamBtn.addEventListener('click', function () { classify('spam'); });
    if (markOkBtn) markOkBtn.addEventListener('click', function () { classify('ok'); });
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
    const mail = selectedMail();
    const progressPercent = state.mails.length > 0 ? Math.round((state.reviewedCount / state.mails.length) * 100) : 0;
    return {
      mode: state.done ? 'result' : 'phishing_inbox',
      measurable: true,
      coordinate_system: 'origin top-left, x right, y down',
      selected_mail_id: state.selectedMailId,
      reviewed_count: state.reviewedCount,
      total_mails: state.mails.length,
      correct_count: state.correctCount,
      score: state.score,
      rate_percent: ratePercent(),
      progress_percent: progressPercent,
      failed: state.failed,
      done: state.done,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs),
      current_mail: mail
        ? {
            id: mail.id,
            sender: mail.sender,
            subject: mail.subject,
            is_phishing: !!mail.isPhishing,
            decision: mail.decision || null
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
