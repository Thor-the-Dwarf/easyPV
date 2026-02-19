/**
 * Widerstands-Radar - Game Logic
 * Identifying stakeholders who resist change.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const grid = document.getElementById('participants-grid');
  const radarCount = document.getElementById('radar-count');
  const instructionEl = document.getElementById('instruction');
  const feedbackArea = document.getElementById('feedback-area');
  const finishBtn = document.getElementById('finish-btn');
  const resetBtn = document.getElementById('reset-btn');

  // State
  let gameState = {
    data: null,
    foundCount: 0,
    wrongCount: 0,
    maxResistance: 3,
    clickedIds: new Set(),
    solved: false,
    simulatedMs: 0
  };

  // Load Data
  fetch('_data/_g01_widerstands_radar.json')
    .then(r => r.json())
    .then(data => initGame(data))
    .catch(err => console.error("Load failed:", err));

  function initGame(data) {
    gameState.data = data;
    document.getElementById('game-title').innerText = data.gameTitle;
    document.getElementById('game-subtitle').innerText = data.gameSubtitle;
    instructionEl.innerText = data.instruction;

    renderParticipants();

    resetBtn.addEventListener('click', resetGame);
    finishBtn.addEventListener('click', finishMeeting);
  }

  function renderParticipants() {
    grid.innerHTML = '';
    // Randomize list position to avoid patterns
    const participants = [...gameState.data.participants].sort(() => Math.random() - 0.5);

    participants.forEach(p => {
      const wrapper = document.createElement('div');
      wrapper.className = 'avatar-wrapper';
      wrapper.id = `part-${p.id}`;

      const icons = ["👤", "👥", "🤵", "👩‍💼", "👨‍💻", "👩‍🔬"];
      const icon = icons[Math.floor(Math.random() * icons.length)];

      wrapper.innerHTML = `
                <div class="role-label">${p.role}</div>
                <div class="speech-bubble">"${p.statement}"</div>
                <div class="avatar-circle">${icon}</div>
                <div class="avatar-name">${p.name}</div>
            `;

      wrapper.addEventListener('click', () => handleParticipantClick(p));
      grid.appendChild(wrapper);
    });
  }

  function handleParticipantClick(p) {
    if (gameState.solved || gameState.clickedIds.has(p.id)) return;

    gameState.clickedIds.add(p.id);
    const el = document.getElementById(`part-${p.id}`);

    if (p.isResistance) {
      gameState.foundCount++;
      el.classList.add('found');
    } else {
      gameState.wrongCount++;
      el.classList.add('wrong');
    }

    updateUI();
  }

  function updateUI() {
    radarCount.innerText = `${gameState.foundCount}/${gameState.maxResistance}`;

    if (gameState.foundCount === gameState.maxResistance) {
      finishBtn.disabled = false;
    }
  }

  function finishMeeting() {
    gameState.solved = true;
    finishBtn.disabled = true;

    let score = Math.max(0, (gameState.foundCount - gameState.wrongCount / 2) / gameState.maxResistance * 100);
    let msg;

    if (gameState.wrongCount === 0 && gameState.foundCount === gameState.maxResistance) {
      msg = gameState.data.scoring.perfect;
      feedbackArea.style.background = 'hsl(var(--success) / 0.1)';
      feedbackArea.style.color = 'green';
    } else if (gameState.foundCount === gameState.maxResistance) {
      msg = gameState.data.scoring.partial;
      feedbackArea.style.background = 'hsl(var(--warning) / 0.1)';
      feedbackArea.style.color = 'orange';
    } else {
      msg = gameState.data.scoring.fail;
      feedbackArea.style.background = 'hsl(var(--error) / 0.1)';
      feedbackArea.style.color = 'red';
    }

    feedbackArea.innerText = msg;
  }

  function resetGame() {
    gameState.foundCount = 0;
    gameState.wrongCount = 0;
    gameState.clickedIds.clear();
    gameState.solved = false;

    radarCount.innerText = `0/${gameState.maxResistance}`;
    feedbackArea.innerText = "";
    feedbackArea.style.background = 'transparent';
    finishBtn.disabled = true;

    renderParticipants();
  }

  function computeProgressPercent() {
    const total = Number(gameState.maxResistance) || 0;
    if (!total) return 0;
    const base = Math.round((Math.min(gameState.foundCount, total) / total) * 100);
    return gameState.solved ? 100 : base;
  }

  function renderGameToText() {
    const payload = {
      mode: gameState.solved ? 'result' : 'play',
      progress_percent: computeProgressPercent(),
      found_count: gameState.foundCount,
      wrong_count: gameState.wrongCount,
      target_count: Number(gameState.maxResistance) || 0,
      clicked_count: gameState.clickedIds.size,
      solved: Boolean(gameState.solved),
      simulated_ms: gameState.simulatedMs
    };
    return JSON.stringify(payload);
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = function advanceTime(ms) {
    const deltaMs = Math.max(0, Number(ms) || 0);
    gameState.simulatedMs += deltaMs;
    return gameState.simulatedMs;
  };
});
