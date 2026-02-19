(function () {
  'use strict';

  const state = {
    cfg: null,
    taskIndex: 0,
    score: 0,
    correctCount: 0,
    assembledIndices: [],
    answered: false,
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
      const response = await fetch('_data/_gg01_sentence_builder_support_ticket.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await response.json();
      restart();
    } catch (error) {
      if (el.root) el.root.innerHTML = '<p>Fehler: ' + escapeHtml(error.message) + '</p>';
    }
  }

  function totalMs() {
    const value = Number(state.cfg && state.cfg.timing && state.cfg.timing.total_ms);
    return Number.isFinite(value) && value > 0 ? value : 150000;
  }

  function currentTask() {
    if (!state.cfg || !Array.isArray(state.cfg.tasks)) return null;
    return state.cfg.tasks[state.taskIndex] || null;
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

  function progressPercent() {
    if (!state.cfg || !Array.isArray(state.cfg.tasks) || state.cfg.tasks.length === 0) return 0;
    return Math.round((state.correctCount / state.cfg.tasks.length) * 100);
  }

  function answeredTasks() {
    if (!state.cfg || !Array.isArray(state.cfg.tasks)) return 0;
    if (state.done) return state.cfg.tasks.length;
    return Math.min(state.cfg.tasks.length, state.taskIndex + (state.answered ? 1 : 0));
  }

  function buildSentenceFrom(indices) {
    const task = currentTask();
    if (!task || !Array.isArray(task.words)) return '';

    const parts = indices.map(function (idx) {
      return String(task.words[idx] || '');
    });

    return parts.join(' ').replace(/\s+([?.!,])/g, '$1').trim();
  }

  function normalizeSentence(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([?.!,])/g, '$1')
      .trim()
      .toLowerCase();
  }

  function addWord(index) {
    if (state.done || state.answered) return;
    if (!Number.isInteger(index) || index < 0) return;
    if (state.assembledIndices.includes(index)) return;
    state.assembledIndices.push(index);
    render();
  }

  function removeWord(position) {
    if (state.done || state.answered) return;
    if (!Number.isInteger(position) || position < 0 || position >= state.assembledIndices.length) return;
    state.assembledIndices.splice(position, 1);
    render();
  }

  function clearSentence() {
    if (state.done || state.answered) return;
    if (state.assembledIndices.length === 0) return;
    state.assembledIndices = [];
    render();
  }

  function evaluateSentence() {
    if (state.done || state.answered) return;

    const task = currentTask();
    if (!task) return;
    if (state.assembledIndices.length === 0) return;

    const built = buildSentenceFrom(state.assembledIndices);
    const normalizedBuilt = normalizeSentence(built);
    const normalizedTarget = normalizeSentence(task.target || '');

    state.answered = true;

    if (normalizedBuilt === normalizedTarget) {
      state.correctCount += 1;
      state.score += scoringValue('correct', 25);
      state.feedbackState = 'ok';
      state.feedback = 'Richtig aufgebaut: ' + built;
    } else {
      state.score += scoringValue('wrong', -10);
      state.feedbackState = 'bad';
      state.feedback = 'Nicht korrekt. Zielsatz: ' + String(task.target || '');
    }

    render();
  }

  function nextTask() {
    if (!state.answered || state.done || !state.cfg) return;

    if (state.taskIndex >= state.cfg.tasks.length - 1) {
      finishGame(true);
      return;
    }

    state.taskIndex += 1;
    state.assembledIndices = [];
    state.answered = false;
    state.feedback = '';
    state.feedbackState = '';
    render();
  }

  function finishGame(completedAllTasks) {
    if (state.done) return;

    stopTimer();
    state.done = true;

    if (completedAllTasks) {
      state.score += scoringValue('completion_bonus', 15);
    }

    render();
  }

  function restart() {
    stopTimer();

    state.taskIndex = 0;
    state.score = 0;
    state.correctCount = 0;
    state.assembledIndices = [];
    state.answered = false;
    state.done = false;
    state.feedback = '';
    state.feedbackState = '';
    state.remainingMs = totalMs();
    state.elapsedMs = 0;
    state.lastTickAt = 0;

    startTimer();
    render();
  }

  function renderKpis() {
    const total = state.cfg && Array.isArray(state.cfg.tasks) ? state.cfg.tasks.length : 0;
    const shownTask = state.done ? total : Math.min(total, state.taskIndex + 1);
    const ratio = totalMs() > 0 ? Math.max(0, Math.min(1, state.remainingMs / totalMs())) : 0;

    if (el.round) el.round.textContent = String(shownTask) + '/' + String(total);
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

  function renderTask() {
    const task = currentTask();
    if (!task) {
      finishGame(true);
      return;
    }

    const chosenSet = new Set(state.assembledIndices);
    const built = buildSentenceFrom(state.assembledIndices);

    let html = '';
    html += '<section class="prompt">';
    html += '<h2>' + escapeHtml(task.de || '') + '</h2>';
    html += '<p>Baue die passende englische Version.</p>';
    html += '</section>';

    html += '<h3 class="section-title">Satz-Leiste (klicken zum Entfernen)</h3>';
    html += '<section class="sentence-zone">';

    if (state.assembledIndices.length === 0) {
      html += '<span class="placeholder">Noch keine Woerter ausgewaehlt.</span>';
    } else {
      state.assembledIndices.forEach(function (wordIndex, position) {
        const text = String(task.words[wordIndex] || '');
        html += '<button class="token-btn assembled" type="button" data-built-pos="' + position + '"' + (state.answered ? ' disabled' : '') + '>';
        html += escapeHtml(text);
        html += '</button>';
      });
    }

    html += '</section>';

    html += '<h3 class="section-title">Wort-Bausteine</h3>';
    html += '<section class="tokens">';

    (task.words || []).forEach(function (word, index) {
      const disabled = chosenSet.has(index) || state.answered;
      html += '<button class="token-btn" type="button" data-word-index="' + index + '"' + (disabled ? ' disabled' : '') + '>';
      html += escapeHtml(String(word));
      html += '</button>';
    });

    html += '</section>';

    html += '<div class="actions">';
    html += '<button id="clear-btn" class="btn" type="button"' + ((state.answered || state.assembledIndices.length === 0) ? ' disabled' : '') + '>Leeren</button>';
    html += '<button id="check-btn" class="btn" type="button"' + ((state.answered || state.assembledIndices.length === 0) ? ' disabled' : '') + '>Pruefen</button>';
    html += '</div>';

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">' + escapeHtml(state.feedback) + '</section>';
      html += '<div class="actions"><button id="next-btn" class="btn" type="button">';
      html += state.taskIndex >= state.cfg.tasks.length - 1 ? 'Auswertung' : 'Naechster Satz';
      html += '</button></div>';
    }

    el.root.innerHTML = html;

    Array.from(el.root.querySelectorAll('[data-word-index]')).forEach(function (button) {
      button.addEventListener('click', function () {
        addWord(Number(button.getAttribute('data-word-index')));
      });
    });

    Array.from(el.root.querySelectorAll('[data-built-pos]')).forEach(function (button) {
      button.addEventListener('click', function () {
        removeWord(Number(button.getAttribute('data-built-pos')));
      });
    });

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', clearSentence);

    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) checkBtn.addEventListener('click', evaluateSentence);

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.addEventListener('click', nextTask);

    void built;
  }

  function renderResult() {
    const total = state.cfg && Array.isArray(state.cfg.tasks) ? state.cfg.tasks.length : 0;
    el.root.innerHTML = [
      '<section class="result">',
      '<h2>Sentence-Builder abgeschlossen</h2>',
      '<p>Score: <strong>' + escapeHtml(String(state.score)) + '</strong></p>',
      '<p>Korrekte Saetze: <strong>' + escapeHtml(String(state.correctCount)) + '/' + escapeHtml(String(total)) + '</strong></p>',
      '<p>Qualitaetsquote: <strong>' + escapeHtml(String(progressPercent())) + '%</strong></p>',
      '<div class="actions"><button id="restart-btn" class="btn" type="button">Nochmal bauen</button></div>',
      '</section>'
    ].join('');

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', restart);
  }

  function render() {
    if (!state.cfg || !el.root) return;
    renderKpis();

    if (state.done) {
      renderResult();
      return;
    }

    renderTask();
  }

  function asStatePayload() {
    const task = currentTask();
    const assembledWords = task && Array.isArray(task.words)
      ? state.assembledIndices.map(function (index) {
        return String(task.words[index] || '');
      })
      : [];
    const assembledSentence = buildSentenceFrom(state.assembledIndices);
    const progress = progressPercent();

    return {
      mode: state.done ? 'result' : 'sentence_builder_support_ticket',
      measurable: true,
      coordinate_system: 'origin top-left, x right, y down',
      task_index: state.taskIndex,
      total_tasks: state.cfg && Array.isArray(state.cfg.tasks) ? state.cfg.tasks.length : 0,
      answered_tasks: answeredTasks(),
      score: state.score,
      progress_percent: progress,
      rate_percent: progress,
      answered: state.answered,
      assembled_words: assembledWords,
      assembled_sentence: assembledSentence,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs),
      current_task: task ? {
        id: task.id,
        target: task.target
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
