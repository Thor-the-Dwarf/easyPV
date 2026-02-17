(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    streak: 0,
    answered: false,
    done: false,
    selectedTicket: null,
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
      const resp = await fetch('_data/_gg01_sla_timer_kampf.json');
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
    if (!state.cfg) return;

    if (state.done) {
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Aktuelle Serie: <strong>${state.streak}</strong></p>
        <ul class="result-list">
          <li>P1 immer zuerst pruefen, auch wenn P2 fast ablaeuft.</li>
          <li>Bei gleicher Prioritaet gilt: geringste Restzeit zuerst.</li>
          <li>Restzeit + Kritikalitaet gemeinsam betrachten.</li>
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
      <p class="round-label">Runde ${state.idx + 1}: Welches Ticket muss jetzt zuerst bearbeitet werden?</p>
      <div class="tickets">
        ${round.tickets.map((ticket) => {
          const classes = ['ticket'];
          if (state.answered && state.selectedTicket === ticket.id) {
            classes.push(ticket.id === round.best_choice ? 'correct' : 'wrong');
          }
          if (state.answered && ticket.id === round.best_choice) {
            classes.push('correct');
          }
          return `
            <button
              type="button"
              class="${classes.join(' ')}"
              data-ticket="${escapeHtml(ticket.id)}"
              ${state.answered ? 'disabled' : ''}>
              <div class="ticket-title">${escapeHtml(ticket.title)}</div>
              <div class="ticket-meta">Prioritaet ${escapeHtml(ticket.priority)} | Restzeit ${ticket.minutes_left} Min.</div>
              <div class="sla-line">
                ${priorityTag(ticket.priority)}
                ${urgencyTag(ticket.minutes_left)}
              </div>
            </button>
          `;
        }).join('')}
      </div>
      <div id="feedback" class="feedback hidden"></div>
      <div class="actions">
        <button type="button" id="next-btn" class="btn hidden">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button>
      </div>
      <p style="margin-top:.8rem;color:#a8bfdf;">
        Punkte: richtig +${scoring.correct}, falsch ${scoring.wrong}, Bonus ab ${scoring.streak_bonus_threshold} Treffern: +${scoring.streak_bonus}
      </p>
    `;

    el.root.querySelectorAll('[data-ticket]').forEach((button) => {
      button.addEventListener('click', () => answer(button.dataset.ticket));
    });
    document.getElementById('next-btn').addEventListener('click', nextRound);
  }

  function answer(ticketId) {
    if (state.answered || state.done) return;

    const round = currentRound();
    const exists = round.tickets.some((ticket) => ticket.id === ticketId);
    if (!exists) return;

    const scoring = state.cfg.scoring;
    state.selectedTicket = ticketId;
    state.answered = true;
    state.lastCorrect = ticketId === round.best_choice;

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

    const correctTicket = round.tickets.find((ticket) => ticket.id === round.best_choice);
    const feedback = document.getElementById('feedback');
    feedback.className = `feedback ${state.lastCorrect ? 'ok' : 'bad'}`;
    feedback.innerHTML = state.lastCorrect
      ? `Richtig. ${escapeHtml(round.reason)}`
      : `Nicht optimal. Korrekt waere <strong>${escapeHtml(correctTicket.title)}</strong>. ${escapeHtml(round.reason)}`;
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
    state.selectedTicket = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.streak = 0;
    state.answered = false;
    state.done = false;
    state.selectedTicket = null;
    state.lastCorrect = false;
    render();
  }

  function priorityTag(priority) {
    const cls = priority.toLowerCase();
    return `<span class="tag ${cls}">${escapeHtml(priority)}</span>`;
  }

  function urgencyTag(minutesLeft) {
    if (minutesLeft <= 30) return '<span class="tag critical">kritisch</span>';
    if (minutesLeft <= 120) return '<span class="tag warning">knapp</span>';
    return '<span class="tag">stabil</span>';
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
      mode: state.done ? 'result' : 'sla_priority_decision',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      streak: state.streak,
      answered: state.answered,
      selected_ticket: state.selectedTicket,
      expected_ticket: round?.best_choice || null,
      tickets: round?.tickets || []
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
