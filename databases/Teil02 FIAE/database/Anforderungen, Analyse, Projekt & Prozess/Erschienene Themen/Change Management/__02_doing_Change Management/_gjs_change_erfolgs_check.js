(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    hits: 0,
    answered: false,
    done: false,
    selected: new Set()
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
      const resp = await fetch('./_g01_change_erfolgs_check.json');
      if (!resp.ok) throw new Error('config unavailable');
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
      const totalHits = (state.cfg.rounds.length * 2);
      const rate = Math.round((state.hits / totalHits) * 100);
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Richtige KPI-Treffer: <strong>${state.hits}</strong> / ${totalHits} (${rate}%)</p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const round = currentRound();

    el.root.innerHTML = `
      <section class="task">
        <h2>Szenario</h2>
        <p>${escapeHtml(round.prompt)}</p>
      </section>

      <div class="grid">
        ${round.kpis.map((kpi) => {
          const classes = ['kpi-card'];
          if (state.selected.has(kpi.id)) classes.push('active');
          return `<button type="button" class="${classes.join(' ')}" data-kpi-id="${escapeHtml(kpi.id)}" ${state.answered ? 'disabled' : ''}>${escapeHtml(kpi.text)}</button>`;
        }).join('')}
      </div>

      <div class="actions">
        <button id="check" class="btn primary" type="button" ${state.answered ? 'disabled' : ''}>Pruefen</button>
        <button id="next" class="btn hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button>
      </div>

      <div id="feedback" class="feedback hidden"></div>
    `;

    el.root.querySelectorAll('[data-kpi-id]').forEach((btn) => {
      btn.addEventListener('click', () => toggleKpi(btn.dataset.kpiId));
    });

    document.getElementById('check').addEventListener('click', evaluate);
    document.getElementById('next').addEventListener('click', nextRound);
  }

  function toggleKpi(kpiId) {
    if (state.answered) return;
    if (state.selected.has(kpiId)) {
      state.selected.delete(kpiId);
    } else {
      if (state.selected.size >= 2) return;
      state.selected.add(kpiId);
    }
    render();
  }

  function evaluate() {
    if (state.answered) return;
    const round = currentRound();
    const fb = document.getElementById('feedback');

    if (state.selected.size !== 2) {
      fb.className = 'feedback bad';
      fb.textContent = 'Bitte genau zwei KPIs auswaehlen.';
      fb.classList.remove('hidden');
      return;
    }

    let correct = 0;
    for (const id of state.selected) {
      const hit = round.kpis.find((kpi) => kpi.id === id && kpi.correct);
      if (hit) correct += 1;
    }

    const wrong = 2 - correct;
    state.hits += correct;
    state.score += correct * 15 - wrong * 10;
    if (correct === 2) state.score += 10;

    state.answered = true;

    el.root.querySelectorAll('[data-kpi-id]').forEach((card) => {
      const id = card.dataset.kpiId;
      const isCorrect = round.kpis.find((k) => k.id === id)?.correct;
      if (isCorrect) card.classList.add('correct');
      if (state.selected.has(id) && !isCorrect) card.classList.add('wrong');
    });

    fb.className = `feedback ${correct === 2 ? 'ok' : 'bad'}`;
    fb.textContent = `${round.reason} (${correct}/2 korrekt)`;
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
    state.selected.clear();
    state.answered = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.hits = 0;
    state.answered = false;
    state.done = false;
    state.selected.clear();
    render();
  }

  function updateKpis() {
    const totalRounds = state.cfg?.rounds.length || 0;
    const maxHits = totalRounds * 2;
    el.round.textContent = `${state.done ? totalRounds : state.idx + 1}/${totalRounds}`;
    el.score.textContent = String(state.score);
    el.hits.textContent = `${state.hits}/${maxHits}`;
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
      mode: state.done ? 'result' : 'kpi_selection',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      hits: state.hits,
      selected: Array.from(state.selected),
      answered: state.answered,
      prompt: round?.prompt || null
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
