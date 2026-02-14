(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    hits: 0,
    answered: false,
    done: false,
    lastMetrics: null
  };

  const el = {
    taskKpi: document.getElementById('kpi-task'),
    hitsKpi: document.getElementById('kpi-hits'),
    rateKpi: document.getElementById('kpi-rate'),
    rpsKpi: document.getElementById('kpi-rps'),
    taskCard: document.getElementById('task-card'),
    rack: document.getElementById('rack'),
    controls: document.getElementById('controls'),
    fill: document.getElementById('sim-fill'),
    feedback: document.getElementById('sim-feedback'),
    nextBtn: document.getElementById('next-btn')
  };

  init();

  async function init() {
    const resp = await fetch('./game_horizontal_vs_vertikal.json');
    if (!resp.ok) {
      el.feedback.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    el.nextBtn.addEventListener('click', next);
    render();
  }

  function render() {
    updateKpis();
    renderTaskCard();
    renderControls();
    renderRack(null);

    el.fill.style.width = '0%';
    el.nextBtn.classList.add('hidden');
    el.feedback.className = 'sim-feedback';
    el.feedback.textContent = state.done ? 'Auswertung abgeschlossen.' : 'Regel: Nur wenn Kosten, CPU und SLA-Verfuegbarkeit eingehalten werden, ist die Wahl korrekt.';

    if (state.done) renderResult();
  }

  function task() {
    return state.cfg.tasks[state.idx];
  }

  function renderTaskCard() {
    if (state.done) {
      el.taskCard.innerHTML = '';
      return;
    }

    const t = task();
    el.taskCard.innerHTML = `
      <h2>Aufgabe ${state.idx + 1}</h2>
      <div class="task-grid">
        <div class="task-item"><span>Traffic</span><strong>${t.traffic_rps} rps</strong></div>
        <div class="task-item"><span>Basis-CPU</span><strong>${t.base_cpu}%</strong></div>
        <div class="task-item"><span>Basis-Kosten</span><strong>${t.base_cost_eur} EUR</strong></div>
      </div>
      <h3>SLA-Vertrag (muss erfuellt werden)</h3>
      <div class="task-grid sla-grid">
        <div class="task-item sla"><span>Max. Kosten</span><strong>${t.goal.max_cost_eur} EUR</strong></div>
        <div class="task-item sla"><span>Min. Verfuegbarkeit</span><strong>${t.goal.min_availability.toFixed(1)}%</strong></div>
        <div class="task-item sla"><span>Max. CPU</span><strong>${t.goal.max_cpu}%</strong></div>
      </div>
    `;
  }

  function renderControls() {
    if (state.done) {
      el.controls.innerHTML = '';
      return;
    }

    const buttons = Object.keys(state.cfg.strategies).map((key) => {
      const s = state.cfg.strategies[key];
      return `
        <button class="scale-btn" type="button" data-strategy="${key}" ${state.answered ? 'disabled' : ''}>
          ${s.icon} ${s.label}
          <small>SLA Verf.: ${s.availability}% | Komplexitaet: ${s.complexity}</small>
        </button>
      `;
    }).join('');

    el.controls.innerHTML = buttons;
    el.controls.querySelectorAll('[data-strategy]').forEach((btn) => {
      btn.addEventListener('click', () => choose(btn.dataset.strategy));
    });
  }

  function choose(strategyKey) {
    if (state.answered || state.done) return;

    const t = task();
    const s = state.cfg.strategies[strategyKey];
    const metrics = evaluate(t, s);
    state.lastMetrics = metrics;
    state.answered = true;

    const correct = strategyKey === t.correct_strategy;
    if (correct) state.hits += 1;

    renderRack(strategyKey);
    updateKpis();

    el.fill.style.width = `${correct ? 100 : 55}%`;
    el.feedback.className = `sim-feedback ${correct ? 'ok' : 'bad'}`;

    const checks = [
      `Kosten ${metrics.cost} EUR ${metrics.cost <= t.goal.max_cost_eur ? 'OK' : 'NICHT OK'}`,
      `CPU ${metrics.cpu}% ${metrics.cpu <= t.goal.max_cpu ? 'OK' : 'NICHT OK'}`,
      `SLA ${metrics.availability.toFixed(1)}% ${metrics.availability >= t.goal.min_availability ? 'OK' : 'NICHT OK'}`
    ].join(' | ');

    if (correct) {
      el.feedback.innerHTML = `<strong>Korrekt.</strong> ${t.explanation}<br><small>${checks}</small>`;
    } else {
      const right = state.cfg.strategies[t.correct_strategy].label;
      el.feedback.innerHTML = `<strong>Nicht korrekt.</strong> Richtige Wahl: <em>${right}</em>.<br><small>${checks}</small>`;
    }

    el.controls.querySelectorAll('[data-strategy]').forEach((b) => { b.disabled = true; });

    el.nextBtn.textContent = state.idx === state.cfg.tasks.length - 1 ? 'Auswertung anzeigen' : 'Naechste Aufgabe';
    el.nextBtn.classList.remove('hidden');
  }

  function evaluate(t, s) {
    const cpu = Math.max(40, Math.round(t.base_cpu - s.cpu_gain));
    const cost = Math.round(t.base_cost_eur * s.cost_factor);
    const availability = s.availability;

    return {
      cpu,
      cost,
      availability,
      goalMet: cpu <= t.goal.max_cpu && cost <= t.goal.max_cost_eur && availability >= t.goal.min_availability
    };
  }

  function renderRack(strategyKey) {
    const count = strategyKey === 'horizontal' ? 4 : 1;
    const cls = state.answered ? 'server stable' : 'server hot';
    const servers = Array.from({ length: count }).map((_, i) => `<div class="${cls}">Server ${i + 1}</div>`).join('');
    const lb = strategyKey === 'horizontal' ? '<div class="lb">🔀 Load Balancer aktiv</div>' : '<div class="lb hidden"></div>';
    el.rack.innerHTML = `<div class="rack-grid">${servers}</div>${lb}`;
  }

  function next() {
    if (!state.answered) return;

    if (state.idx === state.cfg.tasks.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.idx += 1;
    state.answered = false;
    state.lastMetrics = null;
    render();
  }

  function renderResult() {
    const total = state.cfg.tasks.length;
    const rate = total ? Math.round((state.hits / total) * 100) : 0;

    let verdict = 'Ausbaufähig';
    if (rate >= 60) verdict = 'Solider SLA-Blick';
    if (rate >= 80) verdict = 'SLA-sicher';
    if (rate === 100) verdict = 'Skalierungs-Profi';

    el.controls.innerHTML = `
      <section class="result">
        <h2>${verdict}</h2>
        <p>Treffer: <strong>${state.hits}</strong> / ${total}</p>
        <p>Quote: <strong>${rate}%</strong></p>
        <p>Pruefungsrelevant: Strategie muss SLA + Kosten + Lastgrenzen gleichzeitig einhalten.</p>
      </section>
    `;
  }

  function updateKpis() {
    const total = state.cfg ? state.cfg.tasks.length : 0;
    const current = state.done ? total : state.idx + 1;
    const rate = total ? Math.round((state.hits / total) * 100) : 0;
    const t = state.cfg ? task() : null;

    el.taskKpi.textContent = `${current}/${total}`;
    el.hitsKpi.textContent = String(state.hits);
    el.rateKpi.textContent = `${rate}%`;
    el.rpsKpi.textContent = t ? `${t.traffic_rps}` : '0';
  }

  function renderGameToText() {
    const total = state.cfg ? state.cfg.tasks.length : 0;
    return JSON.stringify({
      mode: 'horizontal_vs_vertical_tasks',
      coordinate_system: 'origin top-left, x right, y down',
      task_index: state.idx,
      task_display: `${Math.min(total, state.idx + 1)}/${total}`,
      hits: state.hits,
      answered: state.answered,
      done: state.done,
      last_goal_met: state.lastMetrics ? state.lastMetrics.goalMet : null
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime() { return true; };
})();
