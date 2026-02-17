(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    streak: 0,
    answered: false,
    done: false,
    selectedRole: null,
    lastCorrect: false
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    streak: document.getElementById('kpi-streak'),
    root: document.getElementById('root')
  };

  init();

  async function init() {
    try {
      const response = await fetch('_data/_gg01_rollen_zuweiser.json');
      if (!response.ok) throw new Error('config unavailable');
      state.cfg = await response.json();
      render();
    } catch (_error) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function currentRound() {
    return state.cfg.rounds[state.idx] || null;
  }

  function roleById(roleId) {
    return state.cfg.raci_roles.find((role) => role.id === roleId) || null;
  }

  function render() {
    updateKpis();
    if (!state.cfg) return;

    if (state.done) {
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Serie: <strong>${state.streak}</strong></p>
        <ul class="result-list">
          ${state.cfg.raci_roles.map((role) => `<li><strong>${escapeHtml(role.id)} - ${escapeHtml(role.label)}:</strong> ${escapeHtml(role.hint)}</li>`).join('')}
        </ul>
        <div class="actions">
          <button type="button" id="restart-btn" class="btn">Nochmal spielen</button>
        </div>
      `;
      document.getElementById('restart-btn').addEventListener('click', restart);
      return;
    }

    const round = currentRound();
    const scoring = state.cfg.scoring;

    el.root.innerHTML = `
      <h2>${escapeHtml(round.id.toUpperCase())}: Welche RACI-Rolle passt?</h2>
      <div class="scenario">${escapeHtml(round.scenario)}</div>
      <div class="roles">
        ${state.cfg.raci_roles.map((role) => {
          const classes = ['role'];
          if (state.answered && state.selectedRole === role.id) {
            classes.push(role.id === round.expected_role ? 'correct' : 'wrong');
          }
          if (state.answered && role.id === round.expected_role) {
            classes.push('correct');
          }
          return `
            <button type="button" class="${classes.join(' ')}" data-role="${escapeHtml(role.id)}" ${state.answered ? 'disabled' : ''}>
              <strong>${escapeHtml(role.id)} - ${escapeHtml(role.label)}</strong>
              <small>${escapeHtml(role.hint)}</small>
            </button>
          `;
        }).join('')}
      </div>
      <div id="feedback" class="feedback hidden"></div>
      <div class="actions">
        <button type="button" id="next-btn" class="btn hidden">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button>
      </div>
      <p style="margin-top:.8rem;color:#acc2e0;">
        Punkte: richtig +${scoring.correct}, falsch ${scoring.wrong}, Bonus ab ${scoring.streak_bonus_threshold} Treffern: +${scoring.streak_bonus}
      </p>
    `;

    el.root.querySelectorAll('[data-role]').forEach((button) => {
      button.addEventListener('click', () => answer(button.dataset.role));
    });
    document.getElementById('next-btn').addEventListener('click', nextRound);
  }

  function answer(selected) {
    if (state.answered || state.done) return;

    const round = currentRound();
    if (!roleById(selected)) return;

    const scoring = state.cfg.scoring;
    state.selectedRole = selected;
    state.answered = true;
    state.lastCorrect = selected === round.expected_role;

    if (state.lastCorrect) {
      state.score += scoring.correct;
      state.streak += 1;
      if (state.streak >= scoring.streak_bonus_threshold) {
        state.score += scoring.streak_bonus;
      }
    } else {
      state.score += scoring.wrong;
      state.streak = 0;
    }

    render();

    const correctRole = roleById(round.expected_role);
    const feedback = document.getElementById('feedback');
    feedback.className = `feedback ${state.lastCorrect ? 'ok' : 'bad'}`;
    feedback.innerHTML = state.lastCorrect
      ? `Richtig. ${escapeHtml(round.reason)}`
      : `Nicht korrekt. Erwartet ist <strong>${escapeHtml(correctRole.id)} - ${escapeHtml(correctRole.label)}</strong>. ${escapeHtml(round.reason)}`;
    feedback.classList.remove('hidden');
    document.getElementById('next-btn').classList.remove('hidden');
    updateKpis();
  }

  function nextRound() {
    if (!state.answered) return;

    if (state.idx >= state.cfg.rounds.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.idx += 1;
    state.answered = false;
    state.selectedRole = null;
    state.lastCorrect = false;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.streak = 0;
    state.answered = false;
    state.done = false;
    state.selectedRole = null;
    state.lastCorrect = false;
    render();
  }

  function updateKpis() {
    const total = state.cfg?.rounds.length || 0;
    el.round.textContent = `${state.done ? total : state.idx + 1}/${total}`;
    el.score.textContent = String(state.score);
    el.streak.textContent = String(state.streak);
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
    const round = state.cfg && !state.done ? currentRound() : null;
    return JSON.stringify({
      mode: state.done ? 'result' : 'raci_role_assignment',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      score: state.score,
      streak: state.streak,
      answered: state.answered,
      selected_role: state.selectedRole,
      expected_role: round?.expected_role || null,
      scenario: round?.scenario || null
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
