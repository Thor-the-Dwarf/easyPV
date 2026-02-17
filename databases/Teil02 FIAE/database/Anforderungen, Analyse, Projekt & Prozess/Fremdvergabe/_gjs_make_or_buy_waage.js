(function () {
  'use strict';

  const state = {
    cfg: null,
    started: false,
    done: false,
    gameOver: false,
    idx: 0,
    score: 0,
    stability: 100,
    budget: 0,
    ttmDays: 0,
    makeLoad: 0,
    buyLoad: 0,
    mistakes: 0,
    exitStrategy: false,
    shiftActivated: false,
    lock: false,
    holdChoice: null,
    pointerStartX: null,
    pointerCurrentX: 0
  };

  const el = {
    kpiStability: document.getElementById('kpi-stability'),
    kpiBudget: document.getElementById('kpi-budget'),
    kpiTtm: document.getElementById('kpi-ttm'),
    kpiScore: document.getElementById('kpi-score'),
    kpiProgress: document.getElementById('kpi-progress'),
    scaleBeam: document.getElementById('scale-beam'),
    makeLoad: document.getElementById('make-load'),
    buyLoad: document.getElementById('buy-load'),
    panMake: document.getElementById('pan-make'),
    panBuy: document.getElementById('pan-buy'),
    factorCard: document.getElementById('factor-card'),
    factorCategory: document.getElementById('factor-category'),
    factorTitle: document.getElementById('factor-title'),
    factorText: document.getElementById('factor-text'),
    factorWeight: document.getElementById('factor-weight'),
    restartBtn: document.getElementById('restart-btn'),
    feedback: document.getElementById('feedback')
  };

  init();

  async function init() {
    const res = await fetch('data/_gg01_make_or_buy_waage.json');
    if (!res.ok) {
      el.feedback.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await res.json();
    bindEvents();
    resetState();
    render();
  }

  function bindEvents() {
    el.restartBtn.addEventListener('click', restartGame);
    el.panMake.addEventListener('pointerdown', (event) => onPanPointerDown(event, 'make'));
    el.panBuy.addEventListener('pointerdown', (event) => onPanPointerDown(event, 'buy'));
    el.panMake.addEventListener('pointerup', onPanPointerUp);
    el.panBuy.addEventListener('pointerup', onPanPointerUp);
    el.panMake.addEventListener('pointerleave', clearHoldFeedback);
    el.panBuy.addEventListener('pointerleave', clearHoldFeedback);
    el.panMake.addEventListener('pointercancel', onPanPointerCancel);
    el.panBuy.addEventListener('pointercancel', onPanPointerCancel);

    el.factorCard.addEventListener('pointerdown', onPointerDown);
    el.factorCard.addEventListener('pointermove', onPointerMove);
    el.factorCard.addEventListener('pointerup', onPointerUp);
    el.factorCard.addEventListener('pointercancel', onPointerUp);

    window.addEventListener('keydown', (event) => {
      if (!state.started || state.done || state.gameOver) return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') placeFactor('make');
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') placeFactor('buy');
    });
  }

  function resetState() {
    state.started = true;
    state.done = false;
    state.gameOver = false;
    state.idx = 0;
    state.score = 0;
    state.stability = 100;
    state.budget = state.cfg.start_budget;
    state.ttmDays = state.cfg.start_ttm_days;
    state.makeLoad = 0;
    state.buyLoad = 0;
    state.mistakes = 0;
    state.exitStrategy = false;
    state.shiftActivated = false;
    state.lock = false;
    state.holdChoice = null;
    el.restartBtn.classList.add('hidden');
    clearFeedback();
  }

  function currentFactor() {
    return state.cfg.factors[state.idx] || null;
  }

  function placeFactor(side) {
    if (!state.started || state.done || state.gameOver || state.lock) return;

    const factor = currentFactor();
    if (!factor) return;

    state.lock = true;

    if (factor.level === 3 && !state.shiftActivated) {
      state.shiftActivated = true;
      state.ttmDays = Math.max(0, state.ttmDays - 8);
    }

    const correct = side === factor.recommended;

    if (side === 'make') state.makeLoad += factor.weight;
    else state.buyLoad += factor.weight;

    const budgetCost = side === 'make' ? factor.budget_make : factor.budget_buy;
    const timeCostBase = side === 'make' ? factor.time_make : factor.time_buy;
    const pressure = state.shiftActivated ? (side === 'make' ? 1.25 : 0.9) : 1;

    state.budget = Math.max(0, state.budget - budgetCost);
    state.ttmDays = Math.max(0, state.ttmDays - Math.round(timeCostBase * pressure));

    let deltaScore = correct ? 140 : 30;

    if (!correct) {
      state.mistakes += 1;
    }

    if (correct && factor.core_comp && side === 'make') {
      deltaScore += 120;
    }

    if (side === 'buy' && factor.vendor_lock_in && !state.exitStrategy) {
      deltaScore -= 90;
      state.stability = Math.max(0, state.stability - 10);
    }

    state.score = Math.max(0, state.score + deltaScore);

    const balancePenalty = Math.abs(state.makeLoad - state.buyLoad) * 2.2;
    const errorPenalty = state.mistakes * 6.5;
    state.stability = clamp(100 - balancePenalty - errorPenalty + (correct ? 3 : 0), 0, 100);

    render();

    if (state.budget <= 0 || state.ttmDays <= 0 || state.stability <= 0) {
      state.done = true;
      state.gameOver = true;
      el.restartBtn.classList.remove('hidden');
      setFeedback('Game Over: KPI-Grenze unterschritten.', false);
      return;
    }
    nextFactor();
  }

  function nextFactor() {
    if (state.done || state.gameOver) return;
    state.idx += 1;

    if (state.idx >= state.cfg.factors.length) {
      state.done = true;
      state.lock = true;
      el.restartBtn.classList.remove('hidden');
      setFeedback(`Fertig. Score ${state.score}, Stability ${Math.round(state.stability)}%.`, true);
      render();
      return;
    }

    state.lock = false;
    clearFeedback();
    render();
  }

  function restartGame() {
    resetState();
    render();
  }

  function render() {
    const factor = currentFactor();
    const total = state.cfg.factors.length;

    el.kpiStability.textContent = `${Math.round(state.stability)}%`;
    el.kpiBudget.textContent = euro(state.budget);
    el.kpiTtm.textContent = `${Math.round(state.ttmDays)} Tage`;
    el.kpiScore.textContent = String(state.score);
    el.kpiProgress.textContent = `${Math.min(total, state.idx + (state.done ? 0 : 1))}/${total}`;

    el.makeLoad.textContent = String(state.makeLoad);
    el.buyLoad.textContent = String(state.buyLoad);

    const angle = clamp((state.buyLoad - state.makeLoad) * 0.8, -14, 14);
    el.scaleBeam.style.transform = `rotate(${angle}deg)`;

    if (!factor || state.done) {
      el.factorCategory.textContent = 'SIMULATION';
      el.factorTitle.textContent = state.gameOver ? 'Projekt kippt' : 'Analyse abgeschlossen';
      el.factorText.textContent = state.gameOver
        ? 'Mindestens eine Leitmetrik ist auf kritischem Niveau.'
        : 'Alle Faktoren wurden gewichtet.';
      el.factorWeight.textContent = 'Gewicht: -';
      el.factorCard.classList.remove('draggable', 'dragging');
      return;
    }

    el.factorCategory.textContent = `${factor.category.toUpperCase()} | L${factor.level}`;
    el.factorTitle.textContent = factor.title;
    el.factorText.textContent = factor.text;
    el.factorWeight.textContent = `Gewicht: ${factor.weight}`;
    el.factorCard.classList.toggle('draggable', state.started && !state.lock);
  }

  function setFeedback(text, ok) {
    let tone = 'neutral';
    if (ok === true) tone = 'ok';
    if (ok === false) tone = 'bad';
    el.feedback.className = `feedback ${tone}`;
    el.feedback.textContent = text;
  }

  function clearFeedback() {
    el.feedback.className = 'feedback';
    el.feedback.textContent = '';
  }

  function showHoldFeedback(side) {
    if (!state.started || state.done || state.gameOver || state.lock) return;
    const factor = currentFactor();
    if (!factor) return;

    const wouldBeCorrect = side === factor.recommended;
    const label = side.toUpperCase();
    setFeedback(
      wouldBeCorrect
        ? `${label} ist voraussichtlich passend.`
        : `${label} ist voraussichtlich riskant.`,
      wouldBeCorrect
    );
  }

  function clearHoldFeedback() {
    if (!state.started || state.done || state.gameOver || state.lock) return;
    clearFeedback();
  }

  function onPanPointerDown(event, side) {
    if (!state.started || state.done || state.gameOver || state.lock) return;
    state.holdChoice = side;
    event.currentTarget.setPointerCapture(event.pointerId);
    showHoldFeedback(side);
  }

  function onPanPointerUp(event) {
    if (!state.started || state.done || state.gameOver || state.lock) return;
    const side = state.holdChoice;
    state.holdChoice = null;
    clearHoldFeedback();
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!side) return;
    placeFactor(side);
  }

  function onPanPointerCancel(event) {
    state.holdChoice = null;
    clearHoldFeedback();
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function euro(v) {
    return `${Math.round(v).toLocaleString('de-DE')} EUR`;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function onPointerDown(event) {
    if (!state.started || state.lock || state.done || state.gameOver) return;
    state.pointerStartX = event.clientX;
    state.pointerCurrentX = event.clientX;
    el.factorCard.classList.add('dragging');
    el.factorCard.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (state.pointerStartX == null) return;
    state.pointerCurrentX = event.clientX;
    const delta = clamp(state.pointerCurrentX - state.pointerStartX, -120, 120);
    el.factorCard.style.transform = `translateX(${delta}px)`;
  }

  function onPointerUp(event) {
    if (state.pointerStartX == null) return;

    const delta = state.pointerCurrentX - state.pointerStartX;
    state.pointerStartX = null;
    state.pointerCurrentX = 0;

    el.factorCard.style.transform = 'translateX(0px)';
    el.factorCard.classList.remove('dragging');
    el.factorCard.releasePointerCapture(event.pointerId);

    if (Math.abs(delta) < 56) return;
    placeFactor(delta < 0 ? 'make' : 'buy');
  }

  function renderGameToText() {
    const factor = currentFactor();
    return JSON.stringify({
      mode: state.done ? (state.gameOver ? 'game_over' : 'result') : (state.lock ? 'feedback_wait' : 'active'),
      coordinate_system: 'origin top-left, x right, y down',
      started: state.started,
      done: state.done,
      game_over: state.gameOver,
      progress_index: state.idx,
      total_factors: state.cfg ? state.cfg.factors.length : 0,
      score: state.score,
      decision_stability_percent: Math.round(state.stability),
      remaining_budget: Math.round(state.budget),
      time_to_market_days: Math.round(state.ttmDays),
      make_load: state.makeLoad,
      buy_load: state.buyLoad,
      exit_strategy: state.exitStrategy,
      shift_activated: state.shiftActivated,
      hold_choice: state.holdChoice,
      current_factor: factor ? {
        id: factor.id,
        category: factor.category,
        title: factor.title,
        weight: factor.weight,
        recommended: factor.recommended
      } : null
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0 || !state.started || state.done) return true;

    const passiveDrain = ms / 12000;
    state.stability = clamp(state.stability - passiveDrain, 0, 100);
    if (state.stability <= 0 && !state.gameOver) {
      state.done = true;
      state.gameOver = true;
      el.restartBtn.classList.remove('hidden');
      setFeedback('Game Over: Stabilitaet auf 0%.', false);
    }

    render();
    return true;
  };
})();
