(function () {
  'use strict';

  const state = {
    cfg: null,
    index: 0,
    score: 0,
    locked: false,
    finished: false
  };

  const el = {
    progress: document.getElementById('progress'),
    score: document.getElementById('score'),
    goal: document.getElementById('goal'),
    situation: document.getElementById('situation'),
    options: document.getElementById('options'),
    feedback: document.getElementById('feedback'),
    result: document.getElementById('result')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('_data/_gg01_sender_empfaenger_bruecke.json');
      if (!resp.ok) throw new Error('Konfiguration nicht ladbar');
      state.cfg = await resp.json();
      render();
    } catch (err) {
      el.feedback.textContent = err.message || 'Fehler beim Laden.';
    }
  }

  function currentRound() {
    return state.cfg.rounds[state.index] || null;
  }

  function choose(option) {
    if (state.locked || state.finished) return;
    state.locked = true;

    const round = currentRound();
    const isCorrect = Boolean(option.correct);

    if (isCorrect) {
      state.score += 20;
      el.feedback.textContent = `Richtig. ${round.explanation}`;
      el.feedback.className = 'deesk-feedback ok';
    } else {
      el.feedback.textContent = `Nicht optimal. ${round.explanation}`;
      el.feedback.className = 'deesk-feedback bad';
    }

    setTimeout(() => {
      state.index += 1;
      state.locked = false;
      if (state.index >= state.cfg.rounds.length) {
        state.finished = true;
      }
      render();
    }, 850);
  }

  function render() {
    const total = state.cfg.rounds.length;
    el.progress.textContent = `Runde ${Math.min(state.index + 1, total)}/${total}`;
    el.score.textContent = `Score: ${state.score}`;

    if (state.finished) {
      const percent = Math.round((state.score / (total * 20)) * 100);
      el.result.classList.remove('hidden');
      el.result.innerHTML = `<h2>Auswertung</h2><p>${state.score} Punkte (${percent}%).</p><button id="restart" class="deesk-btn" type="button">Nochmal</button>`;
      const restart = document.getElementById('restart');
      restart.addEventListener('click', () => {
        state.index = 0;
        state.score = 0;
        state.finished = false;
        state.locked = false;
        el.result.classList.add('hidden');
        render();
      });
      return;
    }

    el.result.classList.add('hidden');
    const round = currentRound();
    el.goal.textContent = round.goal;
    el.situation.textContent = round.situation;

    el.options.innerHTML = round.options
      .map((opt, i) => `<button class="deesk-btn" data-idx="${i}" type="button">${escapeHtml(opt.text)}</button>`)
      .join('');

    el.options.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        choose(round.options[idx]);
      });
    });

    el.feedback.textContent = '';
    el.feedback.className = 'deesk-feedback';
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  window.render_game_to_text = function renderGameToText() {
    const round = currentRound();
    return JSON.stringify({
      mode: state.finished ? 'result' : 'round',
      coordinate_system: 'origin top-left, x right, y down',
      index: state.index,
      total: state.cfg ? state.cfg.rounds.length : 0,
      score: state.score,
      goal: round ? round.goal : null,
      situation: round ? round.situation : null
    });
  };

  window.advanceTime = function advanceTime(ms) {
    if (ms >= 900 && state.locked) {
      // wait cycle handled by setTimeout in choose(); this hook keeps deterministic client compatible
    }
    return Promise.resolve();
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
