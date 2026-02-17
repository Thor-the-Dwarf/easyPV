(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    streak: 0,
    answered: false,
    done: false,
    selectedOptionId: null,
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
      const resp = await fetch('_data/_gg01_kommunikations_koffer.json');
      if (!resp.ok) throw new Error('config not reachable');
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

    if (state.done) {
      const total = state.cfg.rounds.length;
      const max = total * 20 + Math.max(0, total - 2) * 10;
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong> / ca. ${max}</p>
        <p>Letzte Serie: <strong>${state.streak}</strong></p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const round = currentRound();

    el.root.innerHTML = `
      <section class="task">
        <h2>Phase: ${escapeHtml(round.phase)}</h2>
        <p>${escapeHtml(round.situation)}</p>
      </section>

      <div class="options">
        ${round.options.map((option) => {
          const classes = ['option'];
          if (state.answered && state.selectedOptionId === option.id) {
            classes.push(option.correct ? 'correct' : 'wrong');
          }
          if (state.answered && option.correct) classes.push('correct');
          return `
            <button type="button" class="${classes.join(' ')}" data-option-id="${escapeHtml(option.id)}" ${state.answered ? 'disabled' : ''}>
              ${escapeHtml(option.text)}
            </button>
          `;
        }).join('')}
      </div>

      <div id="feedback" class="feedback hidden"></div>

      <div class="actions">
        <button id="next" class="btn primary hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button>
      </div>
    `;

    el.root.querySelectorAll('[data-option-id]').forEach((btn) => {
      btn.addEventListener('click', () => choose(btn.dataset.optionId));
    });

    document.getElementById('next').addEventListener('click', nextRound);
  }

  function choose(optionId) {
    if (state.answered) return;
    const round = currentRound();
    const option = round.options.find((o) => o.id === optionId);
    if (!option) return;

    state.selectedOptionId = optionId;
    state.answered = true;
    state.lastCorrect = Boolean(option.correct);

    if (option.correct) {
      state.score += 20;
      state.streak += 1;
      if (state.streak >= 3) state.score += 10;
    } else {
      state.score -= 10;
      state.streak = 0;
    }

    render();

    const fb = document.getElementById('feedback');
    fb.className = `feedback ${option.correct ? 'ok' : 'bad'}`;
    fb.innerHTML = `<strong>${option.correct ? 'Richtig' : 'Nicht optimal'}</strong>${escapeHtml(option.reason)}`;
    fb.classList.remove('hidden');

    document.getElementById('next').classList.remove('hidden');
    updateKpis();
  }

  function nextRound() {
    if (!state.answered) return;
    if (state.idx === state.cfg.rounds.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.idx += 1;
    state.answered = false;
    state.selectedOptionId = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.streak = 0;
    state.answered = false;
    state.done = false;
    state.selectedOptionId = null;
    state.lastCorrect = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg?.rounds.length || 0;
    el.round.textContent = `${state.done ? total : state.idx + 1}/${total}`;
    el.score.textContent = String(state.score);
    el.streak.textContent = String(state.streak);
  }

  function escapeHtml(v) {
    return String(v)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  window.render_game_to_text = function renderGameToText() {
    const round = state.cfg && !state.done ? currentRound() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'communication_choice',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      phase: round?.phase || null,
      score: state.score,
      streak: state.streak,
      answered: state.answered,
      selected_option_id: state.selectedOptionId,
      last_correct: state.lastCorrect
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
