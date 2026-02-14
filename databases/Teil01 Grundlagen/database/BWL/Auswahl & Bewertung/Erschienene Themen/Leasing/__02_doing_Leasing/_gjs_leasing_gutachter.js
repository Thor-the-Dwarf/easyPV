(function () {
  'use strict';

  const STATE = {
    config: null,
    index: 0,
    score: 0,
    answered: false,
    feedbackHtml: '',
    feedbackState: ''
  };

  const OK_LINES = ['Sauber.', 'Stark erkannt.', 'Exakt.'];
  const BAD_LINES = ['Fast.', 'Knapp daneben.', 'Guter Versuch.'];

  const gameRoot = document.getElementById('game-root');
  const progressEl = document.getElementById('progress');
  const scoreEl = document.getElementById('score');
  const accuracyEl = document.getElementById('accuracy');
  const progressFillEl = document.getElementById('progress-fill');

  function shortText(text, maxLen) {
    const t = String(text || '').trim();
    if (t.length <= maxLen) return t;
    return t.slice(0, maxLen).replace(/[\s,;:.!?-]+$/g, '') + '...';
  }

  function labelForType(key) {
    const hit = STATE.config.defectTypes.find((x) => x.key === key);
    return hit ? hit.label : key;
  }

  function rand(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function currentCase() {
    return STATE.config.cases[STATE.index] || null;
  }

  async function init() {
    try {
      const resp = await fetch('./_gg01_leasing_gutachter.json');
      if (!resp.ok) throw new Error('Konfiguration nicht geladen.');
      STATE.config = await resp.json();
      render();
    } catch (err) {
      gameRoot.innerHTML = `<article class="result"><h2>Fehler</h2><p>${escapeHtml(err.message)}</p></article>`;
    }
  }

  function choose(typeKey) {
    if (STATE.answered) return;

    const c = currentCase();
    if (!c) return;

    const correct = c.defectType === typeKey;
    if (correct) STATE.score += 1;

    STATE.feedbackState = correct ? 'ok' : 'bad';
    STATE.feedbackHtml = `
      <h3>${escapeHtml(correct ? rand(OK_LINES) : rand(BAD_LINES))}</h3>
      <p><strong>Dein Pick:</strong> ${escapeHtml(labelForType(typeKey))}</p>
      <p><strong>Richtig:</strong> ${escapeHtml(labelForType(c.defectType))}</p>
      <p style="margin-top:6px;">${escapeHtml(shortText(c.explanation, 130))}</p>
    `;

    STATE.answered = true;
    render();
  }

  function nextCase() {
    if (!STATE.answered) return;
    STATE.index += 1;
    STATE.answered = false;
    STATE.feedbackHtml = '';
    STATE.feedbackState = '';
    render();
  }

  function restart() {
    STATE.index = 0;
    STATE.score = 0;
    STATE.answered = false;
    STATE.feedbackHtml = '';
    STATE.feedbackState = '';
    render();
  }

  function render() {
    const total = STATE.config.cases.length;
    const seen = Math.min(STATE.index, total);
    const accuracy = seen > 0 ? Math.round((STATE.score / seen) * 100) : 0;

    progressEl.textContent = `${Math.min(STATE.index + 1, total)}/${total}`;
    scoreEl.textContent = `${STATE.score}`;
    accuracyEl.textContent = `${accuracy}%`;
    progressFillEl.style.width = `${Math.round((seen / total) * 100)}%`;

    if (STATE.index >= total) {
      const finalAccuracy = Math.round((STATE.score / total) * 100);
      gameRoot.innerHTML = `
        <article class="result">
          <h2>Fertig</h2>
          <p>${STATE.score}/${total} richtig (${finalAccuracy}%).</p>
          <button id="restart" class="restart">Nochmal</button>
        </article>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const c = currentCase();
    const buttons = STATE.config.defectTypes.map((t) => {
      return `<button class="choice" data-key="${escapeAttr(t.key)}" ${STATE.answered ? 'disabled' : ''}>${escapeHtml(t.label)}</button>`;
    }).join('');

    const feedback = STATE.feedbackHtml
      ? `<div class="feedback ${STATE.feedbackState}">${STATE.feedbackHtml}</div>`
      : '';

    gameRoot.innerHTML = `
      <article class="case">
        <img class="case-img" src="${escapeAttr(c.imageUrl)}" alt="Fall ${escapeAttr(c.id)}" loading="lazy">
        <div class="case-body">
          <h2 class="case-title">Fall ${STATE.index + 1}</h2>
          <p class="case-desc">${escapeHtml(shortText(c.description, 72))}</p>
          <p class="prompt">Welche Mangelart passt am besten?</p>
          <div class="choices">${buttons}</div>
          ${feedback}
          ${STATE.answered ? '<button id="next" class="next">Weiter</button>' : ''}
        </div>
      </article>
    `;

    gameRoot.querySelectorAll('.choice').forEach((btn) => {
      btn.addEventListener('click', () => choose(btn.dataset.key));
    });

    const nextBtn = document.getElementById('next');
    if (nextBtn) nextBtn.addEventListener('click', nextCase);
  }

  function renderGameToText() {
    const c = currentCase();
    return JSON.stringify({
      mode: STATE.index >= (STATE.config ? STATE.config.cases.length : 0) ? 'result' : 'question',
      coordinate_system: 'origin top-left, x right, y down',
      current_index: STATE.index,
      total: STATE.config ? STATE.config.cases.length : 0,
      score: STATE.score,
      answered: STATE.answered,
      options: STATE.config ? STATE.config.defectTypes.map((d) => d.key) : [],
      current_case: c ? { id: c.id, description: c.description, expected_type: c.defectType } : null
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime() { return true; };

  function escapeHtml(v) {
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(v) { return escapeHtml(v); }

  init();
})();
