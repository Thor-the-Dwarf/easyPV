(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    answered: false,
    done: false,
    lastDeviation: null,
    lastAward: 0,
    weights: {
      price: 40,
      brand: 20,
      quality: 40
    }
  };

  const el = {
    round: document.getElementById('kw-kpi-round'),
    score: document.getElementById('kw-kpi-score'),
    dev: document.getElementById('kw-kpi-dev'),
    root: document.getElementById('kw-root')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('data/_gg01_kunden_wunsch_rechner.json');
      if (!resp.ok) throw new Error('config unavailable');
      state.cfg = await resp.json();
      render();
    } catch (_error) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function currentRound() {
    return state.cfg.rounds[state.idx] || null;
  }

  function clampInt(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(Number(value))));
  }

  function recomputeQuality() {
    const price = clampInt(state.weights.price, 0, 100);
    const brand = clampInt(state.weights.brand, 0, 100);
    const remainder = 100 - price - brand;
    state.weights.price = price;
    state.weights.brand = brand;
    state.weights.quality = clampInt(remainder, 0, 100);
  }

  function setWeight(key, value) {
    if (state.answered || state.done) return;
    state.weights[key] = clampInt(value, 0, 100);
    recomputeQuality();
    render();
  }

  function deviationFromIdeal(ideal) {
    // Mean absolute deviation across the three criteria.
    const dev =
      Math.abs(state.weights.price - ideal.price) +
      Math.abs(state.weights.quality - ideal.quality) +
      Math.abs(state.weights.brand - ideal.brand);
    return dev / 3;
  }

  function awardPoints(dev) {
    const scoring = state.cfg.scoring;
    if (dev < scoring.good_threshold) return scoring.good_points;
    if (dev < scoring.ok_threshold) return scoring.ok_points;
    return scoring.bad_points;
  }

  function render() {
    updateKpis();
    if (!state.cfg) return;

    if (state.done) {
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <ul class="kw-result-list">
          <li>Verbale Wuensche muessen in konkrete Gewichte uebersetzt werden.</li>
          <li>Idealprofil treffen: kleine Abweichung = hohe Zufriedenheit.</li>
          <li>Denke in Prozentpunkten statt in Gefuehl.</li>
        </ul>
        <button type="button" class="kw-btn kw-btn--primary" id="kw-restart">Nochmal spielen</button>
      `;
      document.getElementById('kw-restart').addEventListener('click', restart);
      return;
    }

    const round = currentRound();
    const ideal = round.ideal;

    el.root.innerHTML = `
      <h2>${escapeHtml(round.id.toUpperCase())}: Kundenwunsch</h2>
      <p class="kw-quote">"${escapeHtml(round.quote)}"</p>

      <div class="kw-sliders">
        <div class="kw-slider">
          <label for="kw-price">Preis <strong>${state.weights.price}%</strong></label>
          <input id="kw-price" type="range" min="0" max="100" value="${state.weights.price}" ${state.answered ? 'disabled' : ''}>
        </div>
        <div class="kw-slider">
          <label for="kw-brand">Marke <strong>${state.weights.brand}%</strong></label>
          <input id="kw-brand" type="range" min="0" max="100" value="${state.weights.brand}" ${state.answered ? 'disabled' : ''}>
        </div>
        <div class="kw-slider kw-slider--readonly">
          <label>Qualitaet (Rest) <strong>${state.weights.quality}%</strong></label>
          <div class="kw-restbar">
            <div class="kw-restfill" style="width:${state.weights.quality}%"></div>
          </div>
        </div>
      </div>

      <div class="kw-compare">
        <div class="kw-profile">
          <h3>Dein Profil</h3>
          <ul>
            <li>Preis: <strong>${state.weights.price}%</strong></li>
            <li>Qualitaet: <strong>${state.weights.quality}%</strong></li>
            <li>Marke: <strong>${state.weights.brand}%</strong></li>
          </ul>
        </div>
        <div class="kw-profile">
          <h3>Idealprofil</h3>
          <ul>
            <li>Preis: <strong>${ideal.price}%</strong></li>
            <li>Qualitaet: <strong>${ideal.quality}%</strong></li>
            <li>Marke: <strong>${ideal.brand}%</strong></li>
          </ul>
        </div>
      </div>

      <div id="kw-feedback" class="kw-feedback hidden"></div>
      <div class="kw-actions">
        <button type="button" id="kw-check" class="kw-btn kw-btn--primary" ${state.answered ? 'disabled' : ''}>Pruefen</button>
        <button type="button" id="kw-next" class="kw-btn hidden">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechster Fall'}</button>
      </div>
      <p class="kw-hint">Hinweis: Qualitaet wird automatisch als Rest berechnet (100 - Preis - Marke).</p>
    `;

    document.getElementById('kw-price').addEventListener('input', (e) => setWeight('price', e.target.value));
    document.getElementById('kw-brand').addEventListener('input', (e) => setWeight('brand', e.target.value));
    document.getElementById('kw-check').addEventListener('click', checkRound);
    document.getElementById('kw-next').addEventListener('click', nextRound);
  }

  function checkRound() {
    if (state.answered || state.done) return;
    const round = currentRound();

    recomputeQuality();
    const dev = deviationFromIdeal(round.ideal);
    const award = awardPoints(dev);

    state.answered = true;
    state.lastDeviation = dev;
    state.lastAward = award;
    state.score += award;

    render();
    updateKpis();

    const fb = document.getElementById('kw-feedback');
    const msg =
      award === state.cfg.scoring.good_points
        ? `Sehr gut. Abweichung ${dev.toFixed(1)} -> ${award} Punkte.`
        : award === state.cfg.scoring.ok_points
          ? `Ok. Abweichung ${dev.toFixed(1)} -> ${award} Punkte.`
          : `Zu weit weg. Abweichung ${dev.toFixed(1)} -> ${award} Punkte.`;

    fb.className = `kw-feedback ${award === 100 ? 'ok' : award === 80 ? 'mid' : 'bad'}`;
    fb.textContent = msg;
    fb.classList.remove('hidden');
    document.getElementById('kw-next').classList.remove('hidden');
  }

  function nextRound() {
    if (!state.answered) return;
    if (state.idx >= state.cfg.rounds.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.idx += 1;
    state.answered = false;
    state.lastDeviation = null;
    state.lastAward = 0;
    // Reset weights to a neutral baseline each round.
    state.weights.price = 40;
    state.weights.brand = 20;
    recomputeQuality();
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.answered = false;
    state.done = false;
    state.lastDeviation = null;
    state.lastAward = 0;
    state.weights.price = 40;
    state.weights.brand = 20;
    recomputeQuality();
    render();
  }

  function updateKpis() {
    const total = state.cfg?.rounds.length || 0;
    el.round.textContent = `${state.done ? total : state.idx + 1}/${total}`;
    el.score.textContent = String(state.score);
    el.dev.textContent = state.lastDeviation === null ? '-' : state.lastDeviation.toFixed(1);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  window.render_game_to_text = function renderGameToText() {
    const round = state.cfg && !state.done ? currentRound() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : (state.answered ? 'checked' : 'editing'),
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      weights: { ...state.weights },
      ideal: round ? { ...round.ideal } : null,
      deviation: state.lastDeviation,
      awarded: state.lastAward
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();

