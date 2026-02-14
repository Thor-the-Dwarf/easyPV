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
      const resp = await fetch('./_g01_interessen_profiler.json');
      if (!resp.ok) throw new Error('config unavailable');
      state.cfg = await resp.json();
      render();
    } catch (_error) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function roundNow() {
    return state.cfg.rounds[state.idx] || null;
  }

  function render() {
    updateKpis();

    if (state.done) {
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Letzte Serie: <strong>${state.streak}</strong></p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const round = roundNow();

    el.root.innerHTML = `
      <section class="task">
        <h2>${escapeHtml(round.person)}</h2>
        <p><strong>Aussage:</strong> ${escapeHtml(round.statement)}</p>
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
    const round = roundNow();
    const opt = round.options.find((x) => x.id === id);
    if (!opt) return;

    state.selectedId = id;
    state.answered = true;
    state.lastCorrect = Boolean(opt.correct);

    if (opt.correct) {
      state.score += 20;
      state.streak += 1;
      if (state.streak >= 3) state.score += 10;
    } else {
      state.score -= 10;
      state.streak = 0;
    }

    render();

    const fb = document.getElementById('feedback');
    fb.className = `feedback ${opt.correct ? 'ok' : 'bad'}`;
    fb.textContent = `${round.reason} (${opt.correct ? 'richtig' : 'falsch'})`;
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

  function escapeHtml(v) {
    return String(v)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  window.render_game_to_text = function renderGameToText() {
    const round = state.cfg && !state.done ? roundNow() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'interest_mapping',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      person: round?.person || null,
      score: state.score,
      streak: state.streak,
      answered: state.answered,
      selected_id: state.selectedId,
      last_correct: state.lastCorrect
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
