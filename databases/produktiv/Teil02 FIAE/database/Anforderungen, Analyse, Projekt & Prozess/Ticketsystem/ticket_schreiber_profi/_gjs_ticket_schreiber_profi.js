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
      const resp = await fetch('_data/_gg01_ticket_schreiber_profi.json');
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

  function fieldLabel(fieldId) {
    const match = state.cfg.required_fields.find((f) => f.id === fieldId);
    return match ? match.label : fieldId;
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
          ${state.cfg.required_fields.map((f) => `<li>${escapeHtml(f.label)}</li>`).join('')}
        </ul>
        <div class="actions">
          <button type="button" class="btn" id="restart-btn">Nochmal spielen</button>
        </div>
      `;
      document.getElementById('restart-btn').addEventListener('click', restart);
      return;
    }

    const round = currentRound();
    const scoring = state.cfg.scoring;

    el.root.innerHTML = `
      <h2>${escapeHtml(round.headline)}: Was fehlt?</h2>
      <div class="snippet">
        <h3>Ticket-Ausschnitt</h3>
        <p>${escapeHtml(round.snippet)}</p>
      </div>
      <div class="options">
        ${round.options.map((opt) => {
          const classes = ['option'];
          if (state.answered && state.selectedId === opt.id) {
            classes.push(opt.id === round.missing_field ? 'correct' : 'wrong');
          }
          if (state.answered && opt.id === round.missing_field) {
            classes.push('correct');
          }
          return `
            <button type="button"
              class="${classes.join(' ')}"
              data-opt="${escapeHtml(opt.id)}"
              ${state.answered ? 'disabled' : ''}>
              ${escapeHtml(opt.text)}
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
        Punkte: richtig +${scoring.correct}, falsch ${scoring.wrong}, Bonus ab ${scoring.streak_bonus_threshold} Treffern: +${scoring.streak_bonus}
      </p>
    `;

    el.root.querySelectorAll('[data-opt]').forEach((btn) => {
      btn.addEventListener('click', () => answer(btn.dataset.opt));
    });
    document.getElementById('next-btn').addEventListener('click', nextRound);
  }

  function answer(optionId) {
    if (state.answered || state.done) return;

    const round = currentRound();
    const scoring = state.cfg.scoring;
    const optionExists = round.options.some((opt) => opt.id === optionId);
    if (!optionExists) return;

    state.selectedId = optionId;
    state.answered = true;
    state.lastCorrect = optionId === round.missing_field;

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
    fb.className = `feedback ${state.lastCorrect ? 'ok' : 'bad'}`;
    fb.textContent = state.lastCorrect
      ? `Richtig. ${round.reason}`
      : `Fehlt: ${fieldLabel(round.missing_field)}. ${round.reason}`;
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
      mode: state.done ? 'result' : 'ticket_writer_training',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      streak: state.streak,
      answered: state.answered,
      selected_option: state.selectedId,
      expected_missing_field: round?.missing_field || null,
      ticket_snippet: round?.snippet || null
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };

  const __baseRenderToTextForSim = window.render_game_to_text;
  const __baseAdvanceTimeForSim = window.advanceTime;
  let __simulatedMs = 0;

  window.render_game_to_text = function renderGameToTextWithSimulatedMs() {
    const raw = typeof __baseRenderToTextForSim === "function" ? __baseRenderToTextForSim() : "{}";
    try {
      const payload = JSON.parse(raw);
      if (payload && typeof payload === "object" && !Array.isArray(payload) && !Object.prototype.hasOwnProperty.call(payload, "simulated_ms")) {
        payload.simulated_ms = __simulatedMs;
      }
      return JSON.stringify(payload);
    } catch (err) {
      return raw;
    }
  };

  window.advanceTime = function advanceTimeWithSimulatedMs(ms) {
    if (Number.isFinite(ms) && ms > 0) __simulatedMs += ms;
    if (typeof __baseAdvanceTimeForSim === "function") {
      try {
        return __baseAdvanceTimeForSim(ms);
      } catch (err) {
        return true;
      }
    }
    return true;
  };
})();
