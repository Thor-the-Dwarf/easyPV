(function () {
  'use strict';

  const state = {
    cfg: null,
    selected: new Set(),
    score: 0,
    timeLeft: 0,
    checked: false,
    done: false,
    timerId: null,
    found: 0,
    falseClicks: 0
  };

  const el = {
    time: document.getElementById('an-kpi-time'),
    selected: document.getElementById('an-kpi-selected'),
    score: document.getElementById('an-kpi-score'),
    list: document.getElementById('an-list'),
    feedback: document.getElementById('an-feedback'),
    check: document.getElementById('an-check'),
    restart: document.getElementById('an-restart')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('data/_gg01_fehler_suche_der_korrupte_analyst.json');
      if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await resp.json();
      wire();
      restartGame();
    } catch (_error) {
      el.feedback.textContent = 'Konfiguration konnte nicht geladen werden.';
      el.feedback.className = 'analyst-feedback bad';
    }
  }

  function wire() {
    el.check.addEventListener('click', evaluate);
    el.restart.addEventListener('click', restartGame);
  }

  function restartGame() {
    stopTimer();
    state.selected.clear();
    state.score = 0;
    state.timeLeft = state.cfg.time_limit_sec;
    state.checked = false;
    state.done = false;
    state.found = 0;
    state.falseClicks = 0;

    renderList();
    setFeedback('neutral', 'Markiere die verdaechtigen Zeilen und klicke auf Pruefen.');
    updateKpis();
    startTimer();
  }

  function startTimer() {
    state.timerId = setInterval(() => {
      if (state.done) return;
      state.timeLeft -= 1;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.done = true;
        evaluate(true);
      }
      updateKpis();
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  }

  function renderList() {
    el.list.innerHTML = state.cfg.rows.map((row) => {
      const classes = ['analyst-row'];
      if (state.selected.has(row.id)) classes.push('is-selected');
      return `
        <button type="button" class="${classes.join(' ')}" data-row="${escapeHtml(row.id)}" ${state.done ? 'disabled' : ''}>
          <strong>${escapeHtml(row.criterion)}</strong>
          <span>${row.weight_percent}% * Note ${row.score} = <strong>${formatGp(row.displayed_gp)}</strong></span>
        </button>
      `;
    }).join('');

    el.list.querySelectorAll('[data-row]').forEach((button) => {
      button.addEventListener('click', () => toggleRow(button.dataset.row));
    });
  }

  function toggleRow(rowId) {
    if (state.done) return;
    if (state.selected.has(rowId)) state.selected.delete(rowId);
    else state.selected.add(rowId);
    renderList();
    updateKpis();
  }

  function evaluate(fromTimeout) {
    if (!state.cfg) return;
    if (state.checked) return;

    state.checked = true;
    state.done = true;
    stopTimer();

    const errorIds = new Set(state.cfg.rows.filter((row) => row.is_error).map((row) => row.id));
    let found = 0;
    let falseClicks = 0;

    for (const rowId of state.selected) {
      if (errorIds.has(rowId)) found += 1;
      else falseClicks += 1;
    }

    const score = Math.max(0, Math.min(
      state.cfg.scoring.max_score,
      (found * state.cfg.scoring.found_error) + (falseClicks * state.cfg.scoring.false_click)
    ));

    state.found = found;
    state.falseClicks = falseClicks;
    state.score = score;

    paintResult(errorIds);
    updateKpis();

    if (found === errorIds.size && falseClicks === 0) {
      setFeedback('ok', 'Perfekt. Alle 5 Fehler gefunden, keine falschen Markierungen.');
    } else if (fromTimeout) {
      setFeedback('bad', `Zeit abgelaufen. Gefunden: ${found}/5, Fehlmarkierungen: ${falseClicks}, Score: ${score}.`);
    } else {
      setFeedback('bad', `Gefunden: ${found}/5, Fehlmarkierungen: ${falseClicks}, Score: ${score}.`);
    }
  }

  function paintResult(errorIds) {
    el.list.querySelectorAll('[data-row]').forEach((button) => {
      const rowId = button.dataset.row;
      const isError = errorIds.has(rowId);
      const isSelected = state.selected.has(rowId);
      button.disabled = true;
      button.classList.remove('is-selected');
      if (isError && isSelected) button.classList.add('is-correct');
      if (!isError && isSelected) button.classList.add('is-false');
      if (isError && !isSelected) button.classList.add('is-missed');
    });
  }

  function updateKpis() {
    el.time.textContent = `${state.timeLeft}s`;
    el.selected.textContent = String(state.selected.size);
    el.score.textContent = String(state.score);
  }

  function setFeedback(type, text) {
    el.feedback.className = `analyst-feedback ${type}`;
    el.feedback.textContent = text;
  }

  function formatGp(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    return num % 1 === 0 ? String(num) : num.toFixed(2);
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
    return JSON.stringify({
      mode: state.done ? 'result' : 'selection',
      coordinate_system: 'origin top-left, x right, y down',
      time_left_sec: state.timeLeft,
      selected_rows: Array.from(state.selected),
      found: state.found,
      false_clicks: state.falseClicks,
      score: state.score
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();

