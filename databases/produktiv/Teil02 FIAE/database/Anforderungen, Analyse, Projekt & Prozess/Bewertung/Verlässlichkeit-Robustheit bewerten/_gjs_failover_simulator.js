(function () {
  'use strict';

  const state = {
    cfg: null,
    started: false,
    completed: false,
    failed: false,
    round: -1,
    hits: 0,
    score: 0,
    totalDowntime: 0,
    uptime: 0,
    rto: 0,
    roundDowntime: 0,
    systemHealth: 100,
    dataLoss: false,
    cascadeTriggered: false,
    logs: [],
    nodes: [],
    healthHistory: [],
    manualClock: false,
    graphTimer: 0
  };

  const el = {
    room: document.getElementById('control-room'),
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    uptime: document.getElementById('kpi-uptime'),
    sla: document.getElementById('kpi-sla'),
    rto: document.getElementById('kpi-rto'),
    hits: document.getElementById('kpi-hits'),
    scenarioMeta: document.getElementById('scenario-meta'),
    systemMap: document.getElementById('system-map'),
    healthFill: document.getElementById('health-fill'),
    healthValue: document.getElementById('health-value'),
    healthGraph: document.getElementById('health-graph'),
    manualActions: document.getElementById('manual-actions'),
    autoActions: document.getElementById('auto-actions'),
    dial: document.getElementById('automation-dial'),
    dialValue: document.getElementById('dial-value'),
    startBtn: document.getElementById('start-btn'),
    nextBtn: document.getElementById('next-btn'),
    restartBtn: document.getElementById('restart-btn'),
    resultBanner: document.getElementById('result-banner'),
    feedList: document.getElementById('feed-list')
  };

  let animationId = null;
  let lastTs = null;

  init();

  async function init() {
    const resp = await fetch('_data/_gg01_failover_simulator.json');
    if (!resp.ok) {
      el.resultBanner.textContent = 'Konfigurationsdatei konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    buildNodeState();
    buildActionButtons();
    bindControls();
    pushLog('System bereit. Mission wartet auf Start.', 'ok');
    render();

    animationId = requestAnimationFrame(tick);
  }

  function buildNodeState() {
    state.nodes = state.cfg.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      x: node.x,
      y: node.y,
      status: 'active',
      heat: 22
    }));
  }

  function buildActionButtons() {
    const manual = state.cfg.actions.filter((a) => a.group === 'manual');
    const auto = state.cfg.actions.filter((a) => a.group === 'auto');

    el.manualActions.innerHTML = manual.map((action) => {
      return `<button type="button" class="action-btn" data-action="${action.id}"><strong>${action.label}</strong><br><small>${action.effect}</small></button>`;
    }).join('');

    el.autoActions.innerHTML = auto.map((action) => {
      return `<button type="button" class="action-btn" data-action="${action.id}"><strong>${action.label}</strong><br><small>${action.effect}</small></button>`;
    }).join('');

    el.manualActions.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => onAction(btn.dataset.action));
    });

    el.autoActions.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => onAction(btn.dataset.action));
    });
  }

  function bindControls() {
    el.startBtn.addEventListener('click', startMission);
    el.nextBtn.addEventListener('click', nextScenario);
    el.restartBtn.addEventListener('click', resetMission);
    el.dial.addEventListener('input', () => {
      el.dialValue.textContent = `${el.dial.value}%`;
    });
  }

  function tick(ts) {
    if (!state.manualClock && state.started && !state.completed && !state.failed) {
      if (lastTs == null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.09);
      lastTs = ts;
      step(dt);
    } else {
      lastTs = ts;
    }

    render();
    animationId = requestAnimationFrame(tick);
  }

  function step(dt) {
    const current = getCurrentScenario();
    if (!current) return;

    state.uptime += dt;
    state.rto += dt;
    state.roundDowntime += dt;
    state.totalDowntime += dt;

    const stress = current.severity * (current.cascade && state.cascadeTriggered ? 1.55 : 1);
    state.systemHealth = clamp(state.systemHealth - dt * stress * 4.6, 0, 100);

    if (!state.dataLoss && state.rto >= current.data_loss_after) {
      state.dataLoss = true;
      pushLog('WARNUNG: RPO verletzt, Datenverlust droht.', 'bad');
      triggerGlitch();
    }

    if (current.cascade && !state.cascadeTriggered && state.rto >= current.cascade_threshold) {
      state.cascadeTriggered = true;
      triggerCascade();
    }

    if (state.systemHealth <= 0.5) {
      state.failed = true;
      state.systemHealth = 0;
      el.resultBanner.textContent = 'Mission fehlgeschlagen. Leitstand ausgefallen.';
      el.restartBtn.classList.remove('hidden');
      disableActionButtons(true);
      pushLog('KRITISCH: Totalausfall. Keine aktiven Reserven mehr.', 'bad');
      triggerGlitch();
    }

    distributeHeat(current.failed_node, dt, stress);
    updateHistory(dt);
  }

  function distributeHeat(failedNodeId, dt, stress) {
    state.nodes.forEach((node) => {
      if (node.id === failedNodeId && node.status === 'failed') {
        node.heat = clamp(node.heat + dt * 38, 0, 100);
        return;
      }

      const target = node.status === 'active' ? 30 + stress * 12 : 44;
      const diff = target - node.heat;
      node.heat = clamp(node.heat + diff * dt * 1.4, 0, 100);
    });
  }

  function updateHistory(dt) {
    state.graphTimer += dt;
    if (state.graphTimer < 0.2) return;

    state.graphTimer = 0;
    state.healthHistory.push(Math.round(state.systemHealth * 10) / 10);
    if (state.healthHistory.length > 90) state.healthHistory.shift();
  }

  function startMission() {
    if (state.started) return;

    state.started = true;
    state.completed = false;
    state.failed = false;
    state.round = 0;
    state.score = 0;
    state.hits = 0;
    state.uptime = 0;
    state.totalDowntime = 0;
    state.healthHistory = [state.systemHealth];

    el.startBtn.classList.add('hidden');
    el.restartBtn.classList.add('hidden');
    el.nextBtn.classList.add('hidden');

    beginScenario();
  }

  function beginScenario() {
    const scenario = getCurrentScenario();
    if (!scenario) {
      completeMission();
      return;
    }

    state.rto = 0;
    state.roundDowntime = 0;
    state.dataLoss = false;
    state.cascadeTriggered = false;
    state.systemHealth = clamp(state.systemHealth + 10, 38, 100);

    resetNodes();
    setNodeStatus(scenario.failed_node, 'failed');
    el.resultBanner.textContent = `Level ${scenario.level}: ${scenario.title} - ${scenario.disaster}`;
    el.nextBtn.classList.add('hidden');
    disableActionButtons(false);
    pushLog(`ALARM [L${scenario.level}] ${scenario.title}: ${scenario.description}`, 'bad');
    triggerGlitch();
  }

  function onAction(actionId) {
    if (!state.started || state.completed || state.failed) return;

    const scenario = getCurrentScenario();
    if (!scenario) return;

    const chosen = state.cfg.actions.find((a) => a.id === actionId);
    if (!chosen) return;

    const automationBonus = Number(el.dial.value) / 100;
    const isAuto = chosen.group === 'auto';
    const responseLag = isAuto ? 1.2 - automationBonus * 0.7 : 1.0 + automationBonus * 0.1;

    if (actionId === scenario.required_action) {
      resolveScenario(responseLag, chosen.label);
      return;
    }

    state.systemHealth = clamp(state.systemHealth - 5.5, 0, 100);
    state.rto += 0.9 * responseLag;
    state.totalDowntime += 0.9 * responseLag;
    state.roundDowntime += 0.9 * responseLag;

    pushLog(`Falsche Aktion: ${chosen.label}. RTO laeuft weiter.`, 'bad');
    triggerGlitch();
  }

  function resolveScenario(responseLag, actionLabel) {
    const scenario = getCurrentScenario();
    state.hits += 1;

    setNodeStatus(scenario.failed_node, 'passive');

    const zeroLossBonus = state.dataLoss ? 0 : 5000;
    const rtoPenalty = Math.round(state.roundDowntime * 180);
    const targetBonus = state.rto <= scenario.rto_target ? 900 : 220;
    const actionBonus = Math.round((1.3 - responseLag) * 350);
    const gain = Math.max(400, 1500 + zeroLossBonus + targetBonus + actionBonus - rtoPenalty);

    state.score += gain;
    state.systemHealth = clamp(state.systemHealth + 16, 0, 100);

    disableActionButtons(true);
    el.nextBtn.classList.remove('hidden');

    const verdict = state.dataLoss ? 'Datenverlust erkannt.' : 'Zero Data Loss erreicht (RPO=0).';
    el.resultBanner.textContent = `Stabilisiert mit ${actionLabel}. +${gain} Punkte. ${verdict}`;

    pushLog(`Failover erfolgreich mit ${actionLabel}. Downtime ${state.roundDowntime.toFixed(1)}s.`, 'ok');
  }

  function nextScenario() {
    if (state.completed || state.failed) return;

    state.round += 1;
    if (state.round >= state.cfg.scenarios.length) {
      completeMission();
      return;
    }

    beginScenario();
  }

  function completeMission() {
    state.completed = true;
    disableActionButtons(true);
    el.nextBtn.classList.add('hidden');
    el.restartBtn.classList.remove('hidden');

    const sla = calcSla();
    const summary = `Mission abgeschlossen. Treffer ${state.hits}/${state.cfg.scenarios.length}, SLA ${sla.toFixed(2)}%, Score ${state.score}.`;
    el.resultBanner.textContent = summary;
    pushLog(summary, 'ok');
  }

  function resetMission() {
    state.started = false;
    state.completed = false;
    state.failed = false;
    state.round = -1;
    state.hits = 0;
    state.score = 0;
    state.totalDowntime = 0;
    state.uptime = 0;
    state.rto = 0;
    state.roundDowntime = 0;
    state.systemHealth = 100;
    state.dataLoss = false;
    state.cascadeTriggered = false;
    state.healthHistory = [100];
    state.logs = [];

    resetNodes();
    disableActionButtons(true);
    el.startBtn.classList.remove('hidden');
    el.nextBtn.classList.add('hidden');
    el.restartBtn.classList.add('hidden');
    el.resultBanner.textContent = 'Warte auf Startsignal.';
    pushLog('System reset. Mission kann neu gestartet werden.', 'ok');
    render();
  }

  function resetNodes() {
    state.nodes.forEach((node) => {
      node.status = 'active';
      node.heat = 26;
    });
  }

  function setNodeStatus(nodeId, status) {
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    node.status = status;
    node.heat = status === 'failed' ? 84 : status === 'passive' ? 38 : 28;
  }

  function triggerCascade() {
    const fallbackCandidates = ['cache', 'api', 'lb', 'db_secondary', 'power'];
    const extra = fallbackCandidates.find((id) => {
      const node = state.nodes.find((n) => n.id === id);
      return node && node.status === 'active';
    });

    if (extra) {
      setNodeStatus(extra, 'failed');
      state.systemHealth = clamp(state.systemHealth - 12, 0, 100);
      pushLog(`CASCADING FAILURE: ${labelForNode(extra)} ausgefallen.`, 'bad');
      triggerGlitch();
    }
  }

  function disableActionButtons(disabled) {
    document.querySelectorAll('.action-btn').forEach((btn) => {
      btn.disabled = disabled;
    });
  }

  function pushLog(text, level) {
    state.logs.unshift({ text, level, t: state.uptime.toFixed(1) });
    if (state.logs.length > 12) state.logs.pop();
  }

  function calcSla() {
    if (state.uptime <= 0) return 100;
    const avail = Math.max(0, (state.uptime - state.totalDowntime) / state.uptime);
    return avail * 100;
  }

  function getCurrentScenario() {
    if (!state.cfg) return null;
    if (state.round < 0 || state.round >= state.cfg.scenarios.length) return null;
    return state.cfg.scenarios[state.round];
  }

  function render() {
    renderHud();
    renderMap();
    renderFeed();
    renderGraph();
  }

  function renderHud() {
    const total = state.cfg ? state.cfg.scenarios.length : 0;
    const displayRound = state.round < 0 ? 0 : Math.min(total, state.round + 1);
    const scenario = getCurrentScenario();

    el.round.textContent = `${displayRound}/${total}`;
    el.score.textContent = String(Math.round(state.score));
    el.uptime.textContent = `${state.uptime.toFixed(1)}s`;
    el.sla.textContent = `${calcSla().toFixed(2)}%`;
    el.rto.textContent = `${state.rto.toFixed(1)}s`;
    el.hits.textContent = String(state.hits);

    el.scenarioMeta.textContent = scenario
      ? `Level ${scenario.level} | Ziel-RTO <= ${scenario.rto_target}s | Disaster: ${scenario.disaster}`
      : 'Bereit fuer den Einsatz.';

    el.healthFill.style.transform = `scaleX(${Math.max(0, state.systemHealth / 100)})`;
    el.healthValue.textContent = `${Math.round(state.systemHealth)}%`;
  }

  function renderMap() {
    const nodes = state.nodes;
    const links = state.cfg ? state.cfg.links : [];

    let html = '';
    links.forEach((pair) => {
      const a = nodes.find((n) => n.id === pair[0]);
      const b = nodes.find((n) => n.id === pair[1]);
      if (!a || !b) return;

      const x1 = a.x + 6;
      const y1 = a.y + 6;
      const x2 = b.x + 6;
      const y2 = b.y + 6;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const active = a.status !== 'failed' && b.status !== 'failed';

      html += `<div class="link ${active ? 'active' : ''}" style="left:${x1}%; top:${y1}%; width:${len}%; transform: rotate(${angle}deg);"></div>`;
    });

    nodes.forEach((node) => {
      html += `<article class="node ${node.status === 'failed' ? 'failed' : ''}" style="left:${node.x}%; top:${node.y}%; --heat:${node.heat.toFixed(1)};">
        <strong>${node.label}</strong>
        <small>Status: ${node.status}</small>
      </article>`;
    });

    el.systemMap.innerHTML = html;
  }

  function renderFeed() {
    el.feedList.innerHTML = state.logs.map((entry) => {
      return `<li class="${entry.level}"><strong>T+${entry.t}s</strong> ${entry.text}</li>`;
    }).join('');
  }

  function renderGraph() {
    const ctx = el.healthGraph.getContext('2d');
    if (!ctx) return;

    const w = el.healthGraph.width;
    const h = el.healthGraph.height;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(84, 246, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i += 1) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const data = state.healthHistory.length ? state.healthHistory : [state.systemHealth];
    const stepX = data.length > 1 ? w / (data.length - 1) : w;

    ctx.strokeStyle = 'rgba(84, 246, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((value, idx) => {
      const x = idx * stepX;
      const y = h - (clamp(value, 0, 100) / 100) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  function triggerGlitch() {
    document.body.classList.add('glitch');
    setTimeout(() => document.body.classList.remove('glitch'), 420);
  }

  function labelForNode(nodeId) {
    const node = state.nodes.find((n) => n.id === nodeId);
    return node ? node.label : nodeId;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function renderGameToText() {
    const scenario = getCurrentScenario();
    const payload = {
      mode: 'failover_simulator',
      coordinate_system: 'origin top-left, x right, y down; map positions in percent',
      started: state.started,
      completed: state.completed,
      failed: state.failed,
      round_index: state.round,
      round_display: state.cfg ? `${Math.max(0, Math.min(state.cfg.scenarios.length, state.round + 1))}/${state.cfg.scenarios.length}` : '0/0',
      current_scenario: scenario ? {
        id: scenario.id,
        level: scenario.level,
        title: scenario.title,
        required_action: scenario.required_action,
        rto_target_seconds: scenario.rto_target,
        disaster: scenario.disaster
      } : null,
      score: Math.round(state.score),
      hits: state.hits,
      system_health_percent: Math.round(state.systemHealth),
      uptime_seconds: Number(state.uptime.toFixed(2)),
      downtime_seconds: Number(state.totalDowntime.toFixed(2)),
      rto_seconds: Number(state.rto.toFixed(2)),
      sla_percent: Number(calcSla().toFixed(2)),
      sla_target_percent: state.cfg ? state.cfg.sla_target : null,
      data_loss: state.dataLoss,
      automation_level_percent: Number(el.dial.value),
      active_nodes: state.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        status: n.status,
        heat: Number(n.heat.toFixed(1)),
        x_percent: n.x,
        y_percent: n.y
      })),
      recent_feed: state.logs.slice(0, 4).map((entry) => ({
        t_seconds: Number(entry.t),
        level: entry.level,
        text: entry.text
      }))
    };

    return JSON.stringify(payload);
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return false;

    state.manualClock = true;
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    const dt = (ms / 1000) / steps;

    for (let i = 0; i < steps; i += 1) {
      if (state.started && !state.completed && !state.failed) step(dt);
    }

    render();
    return true;
  };

  window.addEventListener('beforeunload', () => {
    if (animationId) cancelAnimationFrame(animationId);
  });

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
