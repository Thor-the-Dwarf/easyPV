(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    points: 0,
    answered: false,
    done: false
  };

  const el = {
    caseKpi: document.getElementById('kpi-case'),
    scoreKpi: document.getElementById('kpi-score'),
    doneKpi: document.getElementById('kpi-done'),
    root: document.getElementById('case-root')
  };

  init();

  async function init() {
    const resp = await fetch('./game_abnahme_protokoll_check.json');
    if (!resp.ok) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    render();
  }

  function render() {
    updateKpis();

    if (state.done) {
      renderResult();
      return;
    }

    const current = state.cfg.cases[state.idx];
    const actions = state.cfg.actions.map((action) => {
      return `
        <button type="button" class="action-btn action-btn--${action.id}" data-action="${action.id}" ${state.answered ? 'disabled' : ''}>
          ${action.icon} ${action.label}
          <small>${action.desc}</small>
        </button>
      `;
    }).join('');

    el.root.innerHTML = `
      <article class="issue-card">
        <div class="issue-label">Mangelbeschreibung</div>
        <div class="issue-text">${current.issue}</div>
      </article>
      <div class="actions">${actions}</div>
      <div id="feedback" class="feedback" hidden></div>
      <button id="next-btn" class="next-btn" type="button" hidden>${state.idx === state.cfg.cases.length - 1 ? 'Auswertung anzeigen' : 'Naechster Fall'}</button>
    `;

    el.root.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => decide(btn.dataset.action));
    });

    document.getElementById('next-btn').addEventListener('click', next);
  }

  function decide(actionId) {
    if (state.answered || state.done) return;

    const current = state.cfg.cases[state.idx];
    const isCorrect = actionId === current.correct_action;

    state.answered = true;
    if (isCorrect) state.points += 100;

    const feedback = document.getElementById('feedback');
    feedback.hidden = false;
    feedback.className = `feedback ${isCorrect ? 'ok' : 'bad'}`;

    if (isCorrect) {
      feedback.innerHTML = `<strong>Korrekt.</strong> ${current.feedback_ok}<br><small>${current.legal_hint}</small>`;
    } else {
      feedback.innerHTML = `<strong>Nicht korrekt.</strong> Richtige Einordnung: <em>${labelOf(current.correct_action)}</em>.<br><small>${current.legal_hint}</small>`;
    }

    el.root.querySelectorAll('[data-action]').forEach((btn) => {
      btn.disabled = true;
    });

    document.getElementById('next-btn').hidden = false;
    updateKpis();
  }

  function next() {
    if (!state.answered) return;

    if (state.idx === state.cfg.cases.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.idx += 1;
    state.answered = false;
    render();
  }

  function renderResult() {
    const total = state.cfg.cases.length * 100;
    const rate = total ? Math.round((state.points / total) * 100) : 0;

    let verdict = 'Unsicher';
    if (rate >= 60) verdict = 'Solide';
    if (rate >= 80) verdict = 'Rechtssicher';
    if (rate === 100) verdict = 'Abnahme-Profi';

    el.root.innerHTML = `
      <section class="result">
        <h2>${verdict}</h2>
        <p>Abnahme-Sicherheit: <strong>${rate}%</strong></p>
        <p>Bewertung: <strong>${state.points}</strong> / ${total}</p>
        <p>Merksatz: Nicht jeder Fehler stoppt die Abnahme. Entscheidend ist, ob der Vertragszweck wesentlich beeintraechtigt ist.</p>
        <button id="restart-btn" class="restart-btn" type="button">Nochmal pruefen</button>
      </section>
    `;

    document.getElementById('restart-btn').addEventListener('click', restart);
  }

  function restart() {
    state.idx = 0;
    state.points = 0;
    state.answered = false;
    state.done = false;
    render();
  }

  function updateKpis() {
    const totalCases = state.cfg ? state.cfg.cases.length : 0;
    const caseDisplay = state.done ? totalCases : state.idx + 1;
    const max = totalCases * 100;
    const rate = max ? Math.round((state.points / max) * 100) : 0;
    const doneCount = state.done ? totalCases : state.idx + (state.answered ? 1 : 0);

    el.caseKpi.textContent = `${caseDisplay}/${totalCases}`;
    el.scoreKpi.textContent = `${rate}%`;
    el.doneKpi.textContent = `${doneCount}/${totalCases}`;
  }

  function labelOf(actionId) {
    const action = state.cfg.actions.find((item) => item.id === actionId);
    return action ? action.label : actionId;
  }

  function renderGameToText() {
    const totalCases = state.cfg ? state.cfg.cases.length : 0;
    return JSON.stringify({
      mode: 'abnahme_protokoll',
      coordinate_system: 'origin top-left, x right, y down',
      case_index: state.idx,
      case_display: `${Math.min(totalCases, state.idx + 1)}/${totalCases}`,
      points: state.points,
      answered: state.answered,
      done: state.done
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime() { return true; };
})();
