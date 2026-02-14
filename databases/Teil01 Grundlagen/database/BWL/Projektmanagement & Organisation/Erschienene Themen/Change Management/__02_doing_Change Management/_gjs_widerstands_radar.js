(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    hits: 0,
    selected: new Set(),
    answered: false,
    done: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    hits: document.getElementById('kpi-hits'),
    root: document.getElementById('root')
  };

  init();

  async function init() {
    const resp = await fetch('./_g01_widerstands_radar.json');
    if (!resp.ok) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }
    state.cfg = await resp.json();
    render();
  }

  function currentRound() {
    return state.cfg.rounds[state.idx] || null;
  }

  function render() {
    updateKpis();

    if (state.done) {
      const total = state.cfg.rounds.length;
      const rate = Math.round((state.hits / (total * 3)) * 100);
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Richtig erkannte Blockierer: <strong>${state.hits}</strong> / ${total * 3} (${rate}%)</p>
        <button id="restart" class="check-btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', () => {
        state.idx = 0;
        state.score = 0;
        state.hits = 0;
        state.selected.clear();
        state.answered = false;
        state.done = false;
        render();
      });
      return;
    }

    const round = currentRound();

    el.root.innerHTML = `
      <section class="task">
        <h2>${escapeHtml(round.prompt)}</h2>
        <p>Markiere genau 3 Personen, die aktiv blockieren.</p>
      </section>

      <div id="grid" class="radar-grid">
        ${round.cards.map((c, i) => {
          const active = state.selected.has(i) ? 'active' : '';
          return `<button type="button" class="radar-card ${active}" data-idx="${i}"><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.text)}</p></button>`;
        }).join('')}
      </div>

      <div class="radar-actions">
        <button id="evaluate" class="check-btn" type="button" ${state.answered ? 'disabled' : ''}>Pruefen</button>
        <button id="next" class="next-btn hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button>
      </div>

      <div id="feedback" class="feedback hidden"></div>
    `;

    el.root.querySelectorAll('.radar-card').forEach((card) => {
      card.addEventListener('click', () => {
        if (state.answered) return;
        const i = Number(card.dataset.idx);
        if (state.selected.has(i)) state.selected.delete(i);
        else {
          if (state.selected.size >= 3) return;
          state.selected.add(i);
        }
        render();
      });
    });

    document.getElementById('evaluate').addEventListener('click', evaluate);
    document.getElementById('next').addEventListener('click', nextRound);
  }

  function evaluate() {
    if (state.answered) return;
    if (state.selected.size !== 3) {
      const fb = document.getElementById('feedback');
      fb.className = 'feedback bad';
      fb.textContent = 'Bitte genau 3 Personen markieren.';
      fb.classList.remove('hidden');
      return;
    }

    const round = currentRound();
    let correct = 0;
    for (const i of state.selected) {
      if (round.cards[i].blocker) correct += 1;
    }

    const wrong = 3 - correct;
    state.hits += correct;
    state.score += correct * 15 - wrong * 10;
    if (correct === 3) state.score += 10;

    state.answered = true;

    const fb = document.getElementById('feedback');
    if (correct === 3) {
      fb.className = 'feedback ok';
      fb.textContent = 'Perfekt. Alle 3 Blockierer korrekt erkannt (+10 Bonus).';
    } else {
      fb.className = 'feedback bad';
      fb.textContent = `Teilweise korrekt: ${correct}/3 Blockierer erkannt.`;
    }
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
    state.selected.clear();
    state.answered = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg ? state.cfg.rounds.length : 0;
    el.round.textContent = `${state.done ? total : state.idx + 1}/${total}`;
    el.score.textContent = String(state.score);
    el.hits.textContent = String(state.hits);
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
    const round = !state.done && state.cfg ? currentRound() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'radar',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg ? state.cfg.rounds.length : 0,
      score: state.score,
      hits: state.hits,
      selected_count: state.selected.size,
      prompt: round ? round.prompt : null
    });
  };

  window.advanceTime = function advanceTime() { return true; };
})();
