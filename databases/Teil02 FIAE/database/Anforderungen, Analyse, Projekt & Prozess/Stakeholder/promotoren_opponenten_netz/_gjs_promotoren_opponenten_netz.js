(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    hits: 0,
    answered: false,
    done: false,
    activeId: null,
    assignment: { macht: null, fach: null, opponents: [] }
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
      const resp = await fetch('data/_gg01_promotoren_opponenten_netz.json');
      if (!resp.ok) throw new Error('config unavailable');
      state.cfg = await resp.json();
      render();
    } catch (_error) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function roundNow() {
    return state.cfg.rounds[state.idx] || null;
  }

  function render() {
    updateKpis();

    if (state.done) {
      const maxHits = state.cfg.rounds.length * 4;
      const rate = Math.round((state.hits / maxHits) * 100);
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Treffer: <strong>${state.hits}</strong> / ${maxHits} (${rate}%)</p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const round = roundNow();

    el.root.innerHTML = `
      <h2>${escapeHtml(round.prompt)}</h2>
      <p>Schritt 1: Person waehlen. Schritt 2: Rolle zuweisen (Macht, Fach, Opponent).</p>

      <div class="people">
        ${round.people.map((p) => `
          <button type="button" class="person ${state.activeId === p.id ? 'active' : ''}" data-id="${escapeHtml(p.id)}" ${state.answered ? 'disabled' : ''}>
            <strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(p.hint)}
          </button>
        `).join('')}
      </div>

      <div class="assign">
        <button id="as-macht" class="btn" type="button" ${state.answered ? 'disabled' : ''}>Als Machtpromotor</button>
        <button id="as-fach" class="btn" type="button" ${state.answered ? 'disabled' : ''}>Als Fachpromotor</button>
        <button id="as-opponent" class="btn" type="button" ${state.answered ? 'disabled' : ''}>Als Opponent</button>
        <button id="clear" class="btn" type="button" ${state.answered ? 'disabled' : ''}>Leeren</button>
      </div>

      <p><strong>Aktuell:</strong> Macht=${state.assignment.macht || '-'} | Fach=${state.assignment.fach || '-'} | Opponenten=${state.assignment.opponents.join(', ') || '-'}</p>

      <div class="assign">
        <button id="check" class="btn primary" type="button" ${state.answered ? 'disabled' : ''}>Pruefen</button>
        <button id="next" class="btn hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button>
      </div>

      <div id="feedback" class="feedback hidden"></div>
    `;

    el.root.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeId = btn.dataset.id;
        render();
      });
    });

    document.getElementById('as-macht').addEventListener('click', () => assign('macht'));
    document.getElementById('as-fach').addEventListener('click', () => assign('fach'));
    document.getElementById('as-opponent').addEventListener('click', () => assign('opponent'));
    document.getElementById('clear').addEventListener('click', clearAssign);
    document.getElementById('check').addEventListener('click', evaluate);
    document.getElementById('next').addEventListener('click', nextRound);
  }

  function assign(type) {
    if (state.answered || !state.activeId) return;
    if (type === 'macht') {
      state.assignment.macht = state.activeId;
      state.assignment.opponents = state.assignment.opponents.filter((id) => id !== state.activeId);
      if (state.assignment.fach === state.activeId) state.assignment.fach = null;
    } else if (type === 'fach') {
      state.assignment.fach = state.activeId;
      state.assignment.opponents = state.assignment.opponents.filter((id) => id !== state.activeId);
      if (state.assignment.macht === state.activeId) state.assignment.macht = null;
    } else if (type === 'opponent') {
      if (!state.assignment.opponents.includes(state.activeId)) {
        if (state.assignment.opponents.length >= 2) return;
        state.assignment.opponents.push(state.activeId);
      }
      if (state.assignment.macht === state.activeId) state.assignment.macht = null;
      if (state.assignment.fach === state.activeId) state.assignment.fach = null;
    }
    render();
  }

  function clearAssign() {
    if (state.answered) return;
    state.assignment = { macht: null, fach: null, opponents: [] };
    state.activeId = null;
    render();
  }

  function evaluate() {
    if (state.answered) return;
    const fb = document.getElementById('feedback');
    const round = roundNow();

    if (!state.assignment.macht || !state.assignment.fach || state.assignment.opponents.length !== 2) {
      fb.className = 'feedback bad';
      fb.textContent = 'Bitte genau 1 Machtpromotor, 1 Fachpromotor und 2 Opponenten zuweisen.';
      fb.classList.remove('hidden');
      return;
    }

    let correct = 0;
    const getRole = (id) => round.people.find((p) => p.id === id)?.role;
    if (getRole(state.assignment.macht) === 'macht') correct += 1;
    if (getRole(state.assignment.fach) === 'fach') correct += 1;
    for (const id of state.assignment.opponents) if (getRole(id) === 'opponent') correct += 1;

    const wrong = 4 - correct;
    state.hits += correct;
    state.score += correct * 15 - wrong * 10;
    if (correct === 4) state.score += 10;

    state.answered = true;
    fb.className = `feedback ${correct === 4 ? 'ok' : 'bad'}`;
    fb.textContent = `Runde: ${correct}/4 korrekt.`;
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
    state.activeId = null;
    state.assignment = { macht: null, fach: null, opponents: [] };
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.hits = 0;
    state.answered = false;
    state.done = false;
    state.activeId = null;
    state.assignment = { macht: null, fach: null, opponents: [] };
    render();
  }

  function updateKpis() {
    const total = state.cfg?.rounds.length || 0;
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
    const round = state.cfg && !state.done ? roundNow() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'network_assignment',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      hits: state.hits,
      active_id: state.activeId,
      assignment: state.assignment,
      prompt: round?.prompt || null,
      answered: state.answered
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
