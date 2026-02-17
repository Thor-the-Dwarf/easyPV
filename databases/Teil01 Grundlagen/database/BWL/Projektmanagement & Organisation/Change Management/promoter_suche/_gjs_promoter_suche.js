(function () {
  'use strict';

  const state = {
    cfg: null,
    idx: 0,
    score: 0,
    hits: 0,
    answered: false,
    done: false,
    selectedProfileId: null,
    assignments: {
      macht: null,
      fach: null
    }
  };

  const el = {
    round: document.getElementById('kpi-round'),
    score: document.getElementById('kpi-score'),
    hits: document.getElementById('kpi-hits'),
    root: document.getElementById('root')
  };

  init();

  async function init() {
    try {
      const resp = await fetch('data/_gg01_promoter_suche.json');
      if (!resp.ok) throw new Error('Config not reachable');
      state.cfg = await resp.json();
      render();
    } catch (error) {
      el.root.textContent = 'Konfiguration konnte nicht geladen werden.';
    }
  }

  function currentRound() {
    return state.cfg.rounds[state.idx] || null;
  }

  function render() {
    updateKpis();

    if (state.done) {
      const maxHits = (state.cfg?.rounds.length || 0) * 2;
      const rate = maxHits ? Math.round((state.hits / maxHits) * 100) : 0;
      el.root.innerHTML = `
        <h2>Auswertung</h2>
        <p>Score: <strong>${state.score}</strong></p>
        <p>Korrekte Zuordnungen: <strong>${state.hits}</strong> / ${maxHits} (${rate}%)</p>
        <button id="restart" class="btn" type="button">Nochmal spielen</button>
      `;
      document.getElementById('restart').addEventListener('click', restart);
      return;
    }

    const round = currentRound();
    const assignedSet = new Set(Object.values(state.assignments).filter(Boolean));

    el.root.innerHTML = `
      <section class="task">
        <h2>${escapeHtml(round.prompt)}</h2>
        <p>Tipp: Wichtige Hinweise stehen in den Profilkarten. Du brauchst genau 2 Rollen.</p>
      </section>

      <div id="profiles" class="grid">
        ${round.profiles.map((p) => {
          const isSelected = state.selectedProfileId === p.id;
          const isAssigned = assignedSet.has(p.id);
          return `
            <button
              type="button"
              class="profile ${isSelected ? 'active' : ''} ${isAssigned ? 'assigned' : ''}"
              data-profile-id="${escapeHtml(p.id)}"
              draggable="${state.answered ? 'false' : 'true'}"
              ${state.answered ? 'disabled' : ''}
            >
              <h3>${escapeHtml(p.name)}</h3>
              <p>${escapeHtml(p.hint)}</p>
            </button>
          `;
        }).join('')}
      </div>

      <div class="slots">
        ${renderSlot('macht', 'Machtpromoter')}
        ${renderSlot('fach', 'Fachpromoter')}
      </div>

      <div class="actions">
        <button id="clear" class="btn" type="button" ${state.answered ? 'disabled' : ''}>Auswahl leeren</button>
        <button id="check" class="btn primary" type="button" ${state.answered ? 'disabled' : ''}>Pruefen</button>
        <button id="next" class="btn hidden" type="button">${state.idx === state.cfg.rounds.length - 1 ? 'Auswertung' : 'Naechste Runde'}</button>
      </div>

      <div id="feedback" class="feedback hidden"></div>
    `;

    bindInteractions();
  }

  function renderSlot(slotKey, title) {
    const profile = findProfileById(state.assignments[slotKey]);
    return `
      <section class="slot" data-slot="${slotKey}">
        <h4>${title}</h4>
        <div class="value">${profile ? escapeHtml(profile.name) : 'Noch nicht zugewiesen'}</div>
        <button class="btn" type="button" data-assign-btn="${slotKey}" ${state.answered ? 'disabled' : ''}>Auswahl hier zuordnen</button>
      </section>
    `;
  }

  function bindInteractions() {
    const profiles = Array.from(el.root.querySelectorAll('[data-profile-id]'));
    const slots = Array.from(el.root.querySelectorAll('.slot'));

    profiles.forEach((profileEl) => {
      profileEl.addEventListener('click', () => {
        if (state.answered) return;
        state.selectedProfileId = profileEl.dataset.profileId;
        render();
      });

      profileEl.addEventListener('dragstart', (event) => {
        if (state.answered) {
          event.preventDefault();
          return;
        }
        const id = profileEl.dataset.profileId;
        event.dataTransfer?.setData('text/plain', id);
        state.selectedProfileId = id;
      });
    });

    slots.forEach((slot) => {
      slot.addEventListener('dragover', (event) => {
        if (state.answered) return;
        event.preventDefault();
        slot.classList.add('targeted');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('targeted'));
      slot.addEventListener('drop', (event) => {
        if (state.answered) return;
        event.preventDefault();
        slot.classList.remove('targeted');
        const id = event.dataTransfer?.getData('text/plain') || state.selectedProfileId;
        if (id) assignTo(slot.dataset.slot, id);
      });
    });

    el.root.querySelectorAll('[data-assign-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!state.selectedProfileId || state.answered) return;
        assignTo(btn.dataset.assignBtn, state.selectedProfileId);
      });
    });

    document.getElementById('clear').addEventListener('click', () => {
      if (state.answered) return;
      state.assignments.macht = null;
      state.assignments.fach = null;
      state.selectedProfileId = null;
      render();
    });

    document.getElementById('check').addEventListener('click', evaluate);
    document.getElementById('next').addEventListener('click', nextRound);
  }

  function assignTo(slotKey, profileId) {
    if (state.answered) return;
    if (!slotKey || !profileId) return;

    if (slotKey !== 'macht' && slotKey !== 'fach') return;

    for (const key of ['macht', 'fach']) {
      if (state.assignments[key] === profileId) {
        state.assignments[key] = null;
      }
    }

    state.assignments[slotKey] = profileId;
    render();
  }

  function evaluate() {
    if (state.answered) return;
    const round = currentRound();
    const fb = document.getElementById('feedback');

    if (!state.assignments.macht || !state.assignments.fach) {
      fb.className = 'feedback bad';
      fb.textContent = 'Bitte beide Rollen zuordnen, bevor du pruefst.';
      fb.classList.remove('hidden');
      return;
    }

    let correct = 0;
    if (findProfileById(state.assignments.macht)?.role === 'macht') correct += 1;
    if (findProfileById(state.assignments.fach)?.role === 'fach') correct += 1;

    const wrong = 2 - correct;
    state.hits += correct;
    state.score += correct * 20 - wrong * 10;
    if (correct === 2) state.score += 10;

    state.answered = true;

    if (correct === 2) {
      fb.className = 'feedback ok';
      fb.textContent = 'Stark: beide Promoter korrekt erkannt (+10 Bonus).';
    } else {
      const expectedMacht = round.profiles.find((p) => p.role === 'macht')?.name || 'n/a';
      const expectedFach = round.profiles.find((p) => p.role === 'fach')?.name || 'n/a';
      fb.className = 'feedback bad';
      fb.textContent = `Teilweise korrekt (${correct}/2). Erwartet: Machtpromoter ${expectedMacht}, Fachpromoter ${expectedFach}.`;
    }
    fb.classList.remove('hidden');

    document.getElementById('next').classList.remove('hidden');
    updateKpis();
  }

  function nextRound() {
    if (!state.answered) return;
    if (state.idx === state.cfg.rounds.length - 1) {
      state.done = true;
      render();
      return;
    }

    state.idx += 1;
    state.answered = false;
    state.selectedProfileId = null;
    state.assignments.macht = null;
    state.assignments.fach = null;
    render();
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.hits = 0;
    state.answered = false;
    state.done = false;
    state.selectedProfileId = null;
    state.assignments.macht = null;
    state.assignments.fach = null;
    render();
  }

  function findProfileById(id) {
    if (!id || !state.cfg) return null;
    const round = currentRound();
    return round?.profiles.find((p) => p.id === id) || null;
  }

  function updateKpis() {
    const totalRounds = state.cfg?.rounds.length || 0;
    const current = state.done ? totalRounds : state.idx + 1;
    const maxHits = totalRounds * 2;

    el.round.textContent = `${current}/${totalRounds}`;
    el.score.textContent = String(state.score);
    el.hits.textContent = `${state.hits}/${maxHits}`;
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
      mode: state.done ? 'result' : 'promoter_assignment',
      coordinate_system: 'origin top-left, x right, y down',
      round_index: state.idx,
      total_rounds: state.cfg?.rounds.length || 0,
      prompt: round?.prompt || null,
      score: state.score,
      hits: state.hits,
      selected_profile_id: state.selectedProfileId,
      assignments: {
        macht: state.assignments.macht,
        fach: state.assignments.fach
      },
      answered: state.answered
    });
  };

  window.advanceTime = function advanceTime() {
    return true;
  };
})();
