(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    hits: 0,
    answered: false,
    done: false,
    selectedCategory: null,
    lastCorrect: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    hits: document.getElementById('kpi-hits'),
    root: document.getElementById('root')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('./_g01_priorisierungs_pyramide.json');
      if (!resp.ok) throw new Error('config unavailable');
      state.cfg = await resp.json();
      render();
    } catch (_error) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function cardNow() {
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
        <p>${perfect ? 'Perfekt priorisiert nach Kano.' : 'Gut, wiederhole die Kano-Logik fuer noch bessere Priorisierung.'}</p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const card = cardNow();

    el.root.innerHTML = `
      <h2>Anforderung ${state.idx + 1}</h2>
      <div class="req">${escapeHtml(card.text)}</div>

      <div class="choices">
        ${state.cfg.categories.map((c) => `
          <button type="button" class="choice" data-id="${escapeHtml(c.id)}" ${state.answered ? 'disabled' : ''}>${escapeHtml(c.label)}</button>
        `).join('')}
      </div>

      <div id="feedback" class="feedback hidden"></div>
      <div class="actions"><button id="next" class="btn hidden" type="button">${state.idx === state.cfg.cards.length - 1 ? 'Auswertung' : 'Naechste Anforderung'}</button></div>
    `;

    el.root.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => evaluate(btn.dataset.id));
    });
    document.getElementById('next').addEventListener('click', nextCard);
  }

  function evaluate(categoryId) {
    if (state.answered) return;
    const card = cardNow();

    state.selectedCategory = categoryId;
    state.answered = true;
    state.lastCorrect = categoryId === card.category;

    if (state.lastCorrect) {
      state.score += 20;
      state.hits += 1;
    } else {
      state.score -= 10;
    }

    if (state.idx === state.cfg.cards.length - 1 && state.hits === state.cfg.cards.length) {
      state.score += 20;
    }

    const chosen = el.root.querySelector(`[data-id="${CSS.escape(categoryId)}"]`);
    if (chosen) chosen.classList.add(state.lastCorrect ? 'correct' : 'wrong');
    const target = el.root.querySelector(`[data-id="${CSS.escape(card.category)}"]`);
    if (target) target.classList.add('correct');

    const fb = document.getElementById('feedback');
    fb.className = `feedback ${state.lastCorrect ? 'ok' : 'bad'}`;
    fb.textContent = card.reason;
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
    state.selectedCategory = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.hits = 0;
    state.answered = false;
    state.done = false;
    state.selectedCategory = null;
    state.lastCorrect = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg?.cards.length || 0;
    el.round.textContent = `${state.done ? total : state.idx + 1}/${total}`;
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
    const card = state.cfg && !state.done ? cardNow() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'kano_assignment',
      coordinate_system: 'origin top-left, x right, y down',
      card_index: state.idx,
      total_cards: state.cfg?.cards.length || 0,
      score: state.score,
      hits: state.hits,
      selected_category: state.selectedCategory,
      answered: state.answered,
      last_correct: state.lastCorrect,
      requirement_text: card?.text || null
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
