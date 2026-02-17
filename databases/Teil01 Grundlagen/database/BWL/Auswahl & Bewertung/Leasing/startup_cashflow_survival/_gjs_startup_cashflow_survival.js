(function () {
  'use strict';

  const state = {
    cfg: null,
    month: 0,
    cash: 0,
    mode: 'loading',
    decision: null,
    history: []
  };

  const el = {
    statMonth: document.getElementById('stat-month'),
    statCash: document.getElementById('stat-cash'),
    statMode: document.getElementById('stat-mode'),
    needText: document.getElementById('need-text'),
    decisionActions: document.getElementById('decision-actions'),
    simulationActions: document.getElementById('simulation-actions'),
    chooseBuy: document.getElementById('choose-buy'),
    chooseLease: document.getElementById('choose-lease'),
    nextMonth: document.getElementById('next-month'),
    runToEnd: document.getElementById('run-to-end'),
    restart: document.getElementById('restart'),
    feedback: document.getElementById('feedback'),
    result: document.getElementById('result')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('data/_gg01_startup_cashflow_survival.json');
      if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await resp.json();
      bind();
      resetGame();
    } catch (err) {
      showFeedback('bad', err.message || 'Unbekannter Fehler');
      state.mode = 'error';
      render();
    }
  }

  function bind() {
    el.chooseBuy.addEventListener('click', () => choose('buy'));
    el.chooseLease.addEventListener('click', () => choose('lease'));
    el.nextMonth.addEventListener('click', stepMonth);
    el.runToEnd.addEventListener('click', runToEnd);
    el.restart.addEventListener('click', resetGame);
  }

  function resetGame() {
    const eco = state.cfg.economy;
    state.month = 0;
    state.cash = eco.start_cash_eur;
    state.mode = 'decision';
    state.decision = null;
    state.history = [];
    showFeedback('', 'Triff zuerst die Finanzierungsentscheidung.');
    render();
  }

  function choose(type) {
    if (state.mode !== 'decision') return;

    state.decision = type;
    const d = state.cfg.decision;

    if (type === 'buy') {
      state.cash -= d.buy.upfront_cost_eur;
      state.history.push(`Monat 0: Kauf -${fmtEur(d.buy.upfront_cost_eur)}`);
      if (state.cash < 0) {
        state.mode = 'lose';
        showFeedback('bad', 'Sofort pleite: Kauf war fuer den Start zu teuer.');
        render();
        return;
      }
    } else {
      state.history.push('Monat 0: Leasing gewaehlt');
    }

    state.mode = 'running';
    showFeedback('ok', type === 'lease'
      ? 'Leasing gewaehlt. Simuliere jetzt die Monate.'
      : 'Kauf gewaehlt. Simuliere die restlichen Monate.');
    render();
  }

  function stepMonth() {
    if (state.mode !== 'running') return;

    const eco = state.cfg.economy;
    const d = state.cfg.decision;

    if (state.month >= eco.term_months) return;

    state.month += 1;
    state.cash += eco.monthly_income_eur;

    if (state.decision === 'lease') {
      state.cash -= d.lease.monthly_cost_eur;
      state.history.push(`Monat ${state.month}: +${fmtEur(eco.monthly_income_eur)} -${fmtEur(d.lease.monthly_cost_eur)}`);
    } else {
      state.history.push(`Monat ${state.month}: +${fmtEur(eco.monthly_income_eur)}`);
    }

    if (state.cash < 0) {
      state.mode = 'lose';
      showFeedback('bad', 'Pleite waehrend der Laufzeit.');
      render();
      return;
    }

    if (state.month >= eco.term_months) {
      state.mode = state.cash >= state.cfg.win_condition.min_cash_eur ? 'win' : 'lose';
      showFeedback(state.mode === 'win' ? 'ok' : 'bad',
        state.mode === 'win'
          ? `Geschafft. End-Cash: ${fmtEur(state.cash)}`
          : `Nicht geschafft. End-Cash: ${fmtEur(state.cash)}`
      );
    }

    render();
  }

  function runToEnd() {
    if (state.mode !== 'running') return;
    while (state.mode === 'running') {
      stepMonth();
    }
  }

  function render() {
    const maxMonths = state.cfg ? state.cfg.economy.term_months : 12;
    el.statMonth.textContent = `Monat: ${state.month}/${maxMonths}`;
    el.statCash.textContent = `Cash: ${fmtEur(state.cash)}`;
    el.statMode.textContent = `Modus: ${modeLabel(state.mode)}`;

    const inDecision = state.mode === 'decision';
    el.decisionActions.classList.toggle('hidden', !inDecision);
    el.simulationActions.classList.toggle('hidden', inDecision);

    if (state.mode === 'win' || state.mode === 'lose') {
      el.result.classList.remove('hidden');
      el.result.innerHTML = `
        <h2>${state.mode === 'win' ? 'Erfolgreich' : 'Game Over'}</h2>
        <p>Endstand nach ${state.month} Monaten: <strong>${fmtEur(state.cash)}</strong></p>
        <p>Entscheidung: <strong>${state.decision === 'lease' ? 'Leasen' : 'Kaufen'}</strong></p>
      `;
    } else {
      el.result.classList.add('hidden');
      el.result.innerHTML = '';
    }
  }

  function showFeedback(type, text) {
    el.feedback.className = `sortier-feedback ${type}`.trim();
    el.feedback.textContent = text;
  }

  function modeLabel(mode) {
    switch (mode) {
      case 'decision': return 'Entscheidung';
      case 'running': return 'Simulation';
      case 'win': return 'Gewonnen';
      case 'lose': return 'Verloren';
      case 'error': return 'Fehler';
      default: return 'Laden';
    }
  }

  function fmtEur(value) {
    return `${Number(value).toLocaleString('de-DE')} EUR`;
  }

  window.render_game_to_text = function renderGameToText() {
    return JSON.stringify({
      mode: state.mode,
      coordinate_system: 'origin top-left, x right, y down',
      month: state.month,
      max_months: state.cfg ? state.cfg.economy.term_months : 12,
      cash_eur: state.cash,
      decision: state.decision,
      history_tail: state.history.slice(-3)
    });
  };

  window.advanceTime = function advanceTime(ms) {
    if (ms >= 500 && state.mode === 'running') {
      stepMonth();
    }
    return Promise.resolve();
  };
})();
