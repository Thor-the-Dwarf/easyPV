(function () {
  'use strict';

  const state = {
    config: null,
    items: [],
    index: 0,
    score: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    muted: false,
    lock: false
  };

  const el = {
    progress: document.getElementById('sortier-progress'),
    score: document.getElementById('sortier-score'),
    streak: document.getElementById('sortier-streak'),
    mute: document.getElementById('sortier-mute'),
    board: document.getElementById('sortier-board'),
    card: document.getElementById('term-card'),
    text: document.getElementById('term-text'),
    actions: document.getElementById('sortier-actions'),
    feedback: document.getElementById('sortier-feedback'),
    result: document.getElementById('sortier-result')
  };

  let audioCtx = null;

  init();

  async function init() {
    try {
      const resp = await fetch('./_g01_finanzierungs_sortiermaschine.json');
      if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.config = await resp.json();
      state.items = shuffle([...state.config.terms]);

      initActions();
      el.mute.addEventListener('click', toggleMute);
      render();
    } catch (error) {
      el.board.innerHTML = `<p style="padding:1rem; color:#fff">${escapeHtml(error.message)}</p>`;
    }
  }

  function initActions() {
    el.actions.innerHTML = state.config.categories.map((cat) => {
      return `<button class="sortier-btn" data-cat="${escapeAttr(cat.key)}">${escapeHtml(cat.label)}</button>`;
    }).join('');

    el.actions.querySelectorAll('.sortier-btn').forEach((btn) => {
      btn.addEventListener('click', () => classify(btn.dataset.cat));
    });
  }

  function currentItem() {
    return state.items[state.index] || null;
  }

  function classify(selectedCat) {
    if (state.lock) return;

    const item = currentItem();
    if (!item) return;

    state.lock = true;

    const isCorrect = item.category === selectedCat;
    state.score += isCorrect ? 10 : -10;
    state.correct += isCorrect ? 1 : 0;
    state.streak = isCorrect ? state.streak + 1 : 0;
    state.bestStreak = Math.max(state.bestStreak, state.streak);

    const selectedLabel = categoryLabel(selectedCat);
    const correctLabel = categoryLabel(item.category);

    if (isCorrect) {
      showFeedback('ok', `Richtig: ${selectedLabel}. ${item.explanation}`);
      playTone('ok');
      vibrate([15]);
      animateCardToZone(selectedCat, false);
    } else {
      showFeedback('bad', `Nicht korrekt. Du hast ${selectedLabel} gewaehlt, korrekt ist ${correctLabel}. ${item.explanation}`);
      playTone('bad');
      vibrate([25, 30, 25]);
      animateCardToZone(selectedCat, true);
    }

    // Learner-friendly pacing: short reflection window, no long dead-time.
    const delay = isCorrect ? 900 : 1800;
    setTimeout(() => {
      state.index += 1;
      state.lock = false;
      resetCard();
      render();
    }, delay);
  }

  function categoryLabel(key) {
    const hit = state.config.categories.find((c) => c.key === key);
    return hit ? hit.label : key;
  }

  function animateCardToZone(cat, rejected) {
    const zone = el.board.querySelector(`.drop-zone[data-cat="${cat}"]`);
    if (!zone) return;

    zone.classList.add(rejected ? 'is-reject' : 'is-hit');
    setTimeout(() => zone.classList.remove('is-hit', 'is-reject'), 420);

    const cardBox = el.card.getBoundingClientRect();
    const zoneBox = zone.getBoundingClientRect();
    const tx = zoneBox.left + zoneBox.width / 2 - (cardBox.left + cardBox.width / 2);
    const ty = zoneBox.top + zoneBox.height / 2 - (cardBox.top + cardBox.height / 2);

    if (isCompactLayout()) {
      // Keep visible motion feedback on compact layout without drag.
      const compactShift = cat === 'leasing' ? -24 : (cat === 'kredit' ? 24 : 0);
      const compactDrop = rejected ? 8 : 16;
      el.card.style.transition = 'transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1)';
      setCardTransform(compactShift, compactDrop, rejected ? -4 : 4);
      return;
    }

    el.card.style.transition = 'transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1)';
    if (rejected) {
      setCardTransform(tx * 0.55, ty * 0.35, -6);
    } else {
      setCardTransform(tx, ty + 12, tx > 0 ? 9 : -9);
    }
  }

  function resetCard() {
    el.card.style.transition = 'transform 180ms ease';
    setCardTransform(0, 0, 0);
    setTimeout(() => {
      el.card.style.transition = '';
    }, 190);
  }

  function isCompactLayout() {
    return window.matchMedia('(max-width: 860px)').matches;
  }

  function setCardTransform(tx, ty, rot) {
    if (isCompactLayout()) {
      el.card.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
      return;
    }
    // Keep a fixed spawn anchor at horizontal center on larger layouts.
    el.card.style.transform = `translate(calc(-50% + ${tx}px), ${ty}px) rotate(${rot}deg)`;
  }

  function showFeedback(type, text) {
    el.feedback.className = `sortier-feedback ${type}`;
    el.feedback.textContent = text;
  }

  function toggleMute() {
    state.muted = !state.muted;
    el.mute.textContent = state.muted ? 'Ton: Aus' : 'Ton: An';
    el.mute.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
  }

  function playTone(kind) {
    if (state.muted) return;

    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (kind === 'ok') {
        osc.frequency.value = 640;
        gain.gain.value = 0.04;
      } else {
        osc.frequency.value = 180;
        gain.gain.value = 0.05;
      }

      const now = audioCtx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch (_) {
      // ignore audio failures
    }
  }

  function vibrate(pattern) {
    if (!('vibrate' in navigator)) return;
    try { navigator.vibrate(pattern); } catch (_) { }
  }

  function render() {
    const total = state.items.length;

    if (state.index >= total) {
      const percent = Math.max(0, Math.min(100, state.score));
      el.progress.textContent = `Begriff ${total}/${total}`;
      el.score.textContent = `Score: ${state.score}`;
      el.streak.textContent = `Streak: ${state.bestStreak}`;
      el.feedback.textContent = '';

      el.result.classList.remove('hidden');
      el.result.innerHTML = `
        <h2>Auswertung</h2>
        <p>Richtig: <strong>${state.correct}/${total}</strong> | Score: <strong>${state.score}</strong> (${percent}%)</p>
        <button type="button" id="sortier-restart" class="sortier-btn sortier-btn--restart">Nochmal</button>
      `;

      document.getElementById('sortier-restart').addEventListener('click', restart);
      el.card.classList.add('hidden');
      return;
    }

    el.result.classList.add('hidden');
    el.card.classList.remove('hidden');

    const term = currentItem();
    el.text.textContent = term.text;
    resetCard();
    el.progress.textContent = `Begriff ${state.index + 1}/${total}`;
    el.score.textContent = `Score: ${state.score}`;
    el.streak.textContent = `Streak: ${state.streak}`;
    el.feedback.className = 'sortier-feedback';
    el.feedback.textContent = '';
  }

  function restart() {
    state.items = shuffle([...state.config.terms]);
    state.index = 0;
    state.score = 0;
    state.correct = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.lock = false;
    resetCard();
    render();
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function renderGameToText() {
    const term = currentItem();
    const payload = {
      mode: state.index >= state.items.length ? 'result' : 'sorting',
      coordinate_system: 'origin top-left, x right, y down',
      index: state.index,
      total: state.items.length,
      score: state.score,
      streak: state.streak,
      best_streak: state.bestStreak,
      current_term: term ? {
        text: term.text,
        expected_category: term.category
      } : null,
      categories: state.config ? state.config.categories.map((c) => c.key) : []
    };
    return JSON.stringify(payload);
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime() { return true; };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
