(function () {
  'use strict';

  const state = {
    cfg: null,
    phase: 'loading',
    revealedCount: 0,
    transcriptElapsedMs: 0,
    questionIndex: 0,
    score: 0,
    correctCount: 0,
    answered: false,
    selectedOptionId: null,
    feedback: '',
    feedbackState: '',
    remainingMs: 0,
    elapsedMs: 0,
    lastTickAt: 0,
    timerId: 0,
    done: false
  };

  const el = {
    root: document.getElementById('root'),
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    rate: document.getElementById('kpi-rate'),
    time: document.getElementById('kpi-time'),
    fill: document.getElementById('time-fill')
  };

  window.addEventListener('keydown', function (event) {
    if (state.phase !== 'briefing') return;
    if (!state.cfg) return;
    if (state.revealedCount < dialogLines().length) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    startQuiz();
  });

  init();

  async function init() {
    try {
      const response = await fetch('_data/_gg01_listening_comprehension_the_meeting.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await response.json();
      restart();
    } catch (error) {
      if (el.root) el.root.innerHTML = '<p>Fehler: ' + escapeHtml(error.message) + '</p>';
    }
  }

  function questionLimitMs() {
    const value = Number(state.cfg && state.cfg.timing && state.cfg.timing.question_ms);
    return Number.isFinite(value) && value > 0 ? value : 20000;
  }

  function revealIntervalMs() {
    const value = Number(state.cfg && state.cfg.dialog && state.cfg.dialog.reveal_interval_ms);
    return Number.isFinite(value) && value > 0 ? value : 2400;
  }

  function currentQuestion() {
    if (!state.cfg || !Array.isArray(state.cfg.questions)) return null;
    return state.cfg.questions[state.questionIndex] || null;
  }

  function dialogLines() {
    if (!state.cfg || !state.cfg.dialog || !Array.isArray(state.cfg.dialog.lines)) return [];
    return state.cfg.dialog.lines;
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
    if (state.done) return;
    const delta = Number(deltaMs);
    if (!Number.isFinite(delta) || delta <= 0) return;

    state.elapsedMs += delta;

    if (state.phase === 'briefing') {
      state.transcriptElapsedMs += delta;
      const lines = dialogLines();
      const nextCount = Math.min(lines.length, Math.floor(state.transcriptElapsedMs / revealIntervalMs()) + 1);
      if (nextCount !== state.revealedCount) {
        state.revealedCount = nextCount;
        render();
      } else {
        renderKpis();
      }
      return;
    }

    if (state.phase !== 'quiz' || state.answered) {
      renderKpis();
      return;
    }

    state.remainingMs = Math.max(0, state.remainingMs - delta);
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

  function startQuiz() {
    if (!state.cfg || state.phase === 'quiz') return;
    state.phase = 'quiz';
    state.questionIndex = 0;
    state.answered = false;
    state.selectedOptionId = null;
    state.feedback = '';
    state.feedbackState = '';
    state.remainingMs = questionLimitMs();
    render();
  }

  function evaluate(optionId) {
    if (state.phase !== 'quiz' || state.answered || state.done) return;

    const question = currentQuestion();
    if (!question) return;

    const selected = String(optionId || '').trim();
    const correctId = String(question.correctOptionId || '').trim();
    const option = (question.options || []).find(function (entry) {
      return String(entry.id || '') === selected;
    });

    if (selected !== 'timeout' && !option) return;

    state.answered = true;
    state.selectedOptionId = selected;

    if (selected === 'timeout') {
      state.score += scoringValue('timeout', -8);
      state.feedbackState = 'bad';
      state.feedback = 'Zeit abgelaufen. ' + escapeHtml(question.explanation || '');
    } else if (selected === correctId) {
      state.score += scoringValue('correct', 30);
      state.correctCount += 1;
      state.feedbackState = 'ok';
      state.feedback = 'Richtig. ' + escapeHtml(question.explanation || '');
    } else {
      state.score += scoringValue('wrong', -5);
      state.feedbackState = 'bad';
      state.feedback = 'Nicht korrekt. ' + escapeHtml(question.explanation || '');
    }

    render();
  }

  function nextQuestion() {
    if (!state.answered || state.phase !== 'quiz' || state.done) return;

    if (!state.cfg || !Array.isArray(state.cfg.questions) || state.questionIndex >= state.cfg.questions.length - 1) {
      finishGame(true);
      return;
    }

    state.questionIndex += 1;
    state.answered = false;
    state.selectedOptionId = null;
    state.feedback = '';
    state.feedbackState = '';
    state.remainingMs = questionLimitMs();
    render();
  }

  function finishGame(completed) {
    if (state.done) return;
    state.done = true;
    state.phase = 'result';
    if (completed) {
      state.score += scoringValue('completion_bonus', 10);
    }
    stopTimer();
    render();
  }

  function restart() {
    stopTimer();

    state.phase = 'briefing';
    state.revealedCount = 0;
    state.transcriptElapsedMs = 0;
    state.questionIndex = 0;
    state.score = 0;
    state.correctCount = 0;
    state.answered = false;
    state.selectedOptionId = null;
    state.feedback = '';
    state.feedbackState = '';
    state.remainingMs = questionLimitMs();
    state.elapsedMs = 0;
    state.lastTickAt = 0;
    state.done = false;

    startTimer();
    render();
  }

  function progressPercent() {
    if (!state.cfg || !Array.isArray(state.cfg.questions) || state.cfg.questions.length === 0) return 0;
    return Math.round((state.correctCount / state.cfg.questions.length) * 100);
  }

  function answeredQuestions() {
    if (!state.cfg || !Array.isArray(state.cfg.questions)) return 0;
    if (state.phase === 'result') return state.cfg.questions.length;
    if (state.phase !== 'quiz') return 0;
    return Math.min(state.cfg.questions.length, state.questionIndex + (state.answered ? 1 : 0));
  }

  function renderKpis() {
    const totalQuestions = state.cfg && Array.isArray(state.cfg.questions) ? state.cfg.questions.length : 0;
    const shownQuestion = state.phase === 'quiz' ? state.questionIndex + 1 : 0;

    if (el.round) {
      el.round.textContent = state.phase === 'result'
        ? String(totalQuestions) + '/' + String(totalQuestions)
        : String(shownQuestion) + '/' + String(totalQuestions);
    }
    if (el.score) el.score.textContent = String(state.score);
    if (el.rate) el.rate.textContent = String(progressPercent()) + '%';

    if (el.time) {
      if (state.phase === 'quiz') {
        el.time.textContent = (state.remainingMs / 1000).toFixed(1) + 's';
      } else if (state.phase === 'briefing') {
        el.time.textContent = 'Briefing';
      } else {
        el.time.textContent = '0.0s';
      }
    }

    if (el.fill) {
      let ratio = 0;
      if (state.phase === 'briefing') {
        const totalLines = dialogLines().length || 1;
        ratio = Math.max(0, Math.min(1, state.revealedCount / totalLines));
      } else if (state.phase === 'quiz') {
        ratio = Math.max(0, Math.min(1, state.remainingMs / questionLimitMs()));
      }

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

  function renderBriefing() {
    const lines = dialogLines().slice(0, state.revealedCount);
    const doneReading = state.revealedCount >= dialogLines().length;

    let html = '';
    html += '<h2 class="section-title">Meeting-Protokoll</h2>';
    html += '<section class="chat">';

    lines.forEach(function (line) {
      html += '<article class="chat-line">';
      html += '<strong>' + escapeHtml(line.speaker || 'Speaker') + ':</strong> ';
      html += '<span>' + escapeHtml(line.text || '') + '</span>';
      html += '</article>';
    });

    html += '</section>';
    html += '<p class="briefing-note">' + (doneReading
      ? 'Alle Aussagen wurden angezeigt. Starte jetzt die Fragenrunde.'
      : 'Dialog wird geladen ...') + '</p>';
    html += '<div class="actions">';
    html += '<button id="start-quiz-btn" class="btn" type="button"' + (doneReading ? '' : ' disabled') + '>Zu den Fragen</button>';
    html += '</div>';

    el.root.innerHTML = html;

    const startBtn = document.getElementById('start-quiz-btn');
    if (startBtn) startBtn.addEventListener('click', startQuiz);
  }

  function renderQuiz() {
    const question = currentQuestion();
    if (!question) {
      finishGame(true);
      return;
    }

    let html = '';
    html += '<section class="question">';
    html += '<h2>' + escapeHtml(question.question || '') + '</h2>';
    html += '<div class="options">';

    (question.options || []).forEach(function (option) {
      const disabled = state.answered ? ' disabled' : '';
      const chosen = state.selectedOptionId === option.id ? ' chosen' : '';
      html += '<button class="option-btn' + chosen + '" type="button" data-option-id="' + escapeHtml(option.id) + '"' + disabled + '>';
      html += escapeHtml(option.text);
      html += '</button>';
    });

    html += '</div>';
    html += '</section>';

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">' + escapeHtml(state.feedback) + '</section>';
      html += '<div class="actions"><button id="next-btn" class="btn" type="button">';
      html += state.questionIndex >= state.cfg.questions.length - 1 ? 'Auswertung' : 'Naechste Frage';
      html += '</button></div>';
    }

    el.root.innerHTML = html;

    Array.from(el.root.querySelectorAll('[data-option-id]')).forEach(function (button) {
      button.addEventListener('click', function () {
        evaluate(button.getAttribute('data-option-id'));
      });
    });

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
  }

  function renderResult() {
    const total = state.cfg && Array.isArray(state.cfg.questions) ? state.cfg.questions.length : 0;
    el.root.innerHTML = [
      '<section class="result">',
      '<h2>Meeting-Check abgeschlossen</h2>',
      '<p>Score: <strong>' + escapeHtml(String(state.score)) + '</strong></p>',
      '<p>Richtige Antworten: <strong>' + escapeHtml(String(state.correctCount)) + '/' + escapeHtml(String(total)) + '</strong></p>',
      '<p>Verstaendnisquote: <strong>' + escapeHtml(String(progressPercent())) + '%</strong></p>',
      '<div class="actions"><button id="restart-btn" class="btn" type="button">Nochmal hoeren</button></div>',
      '</section>'
    ].join('');

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', restart);
  }

  function render() {
    if (!state.cfg || !el.root) return;
    renderKpis();

    if (state.phase === 'briefing') {
      renderBriefing();
      return;
    }

    if (state.phase === 'quiz') {
      renderQuiz();
      return;
    }

    renderResult();
  }

  function asStatePayload() {
    const question = currentQuestion();
    const progress = progressPercent();
    return {
      mode: state.phase,
      measurable: true,
      coordinate_system: 'origin top-left, x right, y down',
      question_index: state.questionIndex,
      total_questions: state.cfg && Array.isArray(state.cfg.questions) ? state.cfg.questions.length : 0,
      answered_questions: answeredQuestions(),
      revealed_transcript_lines: state.revealedCount,
      total_transcript_lines: dialogLines().length,
      score: state.score,
      progress_percent: progress,
      rate_percent: progress,
      answered: state.answered,
      selected_option_id: state.selectedOptionId,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs),
      current_question: question ? {
        id: question.id,
        correct_option_id: question.correctOptionId
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
