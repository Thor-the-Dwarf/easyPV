(function () {
  'use strict';

  const state = {
    cfg: null,
    started: false,
    done: false,
    gameOver: false,
    idx: 0,
    levelIdx: 0,
    score: 0,
    confusion: 0,
    streak: 0,
    cardTimer: 0,
    logs: [],
    lock: false,
    cardStart: 0,
    timerId: null,
    touchStartX: null,
    touchCurrentX: 0
  };

  const el = {
    readFill: document.getElementById('read-fill'),
    text: document.getElementById('snippet-text'),
    feedback: document.getElementById('feedback'),
    feed: document.getElementById('feed'),
    binAdmin: document.getElementById('bin-admin'),
    binUser: document.getElementById('bin-user'),
    startBtn: document.getElementById('start-btn'),
    nextBtn: document.getElementById('next-btn'),
    restartBtn: document.getElementById('restart-btn'),
    cardNode: document.getElementById('snippet-card')
  };

  init();

  async function init() {
    const res = await fetch('./game_doku_zielgruppen_match.json');
    if (!res.ok) {
      el.feedback.textContent = 'Konfiguration konnte nicht geladen werden.';
      return;
    }

    state.cfg = await res.json();
    bindControls();
    updateHud();
    pushLog('Desk bereit. Starte den Content-Filter.', 'ok');
    renderFeed();
  }

  function bindControls() {
    el.startBtn.addEventListener('click', startGame);
    el.nextBtn.addEventListener('click', nextCard);
    el.restartBtn.addEventListener('click', resetGame);
    el.binAdmin.addEventListener('click', () => classify('admin'));
    el.binUser.addEventListener('click', () => classify('user'));

    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') classify('admin');
      if (event.key === 'ArrowRight') classify('user');
    });

    el.cardNode.addEventListener('pointerdown', onPointerDown);
    el.cardNode.addEventListener('pointermove', onPointerMove);
    el.cardNode.addEventListener('pointerup', onPointerUp);
    el.cardNode.addEventListener('pointercancel', onPointerUp);
  }

  function startGame() {
    if (!state.cfg || state.started) return;

    state.started = true;
    state.done = false;
    state.gameOver = false;
    state.idx = 0;
    state.score = 0;
    state.confusion = 0;
    state.streak = 0;
    state.logs = [];

    el.startBtn.classList.add('hidden');
    el.nextBtn.classList.add('hidden');
    el.restartBtn.classList.add('hidden');

    showCard();
    startTimer();
    setFeedback('Zuordnen: Links = Admin, Rechts = User.', true);
    pushLog('Mission gestartet.', 'ok');
    renderFeed();
  }

  function showCard() {
    const snippet = currentSnippet();
    const level = currentLevel();

    if (!snippet || !level) {
      finishGame();
      return;
    }

    state.levelIdx = levelIndexBySnippet(state.idx);
    state.cardStart = Date.now();
    state.lock = false;

    el.text.textContent = snippet.text;
    el.cardNode.style.transform = 'translateX(0px)';
    setFeedback('Ordne das aktuelle Fragment zu: links Admin, rechts User.', true);
    updateDragState();

    updateHud();
  }

  function nextCard() {
    if (!state.started || state.gameOver || state.done) return;

    state.idx += 1;
    if (state.idx >= state.cfg.snippets.length) {
      finishGame();
      return;
    }

    el.nextBtn.classList.add('hidden');
    showCard();
    startTimer();
  }

  function classify(targetBin) {
    if (!state.started || state.done || state.gameOver || state.lock) return;

    const snippet = currentSnippet();
    if (!snippet) return;

    state.lock = true;
    stopTimer();

    const elapsedSec = (Date.now() - state.cardStart) / 1000;
    const quickRead = elapsedSec <= 3.0;

    const primary = snippet.primary;
    const secondary = snippet.secondary || null;
    const isPrimary = targetBin === primary;
    const isSecondary = !!secondary && targetBin === secondary;

    let points = 0;
    let confusionDelta = 0;
    let msg = '';

    if (isPrimary) {
      points += 100;
      state.streak += 1;
      msg = `Korrekt: ${snippet.badge} passt in ${labelOf(primary)}.`;

      if (quickRead) {
        points += 150;
        msg += ' Silent Knowledge +150.';
      }
    } else if (isSecondary) {
      points += 40;
      state.streak = 0;
      confusionDelta += 5;
      msg = `Grenzfall: ok fuer ${labelOf(secondary)}, aber primaer ${labelOf(primary)}.`;
    } else {
      state.streak = 0;
      confusionDelta += 15;
      points -= 60;

      if (primary === 'admin' && targetBin === 'user') {
        confusionDelta += 18;
        points -= 60;
        msg = 'Technical Noise im User-Manual erkannt. Extra-Strafe.';
      } else {
        msg = `Falsch: sollte in ${labelOf(primary)}.`;
      }
    }

    state.score = Math.max(0, state.score + points);
    state.confusion = clamp(state.confusion + confusionDelta, 0, 100);

    if (confusionDelta > 0) triggerConfusionWave();

    pushLog(`${snippet.id}: ${msg} (${points >= 0 ? '+' : ''}${points} Pkt, +${confusionDelta}% Confusion)`, points >= 0 ? 'ok' : 'bad');
    renderFeed();

    if (state.confusion >= 100) {
      gameOver();
      return;
    }

    setFeedback(msg, points >= 0);
    updateDragState();
    updateHud();
    el.nextBtn.classList.remove('hidden');
  }

  function startTimer() {
    stopTimer();
    const level = currentLevel();
    state.cardTimer = level.time_limit_sec * 1000;

    state.timerId = window.setInterval(() => {
      state.cardTimer -= 100;
      if (state.cardTimer <= 0) {
        state.cardTimer = 0;
        onTimeout();
      }
      updateHud();
      updateReadability();
    }, 100);
  }

  function stopTimer() {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function onTimeout() {
    if (state.lock) return;

    state.lock = true;
    stopTimer();

    state.streak = 0;
    state.confusion = clamp(state.confusion + 12, 0, 100);
    state.score = Math.max(0, state.score - 40);
    triggerConfusionWave();

    const snippet = currentSnippet();
    pushLog(`${snippet ? snippet.id : '-'}: Zeit abgelaufen. +12% Confusion.`, 'bad');
    renderFeed();

    if (state.confusion >= 100) {
      gameOver();
      return;
    }

    setFeedback('Zu langsam: Support-Rueckfragen steigen.', false);
    updateDragState();
    updateHud();
    el.nextBtn.classList.remove('hidden');
  }

  function finishGame() {
    state.done = true;
    stopTimer();

    const perfect = state.confusion === 0;
    if (perfect) state.score += 300;

    el.nextBtn.classList.add('hidden');
    el.restartBtn.classList.remove('hidden');
    setFeedback(perfect ? 'Zero Confusion erreicht. Bonus +300.' : 'Mission abgeschlossen.', true);
    pushLog(`Abschluss: ${state.score} Punkte, Confusion ${state.confusion}%.`, 'ok');
    renderFeed();
    updateDragState();
    updateHud();
  }

  function gameOver() {
    state.gameOver = true;
    stopTimer();
    setFeedback('Game Over: User-Confusion hat 100% erreicht.', false);
    el.nextBtn.classList.add('hidden');
    el.restartBtn.classList.remove('hidden');
    pushLog('Support-Crisis eskaliert. Mission abgebrochen.', 'bad');
    renderFeed();
    updateDragState();
    updateHud();
  }

  function resetGame() {
    stopTimer();

    state.started = false;
    state.done = false;
    state.gameOver = false;
    state.idx = 0;
    state.levelIdx = 0;
    state.score = 0;
    state.confusion = 0;
    state.streak = 0;
    state.cardTimer = 0;
    state.logs = [];
    state.lock = false;

    el.startBtn.classList.remove('hidden');
    el.nextBtn.classList.add('hidden');
    el.restartBtn.classList.add('hidden');

    el.text.textContent = 'Druecke Mission starten.';

    setFeedback('Neuer Run bereit.', true);
    pushLog('System reset.', 'ok');
    renderFeed();
    updateDragState();
    updateHud();
  }

  function currentSnippet() {
    return state.cfg ? state.cfg.snippets[state.idx] : null;
  }

  function levelIndexBySnippet(snippetIdx) {
    for (let i = 0; i < state.cfg.levels.length; i += 1) {
      const lv = state.cfg.levels[i];
      if (snippetIdx >= lv.start && snippetIdx < lv.end) return i;
    }
    return state.cfg.levels.length - 1;
  }

  function currentLevel() {
    if (!state.cfg) return null;
    return state.cfg.levels[levelIndexBySnippet(state.idx)] || null;
  }

  function labelOf(target) {
    return target === 'admin' ? 'Tech/Admin-Doku' : 'User/FAQ-Doku';
  }

  function setFeedback(text, ok) {
    el.feedback.textContent = text;
    el.feedback.className = `feedback ${ok ? 'ok' : 'bad'}`;
  }

  function updateHud() {
    document.body.classList.toggle('high-confusion', state.confusion >= 70);

    updateDragState();
    updateReadability();
  }

  function updateDragState() {
    const canDrag = state.started && !state.lock && !state.done && !state.gameOver;
    el.cardNode.classList.toggle('draggable', canDrag);
  }

  function updateReadability() {
    const level = currentLevel();
    const maxMs = level ? level.time_limit_sec * 1000 : 1;
    const progress = 1 - clamp(state.cardTimer / maxMs, 0, 1);
    el.readFill.style.width = `${Math.round(progress * 100)}%`;
  }

  function pushLog(text, level) {
    state.logs.unshift({ text, level, t: (Date.now() / 1000).toFixed(1) });
    if (state.logs.length > 10) state.logs.pop();
  }

  function renderFeed() {
    el.feed.innerHTML = state.logs.map((item) => `<li><strong>${item.level.toUpperCase()}</strong> ${item.text}</li>`).join('');
  }

  function triggerConfusionWave() {
    document.body.classList.add('confusion-wave');
    setTimeout(() => document.body.classList.remove('confusion-wave'), 460);
  }

  function onPointerDown(event) {
    if (!state.started || state.lock || state.done || state.gameOver) return;
    state.touchStartX = event.clientX;
    state.touchCurrentX = event.clientX;
    el.cardNode.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (state.touchStartX == null) return;
    state.touchCurrentX = event.clientX;
    const delta = state.touchCurrentX - state.touchStartX;
    el.cardNode.style.transform = `translateX(${clamp(delta, -110, 110)}px)`;
  }

  function onPointerUp(event) {
    if (state.touchStartX == null) return;
    const delta = state.touchCurrentX - state.touchStartX;
    state.touchStartX = null;
    state.touchCurrentX = 0;

    el.cardNode.style.transform = 'translateX(0px)';
    el.cardNode.releasePointerCapture(event.pointerId);

    if (Math.abs(delta) < 48) return;
    classify(delta < 0 ? 'admin' : 'user');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function renderGameToText() {
    const snippet = currentSnippet();
    const level = currentLevel();
    return JSON.stringify({
      mode: 'doku_zielgruppen_match',
      coordinate_system: 'origin top-left, x right, y down',
      started: state.started,
      done: state.done,
      game_over: state.gameOver,
      level: level ? level.name : null,
      level_index: level ? levelIndexBySnippet(state.idx) : 0,
      card_index: state.idx,
      card_total: state.cfg ? state.cfg.snippets.length : 0,
      score: state.score,
      confusion_percent: Math.round(state.confusion),
      target_doc: level ? level.target_doc : null,
      streak: state.streak,
      timer_ms: Math.round(state.cardTimer),
      current_snippet: snippet ? {
        id: snippet.id,
        badge: snippet.badge,
        text: snippet.text,
        primary: snippet.primary,
        secondary: snippet.secondary || null
      } : null,
      recent_feed: state.logs.slice(0, 4).map((item) => ({
        level: item.level,
        text: item.text
      }))
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0 || !state.started || state.done || state.gameOver) return true;

    state.cardTimer = Math.max(0, state.cardTimer - ms);
    if (state.cardTimer === 0) onTimeout();
    updateHud();
    return true;
  };
})();
