(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    hits: 0,
    answered: false,
    done: false,
    selectedQuality: null,
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
      const resp = await fetch('data/_gg01_lastenheft_check.json');
      if (!resp.ok) throw new Error('config unavailable');
      state.cfg = await resp.json();
      render();
    } catch (_error) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function itemNow() {
    return state.cfg.items[state.idx] || null;
  }

  function render() {
    updateKpis();

    if (state.done) {
      const total = state.cfg.items.length;
      const perfect = state.hits === total;
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Treffer: <strong>${state.hits}/${total}</strong></p>
        <p>Score: <strong>${state.score}</strong></p>
        <p>${perfect ? 'Perfekt: alle Anforderungen korrekt bewertet.' : 'Gute Basis: unklare Formulierungen weiter schaerfen.'}</p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const item = itemNow();

    el.root.innerHTML = `
      <h2>Anforderung ${state.idx + 1}</h2>
      <div class="req">${escapeHtml(item.text)}</div>

      <div class="actions">
        <button id="btn-clear" class="btn" type="button" ${state.answered ? 'disabled' : ''}>Klar / messbar</button>
        <button id="btn-unclear" class="btn" type="button" ${state.answered ? 'disabled' : ''}>Unklar / nicht messbar</button>
        <button id="next" class="btn primary hidden" type="button">${state.idx === state.cfg.items.length - 1 ? 'Auswertung' : 'Naechste Anforderung'}</button>
      </div>

      <div id="feedback" class="feedback hidden"></div>
    `;

    document.getElementById('btn-clear').addEventListener('click', () => evaluate('clear'));
    document.getElementById('btn-unclear').addEventListener('click', () => evaluate('unclear'));
    document.getElementById('next').addEventListener('click', nextItem);
  }

  function evaluate(choice) {
    if (state.answered) return;
    const item = itemNow();

    state.selectedQuality = choice;
    state.answered = true;
    state.lastCorrect = choice === item.quality;

    if (state.lastCorrect) {
      state.score += 15;
      state.hits += 1;
    } else {
      state.score -= 10;
    }

    if (state.idx === state.cfg.items.length - 1 && state.hits === state.cfg.items.length) {
      state.score += 20;
    }

    const fb = document.getElementById('feedback');
    fb.className = `feedback ${state.lastCorrect ? 'ok' : 'bad'}`;
    fb.textContent = item.reason;
    fb.classList.remove('hidden');

    document.getElementById('next').classList.remove('hidden');
    updateKpis();
  }

  function nextItem() {
    if (!state.answered) return;
    if (state.idx === state.cfg.items.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.idx += 1;
    state.answered = false;
    state.selectedQuality = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.hits = 0;
    state.answered = false;
    state.done = false;
    state.selectedQuality = null;
    state.lastCorrect = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg?.items.length || 0;
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
    const item = state.cfg && !state.done ? itemNow() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'quality_check',
      coordinate_system: 'origin top-left, x right, y down',
      item_index: state.idx,
      total_items: state.cfg?.items.length || 0,
      score: state.score,
      hits: state.hits,
      selected_quality: state.selectedQuality,
      answered: state.answered,
      last_correct: state.lastCorrect,
      requirement_text: item?.text || null
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
