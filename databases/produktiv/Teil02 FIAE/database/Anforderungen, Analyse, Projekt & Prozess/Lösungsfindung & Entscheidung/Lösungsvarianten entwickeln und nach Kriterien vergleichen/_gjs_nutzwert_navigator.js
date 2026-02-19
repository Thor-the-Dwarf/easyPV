(function () {
  'use strict';

  const AUTO_NEXT_MS = 1500;

  const state = {
    cfg: null,
    idx: 0,
    totalScore: 0,
    sliders: {},
    lock: false,
    done: false,
    timer: null,
    confidence: 0,
    objectivity: 100,
    ranking: []
  };

  const el = {
    total: document.getElementById('kpi-total'),
    objectivity: document.getElementById('kpi-objectivity'),
    confidence: document.getElementById('kpi-confidence'),
    progress: document.getElementById('kpi-progress'),
    level: document.getElementById('kpi-level'),
    tag: document.getElementById('scenario-tag'),
    title: document.getElementById('scenario-title'),
    desc: document.getElementById('scenario-desc'),
    sliderGrid: document.getElementById('slider-grid'),
    resultBars: document.getElementById('result-bars'),
    checkBtn: document.getElementById('check-btn'),
    restartBtn: document.getElementById('restart-btn'),
    feedback: document.getElementById('feedback')
  };

  init();

  async function init() {
    const resp = await fetch('_data/_gg01_nutzwert_navigator.json');
    if (!resp.ok) {
      el.feedback.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    el.checkBtn.addEventListener('click', evaluate);
    el.restartBtn.addEventListener('click', restart);
    restart();
  }

  function restart() {
    clearTimer();
    state.idx = 0;
    state.totalScore = 0;
    state.lock = false;
    state.done = false;
    el.feedback.className = 'feedback';
    el.feedback.textContent = 'Stelle die Gewichtung ein und pruefe dann.';
    initSliders();
    render();
  }

  function initSliders() {
    const equal = Math.round(100 / state.cfg.criteria.length);
    state.sliders = {};
    state.cfg.criteria.forEach((c) => {
      state.sliders[c] = equal;
    });
  }

  function currentCase() {
    return state.cfg.cases[state.idx] || null;
  }

  function render() {
    const c = currentCase();
    if (!c || state.done) {
      finish();
      return;
    }

    el.tag.textContent = c.tag;
    el.title.textContent = c.title;
    el.desc.textContent = c.description;
    el.level.textContent = String(c.level);
    el.progress.textContent = `${state.idx + 1}/${state.cfg.cases.length}`;
    el.total.textContent = String(state.totalScore);

    renderSliders();
    recalc();
    renderBars();
  }

  function renderSliders() {
    const html = state.cfg.criteria.map((criterion) => {
      const value = state.sliders[criterion];
      return `<div class="slider-card">
        <div class="slider-head"><strong>${criterion}</strong><span id="val-${criterion}">${value}%</span></div>
        <input data-criterion="${criterion}" type="range" min="0" max="100" step="1" value="${value}">
      </div>`;
    }).join('');

    el.sliderGrid.innerHTML = html;
    el.sliderGrid.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        if (state.lock || state.done) return;
        state.sliders[input.dataset.criterion] = Number(input.value);
        recalc();
        renderBars();
      });
    });
  }

  function normalizedWeights() {
    const total = Object.values(state.sliders).reduce((a, b) => a + b, 0);
    const denom = total <= 0 ? 1 : total;
    const result = {};
    Object.keys(state.sliders).forEach((k) => {
      result[k] = state.sliders[k] / denom;
    });
    return result;
  }

  function recalc() {
    const c = currentCase();
    const weights = normalizedWeights();

    const ranking = Object.entries(c.options).map(([name, scores]) => {
      let sum = 0;
      state.cfg.criteria.forEach((criterion) => {
        sum += scores[criterion] * weights[criterion];
      });
      return { name, score: sum };
    }).sort((a, b) => b.score - a.score);

    state.ranking = ranking;
    state.objectivity = calcObjectivity();
    state.confidence = calcConfidence(weights, c);

    el.objectivity.textContent = `${state.objectivity}%`;
    el.confidence.textContent = `${state.confidence}%`;
  }

  function calcObjectivity() {
    const values = Object.values(state.sliders);
    const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / Math.max(1, values.length);
    const std = Math.sqrt(variance);
    return clamp(Math.round(100 - std * 2.1), 0, 100);
  }

  function calcConfidence(weights, c) {
    const baseWinner = state.ranking[0] ? state.ranking[0].name : null;
    if (!baseWinner) return 0;

    let stable = 0;
    const trials = 40;

    for (let i = 0; i < trials; i += 1) {
      const perturbed = {};
      state.cfg.criteria.forEach((criterion) => {
        const factor = 1 + randomBetween(-0.05, 0.05);
        perturbed[criterion] = Math.max(0.0001, weights[criterion] * factor);
      });

      const pTotal = Object.values(perturbed).reduce((a, b) => a + b, 0);
      state.cfg.criteria.forEach((criterion) => {
        perturbed[criterion] /= pTotal;
      });

      const trialRank = Object.entries(c.options).map(([name, scores]) => {
        let sum = 0;
        state.cfg.criteria.forEach((criterion) => {
          sum += scores[criterion] * perturbed[criterion];
        });
        return { name, score: sum };
      }).sort((a, b) => b.score - a.score);

      if (trialRank[0] && trialRank[0].name === baseWinner) stable += 1;
    }

    return Math.round((stable / trials) * 100);
  }

  function renderBars() {
    if (!state.ranking.length) {
      el.resultBars.innerHTML = '';
      return;
    }

    const max = state.ranking[0].score || 1;
    el.resultBars.innerHTML = state.ranking.map((entry, idx) => {
      const width = Math.max(8, Math.round((entry.score / max) * 100));
      return `<div class="row ${idx === 0 ? 'leader' : ''}">
        <strong>${entry.name}</strong>
        <div class="track"><div class="fill" style="width:${width}%"></div></div>
        <span>${entry.score.toFixed(2)}</span>
      </div>`;
    }).join('');
  }

  function evaluate() {
    if (state.lock || state.done) return;

    const c = currentCase();
    if (!c || !state.ranking.length) return;

    state.lock = true;

    const winner = state.ranking[0].name;
    const match = winner === c.target_winner;
    const robust = state.confidence >= 75;

    let points = 0;
    let text = '';

    if (match) {
      points += 120;
      text = 'Zielvariante getroffen.';
    } else {
      points -= 40;
      text = `Nicht passend. Erwartet war ${c.target_winner}.`;
    }

    if (robust) {
      points += 80;
      text += ' Robust Decision +80.';
    }

    if (state.objectivity < 55) {
      points -= 50;
      text += ' Biased Scoring -50.';
    }

    state.totalScore = Math.max(0, state.totalScore + points);
    el.total.textContent = String(state.totalScore);

    el.feedback.className = `feedback ${points >= 0 ? 'ok' : 'bad'}`;
    el.feedback.textContent = `${text} (${points >= 0 ? '+' : ''}${points})`;

    const cRef = currentCase();
    if (cRef && cRef.stress) {
      applyStress(cRef);
      recalc();
      renderBars();
      el.feedback.textContent += ' Stress-Test aktiv.';
    }

    clearTimer();
    state.timer = window.setTimeout(() => {
      state.idx += 1;
      state.lock = false;
      if (!state.done) {
        initSliders();
        el.feedback.className = 'feedback';
        el.feedback.textContent = 'Naechster Fall.';
      }
      render();
    }, AUTO_NEXT_MS);
  }

  function applyStress(c) {
    const s = c.stress;
    if (!s || !c.options[s.option]) return;
    c.options[s.option][s.criterion] = clamp(c.options[s.option][s.criterion] + s.delta, 1, 10);
  }

  function finish() {
    state.done = true;
    state.lock = true;

    el.feedback.className = 'feedback';
    const verdict = state.totalScore >= 1700
      ? 'Sehr stark: Entscheidungen bleiben auch unter Stress stabil.'
      : state.totalScore >= 1200
        ? 'Gut: solide Entscheidungen mit brauchbarer Robustheit.'
        : 'Basis erreicht: Gewichtungen objektiver und robuster ausbalancieren.';
    el.feedback.textContent = verdict;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function clearTimer() {
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
  }

  function renderGameToText() {
    const c = currentCase();
    return JSON.stringify({
      mode: state.done ? 'result' : (state.lock ? 'feedback' : 'question'),
      coordinate_system: 'origin top-left, x right, y down',
      index: state.idx,
      total_cases: state.cfg ? state.cfg.cases.length : 0,
      level: c ? c.level : null,
      score_total: state.totalScore,
      objectivity: state.objectivity,
      confidence: state.confidence,
      winner: state.ranking[0] ? state.ranking[0].name : null,
      sliders: state.sliders,
      ranking: state.ranking.map((r) => ({ name: r.name, score: Number(r.score.toFixed(2)) })),
      case: c ? {
        id: c.id,
        title: c.title,
        target_winner: c.target_winner,
        has_stress: Boolean(c.stress)
      } : null
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0 || state.done) return true;
    if (state.lock && state.timer) {
      clearTimer();
      state.idx += 1;
      state.lock = false;
      if (!state.done) {
        initSliders();
      }
      render();
    }
    return true;
  };

  const __baseRenderToTextForSim = window.render_game_to_text;
  const __baseAdvanceTimeForSim = window.advanceTime;
  let __simulatedMs = 0;

  window.render_game_to_text = function renderGameToTextWithSimulatedMs() {
    const raw = typeof __baseRenderToTextForSim === "function" ? __baseRenderToTextForSim() : "{}";
    try {
      const payload = JSON.parse(raw);
      if (payload && typeof payload === "object" && !Array.isArray(payload) && !Object.prototype.hasOwnProperty.call(payload, "simulated_ms")) {
        payload.simulated_ms = __simulatedMs;
      }
      return JSON.stringify(payload);
    } catch (err) {
      return raw;
    }
  };

  window.advanceTime = function advanceTimeWithSimulatedMs(ms) {
    if (Number.isFinite(ms) && ms > 0) __simulatedMs += ms;
    if (typeof __baseAdvanceTimeForSim === "function") {
      try {
        return __baseAdvanceTimeForSim(ms);
      } catch (err) {
        return true;
      }
    }
    return true;
  };
})();
