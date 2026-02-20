(function () {
  'use strict';

  const state = {
    cfg: null,
    foundIds: new Set(),
    score: 0,
    feedback: '',
    feedbackState: '',
    remainingMs: 0,
    elapsedMs: 0,
    done: false,
    timerId: 0,
    lastTickAt: 0
  };

  const el = {
    root: document.getElementById('root'),
    found: document.getElementById('kpi-found'),
    score: document.getElementById('kpi-score'),
    rate: document.getElementById('kpi-rate'),
    time: document.getElementById('kpi-time'),
    fill: document.getElementById('time-fill')
  };

  init();

  async function init() {
    try {
      const response = await fetch('_data/_gg01_folie_des_grauens_fehler_suche.json');
      if (!response.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.cfg = await response.json();
      restart();
    } catch (error) {
      if (el.root) el.root.innerHTML = '<p>Fehler: ' + escapeHtml(error.message) + '</p>';
    }
  }

  function totalMs() {
    const value = Number(state.cfg && state.cfg.timing && state.cfg.timing.total_ms);
    return Number.isFinite(value) && value > 0 ? value : 60000;
  }

  function scoringValue(key, fallback) {
    const value = Number(state.cfg && state.cfg.scoring && state.cfg.scoring[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  function allErrors() {
    return state.cfg && Array.isArray(state.cfg.errors) ? state.cfg.errors : [];
  }

  function startTimer() {
    stopTimer();
    state.lastTickAt = Date.now();
    state.timerId = window.setInterval(function () {
      const now = Date.now();
      tick(now - state.lastTickAt);
      state.lastTickAt = now;
    }, 100);
  }

  function stopTimer() {
    if (!state.timerId) return;
    window.clearInterval(state.timerId);
    state.timerId = 0;
  }

  function tick(deltaMs) {
    if (state.done) return;
    const delta = Number(deltaMs);
    if (!Number.isFinite(delta) || delta <= 0) return;

    state.remainingMs = Math.max(0, state.remainingMs - delta);
    state.elapsedMs += delta;

    if (state.remainingMs <= 0) {
      finishGame(false);
      return;
    }

    renderKpis();
  }

  function progressPercent() {
    const total = allErrors().length;
    if (!total) return 0;
    return Math.round((state.foundIds.size / total) * 100);
  }

  function markError(errorId) {
    if (state.done) return;

    const error = allErrors().find(function (entry) {
      return entry.id === errorId;
    });
    if (!error) return;

    if (state.foundIds.has(error.id)) {
      state.feedbackState = 'bad';
      state.feedback = 'Bereits markiert: ' + error.label;
      render();
      return;
    }

    state.foundIds.add(error.id);
    state.score += scoringValue('found', 15);
    state.feedbackState = 'ok';
    state.feedback = 'Gefunden: ' + error.label + ' - ' + error.explanation;

    if (state.foundIds.size >= allErrors().length) {
      finishGame(true);
      return;
    }

    render();
  }

  function registerMiss() {
    if (state.done) return;
    state.score += scoringValue('miss', -3);
    state.feedbackState = 'bad';
    state.feedback = 'Daneben geklickt. Suche eine konkrete Design-Sünde auf der Folie.';
    render();
  }

  function finishGame(foundAll) {
    if (state.done) return;
    state.done = true;
    stopTimer();

    if (foundAll) {
      state.score += scoringValue('completion_bonus', 20);
      state.feedbackState = 'ok';
      state.feedback = 'Stark! Alle Design-Sünden wurden gefunden.';
    } else {
      state.feedbackState = 'bad';
      state.feedback = 'Zeit vorbei. Du hast ' + state.foundIds.size + ' von ' + allErrors().length + ' Fehlern gefunden.';
    }

    render();
  }

  function restart() {
    stopTimer();
    state.foundIds = new Set();
    state.score = 0;
    state.feedback = '';
    state.feedbackState = '';
    state.remainingMs = totalMs();
    state.elapsedMs = 0;
    state.done = false;
    startTimer();
    render();
  }

  function renderKpis() {
    const total = allErrors().length;
    const ratio = totalMs() > 0 ? Math.max(0, Math.min(1, state.remainingMs / totalMs())) : 0;

    if (el.found) el.found.textContent = String(state.foundIds.size) + '/' + String(total);
    if (el.score) el.score.textContent = String(state.score);
    if (el.rate) el.rate.textContent = String(progressPercent()) + '%';
    if (el.time) el.time.textContent = (state.remainingMs / 1000).toFixed(1) + 's';

    if (el.fill) {
      el.fill.style.width = Math.round(ratio * 100) + '%';
      if (ratio > 0.5) {
        el.fill.style.background = 'linear-gradient(90deg, #35d08a, #ffb347)';
      } else if (ratio > 0.2) {
        el.fill.style.background = 'linear-gradient(90deg, #ffb347, #ff8f57)';
      } else {
        el.fill.style.background = 'linear-gradient(90deg, #ff8f57, #ff6f7a)';
      }
    }
  }

  function renderSlide() {
    const slide = state.cfg && state.cfg.slide ? state.cfg.slide : {};

    let html = '';
    html += '<section class="stage" id="stage">';
    html += '<h2 class="slide-headline">' + escapeHtml(slide.headline || '') + '</h2>';
    html += '<p class="slide-subline">' + escapeHtml(slide.subline || '') + '</p>';
    html += '<div class="slide-grid">';
    html += '<ul class="slide-bullets">';
    (slide.bullets || []).forEach(function (bullet) {
      html += '<li>' + escapeHtml(bullet) + '</li>';
    });
    html += '</ul>';
    html += '<div class="pixel-box" aria-hidden="true"></div>';
    html += '</div>';
    html += '<div class="tiny-note">Schriftgröße 9pt für den Anhang</div>';

    allErrors().forEach(function (error) {
      const marker = error.marker || {};
      const foundClass = state.foundIds.has(error.id) ? ' found' : '';
      html += '<button class="marker' + foundClass + '" type="button" data-error-id="' + escapeHtml(error.id) + '" style="left:' + Number(marker.x_percent || 0) + '%;top:' + Number(marker.y_percent || 0) + '%;width:' + Number(marker.w_percent || 10) + '%;height:' + Number(marker.h_percent || 10) + '%;">';
      if (state.foundIds.has(error.id)) {
        html += '<span class="marker-label">✓</span>';
      }
      html += '</button>';
    });

    html += '</section>';

    if (state.feedback) {
      html += '<section class="feedback ' + escapeHtml(state.feedbackState || 'bad') + '">' + escapeHtml(state.feedback) + '</section>';
    }

    if (state.foundIds.size > 0) {
      html += '<div class="found-list">';
      allErrors().forEach(function (error) {
        if (!state.foundIds.has(error.id)) return;
        html += '<span class="found-chip">' + escapeHtml(error.label) + '</span>';
      });
      html += '</div>';
    }

    if (state.done) {
      html += '<div class="actions"><button id="restart-btn" class="btn" type="button">Nochmal spielen</button></div>';
    }

    el.root.innerHTML = html;

    const stage = document.getElementById('stage');
    if (stage) {
      stage.addEventListener('click', function (event) {
        if (event.target && event.target.closest('[data-error-id]')) return;
        registerMiss();
      });
    }

    Array.from(el.root.querySelectorAll('[data-error-id]')).forEach(function (markerBtn) {
      markerBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        markError(markerBtn.getAttribute('data-error-id'));
      });
    });

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', restart);
  }

  function render() {
    renderKpis();
    if (!state.cfg || !el.root) return;
    renderSlide();
  }

  function asStatePayload() {
    const progress = progressPercent();
    return {
      mode: state.done ? 'result' : 'folie_des_grauens_fehler_suche',
      measurable: true,
      coordinate_system: 'origin top-left, x right, y down',
      total_errors: allErrors().length,
      found_errors: state.foundIds.size,
      found_error_ids: Array.from(state.foundIds),
      score: state.score,
      progress_percent: progress,
      rate_percent: progress,
      remaining_ms: Math.round(state.remainingMs),
      elapsed_ms: Math.round(state.elapsedMs)
    };
  }

  window.render_game_to_text = function () {
    const payload = asStatePayload();
    payload.simulated_ms = window.__simulatedMs || 0;
    return JSON.stringify(payload);
  };

  window.advanceTime = function (ms) {
    const safeMs = Math.max(0, Number(ms) || 0);
    window.__simulatedMs = (window.__simulatedMs || 0) + safeMs;
    if (safeMs <= 0) {
      renderKpis();
      return;
    }

    const step = 1000 / 60;
    let remaining = safeMs;
    while (remaining > 0) {
      const delta = Math.min(step, remaining);
      tick(delta);
      remaining -= delta;
      if (state.done) break;
    }
    renderKpis();
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
