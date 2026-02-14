(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    streak: 0,
    answered: false,
    done: false,
    selectedCategory: null,
    lastCorrect: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    streak: document.getElementById('kpi-streak'),
    root: document.getElementById('root')
  };

  init();

  async function init() {
    try {
      const response = await fetch('./_gg01_aktivitaeten_sortierer.json');
      if (!response.ok) throw new Error('config unavailable');
      state.cfg = await response.json();
      render();
    } catch (_error) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function currentRound() {
    return state.cfg.rounds[state.idx] || null;
  }

  function categoryById(id) {
    return state.cfg.categories.find((category) => category.id === id) || null;
  }

  function render() {
    updateKpis();
    if (!state.cfg) return;

    if (state.done) {
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Serie: <strong>${state.streak}</strong></p>
        <ul class="result-list">
          ${state.cfg.categories.map((category) => `<li><strong>${escapeHtml(category.label)}:</strong> ${escapeHtml(category.hint)}</li>`).join('')}
        </ul>
        <div class="actions">
          <button type="button" id="restart-btn" class="btn">Nochmal spielen</button>
        </div>
      `;
      document.getElementById('restart-btn').addEventListener('click', restart);
      return;
    }

    const round = currentRound();
    const scoring = state.cfg.scoring;

    el.root.innerHTML = `
      <h2>${escapeHtml(round.id.toUpperCase())}: Kategorie bestimmen</h2>
      <div class="activity">${escapeHtml(round.activity)}</div>
      <div class="choices">
        ${state.cfg.categories.map((category) => {
          const classes = ['choice'];
          if (state.answered && state.selectedCategory === category.id) {
            classes.push(category.id === round.correct_category ? 'correct' : 'wrong');
          }
          if (state.answered && category.id === round.correct_category) {
            classes.push('correct');
          }
          return `
            <button
              type="button"
              class="${classes.join(' ')}"
              data-category="${escapeHtml(category.id)}"
              ${state.answered ? 'disabled' : ''}>
              <strong>${escapeHtml(category.label)}</strong>
              <small>${escapeHtml(category.hint)}</small>
            </button>
          `;
        }).join('')}
      </div>
      <div id="feedback" class="feedback hidden"></div>
      <div class="actions">
        <button type="button" id="next-btn" class="btn hidden">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button>
      </div>
      <p style="margin-top:.8rem;color:#acc2e0;">
        Punkte: richtig +${scoring.correct}, falsch ${scoring.wrong}, Bonus ab ${scoring.streak_bonus_threshold} Treffern: +${scoring.streak_bonus}
      </p>
    `;

    el.root.querySelectorAll('[data-category]').forEach((button) => {
      button.addEventListener('click', () => answer(button.dataset.category));
    });
    document.getElementById('next-btn').addEventListener('click', nextRound);
  }

  function answer(categoryId) {
    if (state.answered || state.done) return;

    const round = currentRound();
    if (!categoryById(categoryId)) return;

    const scoring = state.cfg.scoring;
    state.selectedCategory = categoryId;
    state.answered = true;
    state.lastCorrect = categoryId === round.correct_category;

    if (state.lastCorrect) {
      state.score += scoring.correct;
      state.streak += 1;
      if (state.streak >= scoring.streak_bonus_threshold) {
        state.score += scoring.streak_bonus;
      }
    } else {
      state.score += scoring.wrong;
      state.streak = 0;
    }

    render();

    const correctCategory = categoryById(round.correct_category);
    const feedback = document.getElementById('feedback');
    feedback.className = `feedback ${state.lastCorrect ? 'ok' : 'bad'}`;
    feedback.innerHTML = state.lastCorrect
      ? `Richtig. ${escapeHtml(round.reason)}`
      : `Nicht optimal. Korrekt ist <strong>${escapeHtml(correctCategory.label)}</strong>. ${escapeHtml(round.reason)}`;
    feedback.classList.remove('hidden');
    document.getElementById('next-btn').classList.remove('hidden');
    updateKpis();
  }

  function nextRound() {
    if (!state.answered) return;

    if (state.idx >= state.cfg.rounds.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.idx += 1;
    state.answered = false;
    state.selectedCategory = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.streak = 0;
    state.answered = false;
    state.done = false;
    state.selectedCategory = null;
    state.lastCorrect = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg?.rounds.length || 0;
    el.round.textContent = `${state.done ? total : state.idx + 1}/${total}`;
    el.score.textContent = String(state.score);
    el.streak.textContent = String(state.streak);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  window.render_game_to_text = function renderGameToText() {
    const round = state.cfg && !state.done ? currentRound() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'activity_classification',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      streak: state.streak,
      answered: state.answered,
      selected_category: state.selectedCategory,
      expected_category: round?.correct_category || null,
      activity: round?.activity || null
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
