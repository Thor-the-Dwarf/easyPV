(function () {
  'use strict';

  const state = {
    config: null,
    index: 0,
    score: 0,
    answered: false,
    quantity: 0,
    lastEvaluation: null
  };

  const el = {
    progress: document.getElementById('progress'),
    score: document.getElementById('score'),
    accuracy: document.getElementById('accuracy'),
    caseTitle: document.getElementById('case-title'),
    caseHint: document.getElementById('case-hint'),
    fixedCost: document.getElementById('fixed-cost'),
    varCost: document.getElementById('var-cost'),
    buyUnit: document.getElementById('buy-unit'),
    qtyValue: document.getElementById('qty-value'),
    qtySlider: document.getElementById('qty-slider'),
    makeBar: document.getElementById('make-bar'),
    buyBar: document.getElementById('buy-bar'),
    makeCost: document.getElementById('make-cost'),
    buyCost: document.getElementById('buy-cost'),
    makeBtn: document.getElementById('make-btn'),
    buyBtn: document.getElementById('buy-btn'),
    nextBtn: document.getElementById('next-btn'),
    restartBtn: document.getElementById('restart-btn'),
    feedback: document.getElementById('feedback'),
    formulaBox: document.getElementById('formula-box'),
    resultBox: document.getElementById('result-box')
  };

  init();

  async function init() {
    try {
      const response = await fetch('data/_gg01_make_or_buy_calculator.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.config = await response.json();
      bindEvents();
      loadCurrentCase();
    } catch (error) {
      el.feedback.textContent = `Fehler: ${error.message}`;
      el.feedback.className = 'bad';
    }
  }

  function bindEvents() {
    el.qtySlider.addEventListener('input', () => {
      state.quantity = Number(el.qtySlider.value);
      state.answered = false;
      state.lastEvaluation = null;
      render();
    });

    el.makeBtn.addEventListener('click', () => evaluateDecision('make'));
    el.buyBtn.addEventListener('click', () => evaluateDecision('buy'));
    el.nextBtn.addEventListener('click', nextCase);
    el.restartBtn.addEventListener('click', restartGame);
  }

  function currentCase() {
    return state.config.cases[state.index] || null;
  }

  function loadCurrentCase() {
    const c = currentCase();
    if (!c) {
      renderFinal();
      return;
    }

    state.quantity = c.quantity;
    state.answered = false;
    state.lastEvaluation = null;
    el.qtySlider.min = String(c.quantityMin);
    el.qtySlider.max = String(c.quantityMax);
    el.qtySlider.value = String(c.quantity);
    render();
  }

  function calculate(c, quantity) {
    const make = c.fixedCostMake + c.variableCostMake * quantity;
    const buy = c.unitCostBuy * quantity;
    const decision = make <= buy ? 'make' : 'buy';

    let breakEvenQty = null;
    const denominator = c.unitCostBuy - c.variableCostMake;
    if (denominator > 0) {
      breakEvenQty = c.fixedCostMake / denominator;
    }

    return { make, buy, decision, breakEvenQty };
  }

  function evaluateDecision(pick) {
    if (state.answered) return;
    const c = currentCase();
    if (!c) return;

    const calc = calculate(c, state.quantity);
    const correct = pick === calc.decision;
    if (correct) state.score += 1;

    state.answered = true;
    state.lastEvaluation = {
      pick,
      correct,
      expected: calc.decision,
      make: calc.make,
      buy: calc.buy,
      difference: Math.abs(calc.make - calc.buy)
    };

    render();
  }

  function nextCase() {
    if (!state.answered) return;
    state.index += 1;
    loadCurrentCase();
  }

  function restartGame() {
    state.index = 0;
    state.score = 0;
    state.answered = false;
    state.lastEvaluation = null;
    loadCurrentCase();
  }

  function render() {
    const c = currentCase();
    if (!c) {
      renderFinal();
      return;
    }

    const total = state.config.cases.length;
    const seen = Math.min(state.index, total);
    const accuracy = seen > 0 ? Math.round((state.score / seen) * 100) : 0;

    const calc = calculate(c, state.quantity);
    const maxCost = Math.max(calc.make, calc.buy, 1);
    const makeWidth = Math.max(8, Math.round((calc.make / maxCost) * 100));
    const buyWidth = Math.max(8, Math.round((calc.buy / maxCost) * 100));

    el.progress.textContent = `${state.index + 1}/${total}`;
    el.score.textContent = String(state.score);
    el.accuracy.textContent = `${accuracy}%`;

    el.caseTitle.textContent = `Fall ${state.index + 1}: ${c.title}`;
    el.caseHint.textContent = c.hint;
    el.fixedCost.textContent = euro(c.fixedCostMake);
    el.varCost.textContent = `${euro(c.variableCostMake)} / Stk`;
    el.buyUnit.textContent = `${euro(c.unitCostBuy)} / Stk`;
    el.qtyValue.textContent = `${state.quantity} Stk`;

    el.makeCost.textContent = euro(calc.make);
    el.buyCost.textContent = euro(calc.buy);
    el.makeBar.style.width = `${makeWidth}%`;
    el.buyBar.style.width = `${buyWidth}%`;

    el.makeBtn.disabled = state.answered;
    el.buyBtn.disabled = state.answered;
    el.nextBtn.disabled = !state.answered;

    const breakEvenText = calc.breakEvenQty === null
      ? 'Kein klassischer Break-Even, da variable Make-Kosten nicht unter Buy liegen.'
      : `Break-Even-Menge: ${Math.ceil(calc.breakEvenQty)} Stk (nahezu kostengleich).`;

    el.formulaBox.innerHTML = [
      `Make = Fixkosten + Variable * Menge = ${euro(c.fixedCostMake)} + ${euro(c.variableCostMake)} * ${state.quantity}`,
      `Buy = Fremdpreis * Menge = ${euro(c.unitCostBuy)} * ${state.quantity}`,
      `Aktuell: Make ${euro(calc.make)} vs. Buy ${euro(calc.buy)}`,
      breakEvenText
    ].map((line) => `<div>${escapeHtml(line)}</div>`).join('');

    if (!state.answered) {
      el.feedback.className = '';
      el.feedback.textContent = 'Triff deine Entscheidung auf Basis des aktuellen Kostenvergleichs.';
      el.resultBox.textContent = calc.decision === 'make'
        ? 'Aktuelle Empfehlung: Make ist guenstiger oder gleich teuer.'
        : 'Aktuelle Empfehlung: Buy ist guenstiger.';
      return;
    }

    const ev = state.lastEvaluation;
    const expectedLabel = ev.expected === 'make' ? state.config.labels.make : state.config.labels.buy;
    const pickLabel = ev.pick === 'make' ? state.config.labels.make : state.config.labels.buy;
    const cheaper = ev.make <= ev.buy ? 'Make' : 'Buy';

    if (ev.correct) {
      el.feedback.className = 'ok';
      el.feedback.textContent = `Korrekt. Du hast ${pickLabel} gewaehlt.`;
    } else {
      el.feedback.className = 'bad';
      el.feedback.textContent = `Nicht korrekt. Deine Wahl: ${pickLabel}. Richtig waere: ${expectedLabel}.`;
    }

    el.resultBox.textContent = `Kostenabstand: ${euro(ev.difference)}. Guenstiger ist: ${cheaper}.`;
  }

  function renderFinal() {
    const total = state.config.cases.length;
    const accuracy = Math.round((state.score / total) * 100);

    el.progress.textContent = `${total}/${total}`;
    el.score.textContent = String(state.score);
    el.accuracy.textContent = `${accuracy}%`;

    el.caseTitle.textContent = 'Training abgeschlossen';
    el.caseHint.textContent = '';
    el.fixedCost.textContent = '-';
    el.varCost.textContent = '-';
    el.buyUnit.textContent = '-';
    el.qtyValue.textContent = '-';
    el.makeCost.textContent = '-';
    el.buyCost.textContent = '-';
    el.makeBar.style.width = '0%';
    el.buyBar.style.width = '0%';

    el.makeBtn.disabled = true;
    el.buyBtn.disabled = true;
    el.nextBtn.disabled = true;

    el.feedback.className = state.score === total ? 'ok' : 'bad';
    el.feedback.textContent = `Ergebnis: ${state.score}/${total} korrekt (${accuracy}%).`; 
    el.formulaBox.textContent = 'Neustart starten, um alle 5 Faelle erneut zu loesen.';
    el.resultBox.textContent = state.score === total
      ? 'Sehr gut. Du nutzt die Make-or-Buy-Rechnung sicher.'
      : 'Wiederhole die Faelle und achte auf Fixkosten, variable Kosten und Mengenwirkung.';
  }

  function euro(amount) {
    const rounded = Math.round(Number(amount));
    return `${rounded.toLocaleString('de-DE')} EUR`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderGameToText() {
    const c = currentCase();
    const calc = c ? calculate(c, state.quantity) : null;

    return JSON.stringify({
      mode: c ? (state.answered ? 'evaluated' : 'question') : 'result',
      coordinate_system: 'origin top-left, x right, y down',
      case_index: state.index,
      total_cases: state.config ? state.config.cases.length : 0,
      score: state.score,
      answered: state.answered,
      quantity: state.quantity,
      current_case: c ? {
        id: c.id,
        title: c.title,
        fixed_make: c.fixedCostMake,
        variable_make: c.variableCostMake,
        unit_buy: c.unitCostBuy,
        quantity_min: c.quantityMin,
        quantity_max: c.quantityMax
      } : null,
      costs: calc ? {
        make: calc.make,
        buy: calc.buy,
        recommendation: calc.decision,
        break_even_quantity: calc.breakEvenQty
      } : null,
      last_evaluation: state.lastEvaluation
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime() { return true; };
})();
