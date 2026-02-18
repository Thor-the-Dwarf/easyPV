/**
 * Lieferanten-Abhängigkeits-Check
 * Resource allocation game to demonstrate risks of Single Sourcing.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const gameTitle = document.getElementById('game-title');
    const gameSubtitle = document.getElementById('game-subtitle');
    const totalPercent = document.getElementById('total-percent');
    const totalBar = document.getElementById('total-bar');
    const allocationStatus = document.getElementById('allocation-status');
    const stabilityValue = document.getElementById('stability-value');
    const stabilityBar = document.getElementById('stability-bar');
    const budgetValue = document.getElementById('budget-value');
    const budgetBar = document.getElementById('budget-bar');
    const budgetHint = document.getElementById('budget-hint');
    const supplierList = document.getElementById('supplier-list');
    const simulateBtn = document.getElementById('simulate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const overlay = document.getElementById('scenario-overlay');
    const feedbackArea = document.getElementById('feedback-area');
    const instructionEl = document.getElementById('instruction');

    // State
    let gameState = {
        data: null,
        allocations: {}, // id -> value
        isSimulated: false,
        lastScenario: null
    };

    // Load Data
    fetch('_data/_g01_fremdvergabe_lieferanten_check.json')
        .then(r => r.json())
        .then(data => initGame(data))
        .catch(err => console.error("Load error:", err));

    function initGame(data) {
        gameState.data = data;
        gameTitle.innerText = data.gameTitle;
        if (gameSubtitle) gameSubtitle.innerText = data.gameSubtitle || '';
        if (instructionEl) instructionEl.innerText = data.instruction || '';
        if (budgetHint && data.dashboardLabels && data.dashboardLabels.budget) {
            budgetHint.innerText = String(data.dashboardLabels.budget);
        }

        renderSuppliers();
        resetAllocations();
        updateDashboard();

        simulateBtn.addEventListener('click', startSimulation);
        resetBtn.addEventListener('click', resetGame);
        document.getElementById('close-overlay').addEventListener('click', () => overlay.style.display = 'none');
    }

    function renderSuppliers() {
        supplierList.innerHTML = '';
        gameState.data.suppliers.forEach(supp => {
            const riskLabel = supp.riskLevel === 'high' ? 'hoch' : supp.riskLevel === 'medium' ? 'mittel' : 'niedrig';
            const card = document.createElement('div');
            card.className = 'supplier-card';
            card.innerHTML = `
                <div class="supplier-info">
                    <h3>${supp.name}</h3>
                    <p>${supp.description}</p>
                    <span class="risk-badge risk-${supp.riskLevel}">Risiko: ${riskLabel}</span>
                </div>
                <div class="allocation-control">
                    <input type="range" id="slider-${supp.id}" min="0" max="${supp.capacity}" value="0">
                    <div class="percent-display" id="val-${supp.id}">0%</div>
                </div>
                <div style="font-size: 0.7rem; color: var(--txt-muted);">Kapazität: ${supp.capacity}%</div>
            `;

            const slider = card.querySelector('input');
            slider.addEventListener('input', (e) => updateAllocation(supp.id, parseInt(e.target.value)));

            supplierList.appendChild(card);
        });
    }

    function updateAllocation(id, val) {
        if (gameState.isSimulated) return;

        // Simple validation: sum should not exceed 100
        const otherSum = Object.entries(gameState.allocations)
            .filter(([k]) => k !== id)
            .reduce((sum, [, v]) => sum + v, 0);

        if (otherSum + val > 100) {
            val = 100 - otherSum;
            document.getElementById(`slider-${id}`).value = val;
        }

        gameState.allocations[id] = val;
        document.getElementById(`val-${id}`).innerText = `${val}%`;

        updateDashboard();
    }

    function updateBudget() {
        if (!budgetValue || !budgetBar) return;
        const sum = Object.values(gameState.allocations).reduce((a, b) => a + b, 0);
        if (sum !== 100) {
            budgetValue.innerText = '--';
            budgetBar.style.width = '0%';
            return;
        }

        const costs = gameState.data.suppliers.map((s) => Number(s.costFactor)).filter((v) => Number.isFinite(v));
        const minCost = Math.min(...costs);
        const maxCost = Math.max(...costs);

        const costIndex = gameState.data.suppliers.reduce((acc, s) => {
            const alloc = Number(gameState.allocations[s.id] || 0);
            const factor = Number(s.costFactor || 0);
            return acc + (alloc / 100) * factor;
        }, 0);

        const efficiency = maxCost > minCost
            ? Math.max(0, Math.min(100, Math.round(((maxCost - costIndex) / (maxCost - minCost)) * 100)))
            : 0;

        budgetValue.innerText = `${costIndex.toFixed(2)}x`;
        budgetBar.style.width = `${efficiency}%`;
    }

    function updateDashboard() {
        const sum = Object.values(gameState.allocations).reduce((a, b) => a + b, 0);
        totalPercent.innerText = `${sum}%`;
        totalBar.style.width = `${sum}%`;
        updateBudget();

        if (sum === 100) {
            allocationStatus.innerText = "Bereit für Simulation";
            allocationStatus.style.color = "hsl(var(--success))";
            simulateBtn.disabled = false;
        } else {
            allocationStatus.innerText = `Unvollständig (${100 - sum}% offen)`;
            allocationStatus.style.color = "hsl(var(--error))";
            simulateBtn.disabled = true;
        }
    }

    function startSimulation() {
        const scenario = gameState.data.scenarios[Math.floor(Math.random() * gameState.data.scenarios.length)];
        gameState.lastScenario = scenario;

        // Calculate Impact
        const affectedValue = gameState.allocations[scenario.affectedSupplier] || 0;
        const loss = affectedValue * scenario.impactFactor;
        const remainingProduction = 100 - loss;

        // Show Overlay
        document.getElementById('scenario-title').innerText = scenario.title;
        document.getElementById('scenario-desc').innerText = scenario.description;
        document.getElementById('scenario-hint').innerText = scenario.hint;
        overlay.style.display = 'flex';

        // Update Dashboard Stability
        stabilityValue.innerText = `${Math.round(remainingProduction)}%`;
        stabilityBar.style.width = `${remainingProduction}%`;

        // Colors
        if (remainingProduction >= 90) stabilityBar.style.backgroundColor = 'hsl(var(--success))';
        else if (remainingProduction >= 60) stabilityBar.style.backgroundColor = 'hsl(45 100% 50%)';
        else stabilityBar.style.backgroundColor = 'hsl(var(--error))';

        // Feedback
        let finalMsg;
        if (remainingProduction >= 90) finalMsg = gameState.data.feedback.stable;
        else if (remainingProduction >= 60) finalMsg = gameState.data.feedback.warning;
        else finalMsg = gameState.data.feedback.critical;

        feedbackArea.innerText = finalMsg;
        if (remainingProduction >= 90) feedbackArea.style.color = 'hsl(var(--success))';
        else if (remainingProduction >= 60) feedbackArea.style.color = 'hsl(45 100% 50%)';
        else feedbackArea.style.color = 'hsl(var(--error))';

        gameState.isSimulated = true;
        simulateBtn.disabled = true;

        // Lock sliders
        document.querySelectorAll('input[type="range"]').forEach(s => s.disabled = true);
    }

    function resetGame() {
        gameState.isSimulated = false;
        gameState.lastScenario = null;
        gameState.allocations = {};
        resetAllocations();
        updateBudget();

        stabilityValue.innerText = "100%";
        stabilityBar.style.width = "100%";
        stabilityBar.style.backgroundColor = "hsl(var(--success))";

        feedbackArea.innerText = "";
        overlay.style.display = 'none';

        document.querySelectorAll('input[type="range"]').forEach(s => {
            s.disabled = false;
            s.value = 0;
        });

        document.querySelectorAll('.percent-display').forEach(d => d.innerText = "0%");

        updateDashboard();
    }

    function resetAllocations() {
        gameState.data.suppliers.forEach(s => gameState.allocations[s.id] = 0);
    }

    window.render_game_to_text = function renderGameToText() {
        const allocations = Object.fromEntries(Object.entries(gameState.allocations).sort(([a], [b]) => a.localeCompare(b)));
        const sum = Object.values(allocations).reduce((a, b) => a + b, 0);
        const costIndex = sum === 100
            ? gameState.data.suppliers.reduce((acc, s) => acc + (Number(allocations[s.id] || 0) / 100) * Number(s.costFactor || 0), 0)
            : null;
        const stabilityPct = Number(String(stabilityValue?.innerText || '').replace('%', '')) || null;

        return JSON.stringify({
            mode: gameState.isSimulated ? 'result' : 'allocation',
            coordinate_system: 'origin top-left, x right, y down',
            allocation_sum: sum,
            allocations,
            cost_index: costIndex === null ? null : Number(costIndex.toFixed(3)),
            stability_percent: stabilityPct,
            last_scenario: gameState.lastScenario ? {
                id: gameState.lastScenario.id,
                affectedSupplier: gameState.lastScenario.affectedSupplier,
                impactFactor: gameState.lastScenario.impactFactor
            } : null
        });
    };

    const __baseRenderToText = window.render_game_to_text;
  let __simulatedMs = 0;
  window.render_game_to_text = function renderGameToTextWithSimulatedMs() {
    const raw = typeof __baseRenderToText === "function" ? __baseRenderToText() : "{}";
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

  window.advanceTime = function advanceTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return true;
    __simulatedMs += ms;
    return true;
  };
});
