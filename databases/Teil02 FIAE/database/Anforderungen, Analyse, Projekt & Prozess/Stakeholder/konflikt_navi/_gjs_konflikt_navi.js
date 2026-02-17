(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    satisfaction: 60,
    answered: false,
    done: false,
    selectedId: null,
    lastCorrect: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    sat: document.getElementById('kpi-sat'),
    root: document.getElementById('root')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('data/_gg01_konflikt_navi.json');
      if (!resp.ok) throw new Error('config unavailable');
      state.cfg = await resp.json();
      state.satisfaction = Number(state.cfg.start_satisfaction || 60);
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
      const verdict = state.satisfaction >= 70
        ? 'Stark: Konflikte wurden projektorientiert geloest.'
        : state.satisfaction >= 45
          ? 'Solide: teilweiser Ausgleich, noch Potenzial.'
          : 'Kritisch: Konflikte blieben weitgehend ungeloest.';

      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>${verdict}</p>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Zufriedenheit: <strong>${state.satisfaction}%</strong></p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const round = currentRound();

    el.root.innerHTML = `
      <h2>Konfliktfall</h2>
      <p>${escapeHtml(round.prompt)}</p>

      <section class="sat-wrap">
        <div class="sat-bar"><div class="sat-fill" style="width:${state.satisfaction}%"></div></div>
        <div class="sat-label">Stakeholder-Zufriedenheit: ${state.satisfaction}%</div>
      </section>

      <div class="opts">
        ${round.options.map((o) => {
          const cls = ['opt'];
          if (state.answered && state.selectedId === o.id) cls.push(o.correct ? 'correct' : 'wrong');
          if (state.answered && o.correct) cls.push('correct');
          return `<button type="button" class="${cls.join(' ')}" data-id="${escapeHtml(o.id)}" ${state.answered ? 'disabled' : ''}>${escapeHtml(o.text)}</button>`;
        }).join('')}
      </div>

      <div id="feedback" class="feedback hidden"></div>
      <div class="actions"><button id="next" class="btn hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button></div>
    `;

    el.root.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => answer(btn.dataset.id));
    });
    document.getElementById('next').addEventListener('click', nextRound);
  }

  function answer(id) {
    if (state.answered) return;
    const round = currentRound();
    const opt = round.options.find((x) => x.id === id);
    if (!opt) return;

    state.selectedId = id;
    state.answered = true;
    state.lastCorrect = Boolean(opt.correct);
    state.score += Number(opt.score_delta || 0);
    state.satisfaction = clamp(state.satisfaction + Number(opt.satisfaction_delta || 0), 0, 100);

    render();

    const fb = document.getElementById('feedback');
    fb.className = `feedback ${opt.correct ? 'ok' : 'bad'}`;
    fb.textContent = round.reason;
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
    state.selectedId = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.satisfaction = Number(state.cfg.start_satisfaction || 60);
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
    el.sat.textContent = `${state.satisfaction}%`;
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
      mode: state.done ? 'result' : 'conflict_decision',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      satisfaction: state.satisfaction,
      selected_id: state.selectedId,
      answered: state.answered,
      last_correct: state.lastCorrect,
      prompt: round?.prompt || null
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
