(function () {
  'use strict';

  const state = {
    cfg: null,
    triesLeft: 2,
    selectedOffer: null,
    score: 0,
    done: false,
    history: []
  };

  const el = {
    tries: document.getElementById('wg-kpi-tries'),
    threshold: document.getElementById('wg-kpi-threshold'),
    score: document.getElementById('wg-kpi-score'),
    weight: document.getElementById('wg-weight'),
    offers: document.getElementById('wg-offers'),
    feedback: document.getElementById('wg-feedback'),
    restart: document.getElementById('wg-restart')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('./_gg01_wg_zimmer_challenge.json');
      if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await resp.json();
      wire();
      restartGame();
    } catch (_error) {
      el.feedback.textContent = 'Konfiguration konnte nicht geladen werden.';
      el.feedback.className = 'wg-feedback bad';
    }
  }

  function wire() {
    el.restart.addEventListener('click', restartGame);
  }

  function restartGame() {
    state.triesLeft = 2;
    state.selectedOffer = null;
    state.score = 0;
    state.done = false;
    state.history = [];

    renderWeight();
    renderOffers();
    setFeedback('neutral', 'Waehle ein Angebot aus und pruefe deinen Treffer.');
    updateKpis();
  }

  function renderWeight() {
    if (!state.cfg) return;
    el.threshold.textContent = `${state.cfg.target_threshold}+`;
    el.weight.textContent = `Preis ${state.cfg.weights.price}% | Groesse ${state.cfg.weights.size}%`;
  }

  function renderOffers() {
    if (!state.cfg) return;
    el.offers.innerHTML = state.cfg.offers.map((offer) => {
      const points = calcPoints(offer);
      const classes = ['wg-offer'];
      if (state.selectedOffer === offer.id) classes.push('is-selected');
      if (state.done && offer.id === state.cfg.correct_offer) classes.push('is-correct');
      if (state.done && state.selectedOffer === offer.id && offer.id !== state.cfg.correct_offer) classes.push('is-wrong');

      return `
        <button type="button" class="${classes.join(' ')}" data-offer="${escapeHtml(offer.id)}" ${state.done ? 'disabled' : ''}>
          <strong>${escapeHtml(offer.label)}</strong>
          <span>Miete: ${offer.rent_eur} EUR | Groesse: ${offer.size_qm} qm</span>
          <span>Preis-Score: ${offer.price_score} | Groessen-Score: ${offer.size_score}</span>
          <span>Nutzwert: ${points}</span>
        </button>
      `;
    }).join('');

    el.offers.querySelectorAll('[data-offer]').forEach((button) => {
      button.addEventListener('click', () => selectOffer(button.dataset.offer));
    });
  }

  function calcPoints(offer) {
    return (offer.price_score * state.cfg.weights.price) + (offer.size_score * state.cfg.weights.size);
  }

  function selectOffer(offerId) {
    if (state.done) return;
    const offer = state.cfg.offers.find((item) => item.id === offerId);
    if (!offer) return;

    state.selectedOffer = offerId;
    const isCorrect = offerId === state.cfg.correct_offer;
    state.history.push({ offerId, isCorrect, points: calcPoints(offer) });

    if (isCorrect) {
      state.done = true;
      state.score = state.triesLeft === 2 ? state.cfg.scoring.first_try : state.cfg.scoring.second_try;
      setFeedback('ok', `Richtig. ${offer.label} erreicht ${calcPoints(offer)} Punkte und liegt ueber der Zielschwelle.`);
    } else {
      state.triesLeft -= 1;
      if (state.triesLeft <= 0) {
        state.done = true;
        state.score = state.cfg.scoring.failed;
        const correctOffer = state.cfg.offers.find((item) => item.id === state.cfg.correct_offer);
        setFeedback('bad', `Leider nicht. Das richtige Angebot war ${correctOffer.label} mit ${calcPoints(correctOffer)} Punkten.`);
      } else {
        setFeedback('bad', `Nicht korrekt. Du hast noch ${state.triesLeft} Versuch.`);
      }
    }

    renderOffers();
    updateKpis();
  }

  function setFeedback(type, text) {
    el.feedback.className = `wg-feedback ${type}`;
    el.feedback.textContent = text;
  }

  function updateKpis() {
    el.tries.textContent = String(state.triesLeft);
    el.score.textContent = String(state.score);
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
    return JSON.stringify({
      mode: state.done ? 'result' : 'selection',
      coordinate_system: 'origin top-left, x right, y down',
      tries_left: state.triesLeft,
      score: state.score,
      selected_offer: state.selectedOffer,
      correct_offer: state.cfg?.correct_offer || null,
      history: state.history
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
