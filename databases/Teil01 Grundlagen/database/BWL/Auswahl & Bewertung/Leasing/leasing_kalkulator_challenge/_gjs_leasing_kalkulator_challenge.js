(function () {
  'use strict';

  const state = {
    cfg: null,
    termMonths: 24,
    downPaymentEur: 1000,
    kmPerYear: 15000,
    monthlyRate: 0
  };

  const el = {
    targetRate: document.getElementById('target-rate'),
    targetDown: document.getElementById('target-down'),
    termRange: document.getElementById('term-range'),
    termInput: document.getElementById('term-input'),
    downRange: document.getElementById('down-range'),
    downInput: document.getElementById('down-input'),
    kmRange: document.getElementById('km-range'),
    kmInput: document.getElementById('km-input'),
    monthlyRate: document.getElementById('monthly-rate'),
    status: document.getElementById('kalk-status'),
    rateBar: document.getElementById('rate-bar'),
    downBar: document.getElementById('down-bar'),
    checkBtn: document.getElementById('check-btn')
  };

  init();

  async function init() {
    const resp = await fetch('_data/_gg01_leasing_kalkulator_challenge.json');
    if (!resp.ok) {
      el.status.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();

    const { limits, goal } = state.cfg;
    state.termMonths = limits.termMonths.default;
    state.downPaymentEur = limits.downPaymentEur.default;
    state.kmPerYear = limits.kmPerYear.default;

    el.targetRate.textContent = String(goal.targetRateEur);
    el.targetDown.textContent = String(goal.maxDownPaymentEur);

    bindRangeWithInput(el.termRange, el.termInput, limits.termMonths, 'termMonths');
    bindRangeWithInput(el.downRange, el.downInput, limits.downPaymentEur, 'downPaymentEur');
    bindRangeWithInput(el.kmRange, el.kmInput, limits.kmPerYear, 'kmPerYear');

    el.checkBtn.addEventListener('click', checkChallenge);

    recalc();
  }

  function bindRangeWithInput(rangeEl, inputEl, def, key) {
    rangeEl.min = String(def.min);
    rangeEl.max = String(def.max);
    rangeEl.step = String(def.step);

    inputEl.min = String(def.min);
    inputEl.max = String(def.max);
    inputEl.step = String(def.step);

    rangeEl.value = String(state[key]);
    inputEl.value = String(state[key]);

    rangeEl.addEventListener('input', () => {
      state[key] = Number(rangeEl.value);
      inputEl.value = String(state[key]);
      recalc();
    });

    inputEl.addEventListener('input', () => {
      const val = clamp(Number(inputEl.value || def.min), def.min, def.max);
      state[key] = snap(val, def.step, def.min);
      inputEl.value = String(state[key]);
      rangeEl.value = String(state[key]);
      recalc();
    });
  }

  function recalc() {
    const p = state.cfg.pricing;

    const termEffect = (state.termMonths - 24) * p.termPerMonthDiscount;
    const downEffect = (state.downPaymentEur / 100) * p.downPaymentPer100Discount;
    const kmEffect = ((state.kmPerYear - 15000) / 1000) * p.kmPer1000Surcharge;

    const rate = p.baseRate - termEffect - downEffect + kmEffect;
    state.monthlyRate = Math.max(p.minRate, Math.round(rate));

    el.monthlyRate.textContent = `${state.monthlyRate} EUR`;

    const goal = state.cfg.goal;
    const rateRatio = Math.min(1.4, state.monthlyRate / goal.targetRateEur);
    const downRatio = Math.min(1.4, state.downPaymentEur / goal.maxDownPaymentEur);

    el.rateBar.style.width = `${Math.round(Math.min(100, rateRatio * 100))}%`;
    el.downBar.style.width = `${Math.round(Math.min(100, downRatio * 100))}%`;

    el.rateBar.className = `fill ${state.monthlyRate <= goal.targetRateEur ? 'ok' : 'bad'}`;
    el.downBar.className = `fill ${state.downPaymentEur <= goal.maxDownPaymentEur ? 'ok' : 'bad'}`;

    if (state.downPaymentEur > goal.maxDownPaymentEur) {
      el.status.textContent = 'Budget ueberschritten: Anzahlung ist zu hoch.';
      el.status.className = 'kalk-status bad';
      return;
    }

    if (state.monthlyRate <= goal.targetRateEur) {
      el.status.textContent = 'Ziel in Reichweite. Jetzt pruefen!';
      el.status.className = 'kalk-status ok';
    } else {
      el.status.textContent = 'Rate ist noch zu hoch.';
      el.status.className = 'kalk-status';
    }
  }

  function checkChallenge() {
    el.checkBtn.disabled = true;
    el.checkBtn.textContent = 'Rechne...';

    setTimeout(() => {
      const goal = state.cfg.goal;
      const success = state.monthlyRate <= goal.targetRateEur && state.downPaymentEur <= goal.maxDownPaymentEur;
      const rateDiff = Math.round(((state.monthlyRate - goal.targetRateEur) / goal.targetRateEur) * 100);

      if (success) {
        el.status.textContent = 'Perfekt! Du hast die Challenge geloest.';
        el.status.className = 'kalk-status ok';
      } else if (state.downPaymentEur > goal.maxDownPaymentEur) {
        el.status.textContent = 'Nicht bestanden: Budget fuer Anzahlung ueberschritten.';
        el.status.className = 'kalk-status bad';
      } else {
        el.status.textContent = `Nicht bestanden: Rate liegt noch ${Math.abs(rateDiff)}% ueber dem Ziel.`;
        el.status.className = 'kalk-status bad';
      }

      el.checkBtn.disabled = false;
      el.checkBtn.textContent = 'Pruefen';
    }, 800);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function snap(value, step, base) {
    return Math.round((value - base) / step) * step + base;
  }

  function renderGameToText() {
    const goal = state.cfg ? state.cfg.goal : { targetRateEur: 0, maxDownPaymentEur: 0 };
    return JSON.stringify({
      mode: 'calculator',
      coordinate_system: 'origin top-left, x right, y down',
      term_months: state.termMonths,
      down_payment_eur: state.downPaymentEur,
      km_per_year: state.kmPerYear,
      monthly_rate_eur: state.monthlyRate,
      target_rate_eur: goal.targetRateEur,
      max_down_payment_eur: goal.maxDownPaymentEur,
      solved: state.monthlyRate <= goal.targetRateEur && state.downPaymentEur <= goal.maxDownPaymentEur
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime() { return true; };
})();
