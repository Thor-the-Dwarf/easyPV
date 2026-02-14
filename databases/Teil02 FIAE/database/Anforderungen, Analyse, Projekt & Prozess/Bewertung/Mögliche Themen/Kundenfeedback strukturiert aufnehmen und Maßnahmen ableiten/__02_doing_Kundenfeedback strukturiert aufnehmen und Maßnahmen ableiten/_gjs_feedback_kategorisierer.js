(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    hits: 0,
    answered: false,
    done: false,
    roadmap: {
      bug: [],
      feature: [],
      support: [],
      lob: []
    }
  };

  const el = {
    round: document.getElementById('kpi-round'),
    hits: document.getElementById('kpi-hits'),
    rate: document.getElementById('kpi-rate'),
    feedbackRoot: document.getElementById('feedback-root'),
    road: {
      bug: document.getElementById('road-bug'),
      feature: document.getElementById('road-feature'),
      support: document.getElementById('road-support'),
      lob: document.getElementById('road-lob')
    }
  };

  init();

  async function init() {
    const resp = await fetch('./_gg01_feedback_kategorisierer.json');
    if (!resp.ok) {
      el.feedbackRoot.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    render();
  }

  function render() {
    updateKpis();
    renderRoadmap();

    if (state.done) {
      renderResult();
      return;
    }

    const item = state.cfg.feedbacks[state.idx];
    const tags = state.cfg.tags.map((tag) => {
      return `<button type="button" class="tag-btn tag-btn--${tag.color}" data-tag="${tag.id}" ${state.answered ? 'disabled' : ''}>${tag.icon} ${tag.label}</button>`;
    }).join('');

    el.feedbackRoot.innerHTML = `
      <article class="quote-card">
        <div class="quote-label">Kundenstimme</div>
        <div class="quote-text">${item.quote}</div>
      </article>
      <div class="tag-cloud">${tags}</div>
      <div id="feedback-msg" class="feedback hidden"></div>
      <button id="next-btn" class="next-btn hidden" type="button">${state.idx === state.cfg.feedbacks.length - 1 ? 'Auswertung' : 'Naechstes Feedback'}</button>
    `;

    el.feedbackRoot.querySelectorAll('[data-tag]').forEach((btn) => {
      btn.addEventListener('click', () => classify(btn.dataset.tag));
    });

    document.getElementById('next-btn').addEventListener('click', next);
  }

  function classify(tagId) {
    if (state.answered || state.done) return;

    const current = state.cfg.feedbacks[state.idx];
    const isCorrect = tagId === current.correct_tag;
    state.answered = true;

    state.roadmap[tagId].push(current.quote);
    if (isCorrect) state.hits += 1;

    const msg = document.getElementById('feedback-msg');
    msg.classList.remove('hidden');
    msg.className = `feedback ${isCorrect ? 'ok' : 'bad'}`;

    if (isCorrect) {
      msg.innerHTML = `<strong>Korrekt.</strong> ${current.explain}`;
    } else {
      msg.innerHTML = `<strong>Nicht optimal.</strong> Richtiger Kanal: <em>${labelOf(current.correct_tag)}</em>. ${current.explain}`;
    }

    el.feedbackRoot.querySelectorAll('[data-tag]').forEach((btn) => {
      btn.disabled = true;
    });

    document.getElementById('next-btn').classList.remove('hidden');
    updateKpis();
    renderRoadmap();
  }

  function next() {
    if (!state.answered) return;

    if (state.idx === state.cfg.feedbacks.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.idx += 1;
    state.answered = false;
    render();
  }

  function renderRoadmap() {
    ['bug', 'feature', 'support', 'lob'].forEach((col) => {
      const list = el.road[col];
      list.replaceChildren();
      const entries = state.roadmap[col].slice(-3);

      if (!entries.length) {
        const li = document.createElement('li');
        li.textContent = 'Noch leer';
        list.appendChild(li);
        return;
      }

      entries.forEach((quote) => {
        const li = document.createElement('li');
        li.textContent = trim(quote, 56);
        list.appendChild(li);
      });
    });
  }

  function renderResult() {
    const total = state.cfg.feedbacks.length;
    const rate = total ? Math.round((state.hits / total) * 100) : 0;

    let verdict = 'Weiter triagieren';
    if (rate >= 60) verdict = 'Gute Triage';
    if (rate >= 80) verdict = 'Sehr sauber';
    if (rate === 100) verdict = 'Triage-Profi';

    el.feedbackRoot.innerHTML = `
      <section class="result">
        <h2>${verdict}</h2>
        <p>Treffer: <strong>${state.hits}</strong> / ${total}</p>
        <p>Triage-Quote: <strong>${rate}%</strong></p>
        <p>Merksatz: Erst richtig einordnen, dann den passenden Prozess triggern.</p>
        <button id="restart-btn" class="restart-btn" type="button">Nochmal sortieren</button>
      </section>
    `;

    document.getElementById('restart-btn').addEventListener('click', restart);
  }

  function restart() {
    state.idx = 0;
    state.hits = 0;
    state.answered = false;
    state.done = false;
    state.roadmap = { bug: [], feature: [], support: [], lob: [] };
    render();
  }

  function updateKpis() {
    const total = state.cfg ? state.cfg.feedbacks.length : 0;
    const current = state.done ? total : state.idx + 1;
    const rate = total ? Math.round((state.hits / total) * 100) : 0;

    el.round.textContent = `${current}/${total}`;
    el.hits.textContent = String(state.hits);
    el.rate.textContent = `${rate}%`;
  }

  function labelOf(tagId) {
    const tag = state.cfg.tags.find((t) => t.id === tagId);
    return tag ? `${tag.icon} ${tag.label}` : tagId;
  }

  function trim(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function renderGameToText() {
    const total = state.cfg ? state.cfg.feedbacks.length : 0;
    return JSON.stringify({
      mode: 'feedback_kategorisierer',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      round_display: `${Math.min(total, state.idx + 1)}/${total}`,
      hits: state.hits,
      answered: state.answered,
      done: state.done,
      roadmap_counts: {
        bug: state.roadmap.bug.length,
        feature: state.roadmap.feature.length,
        support: state.roadmap.support.length,
        lob: state.roadmap.lob.length
      }
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime() { return true; };
})();
