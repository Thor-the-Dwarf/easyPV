(function () {
  'use strict';
  const state = { cfg: null, index: 0, score: 0, answered: false, done: false };
  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    progress: document.getElementById('kpi-progress'),
    card: document.getElementById('card')
  };
  init();

  async function init() {
    const resp = await fetch('_data/_gg01_lieferkette_risiko_router.json');
    if (!resp.ok) { el.card.textContent = 'Konfigurationsdatei konnte nicht geladen werden.'; return; }
    state.cfg = await resp.json();
    render();
  }

  function render() {
    if (!state.cfg) return;
    updateKpis();
    if (state.done) return renderDone();

    const round = state.cfg.rounds[state.index];
    const options = round.options.map((opt) => '<button class="option-btn" type="button" data-id="' + opt.id + '" ' + (state.answered ? 'disabled' : '') + '>' + escapeHtml(opt.text) + '</button>').join('');

    el.card.innerHTML =
      '<h2 class="prompt">' + escapeHtml(round.prompt) + '</h2>' +
      '<p class="hint">' + escapeHtml(round.hint || '') + '</p>' +
      '<div class="options">' + options + '</div>' +
      '<div id="feedback" class="feedback" hidden></div>' +
      '<div class="actions"><button id="next-btn" class="action-btn" type="button" hidden>' + (state.index === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde') + '</button></div>';

    Array.from(el.card.querySelectorAll('[data-id]')).forEach((btn) => {
      btn.addEventListener('click', () => answer(btn.getAttribute('data-id')));
    });
    document.getElementById('next-btn').addEventListener('click', nextRound);
  }

  function answer(optionId) {
    if (state.answered || state.done || !state.cfg) return;
    const round = state.cfg.rounds[state.index];
    const option = round.options.find((entry) => entry.id === optionId);
    if (!option) return;
    state.answered = true;
    state.score += Number(option.correct ? state.cfg.scoring.correct : state.cfg.scoring.wrong) || 0;

    const feedback = document.getElementById('feedback');
    feedback.hidden = false;
    feedback.className = 'feedback ' + (option.correct ? 'ok' : 'bad');
    feedback.textContent = option.feedback || (option.correct ? 'Korrekt.' : 'Nicht korrekt.');

    Array.from(el.card.querySelectorAll('[data-id]')).forEach((btn) => { btn.disabled = true; });
    document.getElementById('next-btn').hidden = false;
    updateKpis();
  }

  function nextRound() {
    if (!state.answered || !state.cfg) return;
    if (state.index >= state.cfg.rounds.length - 1) {
      state.done = true;
      if (state.score < 0) state.score = 0;
      state.score += Number(state.cfg.scoring.completion_bonus) || 0;
      return render();
    }
    state.index += 1;
    state.answered = false;
    render();
  }

  function renderDone() {
    const total = state.cfg.rounds.length;
    const maxScore = Math.max(1, total * Math.max(1, Number(state.cfg.scoring.correct) || 0));
    const progress = Math.round(Math.max(0, Math.min(1, state.score / maxScore)) * 100);
    el.card.innerHTML =
      '<h2 class="prompt">Session abgeschlossen</h2>' +
      '<p class="hint">Punkte: <strong>' + state.score + '</strong> | Fortschritt: <strong>' + progress + '%</strong></p>' +
      '<div class="actions"><button id="restart-btn" class="action-btn" type="button">Nochmal spielen</button></div>';
    document.getElementById('restart-btn').addEventListener('click', restart);
    updateKpis();
  }

  function restart() { state.index = 0; state.score = 0; state.answered = false; state.done = false; render(); }

  function updateKpis() {
    const totalRounds = state.cfg ? state.cfg.rounds.length : 0;
    const currentRound = state.done ? totalRounds : Math.min(totalRounds, state.index + 1);
    const progressPercent = totalRounds > 0 ? Math.round((currentRound / totalRounds) * 100) : 0;
    el.round.textContent = currentRound + '/' + totalRounds;
    el.score.textContent = String(state.score);
    el.progress.textContent = progressPercent + '%';
  }

  function computeProgressPercent() {
    if (!state.cfg || !Array.isArray(state.cfg.rounds) || state.cfg.rounds.length === 0) return 0;
    const total = state.cfg.rounds.length;
    const solved = state.done ? total : state.index + (state.answered ? 1 : 0);
    return Math.round(Math.max(0, Math.min(1, solved / total)) * 100);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.render_game_to_text = function renderGameToText() {
    return JSON.stringify({
      mode: 'nachhaltigkeit_lieferkette_router',
      measurable: true,
      coordinate_system: 'origin top-left, x right, y down',
      current_round: state.index + 1,
      total_rounds: state.cfg && Array.isArray(state.cfg.rounds) ? state.cfg.rounds.length : 0,
      completed_rounds: state.done ? (state.cfg && state.cfg.rounds ? state.cfg.rounds.length : 0) : (state.index + (state.answered ? 1 : 0)),
      score: state.score,
      progress_percent: computeProgressPercent(),
      done: state.done
    });
  };

  const __baseRenderToText = window.render_game_to_text;
  let __simulatedMs = 0;
  window.render_game_to_text = function renderGameToTextWithSimulatedMs() {
    const raw = typeof __baseRenderToText === 'function' ? __baseRenderToText() : '{}';
    try {
      const payload = JSON.parse(raw);
      if (payload && typeof payload === 'object' && !Array.isArray(payload) && !Object.prototype.hasOwnProperty.call(payload, 'simulated_ms')) {
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
