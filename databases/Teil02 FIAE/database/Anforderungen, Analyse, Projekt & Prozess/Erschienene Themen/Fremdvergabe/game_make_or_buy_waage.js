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
    logs: [],
    pointerStartX: null,
    pointerCurrentX: 0
  };

  const el = {
    kpiStability: document.getElementById('kpi-stability'),
    kpiBudget: document.getElementById('kpi-budget'),
    kpiTtm: document.getElementById('kpi-ttm'),
    kpiScore: document.getElementById('kpi-score'),
    kpiProgress: document.getElementById('kpi-progress'),
    kpiLevel: document.getElementById('kpi-level'),
    scaleBeam: document.getElementById('scale-beam'),
    makeLoad: document.getElementById('make-load'),
    buyLoad: document.getElementById('buy-load'),
    panMake: document.getElementById('pan-make'),
    panBuy: document.getElementById('pan-buy'),
    scaleHint: document.getElementById('scale-hint'),
    factorCard: document.getElementById('factor-card'),
    factorCategory: document.getElementById('factor-category'),
    factorTitle: document.getElementById('factor-title'),
    factorText: document.getElementById('factor-text'),
    factorWeight: document.getElementById('factor-weight'),
    exitStrategy: document.getElementById('exit-strategy'),
    startBtn: document.getElementById('start-btn'),
    nextBtn: document.getElementById('next-btn'),
    restartBtn: document.getElementById('restart-btn'),
    feedback: document.getElementById('feedback'),
    tickerList: document.getElementById('ticker-list')
  };

  init();

  async function init() {
    const res = await fetch('./game_make_or_buy_waage.json');
    if (!res.ok) {
      el.feedback.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await res.json();
    resetState();
    bindEvents();
    render();
    pushLog('Decision Lab bereit. Starte die Simulation.', 'ok');
    renderLogs();
  }

  function bindEvents() {
    el.startBtn.addEventListener('click', startGame);
    el.nextBtn.addEventListener('click', nextFactor);
    el.restartBtn.addEventListener('click', restartGame);
    el.panMake.addEventListener('click', () => placeFactor('make'));
    el.panBuy.addEventListener('click', () => placeFactor('buy'));

    el.exitStrategy.addEventListener('change', () => {
      state.exitStrategy = el.exitStrategy.checked;
      pushLog(state.exitStrategy ? 'Exit-Strategie aktiv.' : 'Exit-Strategie deaktiviert.', 'ok');
      renderLogs();
    });

    el.factorCard.addEventListener('pointerdown', onPointerDown);
    el.factorCard.addEventListener('pointermove', onPointerMove);
    el.factorCard.addEventListener('pointerup', onPointerUp);
    el.factorCard.addEventListener('pointercancel', onPointerUp);

    window.addEventListener('keydown', (event) => {
      if (!state.started || state.done || state.gameOver) return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') placeFactor('make');
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') placeFactor('buy');
      if (event.key === ' ' || event.key === 'Enter') nextFactor();
    });
  }

  function resetState() {
    state.started = false;
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
    state.logs = [];
    el.exitStrategy.checked = false;
  }

  function startGame() {
    if (state.started) return;
    state.started = true;
    state.lock = false;
    el.startBtn.classList.add('hidden');
    el.nextBtn.classList.add('hidden');
    el.restartBtn.classList.add('hidden');
    setFeedback('Platziere das Faktor-Gewicht auf MAKE oder BUY.', null);
    render();
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
      pushLog('Strategic Shift: Konkurrent bringt Feature X. Zeitdruck steigt.', 'bad');
      state.ttmDays = Math.max(0, state.ttmDays - 8);
    }

    const correct = side === factor.recommended;
    const weight = factor.weight;

    if (side === 'make') state.makeLoad += weight;
    else state.buyLoad += weight;

    const budgetCost = side === 'make' ? factor.budget_make : factor.budget_buy;
    const timeCostBase = side === 'make' ? factor.time_make : factor.time_buy;
    const pressure = state.shiftActivated ? (side === 'make' ? 1.25 : 0.9) : 1;
    const timeCost = Math.round(timeCostBase * pressure);

    state.budget = Math.max(0, state.budget - budgetCost);
    state.ttmDays = Math.max(0, state.ttmDays - timeCost);

    let deltaScore = correct ? 140 : 30;
    let details = '';

    if (!correct) {
      state.mistakes += 1;
      details += ' Fehlgewichtung.';
    }

    if (correct && factor.core_comp && side === 'make') {
      deltaScore += 120;
      details += ' Core-Competence Protection +120.';
    }

    if (side === 'buy' && factor.vendor_lock_in && !state.exitStrategy) {
      deltaScore -= 90;
      state.stability = Math.max(0, state.stability - 10);
      details += ' Vendor Lock-in ohne Exit-Strategie: -90.';
    }

    state.score = Math.max(0, state.score + deltaScore);

    const balancePenalty = Math.abs(state.makeLoad - state.buyLoad) * 2.2;
    const errorPenalty = state.mistakes * 6.5;
    const recovery = correct ? 3 : 0;
    state.stability = clamp(100 - balancePenalty - errorPenalty + recovery, 0, 100);

    if (correct) {
      setFeedback(`Korrekt zugeordnet (${side.toUpperCase()}).${details}`, true);
      pushLog(`${factor.title}: korrekt -> ${side.toUpperCase()} (${deltaScore >= 0 ? '+' : ''}${deltaScore}).${details}`, 'ok');
    } else {
      setFeedback(`Nicht optimal. Erwartet: ${factor.recommended.toUpperCase()}.${details}`, false);
      pushLog(`${factor.title}: falsch -> ${side.toUpperCase()} (${deltaScore >= 0 ? '+' : ''}${deltaScore}).${details}`, 'bad');
    }

    const diff = Math.abs(state.makeLoad - state.buyLoad);
    el.panMake.classList.toggle('cracked', diff > 17 && state.makeLoad > state.buyLoad);
    el.panBuy.classList.toggle('cracked', diff > 17 && state.buyLoad > state.makeLoad);

    if (state.budget <= 0 || state.ttmDays <= 0 || state.stability <= 0) {
      state.gameOver = true;
      state.done = true;
      el.nextBtn.classList.add('hidden');
      el.restartBtn.classList.remove('hidden');
      setFeedback('Breaking Point erreicht. Projektbalance kollabiert.', false);
      pushLog('Simulation beendet: kritischer KPI unterschritten.', 'bad');
      state.lock = true;
    } else {
      el.nextBtn.classList.remove('hidden');
    }

    render();
    renderLogs();
  }

  function nextFactor() {
    if (!state.started || state.gameOver || state.done) return;
    state.idx += 1;

    if (state.idx >= state.cfg.factors.length) {
      state.done = true;
      state.lock = true;
      el.nextBtn.classList.add('hidden');
      el.restartBtn.classList.remove('hidden');
      setFeedback(`Run abgeschlossen. Finale Stabilitaet ${Math.round(state.stability)}%.`, true);
      pushLog(`Abschlussscore: ${state.score}.`, 'ok');
      render();
      renderLogs();
      return;
    }

    state.lock = false;
    el.nextBtn.classList.add('hidden');
    setFeedback('Naechstes Gewicht: entscheide MAKE oder BUY.', null);
    render();
  }

  function restartGame() {
    resetState();
    el.startBtn.classList.remove('hidden');
    el.nextBtn.classList.add('hidden');
    el.restartBtn.classList.add('hidden');
    setFeedback('Neuer Run bereit.', null);
    pushLog('Simulation zurueckgesetzt.', 'ok');
    render();
    renderLogs();
  }

  function render() {
    const factor = currentFactor();
    const total = state.cfg.factors.length;
    const level = factor ? factor.level : 3;

    el.kpiStability.textContent = `${Math.round(state.stability)}%`;
    el.kpiBudget.textContent = euro(state.budget);
    el.kpiTtm.textContent = `${Math.round(state.ttmDays)} Tage`;
    el.kpiScore.textContent = String(state.score);
    el.kpiProgress.textContent = `${Math.min(total, state.idx + (state.done ? 0 : 1))}/${total}`;
    el.kpiLevel.textContent = levelLabel(level);

    el.makeLoad.textContent = `${state.makeLoad} kg`;
    el.buyLoad.textContent = `${state.buyLoad} kg`;

    const angle = clamp((state.buyLoad - state.makeLoad) * 0.8, -14, 14);
    el.scaleBeam.style.transform = `rotate(${angle}deg)`;
    el.scaleHint.textContent = state.done
      ? 'Run abgeschlossen.'
      : (state.lock ? 'Faktor abgelegt. Weiter mit Naechster Faktor.' : 'Waage aktiv. Faktor platzieren.');

    if (!factor || state.done) {
      el.factorCategory.textContent = 'SIMULATION';
      el.factorTitle.textContent = state.gameOver ? 'Breaking Point' : 'Analyse abgeschlossen';
      el.factorText.textContent = state.gameOver
        ? 'Mindestens eine Leitmetrik ist unter die Grenze gefallen.'
        : 'Du hast alle 20 Faktoren gewichtet.';
      el.factorWeight.textContent = 'Gewicht: -';
      el.factorCard.classList.remove('draggable', 'dragging');
      return;
    }

    el.factorCategory.textContent = `${factor.category.toUpperCase()} | L${factor.level}`;
    el.factorTitle.textContent = factor.title;
    el.factorText.textContent = factor.text;
    el.factorWeight.textContent = `Gewicht: ${factor.weight} kg`;
    el.factorCard.classList.toggle('draggable', state.started && !state.lock);
  }

  function setFeedback(text, ok) {
    let tone = 'neutral';
    if (ok === true) tone = 'ok';
    if (ok === false) tone = 'bad';
    el.feedback.className = `feedback ${tone}`;
    el.feedback.textContent = text;
  }

  function pushLog(text, tone) {
    state.logs.unshift({ text, tone });
    if (state.logs.length > 10) state.logs.pop();
  }

  function renderLogs() {
    el.tickerList.innerHTML = state.logs.map((entry) => `<li><strong>${entry.tone.toUpperCase()}</strong> ${entry.text}</li>`).join('');
  }

  function euro(v) {
    return `${Math.round(v).toLocaleString('de-DE')} EUR`;
  }

  function levelLabel(level) {
    if (level === 1) return '1 (Klar)';
    if (level === 2) return '2 (Budget)';
    return '3 (Shift)';
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
      mode: state.done ? (state.gameOver ? 'game_over' : 'result') : (state.lock ? 'evaluated' : 'active'),
      coordinate_system: 'origin top-left, x right, y down',
      started: state.started,
      done: state.done,
      game_over: state.gameOver,
      progress_index: state.idx,
      total_factors: state.cfg ? state.cfg.factors.length : 0,
      level: factor ? factor.level : null,
      score: state.score,
      decision_stability_percent: Math.round(state.stability),
      remaining_budget: Math.round(state.budget),
      time_to_market_days: Math.round(state.ttmDays),
      make_load: state.makeLoad,
      buy_load: state.buyLoad,
      balance_diff: Math.abs(state.makeLoad - state.buyLoad),
      exit_strategy: state.exitStrategy,
      shift_activated: state.shiftActivated,
      current_factor: factor ? {
        id: factor.id,
        category: factor.category,
        title: factor.title,
        weight: factor.weight,
        recommended: factor.recommended,
        core_comp: factor.core_comp,
        vendor_lock_in: factor.vendor_lock_in
      } : null,
      recent_logs: state.logs.slice(0, 4)
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0 || !state.started || state.done) return true;
    const passiveDrain = ms / 12000;
    state.stability = clamp(state.stability - passiveDrain, 0, 100);
    if (state.stability <= 0 && !state.gameOver) {
      state.gameOver = true;
      state.done = true;
      setFeedback('Simulation gestoppt: Stabilitaet auf 0%.', false);
      pushLog('Passiver Verfall hat Stabilitaet gebrochen.', 'bad');
      el.nextBtn.classList.add('hidden');
      el.restartBtn.classList.remove('hidden');
      renderLogs();
    }
    render();
    return true;
  };
})();
