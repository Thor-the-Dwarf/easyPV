(function () {
  'use strict';

  const BEST_KEY = 'anforderungs_sortierer_best_v1';

  const state = {
    cfg: null,
    levelIdx: 0,
    cardIdx: 0,
    score: 0,
    streak: 0,
    cards: [],
    timerMs: 0,
    timerId: null,
    locked: false,
    best: Number(localStorage.getItem(BEST_KEY) || 0)
  };

  const el = {
    level: document.getElementById('hud-level'),
    score: document.getElementById('hud-score'),
    streak: document.getElementById('hud-streak'),
    best: document.getElementById('hud-best'),
    card: document.getElementById('hud-card'),
    time: document.getElementById('hud-time'),
    xp: document.getElementById('xp-fill'),
    cardBox: document.getElementById('card'),
    btnNfa: document.getElementById('btn-nfa'),
    btnFkt: document.getElementById('btn-fkt'),
    feedback: document.getElementById('feedback')
  };

  init();

  async function init() {
    const resp = await fetch('_data/_gg01_anforderungs_sortierer.json');
    if (!resp.ok) {
      el.feedback.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await resp.json();
    startLevel(0);

    el.btnNfa.addEventListener('click', () => classify('NFA'));
    el.btnFkt.addEventListener('click', () => classify('FKT'));
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowLeft') classify('NFA');
      if (ev.key === 'ArrowRight') classify('FKT');
    });
  }

  function startLevel(idx) {
    state.levelIdx = idx;
    state.cardIdx = 0;
    const level = state.cfg.levels[idx];

    state.cards = shuffle(state.cfg.cards).slice(0, level.cards);
    nextCard();
    updateHud();
    setFeedback(`Level ${idx + 1}: ${level.name}. Links = NFA, rechts = FKT.`, false);
  }

  function nextCard() {
    clearTimer();

    if (state.cardIdx >= state.cards.length) {
      if (state.levelIdx < state.cfg.levels.length - 1) {
        startLevel(state.levelIdx + 1);
        return;
      }
      finishGame();
      return;
    }

    state.locked = false;
    el.cardBox.classList.remove('throw-left', 'throw-right');
    el.cardBox.textContent = state.cards[state.cardIdx].text;

    const limitSec = state.cfg.levels[state.levelIdx].time_limit_sec;
    if (limitSec > 0) {
      state.timerMs = limitSec * 1000;
      state.timerId = window.setInterval(() => {
        state.timerMs -= 100;
        if (state.timerMs <= 0) {
          state.timerMs = 0;
          clearTimer();
          onTimeout();
        }
        updateHud();
      }, 100);
    }

    updateHud();
  }

  function classify(tag) {
    if (state.locked || !state.cards[state.cardIdx]) return;
    state.locked = true;

    const current = state.cards[state.cardIdx];
    const ok = current.tag === tag;

    clearTimer();

    if (ok) {
      const mult = state.streak >= 4 ? 2 : 1;
      state.score += 100 * mult;
      state.streak += 1;
      setFeedback(`Korrekt. ${explainTag(current)} +${100 * mult} Punkte.`, true);
    } else {
      state.score = Math.max(0, state.score - 50);
      state.streak = 0;
      setFeedback(`Nicht ganz. ${explainTag(current)} -50 Punkte.`, false);
    }

    el.cardBox.classList.add(tag === 'NFA' ? 'throw-left' : 'throw-right');

    window.setTimeout(() => {
      state.cardIdx += 1;
      nextCard();
    }, 220);

    updateHud();
  }

  function explainTag(card) {
    if (card.tag === 'FKT') {
      return `"${card.text}" ist FKT: beschreibt eine konkrete Funktion (WAS das System tun soll).`;
    }
    return `"${card.text}" ist NFA: beschreibt Qualitaet, Rahmenbedingung oder Zielwert (WIE gut das System sein soll).`;
  }

  function onTimeout() {
    if (state.locked) return;
    state.locked = true;

    state.score = Math.max(0, state.score - 50);
    state.streak = 0;
    setFeedback('Zeit abgelaufen. NFA = WIE, FKT = WAS. -50 Punkte.', false);

    window.setTimeout(() => {
      state.cardIdx += 1;
      nextCard();
    }, 220);

    updateHud();
  }

  function finishGame() {
    clearTimer();

    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(BEST_KEY, String(state.best));
    }

    el.cardBox.textContent = `Fertig. Dein Score: ${state.score}`;
    setFeedback('Run abgeschlossen. Druecke F5 fuer einen neuen Run.', true);
    updateHud();
  }

  function updateHud() {
    const level = state.cfg ? state.cfg.levels[state.levelIdx] : { cards: 0, time_limit_sec: 0 };
    const cardDisplay = `${Math.min(level.cards, state.cardIdx + 1)}/${level.cards}`;

    el.level.textContent = String(state.levelIdx + 1);
    el.score.textContent = String(state.score);
    el.streak.textContent = String(state.streak);
    el.best.textContent = String(state.best);
    el.card.textContent = cardDisplay;

    if (level.time_limit_sec > 0) {
      el.time.textContent = `${(state.timerMs / 1000).toFixed(1)}s`;
    } else {
      el.time.textContent = '∞';
    }

    const totalLevels = state.cfg ? state.cfg.levels.length : 1;
    const levelProgress = ((state.levelIdx + (state.cardIdx / Math.max(1, level.cards))) / totalLevels) * 100;
    el.xp.style.width = `${Math.min(100, Math.max(0, levelProgress))}%`;
  }

  function setFeedback(text, ok) {
    el.feedback.textContent = text;
    el.feedback.className = `feedback ${ok ? 'ok' : 'bad'}`;
  }

  function clearTimer() {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function renderGameToText() {
    const level = state.cfg ? state.cfg.levels[state.levelIdx] : { name: '-', cards: 0 };
    return JSON.stringify({
      mode: 'anforderungs_sortierer',
      coordinate_system: 'origin top-left, x right, y down',
      level: level.name,
      level_index: state.levelIdx,
      card_index: state.cardIdx,
      score: state.score,
      streak: state.streak,
      timer_ms: state.timerMs,
      best: state.best
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime(ms) {
    if (state.timerId) {
      state.timerMs = Math.max(0, state.timerMs - ms);
      if (state.timerMs === 0) {
        clearTimer();
        onTimeout();
      }
      updateHud();
    }
    return true;
  };

  const __baseRenderToTextForSim = window.render_game_to_text;
  const __baseAdvanceTimeForSim = window.advanceTime;
  let __simulatedMs = 0;

  window.render_game_to_text = function renderGameToTextWithSimulatedMs() {
    const raw = typeof __baseRenderToTextForSim === "function" ? __baseRenderToTextForSim() : "{}";
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

  window.advanceTime = function advanceTimeWithSimulatedMs(ms) {
    if (Number.isFinite(ms) && ms > 0) __simulatedMs += ms;
    if (typeof __baseAdvanceTimeForSim === "function") {
      try {
        return __baseAdvanceTimeForSim(ms);
      } catch (err) {
        return true;
      }
    }
    return true;
  };
})();
