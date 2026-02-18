(function () {
  'use strict';

  const state = {
    cfg: null,
    roundIndex: 0,
    score: 0,
    checked: false,
    done: false,
    selections: {},
    focusTermId: '',
    feedbackState: '',
    feedbackSummary: '',
    feedbackItems: [],
    feedbackExample: '',
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
      const response = await fetch('_data/_gg01_tone_of_voice_editor.json');
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
    return 15000;
  }

  function maxScore() {
    if (!state.cfg || !Array.isArray(state.cfg.rounds)) return 0;

    const perTerm = Number(state.cfg.scoring && state.cfg.scoring.correct_term) || 0;
    const fullRoundBonus = Number(state.cfg.scoring && state.cfg.scoring.full_round_bonus) || 0;
    const completionBonus = Number(state.cfg.scoring && state.cfg.scoring.completion_bonus) || 0;

    let total = 0;
    state.cfg.rounds.forEach(function (round) {
      const terms = Array.isArray(round.terms) ? round.terms.length : 0;
      total += terms * perTerm + fullRoundBonus;
    });

    return total + completionBonus;
  }

  function startRound() {
    const round = currentRound();
    if (!round) {
      finishGame();
      return;
    }

    state.checked = false;
    state.selections = {};
    state.focusTermId = '';
    state.feedbackState = '';
    state.feedbackSummary = '';
    state.feedbackItems = [];
    state.feedbackExample = '';
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
    if (state.done || state.checked) return;

    const delta = Number(deltaMs);
    if (!Number.isFinite(delta) || delta <= 0) return;

    state.remainingMs = Math.max(0, state.remainingMs - delta);
    state.elapsedMs += delta;

    if (state.remainingMs <= 0) {
      evaluateTimeout();
      return;
    }

    renderKpis();
  }

  function allTermsSelected(round) {
    if (!round || !Array.isArray(round.terms) || round.terms.length === 0) return false;

    return round.terms.every(function (term) {
      return typeof state.selections[term.id] === 'string' && state.selections[term.id].length > 0;
    });
  }

  function evaluateTimeout() {
    if (state.done || state.checked) return;

    const round = currentRound();
    if (!round) return;

    stopTimer();
    state.checked = true;
    state.feedbackState = 'bad';
    state.feedbackSummary = 'Zeit abgelaufen. Die professionellen Ersatzbegriffe werden angezeigt.';
    state.feedbackItems = (round.terms || []).map(function (term) {
      const best = (term.options || []).find(function (opt) {
        return opt.id === term.bestChoiceId;
      });
      return '"' + term.word + '" -> ' + (best ? best.text : '-');
    });
    state.feedbackExample = round.goodExample || '';
    render();
  }

  function evaluateSelection() {
    if (state.done || state.checked) return;

    const round = currentRound();
    if (!round || !allTermsSelected(round)) return;

    stopTimer();
    state.checked = true;

    const scoring = state.cfg && state.cfg.scoring ? state.cfg.scoring : {};
    const correctTermPoints = Number(scoring.correct_term) || 0;
    const fullRoundBonus = Number(scoring.full_round_bonus) || 0;

    let correctTerms = 0;
    const feedbackItems = [];

    round.terms.forEach(function (term) {
      const selectedId = state.selections[term.id];
      const selectedOption = (term.options || []).find(function (opt) {
        return opt.id === selectedId;
      });
      const bestOption = (term.options || []).find(function (opt) {
        return opt.id === term.bestChoiceId;
      });

      if (selectedId === term.bestChoiceId) {
        correctTerms += 1;
        feedbackItems.push('OK: "' + term.word + '" -> "' + (selectedOption ? selectedOption.text : '-') + '"');
      } else {
        feedbackItems.push('Besser: "' + term.word + '" -> "' + (bestOption ? bestOption.text : '-') + '"');
      }
    });

    const allCorrect = correctTerms === round.terms.length;
    const roundPoints = correctTerms * correctTermPoints + (allCorrect ? fullRoundBonus : 0);

    state.score += roundPoints;
    state.feedbackState = allCorrect ? 'ok' : 'bad';
    state.feedbackSummary = 'Runde: ' + correctTerms + '/' + round.terms.length + ' Begriffe professionell ersetzt.';
    state.feedbackItems = feedbackItems;
    state.feedbackExample = round.goodExample || '';

    render();
  }

  function nextRound() {
    if (!state.checked || state.done || !state.cfg) return;

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
    state.checked = false;
    state.done = false;
    state.selections = {};
    state.focusTermId = '';
    state.feedbackState = '';
    state.feedbackSummary = '';
    state.feedbackItems = [];
    state.feedbackExample = '';
    state.remainingMs = 0;
    state.lastTickAt = 0;
    state.elapsedMs = 0;

    startRound();
    render();
  }

  function businessPercent() {
    const max = maxScore();
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((state.score / max) * 100)));
  }

  function renderKpis() {
    const total = state.cfg && state.cfg.rounds ? state.cfg.rounds.length : 0;
    const shownRound = state.done ? total : state.roundIndex + 1;
    const round = currentRound();
    const limitMs = getRoundLimitMs(round);
    const ratio = limitMs > 0 ? Math.max(0, Math.min(1, state.remainingMs / limitMs)) : 0;

    if (el.round) el.round.textContent = String(shownRound) + '/' + String(total);
    if (el.score) el.score.textContent = String(state.score);
    if (el.rate) el.rate.textContent = String(businessPercent()) + '%';
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

  function renderHighlightedText(round) {
    let rendered = escapeHtml(round.badText || '');

    (round.terms || []).forEach(function (term) {
      const pattern = new RegExp(escapeRegExp(term.word), 'i');
      rendered = rendered.replace(pattern, function (match) {
        return '<button class="word-chip" type="button" data-focus-term="' + escapeHtml(term.id) + '">' + escapeHtml(match) + '</button>';
      });
    });

    return rendered;
  }

  function render() {
    renderKpis();
    if (!state.cfg || !el.root) return;

    if (state.done) {
      const max = maxScore();
      el.root.innerHTML = [
        '<section class="result">',
        '<h2>Editor-Durchlauf abgeschlossen</h2>',
        '<p>Score: <strong>' + escapeHtml(String(state.score)) + '</strong> / ' + escapeHtml(String(max)) + '</p>',
        '<p>Business-Score: <strong>' + escapeHtml(String(businessPercent())) + '%</strong></p>',
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
    html += '<article class="draft">';
    html += '<header class="draft-head"><div class="draft-title">Originaltext</div></header>';
    html += '<div class="draft-body">' + renderHighlightedText(round) + '</div>';
    html += '</article>';

    html += '<section class="editor-table">';
    html += '<div class="editor-head">Aggressive Begriffe professionell ersetzen</div>';

    (round.terms || []).forEach(function (term) {
      const selectedValue = state.selections[term.id] || '';
      const activeClass = state.focusTermId === term.id ? ' active' : '';

      html += '<div class="term-row' + activeClass + '">';
      html += '<div class="term-word">' + escapeHtml(term.word) + '</div>';
      html += '<select class="term-select" data-term-id="' + escapeHtml(term.id) + '" ' + (state.checked ? 'disabled' : '') + '>';
      html += '<option value="">Bitte waehlen</option>';

      (term.options || []).forEach(function (option) {
        const selectedAttr = selectedValue === option.id ? ' selected' : '';
        html += '<option value="' + escapeHtml(option.id) + '"' + selectedAttr + '>' + escapeHtml(option.text) + '</option>';
      });

      html += '</select>';
      html += '</div>';
    });

    html += '</section>';

    const canCheck = allTermsSelected(round);

    html += '<div class="actions">';
    html += '<button id="check-btn" class="btn" type="button" ' + (!canCheck || state.checked ? 'disabled' : '') + '>Text pruefen</button>';
    html += '</div>';

    if (state.feedbackSummary) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">';
      html += '<p class="feedback-summary">' + escapeHtml(state.feedbackSummary) + '</p>';
      if (state.feedbackItems.length > 0) {
        html += '<ul class="feedback-list">';
        state.feedbackItems.forEach(function (item) {
          html += '<li>' + escapeHtml(item) + '</li>';
        });
        html += '</ul>';
      }
      if (state.feedbackExample) {
        html += '<p class="good-example"><strong>Business-Variante:</strong> ' + escapeHtml(state.feedbackExample) + '</p>';
      }
      html += '</section>';
      html += '<div class="next-wrap"><button id="next-btn" class="btn" type="button">';
      html += state.roundIndex >= state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechster Satz';
      html += '</button></div>';
    }

    el.root.innerHTML = html;

    Array.from(el.root.querySelectorAll('[data-focus-term]')).forEach(function (button) {
      button.addEventListener('click', function () {
        const termId = button.getAttribute('data-focus-term');
        state.focusTermId = termId || '';
        render();
        const select = el.root.querySelector('select[data-term-id="' + CSS.escape(state.focusTermId) + '"]');
        if (select) select.focus();
      });
    });

    Array.from(el.root.querySelectorAll('[data-term-id]')).forEach(function (select) {
      select.addEventListener('change', function () {
        const termId = select.getAttribute('data-term-id');
        if (!termId) return;
        state.selections[termId] = select.value || '';
        state.focusTermId = termId;
        render();
      });
    });

    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
      checkBtn.addEventListener('click', evaluateSelection);
    }

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', nextRound);
    }
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      mode: state.done ? 'result' : 'tone_of_voice_editor',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.roundIndex,
      total_rounds: state.cfg && state.cfg.rounds ? state.cfg.rounds.length : 0,
      score: state.score,
      business_percent: businessPercent(),
      checked: state.checked,
      selected_terms: state.selections,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs),
      current_round: round
        ? {
            id: round.id,
            bad_text: round.badText,
            term_ids: (round.terms || []).map(function (term) { return term.id; })
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
