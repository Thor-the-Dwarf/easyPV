(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    health: 55,
    answered: false,
    done: false,
    lastChoiceId: null,
    lastGood: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    health: document.getElementById('kpi-health'),
    root: document.getElementById('root')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('./_g01_kultur_gaertner.json');
      if (!resp.ok) throw new Error('config not reachable');
      state.cfg = await resp.json();
      state.health = clamp(state.cfg.start_health ?? 55, 0, 100);
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
      const target = state.health > 80 ? 'Ziel erreicht: Kultur stabil.' : 'Ziel verpasst: Kultur weiter pflegen.';
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>${escapeHtml(target)}</p>
        <p>End-Score: <strong>${state.score}</strong></p>
        <p>End-Gesundheit: <strong>${state.health}%</strong></p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const round = currentRound();

    el.root.innerHTML = `
      <section class="task">
        <h2>${escapeHtml(round.prompt)}</h2>
      </section>

      <section class="tree-wrap">
        <div class="tree-bar"><div class="tree-fill" style="width:${state.health}%"></div></div>
        <div class="tree-label">Kultur-Baum Gesundheit: ${state.health}%</div>
      </section>

      <div class="choices">
        ${round.choices.map((c) => {
          const cls = ['choice'];
          if (state.answered && state.lastChoiceId === c.id) cls.push(c.id === 'grow' ? 'good' : 'bad');
          return `<button type="button" class="${cls.join(' ')}" data-choice-id="${escapeHtml(c.id)}" ${state.answered ? 'disabled' : ''}>${escapeHtml(c.text)}</button>`;
        }).join('')}
      </div>

      <div id="feedback" class="feedback hidden"></div>
      <div class="actions"><button id="next" class="btn hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button></div>
    `;

    el.root.querySelectorAll('[data-choice-id]').forEach((btn) => {
      btn.addEventListener('click', () => pick(btn.dataset.choiceId));
    });
    document.getElementById('next').addEventListener('click', nextRound);
  }

  function pick(choiceId) {
    if (state.answered) return;
    const round = currentRound();
    const choice = round.choices.find((c) => c.id === choiceId);
    if (!choice) return;

    state.answered = true;
    state.lastChoiceId = choice.id;
    state.lastGood = choice.health_delta > 0;
    state.score += Number(choice.score_delta || 0);
    state.health = clamp(state.health + Number(choice.health_delta || 0), 0, 100);

    render();

    const fb = document.getElementById('feedback');
    fb.className = `feedback ${state.lastGood ? 'ok' : 'bad'}`;
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
    state.lastChoiceId = null;
    state.lastGood = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.health = clamp(state.cfg.start_health ?? 55, 0, 100);
    state.answered = false;
    state.done = false;
    state.lastChoiceId = null;
    state.lastGood = false;
    render();
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function updateKpis() {
    const total = state.cfg?.rounds.length || 0;
    el.round.textContent = `${state.done ? total : state.idx + 1}/${total}`;
    el.score.textContent = String(state.score);
    el.health.textContent = `${state.health}%`;
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
      mode: state.done ? 'result' : 'culture_decision',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      prompt: round?.prompt || null,
      health: state.health,
      score: state.score,
      answered: state.answered,
      last_choice_id: state.lastChoiceId,
      last_good: state.lastGood
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
