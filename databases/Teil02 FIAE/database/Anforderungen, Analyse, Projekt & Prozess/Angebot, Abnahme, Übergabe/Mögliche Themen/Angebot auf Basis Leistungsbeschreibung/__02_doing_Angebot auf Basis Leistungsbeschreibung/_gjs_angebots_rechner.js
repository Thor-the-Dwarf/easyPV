(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    hits: 0,
    answered: false,
    done: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    hits: document.getElementById('kpi-hits'),
    rate: document.getElementById('kpi-rate'),
    root: document.getElementById('calc-root')
  };

  init();

  async function init() {
    const resp = await fetch('./_g01_angebots_rechner.json');
    if (!resp.ok) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    render();
  }

  function render() {
    updateKpis();

    if (state.done) {
      renderResult();
      return;
    }

    const current = state.cfg.rounds[state.idx];

    el.root.innerHTML = `
      <section class="task">
        <h2>Aufgabe ${state.idx + 1}</h2>
        <div class="values">
          <div class="value"><span>Stunden</span><strong>${current.hours}</strong></div>
          <div class="value"><span>Stundensatz</span><strong>${current.hourly_rate} ${state.cfg.currency}</strong></div>
          <div class="value"><span>Risikoaufschlag</span><strong>${current.risk_percent}%</strong></div>
        </div>
      </section>

      <div class="answer">
        <label for="total-input">Endpreis (${state.cfg.currency})</label>
        <input id="total-input" type="number" inputmode="numeric" placeholder="z. B. 13200" min="0" step="1" ${state.answered ? 'disabled' : ''}>
        <button id="check-btn" class="check-btn" type="button" ${state.answered ? 'disabled' : ''}>Pruefen</button>
        <div id="feedback" class="feedback hidden"></div>
        <button id="next-btn" class="next-btn hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Aufgabe'}</button>
      </div>
    `;

    document.getElementById('check-btn').addEventListener('click', checkAnswer);
    document.getElementById('next-btn').addEventListener('click', nextRound);
  }

  function checkAnswer() {
    if (state.answered || state.done) return;

    const input = document.getElementById('total-input');
    const feedback = document.getElementById('feedback');
    const nextBtn = document.getElementById('next-btn');
    const current = state.cfg.rounds[state.idx];

    const given = Number(input.value);
    if (!Number.isFinite(given) || given <= 0) {
      feedback.className = 'feedback bad';
      feedback.textContent = 'Bitte einen gueltigen Endpreis eingeben.';
      feedback.classList.remove('hidden');
      return;
    }

    state.answered = true;
    const correct = given === current.correct_total;

    if (correct) {
      state.hits += 1;
      feedback.className = 'feedback ok';
      feedback.innerHTML = `<strong>Korrekt.</strong> Basispreis ${basePrice(current)} + Risiko ${riskAmount(current)} = ${current.correct_total} ${state.cfg.currency}.`;
    } else {
      const delta = given - current.correct_total;
      const direction = delta > 0 ? 'zu hoch' : 'zu niedrig';
      feedback.className = 'feedback bad';
      feedback.innerHTML = `<strong>Nicht korrekt.</strong> Dein Wert ist ${Math.abs(delta)} ${state.cfg.currency} ${direction}. Richtig sind ${current.correct_total} ${state.cfg.currency}.`;
    }

    input.disabled = true;
    document.getElementById('check-btn').disabled = true;
    feedback.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
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
    render();
  }

  function renderResult() {
    const total = state.cfg.rounds.length;
    const rate = total ? Math.round((state.hits / total) * 100) : 0;

    let verdict = 'Ueben';
    if (rate >= 60) verdict = 'Solide';
    if (rate >= 80) verdict = 'Angebots-fit';
    if (rate === 100) verdict = 'Kalkulations-Profi';

    el.root.innerHTML = `
      <section class="result">
        <h2>${verdict}</h2>
        <p>Treffer: <strong>${state.hits}</strong> / ${total}</p>
        <p>Quote: <strong>${rate}%</strong></p>
        <p>Merksatz: Endpreis = Stunden * Satz + Risikoaufschlag auf den Basispreis.</p>
        <button id="restart-btn" class="restart-btn" type="button">Nochmal rechnen</button>
      </section>
    `;

    document.getElementById('restart-btn').addEventListener('click', restart);
  }

  function restart() {
    state.idx = 0;
    state.hits = 0;
    state.answered = false;
    state.done = false;
    render();
  }

  function basePrice(round) {
    return round.hours * round.hourly_rate;
  }

  function riskAmount(round) {
    return Math.round(basePrice(round) * (round.risk_percent / 100));
  }

  function updateKpis() {
    const total = state.cfg ? state.cfg.rounds.length : 0;
    const current = state.done ? total : state.idx + 1;
    const rate = total ? Math.round((state.hits / total) * 100) : 0;

    el.round.textContent = `${current}/${total}`;
    el.hits.textContent = String(state.hits);
    el.rate.textContent = `${rate}%`;
  }

  function renderGameToText() {
    const total = state.cfg ? state.cfg.rounds.length : 0;
    return JSON.stringify({
      mode: 'angebots_rechner',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      round_display: `${Math.min(total, state.idx + 1)}/${total}`,
      hits: state.hits,
      answered: state.answered,
      done: state.done
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime() { return true; };
})();
