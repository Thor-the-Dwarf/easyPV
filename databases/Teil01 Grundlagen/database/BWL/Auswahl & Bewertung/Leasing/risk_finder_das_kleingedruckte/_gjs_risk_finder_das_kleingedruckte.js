(function () {
  'use strict';

  const state = {
    cfg: null,
    selected: new Set(),
    checked: false,
    foundTargets: 0,
    falseClicks: 0,
    score: 0
  };

  const el = {
    targets: document.getElementById('risk-targets'),
    falseHits: document.getElementById('risk-false'),
    score: document.getElementById('risk-score'),
    contract: document.getElementById('risk-contract'),
    terms: document.getElementById('risk-terms'),
    check: document.getElementById('risk-check'),
    reset: document.getElementById('risk-reset'),
    feedback: document.getElementById('risk-feedback')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('data/_gg01_risk_finder_das_kleingedruckte.json');
      if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await resp.json();
      renderContract();
      renderTerms();
      bindActions();
      updateStats();
      showFeedback('neutral', 'Markiere die vermuteten Kostenfallen und pruefe dann.');
    } catch (error) {
      el.contract.textContent = String(error && error.message ? error.message : 'Unbekannter Ladefehler');
    }
  }

  function bindActions() {
    el.check.addEventListener('click', evaluateSelection);
    el.reset.addEventListener('click', resetRound);
  }

  function renderContract() {
    el.contract.innerHTML = state.cfg.contract_excerpt
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('');
  }

  function renderTerms() {
    const shuffled = shuffle(state.cfg.terms.map((term) => ({ ...term })));
    el.terms.innerHTML = shuffled
      .map((term) => {
        return `
          <button type="button" class="risk-term" data-term="${escapeHtml(term.id)}">
            <span class="risk-term-label">${escapeHtml(term.label)}</span>
          </button>
        `;
      })
      .join('');

    el.terms.querySelectorAll('.risk-term').forEach((button) => {
      button.addEventListener('click', () => toggleTerm(button.dataset.term));
    });
  }

  function toggleTerm(termId) {
    if (state.checked) return;

    if (state.selected.has(termId)) {
      state.selected.delete(termId);
    } else {
      state.selected.add(termId);
    }
    paintSelection();
  }

  function paintSelection() {
    el.terms.querySelectorAll('.risk-term').forEach((button) => {
      const termId = button.dataset.term;
      button.classList.toggle('is-selected', state.selected.has(termId));
    });
  }

  function evaluateSelection() {
    if (!state.cfg || state.checked) return;

    const targets = state.cfg.terms.filter((term) => term.is_target);
    const targetIds = new Set(targets.map((term) => term.id));

    let foundTargets = 0;
    let falseClicks = 0;

    for (const termId of state.selected) {
      if (targetIds.has(termId)) {
        foundTargets += 1;
      } else {
        falseClicks += 1;
      }
    }

    const missedTargets = Math.max(0, targets.length - foundTargets);
    const penalty = (missedTargets * state.cfg.scoring.miss_penalty) + (falseClicks * state.cfg.scoring.false_penalty);
    const score = Math.max(0, state.cfg.scoring.max_score - penalty);

    state.foundTargets = foundTargets;
    state.falseClicks = falseClicks;
    state.score = score;
    state.checked = true;

    paintResult(targetIds);
    updateStats();

    if (foundTargets === targets.length && falseClicks === 0) {
      showFeedback('ok', 'Perfekt. Alle 5 Risiken erkannt, keine Fehlklicks.');
    } else {
      showFeedback(
        'bad',
        `Gefunden: ${foundTargets}/5, Fehlklicks: ${falseClicks}, uebersehen: ${missedTargets}.`
      );
    }
  }

  function paintResult(targetIds) {
    el.terms.querySelectorAll('.risk-term').forEach((button) => {
      const termId = button.dataset.term;
      const isTarget = targetIds.has(termId);
      const isSelected = state.selected.has(termId);

      button.disabled = true;
      if (isTarget && isSelected) button.classList.add('is-correct');
      if (!isTarget && isSelected) button.classList.add('is-false');
      if (isTarget && !isSelected) button.classList.add('is-missed');
    });
  }

  function resetRound() {
    if (!state.cfg) return;
    state.selected.clear();
    state.checked = false;
    state.foundTargets = 0;
    state.falseClicks = 0;
    state.score = 0;

    renderTerms();
    updateStats();
    showFeedback('neutral', 'Neue Runde gestartet. Suche wieder die 5 Kostenfallen.');
  }

  function updateStats() {
    const totalTargets = state.cfg ? state.cfg.terms.filter((term) => term.is_target).length : 0;
    el.targets.textContent = `Gefunden: ${state.foundTargets}/${totalTargets}`;
    el.falseHits.textContent = `Fehlklicks: ${state.falseClicks}`;
    el.score.textContent = `Score: ${state.score}`;
  }

  function showFeedback(type, message) {
    el.feedback.className = `riskfinder-feedback ${type}`;
    el.feedback.textContent = message;
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
    const targetIds = state.cfg ? state.cfg.terms.filter((term) => term.is_target).map((term) => term.id) : [];
    return JSON.stringify({
      mode: state.checked ? 'result' : 'selection',
      coordinate_system: 'origin top-left, x right, y down',
      selected_terms: Array.from(state.selected),
      target_terms: targetIds,
      found_targets: state.foundTargets,
      false_clicks: state.falseClicks,
      score: state.score
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
