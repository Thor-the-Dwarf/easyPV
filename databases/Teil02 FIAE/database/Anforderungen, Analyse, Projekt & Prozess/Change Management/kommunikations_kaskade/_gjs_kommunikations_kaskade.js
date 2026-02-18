(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    rumor: 45,
    answered: false,
    done: false,
    selectedChoiceId: null,
    lastCorrect: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    rumor: document.getElementById('kpi-rumor'),
    root: document.getElementById('root')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('_data/_gg01_kommunikations_kaskade.json');
      if (!resp.ok) throw new Error('config unavailable');
      state.cfg = await resp.json();
      state.rumor = Number(state.cfg.start_rumor || 45);
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
      const rating = state.rumor <= 25
        ? 'Sehr gut: Geruechte deutlich reduziert.'
        : state.rumor <= 50
          ? 'Solide: Kommunikation meist stabil.'
          : 'Kritisch: Flurfunk bleibt hoch.';
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>${rating}</p>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Flurfunk-Endwert: <strong>${state.rumor}%</strong></p>
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

      <section class="rumor-wrap">
        <div class="rumor-bar"><div class="rumor-fill" style="width:${state.rumor}%"></div></div>
        <div class="rumor-label">Flurfunk-Level: ${state.rumor}%</div>
      </section>

      <div class="choices">
        ${round.choices.map((choice) => {
          const cls = ['choice'];
          if (state.answered && state.selectedChoiceId === choice.id) cls.push(choice.correct ? 'correct' : 'wrong');
          if (state.answered && choice.correct) cls.push('correct');
          return `
            <button type="button" class="${cls.join(' ')}" data-choice-id="${escapeHtml(choice.id)}" ${state.answered ? 'disabled' : ''}>
              <strong>${escapeHtml(choice.sequence)}</strong>
              <div>${escapeHtml(choice.channel)}</div>
            </button>
          `;
        }).join('')}
      </div>

      <div id="feedback" class="feedback hidden"></div>
      <div class="actions"><button id="next" class="btn hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button></div>
    `;

    el.root.querySelectorAll('[data-choice-id]').forEach((btn) => {
      btn.addEventListener('click', () => answer(btn.dataset.choiceId));
    });

    document.getElementById('next').addEventListener('click', nextRound);
  }

  function answer(choiceId) {
    if (state.answered) return;
    const round = currentRound();
    const choice = round.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    state.answered = true;
    state.selectedChoiceId = choiceId;
    state.lastCorrect = Boolean(choice.correct);
    state.score += Number(choice.score_delta || 0);
    state.rumor = clamp(state.rumor + Number(choice.rumor_delta || 0), 0, 100);

    render();

    const fb = document.getElementById('feedback');
    fb.className = `feedback ${choice.correct ? 'ok' : 'bad'}`;
    fb.textContent = choice.reason;
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
    state.selectedChoiceId = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.rumor = Number(state.cfg.start_rumor || 45);
    state.answered = false;
    state.done = false;
    state.selectedChoiceId = null;
    state.lastCorrect = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg?.rounds.length || 0;
    el.round.textContent = `${state.done ? total : state.idx + 1}/${total}`;
    el.score.textContent = String(state.score);
    el.rumor.textContent = `${state.rumor}%`;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
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
      mode: state.done ? 'result' : 'communication_cascade',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      rumor: state.rumor,
      prompt: round?.prompt || null,
      answered: state.answered,
      selected_choice_id: state.selectedChoiceId,
      last_correct: state.lastCorrect
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
