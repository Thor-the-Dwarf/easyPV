(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    hits: 0,
    answered: false,
    done: false,
    selectedPhaseId: null,
    lastCorrect: false
  };

  const el = {
    progress: document.getElementById('kpi-progress'),
    score: document.getElementById('kpi-score'),
    hits: document.getElementById('kpi-hits'),
    root: document.getElementById('root')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('./_g01_drei_phasen_modell.json');
      if (!resp.ok) throw new Error('config unavailable');
      state.cfg = await resp.json();
      render();
    } catch (_error) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function currentCard() {
    return state.cfg.cards[state.idx] || null;
  }

  function render() {
    updateKpis();

    if (state.done) {
      const total = state.cfg.cards.length;
      const perfect = state.hits === total;
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Treffer: <strong>${state.hits}/${total}</strong></p>
        <p>Score: <strong>${state.score}</strong></p>
        <p>${perfect ? 'Perfekte Zuordnung. Stark.' : 'Gut, jetzt die Erklaerungen wiederholen und erneut versuchen.'}</p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const card = currentCard();

    el.root.innerHTML = `
      <section class="task">
        <h2>Massnahme ${state.idx + 1}</h2>
        <p>${escapeHtml(card.text)}</p>
      </section>

      <div class="phase-grid">
        ${state.cfg.phases.map((phase) => {
          const classes = ['phase-btn'];
          if (state.answered && state.selectedPhaseId === phase.id) classes.push(state.lastCorrect ? 'correct' : 'wrong');
          if (state.answered && phase.id === card.correct_phase) classes.push('correct');
          return `<button type="button" class="${classes.join(' ')}" data-phase-id="${escapeHtml(phase.id)}" ${state.answered ? 'disabled' : ''}>${escapeHtml(phase.label)}</button>`;
        }).join('')}
      </div>

      <div id="feedback" class="feedback hidden"></div>
      <div class="actions"><button id="next" class="btn hidden" type="button">${state.idx === state.cfg.cards.length - 1 ? 'Auswertung' : 'Naechste Karte'}</button></div>
    `;

    el.root.querySelectorAll('[data-phase-id]').forEach((btn) => {
      btn.addEventListener('click', () => answer(btn.dataset.phaseId));
    });

    document.getElementById('next').addEventListener('click', nextCard);
  }

  function answer(phaseId) {
    if (state.answered) return;
    const card = currentCard();
    state.answered = true;
    state.selectedPhaseId = phaseId;
    state.lastCorrect = phaseId === card.correct_phase;

    if (state.lastCorrect) {
      state.score += 20;
      state.hits += 1;
    } else {
      state.score -= 10;
    }

    if (state.idx === state.cfg.cards.length - 1 && state.hits === state.cfg.cards.length) {
      state.score += 20;
    }

    render();

    const fb = document.getElementById('feedback');
    fb.className = `feedback ${state.lastCorrect ? 'ok' : 'bad'}`;
    fb.textContent = card.explanation;
    fb.classList.remove('hidden');
    document.getElementById('next').classList.remove('hidden');

    updateKpis();
  }

  function nextCard() {
    if (!state.answered) return;
    if (state.idx === state.cfg.cards.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.idx += 1;
    state.answered = false;
    state.selectedPhaseId = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.hits = 0;
    state.answered = false;
    state.done = false;
    state.selectedPhaseId = null;
    state.lastCorrect = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg?.cards.length || 0;
    el.progress.textContent = `${state.done ? total : state.idx + 1}/${total}`;
    el.score.textContent = String(state.score);
    el.hits.textContent = String(state.hits);
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
    const card = state.cfg && !state.done ? currentCard() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'phase_assignment',
      coordinate_system: 'origin top-left, x right, y down',
      card_index: state.idx,
      total_cards: state.cfg?.cards.length || 0,
      score: state.score,
      hits: state.hits,
      answered: state.answered,
      selected_phase_id: state.selectedPhaseId,
      expected_phase_id: card?.correct_phase || null,
      last_correct: state.lastCorrect
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
