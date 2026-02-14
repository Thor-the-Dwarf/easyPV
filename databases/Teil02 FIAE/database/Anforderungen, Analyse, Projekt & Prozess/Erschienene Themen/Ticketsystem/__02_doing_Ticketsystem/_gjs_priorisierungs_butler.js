(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    streak: 0,
    answered: false,
    done: false,
    selectedId: null,
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
      const resp = await fetch('./_g01_priorisierungs_butler.json');
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

  function priorityById(id) {
    return state.cfg.priorities.find((p) => p.id === id) || null;
  }

  function render() {
    updateKpis();

    if (!state.cfg) return;

    if (state.done) {
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Du hast <strong>${state.score}</strong> Punkte erreicht.</p>
        <p>Maximale Serie: <strong>${state.streak}</strong></p>
        <ul class="result-list">
          <li>P1: Systemstillstand oder Sicherheitsrisiko</li>
          <li>P2: Schwere Einschraenkung ohne Totalausfall</li>
          <li>P3: Workaround vorhanden</li>
          <li>P4: Kosmetisch / niedrige Auswirkung</li>
        </ul>
        <div class="actions">
          <button id="restart-btn" class="btn" type="button">Nochmal spielen</button>
        </div>
      `;
      document.getElementById('restart-btn').addEventListener('click', restart);
      return;
    }

    const round = currentRound();
    const scoring = state.cfg.scoring;

    el.root.innerHTML = `
      <h2>${escapeHtml(round.id.toUpperCase())}: Ticket priorisieren</h2>
      <div class="ticket">
        <h3>${escapeHtml(round.ticket)}</h3>
        <p>${escapeHtml(round.details)}</p>
      </div>
      <div class="choices">
        ${state.cfg.priorities.map((p) => {
          const classes = ['choice'];
          if (state.answered && state.selectedId === p.id) {
            classes.push(p.id === round.correct_priority ? 'correct' : 'wrong');
          }
          if (state.answered && p.id === round.correct_priority) {
            classes.push('correct');
          }
          return `
            <button type="button"
              class="${classes.join(' ')}"
              data-priority="${escapeHtml(p.id)}"
              ${state.answered ? 'disabled' : ''}>
              <strong>${escapeHtml(p.label)}</strong>
              <small>${escapeHtml(p.hint)} | SLA: ${escapeHtml(p.sla)}</small>
            </button>
          `;
        }).join('')}
      </div>
      <div id="feedback" class="feedback hidden"></div>
      <div class="actions">
        <button id="next-btn" class="btn hidden" type="button">
          ${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}
        </button>
      </div>
      <p style="margin-top:.8rem;color:#9fb4d6;">
        Punkte: richtig ${scoring.correct > 0 ? '+' : ''}${scoring.correct},
        falsch ${scoring.wrong},
        Serienbonus ab ${scoring.streak_bonus_threshold} Treffern: +${scoring.streak_bonus}
      </p>
    `;

    el.root.querySelectorAll('[data-priority]').forEach((btn) => {
      btn.addEventListener('click', () => answer(btn.dataset.priority));
    });
    document.getElementById('next-btn').addEventListener('click', nextRound);
  }

  function answer(priorityId) {
    if (state.answered || state.done) return;

    const round = currentRound();
    const scoring = state.cfg.scoring;
    const selected = priorityById(priorityId);
    if (!selected) return;

    state.selectedId = priorityId;
    state.answered = true;
    state.lastCorrect = priorityId === round.correct_priority;

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

    const fb = document.getElementById('feedback');
    const correct = priorityById(round.correct_priority);
    fb.className = `feedback ${state.lastCorrect ? 'ok' : 'bad'}`;
    fb.innerHTML = state.lastCorrect
      ? `Richtig. ${escapeHtml(round.reason)}`
      : `Nicht optimal. Korrekt ist <strong>${escapeHtml(correct.label)}</strong>. ${escapeHtml(round.reason)}`;
    fb.classList.remove('hidden');

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
    state.selectedId = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.streak = 0;
    state.answered = false;
    state.done = false;
    state.selectedId = null;
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
      mode: state.done ? 'result' : 'priority_decision',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      streak: state.streak,
      answered: state.answered,
      selected_priority: state.selectedId,
      expected_priority: round?.correct_priority || null,
      ticket: round?.ticket || null
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
