(function () {
  'use strict';

  const EAR_ORDER = ['sache', 'ich', 'du', 'appell'];
  const KEY_TO_EAR = {
    ArrowUp: 'sache',
    ArrowLeft: 'ich',
    ArrowRight: 'du',
    ArrowDown: 'appell'
  };

  const state = {
    cfg: null,
    index: 0,
    score: 0,
    hits: 0,
    done: false,
    last: null,
    locked: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    hits: document.getElementById('kpi-hits'),
    card: document.getElementById('card')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('./_gg01_nachricht_scanner_welches_ohr_hort_mit.json');
      if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await resp.json();
      window.addEventListener('keydown', onKeyDown);
      render();
    } catch (_error) {
      el.card.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function currentStatement() {
    return state.cfg.statements[state.index] || null;
  }

  function earLabel(earId) {
    const hit = state.cfg.ears.find((ear) => ear.id === earId);
    return hit ? hit.label : earId;
  }

  function onKeyDown(event) {
    if (!state.cfg) return;
    if (state.locked) return;
    if (event.repeat) return;

    if (state.done) {
      if (event.key === 'Enter' || event.key === ' ') restart();
      return;
    }

    const earId = KEY_TO_EAR[event.key];
    if (!earId) return;
    event.preventDefault();
    answer(earId);
  }

  function render() {
    if (!state.cfg) return;
    updateKpis();

    if (state.done) {
      renderResult();
      return;
    }

    const statement = currentStatement();
    const buttons = EAR_ORDER.map((earId) => {
      const label = earLabel(earId);
      const testId = `ear-${earId}`;
      return `
        <button class="scanner-btn" type="button" data-ear="${earId}" data-testid="${testId}">
          ${escapeHtml(label)}
        </button>
      `;
    }).join('');

    const feedback = state.last
      ? `
        <div class="feedback ${state.last.correct ? 'ok' : 'bad'}" aria-live="polite">
          ${
            state.last.correct
              ? `<strong>Richtig:</strong> ${escapeHtml(state.last.explanation)}`
              : `<strong>Falsch:</strong> Korrekt ist <strong>${escapeHtml(earLabel(state.last.expectedEar))}</strong>. ${escapeHtml(state.last.explanation)}`
          }
        </div>
      `
      : '<div class="feedback" hidden></div>';

    el.card.innerHTML = `
      <div class="bubble">
        <div class="bubble-label">Aussage</div>
        <div class="bubble-text">${escapeHtml(statement.text)}</div>
      </div>
      <div class="scanner-grid">${buttons}</div>
      ${feedback}
    `;

    el.card.querySelectorAll('[data-ear]').forEach((btn) => {
      btn.addEventListener('click', () => answer(btn.dataset.ear));
    });
  }

  function answer(earId) {
    if (state.locked || state.done) return;

    const statement = currentStatement();
    if (!statement) return;
    if (!EAR_ORDER.includes(earId)) return;

    state.locked = true;
    const lastCorrect = earId === statement.correct_ear;

    if (lastCorrect) {
      state.score += state.cfg.scoring.correct;
      state.hits += 1;
    } else {
      state.score += state.cfg.scoring.wrong;
    }

    state.last = {
      correct: lastCorrect,
      selectedEar: earId,
      expectedEar: statement.correct_ear,
      explanation: statement.explanation || ''
    };

    if (state.index >= state.cfg.statements.length - 1) {
      state.done = true;
    } else {
      state.index += 1;
    }

    render();
    updateKpis();

    // Allow the next input after the DOM updated (prevents key-repeat/double taps).
    requestAnimationFrame(() => {
      state.locked = false;
    });
  }

  function renderResult() {
    const total = state.cfg.statements.length;
    const percent = total ? Math.round((state.hits / total) * 100) : 0;

    let verdict = 'Guter Start';
    if (percent >= 80) verdict = 'Starker Scanner';
    if (percent === 100) verdict = 'Vier-Ohren-Meister';

    el.card.innerHTML = `
      <section class="result">
        <h2>${verdict}</h2>
        <p>Treffer: <strong>${state.hits}</strong> / ${total} (${percent}%)</p>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Merksatz: Frage dich immer: Fakt, Ich, Du oder Appell?</p>
        <button id="restart-btn" class="restart-btn" type="button">Nochmal spielen</button>
      </section>
    `;
    document.getElementById('restart-btn').addEventListener('click', restart);
  }

  function restart() {
    state.index = 0;
    state.score = 0;
    state.hits = 0;
    state.done = false;
    state.last = null;
    state.locked = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg ? state.cfg.statements.length : 0;
    const current = state.done ? total : state.index + 1;
    el.round.textContent = `${current}/${total}`;
    el.score.textContent = String(state.score);
    el.hits.textContent = String(state.hits);
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
    const statement = state.cfg && !state.done ? currentStatement() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'scanner',
      coordinate_system: 'origin top-left, x right, y down',
      index: state.index,
      total: state.cfg ? state.cfg.statements.length : 0,
      score: state.score,
      hits: state.hits,
      last: state.last,
      expected_ear: statement ? statement.correct_ear : null,
      statement: statement ? statement.text : null
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
