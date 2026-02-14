(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    hits: 0,
    answered: false,
    selected: new Set(),
    done: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    rate: document.getElementById('kpi-rate'),
    root: document.getElementById('check-root')
  };

  init();

  async function init() {
    const resp = await fetch('./_g01_angebots_checkliste.json');
    if (!resp.ok) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    render();
  }

  function currentRound() {
    return state.cfg.rounds[state.idx] || null;
  }

  function render() {
    updateKpis();

    if (state.done) {
      renderResult();
      return;
    }

    const round = currentRound();
    const fields = state.cfg.fields;

    el.root.innerHTML = `
      <section class="task">
        <h2>${escapeHtml(round.scenario)}</h2>
        <p>Markiere alle formalen Pflichtangaben fuer dieses Angebot.</p>
      </section>

      <div class="answer">
        <div id="field-grid" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:.6rem; margin: .8rem 0 1rem;">
          ${fields.map((f) => {
            const active = state.selected.has(f.id) ? 'active' : '';
            const disabled = state.answered ? 'disabled' : '';
            return `<button type="button" class="check-btn ${active}" data-id="${escapeAttr(f.id)}" ${disabled}>${escapeHtml(f.label)}</button>`;
          }).join('')}
        </div>

        <button id="evaluate-btn" class="next-btn" type="button" ${state.answered ? 'disabled' : ''}>Pruefen</button>
        <div id="feedback" class="feedback hidden"></div>
        <button id="next-btn" class="next-btn hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button>
      </div>
    `;

    const grid = document.getElementById('field-grid');
    grid.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => toggleField(btn.dataset.id));
    });

    document.getElementById('evaluate-btn').addEventListener('click', evaluate);
    document.getElementById('next-btn').addEventListener('click', nextRound);
  }

  function toggleField(id) {
    if (state.answered) return;
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    render();
  }

  function evaluate() {
    if (state.answered) return;

    const round = currentRound();
    const required = new Set(round.required);

    let delta = 0;
    let correctInRound = 0;

    for (const id of state.selected) {
      if (required.has(id)) {
        delta += 20;
        correctInRound += 1;
      } else {
        delta -= 10;
      }
    }

    const missing = [...required].filter((id) => !state.selected.has(id));
    state.score += delta;
    if (missing.length === 0 && correctInRound === required.size) state.hits += 1;

    state.answered = true;

    const feedback = document.getElementById('feedback');
    const next = document.getElementById('next-btn');
    feedback.classList.remove('hidden');

    if (missing.length === 0) {
      feedback.className = 'feedback ok';
      feedback.innerHTML = `<strong>Vollstaendig.</strong> ${escapeHtml(round.feedback)}`;
    } else {
      const labels = state.cfg.fields
        .filter((f) => missing.includes(f.id))
        .map((f) => f.label)
        .join(', ');
      feedback.className = 'feedback bad';
      feedback.innerHTML = `<strong>Unvollstaendig.</strong> Es fehlen: ${escapeHtml(labels)}. ${escapeHtml(round.feedback)}`;
    }

    next.classList.remove('hidden');
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
    state.selected.clear();
    render();
  }

  function renderResult() {
    const total = state.cfg.rounds.length;
    const rate = total ? Math.round((state.hits / total) * 100) : 0;

    el.root.innerHTML = `
      <section class="result">
        <h2>Angebots-Review abgeschlossen</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Vollstaendige Runden: <strong>${state.hits}/${total}</strong> (${rate}%)</p>
        <p>Merksatz: Formale Luecken erzeugen rechtliche und kaufmaennische Risiken.</p>
        <button id="restart-btn" class="restart-btn" type="button">Nochmal pruefen</button>
      </section>
    `;

    document.getElementById('restart-btn').addEventListener('click', restart);
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.hits = 0;
    state.selected.clear();
    state.answered = false;
    state.done = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg ? state.cfg.rounds.length : 0;
    const current = state.done ? total : state.idx + 1;
    const rate = total ? Math.round((state.hits / total) * 100) : 0;

    el.round.textContent = `${current}/${total}`;
    el.score.textContent = String(state.score);
    el.rate.textContent = `${rate}%`;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  window.render_game_to_text = function renderGameToText() {
    const total = state.cfg ? state.cfg.rounds.length : 0;
    const round = state.cfg && !state.done ? currentRound() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'checklist',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: total,
      score: state.score,
      hits: state.hits,
      answered: state.answered,
      selected_count: state.selected.size,
      scenario: round ? round.scenario : null
    });
  };

  window.advanceTime = function advanceTime() { return true; };
})();
