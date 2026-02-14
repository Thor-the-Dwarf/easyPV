(function () {
  'use strict';

  const state = {
    cfg: null,
    selectedStatementId: null,
    placements: {},
    checked: false,
    score: 0
  };

  const el = {
    curve: document.getElementById('curve'),
    pool: document.getElementById('statement-pool'),
    feedback: document.getElementById('feedback'),
    phaseDesc: document.getElementById('phase-desc'),
    progress: document.getElementById('progress-label'),
    score: document.getElementById('score-label'),
    status: document.getElementById('status-label'),
    checkBtn: document.getElementById('check-btn'),
    resetBtn: document.getElementById('reset-btn')
  };

  init();

  async function init() {
    try {
      const response = await fetch('./_gg01_kurve_der_veraenderung.json');
      if (!response.ok) throw new Error('Konfiguration nicht gefunden.');
      state.cfg = await response.json();
      rebuildRound();
      bindControls();
    } catch (error) {
      el.feedback.textContent = `Fehler: ${error.message}`;
      el.status.textContent = 'Fehler';
    }
  }

  function bindControls() {
    el.checkBtn.addEventListener('click', checkAssignments);
    el.resetBtn.addEventListener('click', rebuildRound);
  }

  function rebuildRound() {
    state.selectedStatementId = null;
    state.checked = false;
    state.score = 0;
    state.placements = {};
    state.cfg.statements.forEach((statement) => {
      state.placements[statement.id] = null;
    });

    renderPhases();
    renderStatements();
    renderMeta();
    el.feedback.textContent = '';
    el.phaseDesc.textContent = 'Waehle eine Phase, um ihre Bedeutung zu sehen.';
  }

  function renderPhases() {
    const fragment = document.createDocumentFragment();

    state.cfg.phases.forEach((phase) => {
      const phaseEl = document.createElement('section');
      phaseEl.className = 'phase';

      const dot = document.createElement('div');
      dot.className = 'phase-dot';

      const slot = document.createElement('div');
      slot.className = 'phase-slot';
      slot.dataset.phaseId = phase.id;
      slot.title = phase.description;

      slot.addEventListener('click', () => {
        el.phaseDesc.textContent = phase.description;
        if (state.selectedStatementId) {
          assignToPhase(state.selectedStatementId, phase.id);
          state.selectedStatementId = null;
          renderStatements();
          renderPhases();
          renderMeta();
        }
      });

      slot.addEventListener('dragover', (event) => {
        event.preventDefault();
        slot.classList.add('dragover');
      });

      slot.addEventListener('dragleave', () => {
        slot.classList.remove('dragover');
      });

      slot.addEventListener('drop', (event) => {
        event.preventDefault();
        slot.classList.remove('dragover');
        const statementId = event.dataTransfer.getData('text/plain');
        if (statementId) {
          assignToPhase(statementId, phase.id);
          state.selectedStatementId = null;
          renderStatements();
          renderPhases();
          renderMeta();
        }
      });

      const statementsForPhase = getStatementsByPhase(phase.id);
      statementsForPhase.forEach((statement) => {
        slot.appendChild(makeStatementCard(statement, true));
      });

      if (state.checked) {
        const hasWrong = statementsForPhase.some((statement) => statement.phaseId !== phase.id);
        const hasAny = statementsForPhase.length > 0;
        if (hasAny) slot.classList.add(hasWrong ? 'wrong' : 'correct');
      }

      const name = document.createElement('div');
      name.className = 'phase-name';
      name.textContent = phase.label;

      phaseEl.appendChild(dot);
      phaseEl.appendChild(slot);
      phaseEl.appendChild(name);
      fragment.appendChild(phaseEl);
    });

    el.curve.replaceChildren(fragment);
  }

  function renderStatements() {
    const unassigned = shuffledUnassigned();
    const fragment = document.createDocumentFragment();

    if (unassigned.length === 0) {
      const done = document.createElement('p');
      done.className = 'hint';
      done.textContent = 'Alle Aussagen wurden zugeordnet. Jetzt pruefen.';
      fragment.appendChild(done);
    }

    unassigned.forEach((statement) => {
      fragment.appendChild(makeStatementCard(statement, false));
    });

    el.pool.replaceChildren(fragment);
  }

  function makeStatementCard(statement, placed) {
    const card = document.createElement('article');
    card.className = 'statement';
    card.draggable = !state.checked;
    card.dataset.statementId = statement.id;
    card.textContent = statement.text;

    if (!state.checked && state.selectedStatementId === statement.id) {
      card.classList.add('selected');
    }

    if (state.checked) {
      card.classList.add(statement.phaseId === state.placements[statement.id] ? 'correct' : 'wrong');
    }

    if (!state.checked) {
      card.addEventListener('click', () => {
        if (placed) {
          state.placements[statement.id] = null;
          state.selectedStatementId = statement.id;
          renderStatements();
          renderPhases();
          renderMeta();
          return;
        }

        state.selectedStatementId = state.selectedStatementId === statement.id ? null : statement.id;
        renderStatements();
      });

      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', statement.id);
        event.dataTransfer.effectAllowed = 'move';
      });
    }

    return card;
  }

  function assignToPhase(statementId, phaseId) {
    if (!state.placements.hasOwnProperty(statementId) || state.checked) return;
    state.placements[statementId] = phaseId;
  }

  function getStatementsByPhase(phaseId) {
    return state.cfg.statements.filter((statement) => state.placements[statement.id] === phaseId);
  }

  function shuffledUnassigned() {
    const list = state.cfg.statements.filter((statement) => state.placements[statement.id] === null);
    return list.sort((a, b) => a.id.localeCompare(b.id));
  }

  function renderMeta() {
    const total = state.cfg.statements.length;
    const assigned = Object.values(state.placements).filter(Boolean).length;
    el.progress.textContent = `${assigned}/${total}`;
    el.checkBtn.disabled = assigned !== total || state.checked;
    el.score.textContent = String(state.score);

    if (state.checked) {
      el.status.textContent = state.score === total ? 'Perfekt' : 'Ausgewertet';
      return;
    }

    el.status.textContent = assigned === total ? 'Bereit zum Pruefen' : 'In Arbeit';
  }

  function checkAssignments() {
    const total = state.cfg.statements.length;
    const assigned = Object.values(state.placements).filter(Boolean).length;

    if (assigned !== total) {
      el.feedback.textContent = 'Bitte zuerst alle Aussagen zuordnen.';
      return;
    }

    state.checked = true;
    state.score = state.cfg.statements.reduce((sum, statement) => {
      return sum + (statement.phaseId === state.placements[statement.id] ? 1 : 0);
    }, 0);

    if (state.score === total) {
      el.feedback.textContent = `Stark. ${state.score}/${total} korrekt. Du erkennst die Change-Phasen sicher.`;
    } else {
      el.feedback.textContent = `${state.score}/${total} korrekt. Falsche Karten sind rot markiert. Klick auf "Neu mischen" fuer einen neuen Durchlauf.`;
    }

    renderStatements();
    renderPhases();
    renderMeta();
  }

  function renderGameToText() {
    const assignments = state.cfg
      ? state.cfg.statements.map((statement) => ({
          id: statement.id,
          text: statement.text,
          assigned_phase: state.placements[statement.id],
          expected_phase: statement.phaseId
        }))
      : [];

    return JSON.stringify({
      mode: state.checked ? 'checked' : 'matching',
      coordinate_system: 'origin top-left, x right, y down',
      goal: state.cfg ? state.cfg.goal : '',
      selected_statement_id: state.selectedStatementId,
      assigned_count: assignments.filter((entry) => !!entry.assigned_phase).length,
      total_count: assignments.length,
      score: state.score,
      status: el.status.textContent,
      phases: state.cfg ? state.cfg.phases.map((phase) => phase.id) : [],
      assignments: assignments
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime() { return true; };
})();
