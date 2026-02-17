(function () {
  'use strict';

  const FEEDBACK_MS = 1400;

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    energy: 70,
    quality: 60,
    agendaTime: 90,
    streak: 0,
    lock: false,
    done: false,
    usage: {},
    timer: null
  };

  const el = {
    level: document.getElementById('kpi-level'),
    energy: document.getElementById('kpi-energy'),
    quality: document.getElementById('kpi-quality'),
    time: document.getElementById('kpi-time'),
    score: document.getElementById('kpi-score'),
    round: document.getElementById('kpi-round'),
    vibe: document.getElementById('vibe'),
    title: document.getElementById('title'),
    desc: document.getElementById('desc'),
    methodGrid: document.getElementById('method-grid'),
    feedback: document.getElementById('feedback'),
    result: document.getElementById('result'),
    resultText: document.getElementById('result-text'),
    restartBtn: document.getElementById('restart-btn')
  };

  init();

  async function init() {
    const resp = await fetch('data/_gg01_moderations_master.json');
    if (!resp.ok) {
      el.feedback.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    el.restartBtn.addEventListener('click', restart);
    restart();
  }

  function restart() {
    clearTimer();
    state.idx = 0;
    state.score = 0;
    state.energy = 70;
    state.quality = 60;
    state.agendaTime = 90;
    state.streak = 0;
    state.lock = false;
    state.done = false;
    state.usage = {};

    el.result.classList.add('hidden');
    el.feedback.className = 'feedback';
    el.feedback.textContent = 'Waehle eine Methode, um den Raum zu steuern.';
    render();
  }

  function currentRound() {
    return state.cfg.rounds[state.idx] || null;
  }

  function render() {
    const round = currentRound();
    const total = state.cfg.rounds.length;

    if (!round || state.done) {
      finish();
      return;
    }

    el.level.textContent = String(round.level);
    el.energy.textContent = `${Math.round(state.energy)}%`;
    el.quality.textContent = stars(state.quality);
    el.time.textContent = `${Math.max(0, Math.round(state.agendaTime))} min`;
    el.score.textContent = String(state.score);
    el.round.textContent = `${state.idx + 1}/${total}`;

    el.vibe.textContent = round.vibe;
    el.title.textContent = round.title;
    el.desc.textContent = round.desc;

    const buttons = round.options.map((id) => {
      const method = methodById(id);
      return `<button type="button" class="method-btn" data-method="${method.id}" ${state.lock ? 'disabled' : ''}>
        ${method.label}
        <small>${method.desc}</small>
      </button>`;
    }).join('');

    el.methodGrid.innerHTML = buttons;
    el.methodGrid.querySelectorAll('[data-method]').forEach((btn) => {
      btn.addEventListener('click', () => choose(btn.dataset.method));
    });
  }

  function choose(methodId) {
    if (state.lock || state.done) return;

    const round = currentRound();
    if (!round) return;

    state.lock = true;

    state.energy = clamp((state.energy + round.energy) / 2, 0, 100);
    state.quality = clamp((state.quality + round.quality) / 2, 0, 100);

    const used = (state.usage[methodId] || 0) + 1;
    state.usage[methodId] = used;

    let points = 0;
    let message = '';
    let ok = false;

    if (methodId === round.best) {
      points = 130;
      state.streak += 1;
      state.energy = clamp(state.energy + 10, 0, 100);
      state.quality = clamp(state.quality + 12, 0, 100);
      message = 'Sehr gut moderiert.';
      ok = true;
    } else if (round.good.includes(methodId)) {
      points = 70;
      state.streak = 0;
      state.energy = clamp(state.energy + 2, 0, 100);
      state.quality = clamp(state.quality + 4, 0, 100);
      message = 'Solide Wahl, aber nicht optimal.';
      ok = true;
    } else {
      points = -45;
      state.streak = 0;
      state.energy = clamp(state.energy - 9, 0, 100);
      state.quality = clamp(state.quality - 11, 0, 100);
      message = 'Diese Methode passt hier nicht gut.';
    }

    if (used > 1) {
      const boredomPenalty = (used - 1) * 12;
      points -= boredomPenalty;
      message += ` Method-Boredom -${boredomPenalty}.`;
    }

    if (state.streak >= 3 && state.energy >= 72 && state.quality >= 72) {
      points += 90;
      message += ' Flow-State +90.';
    }

    state.score = Math.max(0, state.score + points);
    state.agendaTime = Math.max(0, state.agendaTime - round.time_cost);

    el.feedback.className = `feedback ${ok ? 'ok' : 'bad'}`;
    el.feedback.textContent = `${message} (${points >= 0 ? '+' : ''}${points})`;

    if (state.agendaTime <= 0 || state.quality <= 0) {
      state.done = true;
      render();
      return;
    }

    clearTimer();
    state.timer = window.setTimeout(() => {
      state.idx += 1;
      state.lock = false;
      if (!state.done) {
        el.feedback.className = 'feedback';
        el.feedback.textContent = 'Naechste Situation.';
      }
      render();
    }, FEEDBACK_MS);
  }

  function finish() {
    state.done = true;

    el.level.textContent = '3';
    el.energy.textContent = `${Math.round(state.energy)}%`;
    el.quality.textContent = stars(state.quality);
    el.time.textContent = `${Math.max(0, Math.round(state.agendaTime))} min`;
    el.score.textContent = String(state.score);
    el.round.textContent = `${Math.min(state.cfg.rounds.length, state.idx)}/${state.cfg.rounds.length}`;

    el.methodGrid.innerHTML = '';

    const verdict = state.score >= 1500
      ? 'Moderation sehr stark: Gruppe blieb im Flow.'
      : state.score >= 1000
        ? 'Gute Moderation: Zielbild ist klar.'
        : 'Basis erreicht: mehr Methodenwechsel einplanen.';

    el.resultText.textContent = `${verdict} Score: ${state.score}.`;
    el.result.classList.remove('hidden');
  }

  function methodById(id) {
    return state.cfg.methods.find((m) => m.id === id);
  }

  function stars(value) {
    const n = clamp(Math.round(value / 20), 0, 5);
    return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function clearTimer() {
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
  }

  function renderGameToText() {
    const round = currentRound();
    return JSON.stringify({
      mode: state.done ? 'result' : (state.lock ? 'feedback' : 'question'),
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg ? state.cfg.rounds.length : 0,
      level: round ? round.level : null,
      vibe: round ? round.vibe : null,
      score: state.score,
      group_energy: Math.round(state.energy),
      result_quality: Math.round(state.quality),
      agenda_time: Math.round(state.agendaTime),
      streak: state.streak,
      current_round: round ? {
        id: round.id,
        title: round.title,
        best: round.best,
        options: round.options
      } : null
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0 || state.done) return true;
    state.agendaTime = Math.max(0, state.agendaTime - (ms / 60000));
    if (state.agendaTime <= 0 && !state.done) {
      state.done = true;
      render();
    }
    return true;
  };
})();
