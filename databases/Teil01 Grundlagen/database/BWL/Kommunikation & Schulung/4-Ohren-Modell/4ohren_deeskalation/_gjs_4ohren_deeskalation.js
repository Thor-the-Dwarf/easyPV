(function () {
  'use strict';

  const state = {
    cfg: null,
    index: 0,
    points: 0,
    done: false,
    answered: false,
    lastWasCorrect: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    points: document.getElementById('kpi-points'),
    rate: document.getElementById('kpi-rate'),
    card: document.getElementById('card')
  };

  init();

  async function init() {
    const resp = await fetch('_data/_gg01_4ohren_deeskalation.json');
    if (!resp.ok) {
      el.card.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    render();
  }

  function render() {
    if (!state.cfg) return;
    updateKpis();

    if (state.done) {
      renderResult();
      return;
    }

    const scenario = state.cfg.scenarios[state.index];

    const optionButtons = scenario.options.map((option) => {
      return `<button class="option-btn" type="button" data-option-id="${option.id}" ${state.answered ? 'disabled' : ''}>${option.text}</button>`;
    }).join('');

    el.card.innerHTML = `
      <div class="bubble">
        <div class="bubble-label">Konfliktsituation (${scenario.ear})</div>
        <div class="bubble-text">${scenario.trigger}</div>
      </div>
      <div class="options">${optionButtons}</div>
      <div id="feedback" class="feedback" hidden></div>
      <button id="next-btn" class="next-btn" type="button" hidden>${state.index === state.cfg.scenarios.length - 1 ? 'Auswertung' : 'Naechster Fall'}</button>
    `;

    el.card.querySelectorAll('[data-option-id]').forEach((btn) => {
      btn.addEventListener('click', () => answer(btn.dataset.optionId));
    });

    const nextBtn = document.getElementById('next-btn');
    nextBtn.addEventListener('click', next);
  }

  function answer(optionId) {
    if (state.answered || state.done) return;

    const scenario = state.cfg.scenarios[state.index];
    const option = scenario.options.find((item) => item.id === optionId);
    if (!option) return;

    state.answered = true;
    state.lastWasCorrect = option.score === 100;
    state.points += option.score;

    const feedback = document.getElementById('feedback');
    feedback.hidden = false;

    if (state.lastWasCorrect) {
      feedback.className = 'feedback ok';
      feedback.innerHTML = `<strong>Richtig:</strong> Du bleibst auf der Sachebene. ${scenario.explanation}`;
    } else {
      feedback.className = 'feedback bad';
      feedback.innerHTML = `<strong>Nicht optimal:</strong> Diese Antwort eskaliert eher. Besser waere eine klare Sachantwort mit Fakten und naechstem Schritt.`;
    }

    el.card.querySelectorAll('[data-option-id]').forEach((btn) => {
      btn.disabled = true;
    });

    const nextBtn = document.getElementById('next-btn');
    nextBtn.hidden = false;

    updateKpis();
  }

  function next() {
    if (!state.answered) return;

    if (state.index === state.cfg.scenarios.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.index += 1;
    state.answered = false;
    state.lastWasCorrect = false;
    render();
  }

  function renderResult() {
    const total = state.cfg.scenarios.length * 100;
    const rate = total ? Math.round((state.points / total) * 100) : 0;

    let verdict = 'Guter Start';
    if (rate >= 80) verdict = 'Stark deeskaliert';
    if (rate === 100) verdict = 'Deeskalations-Profi';

    el.card.innerHTML = `
      <section class="result">
        <h2>${verdict}</h2>
        <p>Gesamtpunkte: <strong>${state.points}</strong> / ${total}</p>
        <p>Trefferquote: <strong>${rate}%</strong></p>
        <p>Merksatz: In Konflikten zuerst den Fakt klaeren, dann den naechsten Schritt anbieten.</p>
        <button id="restart-btn" class="restart-btn" type="button">Nochmal spielen</button>
      </section>
    `;

    document.getElementById('restart-btn').addEventListener('click', restart);
  }

  function restart() {
    state.index = 0;
    state.points = 0;
    state.done = false;
    state.answered = false;
    state.lastWasCorrect = false;
    render();
  }

  function updateKpis() {
    const totalRounds = state.cfg ? state.cfg.scenarios.length : 0;
    const current = state.done ? totalRounds : state.index + 1;
    const maxPoints = totalRounds * 100;
    const rate = maxPoints ? Math.round((state.points / maxPoints) * 100) : 0;

    el.round.textContent = `${current}/${totalRounds}`;
    el.points.textContent = String(state.points);
    el.rate.textContent = `${rate}%`;
  }

  function renderGameToText() {
    const totalRounds = state.cfg ? state.cfg.scenarios.length : 0;
    return JSON.stringify({
      mode: 'deeskalation',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.index,
      round_display: totalRounds ? `${Math.min(totalRounds, state.index + 1)}/${totalRounds}` : '0/0',
      points: state.points,
      answered: state.answered,
      done: state.done
    });
  }

  window.render_game_to_text = renderGameToText;
  const __baseRenderToText = window.render_game_to_text;
  let __simulatedMs = 0;
  window.render_game_to_text = function renderGameToTextWithSimulatedMs() {
    const raw = typeof __baseRenderToText === "function" ? __baseRenderToText() : "{}";
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

  window.advanceTime = function advanceTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return true;
    __simulatedMs += ms;
    return true;
  };
})();
