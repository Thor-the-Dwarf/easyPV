(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    mood: 60,
    answered: false,
    done: false,
    selectedOptionId: null,
    lastCorrect: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    type: document.getElementById('kpi-type'),
    root: document.getElementById('root')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('./_gg01_widerstands_baendiger.json');
      if (!resp.ok) throw new Error('config unavailable');
      state.cfg = await resp.json();
      state.mood = Number(state.cfg.start_mood || 60);
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
      const summary = state.mood >= 70
        ? 'Change-Prozess stabilisiert.'
        : state.mood >= 45
          ? 'Teilweise stabil, weitere Begleitung noetig.'
          : 'Kritisch: Widerstand bleibt hoch.';
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>${summary}</p>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Stimmungsbarometer: <strong>${state.mood}%</strong></p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const round = currentRound();

    el.root.innerHTML = `
      <section class="task">
        <h2>Widerstandsfall</h2>
        <p>${escapeHtml(round.prompt)}</p>
      </section>

      <section class="mood-wrap">
        <div class="mood-bar"><div class="mood-fill" style="width:${state.mood}%"></div></div>
        <div class="mood-label">Stimmungsbarometer: ${state.mood}%</div>
      </section>

      <div class="options">
        ${round.options.map((opt) => {
          const cls = ['option'];
          if (state.answered && state.selectedOptionId === opt.id) cls.push(opt.correct ? 'correct' : 'wrong');
          if (state.answered && opt.correct) cls.push('correct');
          return `<button type="button" class="${cls.join(' ')}" data-option-id="${escapeHtml(opt.id)}" ${state.answered ? 'disabled' : ''}>${escapeHtml(opt.text)}</button>`;
        }).join('')}
      </div>

      <div id="feedback" class="feedback hidden"></div>
      <div class="actions"><button id="next" class="btn hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button></div>
    `;

    el.root.querySelectorAll('[data-option-id]').forEach((btn) => {
      btn.addEventListener('click', () => answer(btn.dataset.optionId));
    });
    document.getElementById('next').addEventListener('click', nextRound);
  }

  function answer(optionId) {
    if (state.answered) return;
    const round = currentRound();
    const opt = round.options.find((o) => o.id === optionId);
    if (!opt) return;

    state.answered = true;
    state.selectedOptionId = optionId;
    state.lastCorrect = Boolean(opt.correct);
    state.score += Number(opt.score_delta || 0);
    state.mood = clamp(state.mood + Number(opt.mood_delta || 0), 0, 100);

    render();

    const fb = document.getElementById('feedback');
    fb.className = `feedback ${opt.correct ? 'ok' : 'bad'}`;
    fb.textContent = opt.reason;
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
    state.selectedOptionId = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.mood = Number(state.cfg.start_mood || 60);
    state.answered = false;
    state.done = false;
    state.selectedOptionId = null;
    state.lastCorrect = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg?.rounds.length || 0;
    const round = !state.done && state.cfg ? currentRound() : null;
    el.round.textContent = `${state.done ? total : state.idx + 1}/${total}`;
    el.score.textContent = String(state.score);
    el.type.textContent = round ? round.type : '-';
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
      mode: state.done ? 'result' : 'resistance_response',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      resistance_type: round?.type || null,
      score: state.score,
      mood: state.mood,
      answered: state.answered,
      selected_option_id: state.selectedOptionId,
      last_correct: state.lastCorrect
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
