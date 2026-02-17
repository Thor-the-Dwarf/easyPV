(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    streak: 0,
    answered: false,
    done: false,
    selectedOption: null,
    lastCorrect: false,
    optionScores: []
  };

  const el = {
    round: document.getElementById('det-kpi-round'),
    score: document.getElementById('det-kpi-score'),
    streak: document.getElementById('det-kpi-streak'),
    root: document.getElementById('det-root')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('_data/_gg01_entscheidungs_detektiv.json');
      if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await resp.json();
      render();
    } catch (_error) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function currentRound() {
    return state.cfg.rounds[state.idx] || null;
  }

  function render() {
    updateKpis();
    if (!state.cfg) return;

    if (state.done) {
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Serie: <strong>${state.streak}</strong></p>
        <ul class="det-result-list">
          <li>Nutzwertanalyse macht Entscheidungen nachvollziehbar.</li>
          <li>Gewichtungen bestimmen den Sieger, nicht Bauchgefuehl.</li>
          <li>Wichtig ist der Rechenweg je Kriterium und Option.</li>
        </ul>
        <button type="button" class="det-btn det-btn--primary" id="det-restart">Nochmal spielen</button>
      `;
      document.getElementById('det-restart').addEventListener('click', restart);
      return;
    }

    const round = currentRound();
    const scoring = state.cfg.scoring;

    el.root.innerHTML = `
      <h2>${escapeHtml(round.id.toUpperCase())}: Welche Option gewinnt rechnerisch?</h2>
      <p class="det-scenario">${escapeHtml(round.scenario)}</p>
      <div class="det-weights">
        ${round.criteria.map((criterion) => `
          <div class="det-weight">
            <span>${escapeHtml(criterion.label)}</span>
            <strong>${criterion.weight}%</strong>
          </div>
        `).join('')}
      </div>
      <div class="det-options">
        ${round.options.map((option) => {
          const classes = ['det-option'];
          if (state.answered && state.selectedOption === option.id) {
            classes.push(option.id === round.correct_option ? 'correct' : 'wrong');
          }
          if (state.answered && option.id === round.correct_option) {
            classes.push('correct');
          }
          return `
            <button type="button" class="${classes.join(' ')}" data-opt="${escapeHtml(option.id)}" ${state.answered ? 'disabled' : ''}>
              <strong>${escapeHtml(option.label)}</strong>
              <span>${round.criteria.map((criterion) => `${escapeHtml(criterion.label)} ${option.scores[criterion.id]}`).join(' | ')}</span>
            </button>
          `;
        }).join('')}
      </div>
      <div id="det-feedback" class="det-feedback hidden"></div>
      <div id="det-breakdown" class="det-breakdown hidden"></div>
      <div class="det-actions">
        <button type="button" id="det-next" class="det-btn hidden">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechster Fall'}</button>
      </div>
      <p class="det-scoring">Punkte: richtig +${scoring.correct}, falsch ${scoring.wrong}, Bonus ab ${scoring.streak_bonus_threshold} Treffern: +${scoring.streak_bonus}</p>
    `;

    el.root.querySelectorAll('[data-opt]').forEach((button) => {
      button.addEventListener('click', () => answer(button.dataset.opt));
    });
    document.getElementById('det-next').addEventListener('click', nextRound);
  }

  function answer(optionId) {
    if (state.answered || state.done) return;
    const round = currentRound();
    const exists = round.options.some((option) => option.id === optionId);
    if (!exists) return;

    state.optionScores = computeScores(round);
    state.selectedOption = optionId;
    state.answered = true;
    state.lastCorrect = optionId === round.correct_option;

    if (state.lastCorrect) {
      state.score += state.cfg.scoring.correct;
      state.streak += 1;
      if (state.streak >= state.cfg.scoring.streak_bonus_threshold) {
        state.score += state.cfg.scoring.streak_bonus;
      }
    } else {
      state.score += state.cfg.scoring.wrong;
      state.streak = 0;
    }

    render();
    showAnswerDetails(round);
    updateKpis();
  }

  function computeScores(round) {
    return round.options
      .map((option) => {
        let sum = 0;
        for (const criterion of round.criteria) {
          sum += (criterion.weight * Number(option.scores[criterion.id])) / 100;
        }
        return { id: option.id, label: option.label, value: Number(sum.toFixed(2)) };
      })
      .sort((a, b) => b.value - a.value);
  }

  function showAnswerDetails(round) {
    const feedback = document.getElementById('det-feedback');
    feedback.className = `det-feedback ${state.lastCorrect ? 'ok' : 'bad'}`;
    feedback.textContent = state.lastCorrect
      ? `Richtig. ${round.reason}`
      : `Nicht korrekt. ${round.reason}`;
    feedback.classList.remove('hidden');

    const breakdown = document.getElementById('det-breakdown');
    breakdown.classList.remove('hidden');
    breakdown.innerHTML = `
      <h3>Gewichtete Nutzwerte</h3>
      <ul>
        ${state.optionScores.map((entry) => `<li><strong>${escapeHtml(entry.label)}:</strong> ${entry.value.toFixed(2)}</li>`).join('')}
      </ul>
    `;

    document.getElementById('det-next').classList.remove('hidden');
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
    state.selectedOption = null;
    state.lastCorrect = false;
    state.optionScores = [];
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.streak = 0;
    state.answered = false;
    state.done = false;
    state.selectedOption = null;
    state.lastCorrect = false;
    state.optionScores = [];
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
      mode: state.done ? 'result' : 'weighted_decision',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      streak: state.streak,
      answered: state.answered,
      selected_option: state.selectedOption,
      expected_option: round?.correct_option || null,
      option_scores: state.optionScores
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
