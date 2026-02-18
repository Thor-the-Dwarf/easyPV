(function () {
  'use strict';

  const state = {
    cfg: null,
    pointSelects: [],
    rowSelects: {},
    gpCells: {},
    sumCells: {},
    lastScore: null
  };

  const el = {
    customer: document.getElementById('situation-customer'),
    plan: document.getElementById('situation-plan'),
    table: document.getElementById('nwa-table'),
    feedback: document.getElementById('nwa-feedback'),
    progress: document.getElementById('progress-label'),
    submit: document.getElementById('submit-btn'),
    comparePanel: document.getElementById('compare-panel'),
    compareTables: document.getElementById('compare-tables')
  };

  init();

  async function init() {
    const resp = await fetch('_data/_gg01_der_matrix_architekt.json');
    if (!resp.ok) {
      el.feedback.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    el.customer.textContent = state.cfg.scenario.customer;
    el.plan.textContent = state.cfg.scenario.plan;

    buildTable();
    el.submit.addEventListener('click', submitEvaluation);
    recalcAll();
  }

  function buildTable() {
    const head = document.createElement('thead');
    const rowTop = document.createElement('tr');

    rowTop.appendChild(makeHead('Nr', 'nwa-col-nr'));
    rowTop.appendChild(makeHead('Kriterium', 'nwa-col-krit'));
    rowTop.appendChild(makeHead('Gewichtung', 'nwa-col-gew'));

    state.cfg.alternatives.forEach((alt) => {
      const th = document.createElement('th');
      th.colSpan = 2;
      th.textContent = alt.label;
      rowTop.appendChild(th);
    });

    const rowSub = document.createElement('tr');
    rowSub.appendChild(makeHead('', 'nwa-col-nr'));
    rowSub.appendChild(makeHead('', 'nwa-col-krit'));
    rowSub.appendChild(makeHead('', 'nwa-col-gew'));

    state.cfg.alternatives.forEach(() => {
      rowSub.appendChild(makeHead('Punkte', 'nwa-col-small'));
      rowSub.appendChild(makeHead('gP', 'nwa-col-small'));
    });

    head.appendChild(rowTop);
    head.appendChild(rowSub);

    const body = document.createElement('tbody');

    state.cfg.criteria.forEach((criterion, rowIdx) => {
      state.rowSelects[rowIdx] = [];

      const tr = document.createElement('tr');
      tr.appendChild(makeCell(String(criterion.nr), 'nwa-fixed'));
      tr.appendChild(makeCell(criterion.name, 'nwa-fixed'));
      tr.appendChild(makeCell(`${criterion.weight_percent} %`, 'nwa-fixed'));

      state.cfg.alternatives.forEach((alt) => {
        const pointsKey = keyOf(rowIdx, alt.id);
        tr.appendChild(makePointsCell(pointsKey, rowIdx));
        tr.appendChild(makeGpCell(pointsKey));
      });

      body.appendChild(tr);
    });

    const sumRow = document.createElement('tr');
    sumRow.appendChild(makeCell('', 'nwa-fixed'));
    sumRow.appendChild(makeCell('Auswertung', 'nwa-fixed'));
    sumRow.appendChild(makeCell('100 %', 'nwa-fixed'));

    state.cfg.alternatives.forEach((alt) => {
      sumRow.appendChild(makeCell('', 'nwa-fixed'));
      const td = document.createElement('td');
      td.className = 'nwa-sum-cell';
      td.textContent = '0,00';
      state.sumCells[alt.id] = td;
      sumRow.appendChild(td);
    });

    body.appendChild(sumRow);
    el.table.replaceChildren(head, body);

    Object.keys(state.rowSelects).forEach((rowIdx) => enforceRowUnique(Number(rowIdx)));
  }

  function makeHead(text, klass) {
    const th = document.createElement('th');
    th.className = klass || '';
    th.textContent = text;
    return th;
  }

  function makeCell(text, klass) {
    const td = document.createElement('td');
    td.className = klass || '';
    td.textContent = text;
    return td;
  }

  function makePointsCell(pointsKey, rowIdx) {
    const td = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'nwa-select';
    select.dataset.pointsKey = pointsKey;
    select.dataset.rowIndex = String(rowIdx);

    select.appendChild(new Option('-', ''));
    for (let i = 1; i <= 4; i += 1) {
      select.appendChild(new Option(String(i), String(i)));
    }

    select.addEventListener('change', () => {
      select.classList.remove('is-correct', 'is-wrong');
      enforceRowUnique(rowIdx);
      recalcAll();
    });

    td.appendChild(select);
    state.pointSelects.push(select);
    state.rowSelects[rowIdx].push(select);
    return td;
  }

  function makeGpCell(pointsKey) {
    const td = document.createElement('td');
    td.className = 'nwa-gp-cell';
    td.textContent = '-';
    state.gpCells[pointsKey] = td;
    return td;
  }

  function enforceRowUnique(rowIdx) {
    const row = state.rowSelects[rowIdx] || [];

    row.forEach((select) => {
      const usedByOthers = new Set(
        row
          .filter((other) => other !== select && other.value !== '')
          .map((other) => other.value)
      );

      Array.from(select.options).forEach((option) => {
        if (option.value === '') {
          option.disabled = false;
          return;
        }
        option.disabled = usedByOthers.has(option.value) && option.value !== select.value;
      });
    });
  }

  function recalcAll() {
    const altSums = {};
    state.cfg.alternatives.forEach((alt) => {
      altSums[alt.id] = 0;
    });

    let filled = 0;

    state.pointSelects.forEach((select) => {
      const pointsKey = select.dataset.pointsKey;
      const [rowIndexRaw, altId] = pointsKey.split('|');
      const rowIndex = Number(rowIndexRaw);
      const weight = state.cfg.criteria[rowIndex].weight_percent;
      const cell = state.gpCells[pointsKey];

      if (select.value === '') {
        cell.textContent = '-';
        cell.className = 'nwa-gp-cell';
        return;
      }

      const points = Number(select.value);
      filled += 1;
      const gp = (weight * points) / 100;
      altSums[altId] += gp;
      cell.textContent = formatDecimal(gp);
      cell.className = 'nwa-gp-cell is-filled';
    });

    state.cfg.alternatives.forEach((alt) => {
      state.sumCells[alt.id].textContent = formatDecimal(altSums[alt.id]);
    });

    const total = state.pointSelects.length;
    const progressPercent = total ? Math.round((filled / total) * 100) : 0;
    el.progress.textContent = `${progressPercent}%`;
  }

  function submitEvaluation() {
    const empty = state.pointSelects.filter((select) => select.value === '');
    if (empty.length > 0) {
      el.feedback.textContent = `Bitte alle Felder ausfuellen. Es fehlen noch ${empty.length} Punktwerte.`;
      el.feedback.className = 'nwa-feedback bad';
      return;
    }

    const duplicateRows = findRowsWithDuplicates();
    if (duplicateRows.length > 0) {
      el.feedback.textContent = `In Zeile ${duplicateRows.join(', ')} sind Punkte doppelt vergeben. Pro Kriterium sind nur 1,2,3,4 jeweils einmal erlaubt.`;
      el.feedback.className = 'nwa-feedback bad';
      return;
    }

    let correct = 0;
    const total = state.pointSelects.length;

    state.pointSelects.forEach((select) => {
      const [rowIndexRaw, altId] = select.dataset.pointsKey.split('|');
      const rowIndex = Number(rowIndexRaw);
      const expected = state.cfg.criteria[rowIndex].values[altId].punkte;
      const given = Number(select.value);

      select.classList.remove('is-correct', 'is-wrong');
      if (given === expected) {
        correct += 1;
        select.classList.add('is-correct');
      } else {
        select.classList.add('is-wrong');
      }
    });

    const score = Math.round((correct / total) * 100);
    state.lastScore = score;

    if (score === 100) {
      el.feedback.textContent = 'Sehr stark. Alle Punktvergaben passen zur Musterloesung.';
      el.feedback.className = 'nwa-feedback ok';
    } else {
      el.feedback.textContent = `${score}% korrekt. Unten findest du fuer jedes Kriterium eine eigene Vergleichstabelle mit Erklaerungen.`;
      el.feedback.className = 'nwa-feedback bad';
    }

    showComparisonPanel();
  }

  function findRowsWithDuplicates() {
    return state.cfg.criteria
      .map((criterion, rowIdx) => {
        const values = (state.rowSelects[rowIdx] || []).map((select) => select.value);
        const unique = new Set(values);
        return unique.size !== values.length ? criterion.nr : null;
      })
      .filter((nr) => nr !== null);
  }

  function showComparisonPanel() {
    el.comparePanel.classList.remove('hidden');
    renderAllComparisonTables();
  }

  function renderAllComparisonTables() {
    el.compareTables.replaceChildren();

    state.cfg.criteria.forEach((criterion) => {
      const block = document.createElement('section');
      block.className = 'nwa-criterion-block';

      const title = document.createElement('h3');
      title.textContent = `${criterion.nr}. ${criterion.name}`;
      block.appendChild(title);

      const wrap = document.createElement('div');
      wrap.className = 'nwa-compare-scroll';
      wrap.appendChild(buildCriterionTable(criterion));
      block.appendChild(wrap);

      el.compareTables.appendChild(block);
    });
  }

  function buildCriterionTable(criterion) {
    const table = document.createElement('table');
    table.className = 'nwa-criterion-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.appendChild(makeHead(`Vergleich (${criterion.name})`));
    state.cfg.alternatives.forEach((alt) => headRow.appendChild(makeHead(alt.label)));
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    state.cfg.alternatives.forEach((rowAlt) => {
      const tr = document.createElement('tr');
      tr.appendChild(makeCell(rowAlt.label, 'nwa-compare-rowhead'));

      state.cfg.alternatives.forEach((colAlt) => {
        const td = document.createElement('td');
        td.className = 'nwa-compare-cell';

        if (rowAlt.id === colAlt.id) {
          td.textContent = '-';
        } else {
          td.textContent = buildPairExplanation(criterion, rowAlt.id, colAlt.id);
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
  }

  function buildPairExplanation(criterion, rowAltId, colAltId) {
    const rowPoints = criterion.values[rowAltId].punkte;
    const colPoints = criterion.values[colAltId].punkte;
    const rowLabel = altLabel(rowAltId);
    const colLabel = altLabel(colAltId);

    if (rowPoints > colPoints) {
      return `${rowLabel} besser (${rowPoints} vs ${colPoints}), weil ${criterion.reasoning[rowAltId]}.`;
    }

    return `${colLabel} besser (${colPoints} vs ${rowPoints}), weil ${criterion.reasoning[colAltId]}.`;
  }

  function altLabel(altId) {
    const alt = state.cfg.alternatives.find((item) => item.id === altId);
    return alt ? alt.label : altId;
  }

  function formatDecimal(value) {
    return value.toFixed(2).replace('.', ',');
  }

  function keyOf(rowIdx, altId) {
    return `${rowIdx}|${altId}`;
  }

  function renderGameToText() {
    const filled = state.pointSelects.filter((s) => s.value !== '').length;
    const total = state.pointSelects.length;
    return JSON.stringify({
      mode: 'matrix_architekt_dropdown',
      coordinate_system: 'origin top-left, x right, y down',
      total_point_fields: total,
      filled_point_fields: filled,
      progress_percent: total ? Math.round((filled / total) * 100) : 0,
      last_score_percent: state.lastScore
    });
  }

  window.render_game_to_text = renderGameToText;
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
})();
