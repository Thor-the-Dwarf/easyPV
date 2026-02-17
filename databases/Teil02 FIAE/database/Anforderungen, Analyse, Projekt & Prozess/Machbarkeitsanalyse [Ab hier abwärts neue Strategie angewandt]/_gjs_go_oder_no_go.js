(function () {
  'use strict';

  const state = {
    config: null,
    scenarios: [],
    currentIndex: 0,
    score: 0,
    streak: 0,
    riskLevel: 0, // 0-100
    pressureLevel: 0, // 0-100
    isLocked: false,
    gameOver: false,
    history: []
  };

  const el = {
    score: document.getElementById('score-val'),
    riskBar: document.getElementById('risk-bar'),
    pressureBar: document.getElementById('pressure-bar'),
    scenarioCard: document.getElementById('scenario-card'),
    scenarioTitle: document.getElementById('scenario-title'),
    scenarioDesc: document.getElementById('scenario-desc'),
    factGrid: document.getElementById('fact-grid'),
    gateContainer: document.getElementById('gate-container'),
    feedbackOverlay: document.getElementById('feedback-overlay'),
    crashEffect: document.getElementById('crash-effect'),
    resultScreen: document.getElementById('result-screen'),
    finalScore: document.getElementById('final-score'),
    restartBtn: document.getElementById('restart-btn'),
    btnGo: document.getElementById('btn-go'),
    btnNoGo: document.getElementById('btn-nogo')
  };

  // Sound effects (simple oscillator)
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playTone(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'fail') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'gate') {
       osc.frequency.setValueAtTime(200, audioCtx.currentTime);
       gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
       gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
       osc.start();
       osc.stop(audioCtx.currentTime + 0.5);
    }
  }

  async function init() {
    try {
      const resp = await fetch('_data/_gg01_go_oder_no_go.json');
      if (!resp.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      state.config = await resp.json();
      startGame();
    } catch (e) {
      console.error(e);
      el.scenarioTitle.textContent = 'Fehler beim Laden';
      el.scenarioDesc.textContent = e.message;
    }

    el.btnGo.addEventListener('click', () => handleDecision('GO'));
    el.btnNoGo.addEventListener('click', () => handleDecision('NO-GO'));
    el.restartBtn.addEventListener('click', startGame);
  }

  function startGame() {
    state.scenarios = shuffle([...state.config.scenarios]);
    state.currentIndex = 0;
    state.score = 0;
    state.streak = 0;
    state.gameOver = false;
    state.isLocked = false;
    state.history = [];

    el.resultScreen.classList.remove('active');
    el.resultScreen.classList.add('hidden');
    el.gateContainer.classList.remove('gate-open');
    
    updateHUD();
    renderScenario();
  }

  function renderScenario() {
    if (state.currentIndex >= state.scenarios.length) {
      endGame();
      return;
    }

    const scenario = state.scenarios[state.currentIndex];
    state.riskLevel = scenario.risk_level;
    state.pressureLevel = scenario.pressure;
    updateHUD();

    // Animate Card Entry
    el.scenarioCard.classList.add('hidden');
    setTimeout(() => {
      el.scenarioTitle.textContent = scenario.title;
      el.scenarioDesc.textContent = scenario.description;
      
      el.factGrid.innerHTML = scenario.facts.map(f => `
        <div class="fact-item">
          <div class="fact-icon">${f.icon}</div>
          <div class="fact-text">${f.text}</div>
        </div>
      `).join('');

      el.scenarioCard.classList.remove('hidden');
    }, 300);
  }

  function handleDecision(decision) {
    if (state.isLocked || state.gameOver) return;
    state.isLocked = true;

    const scenario = state.scenarios[state.currentIndex];
    const correct = scenario.correct_decision === decision;
    
    state.history.push({
      scenario: scenario.title,
      decision: decision,
      correct: correct
    });

    if (decision === 'GO') {
      // Gate Animation
      playTone('gate');
      el.gateContainer.classList.add('gate-open');
    }

    setTimeout(() => {
      if (correct) {
        handleSuccess(decision);
      } else {
        handleFailure(decision);
      }
    }, 600); // Wait for gate or immediate "block"
  }

  function handleSuccess(decision) {
    playTone('success');
    state.score += 1000 + (state.streak * 100);
    state.streak++;
    
    showFeedback('success', decision === 'GO' ? 'GO! SUCCESS' : 'BLOCKED! SAFE');
    
    nextRound();
  }

  function handleFailure(decision) {
    playTone('fail');
    state.streak = 0;
    state.score = Math.max(0, state.score - 500);

    if (decision === 'GO') {
      // Crash!
      triggerCrash();
      showFeedback('fail', 'CRASH!');
    } else {
      // Missed Opportunity
      showFeedback('fail', 'MISSED CHANCE');
    }
    
    nextRound();
  }

  function triggerCrash() {
    el.crashEffect.classList.add('active');
    // Rumble effect on body could be added here
    setTimeout(() => el.crashEffect.classList.remove('active'), 500);
  }

  function showFeedback(type, text) {
    el.feedbackOverlay.textContent = text;
    el.feedbackOverlay.className = `feedback-overlay show ${type}`;
    setTimeout(() => {
      el.feedbackOverlay.classList.remove('show');
    }, 1500);
  }

  function nextRound() {
    setTimeout(() => {
      el.gateContainer.classList.remove('gate-open');
      state.currentIndex++;
      state.isLocked = false;
      renderScenario();
    }, 2000);
  }

  function endGame() {
    state.gameOver = true;
    el.finalScore.textContent = state.score;
    el.resultScreen.classList.remove('hidden');
    // slight delay to allow display
    requestAnimationFrame(() => el.resultScreen.classList.add('active'));
  }

  function updateHUD() {
    el.score.textContent = state.score;
    el.riskBar.style.width = `${state.riskLevel}%`;
    el.pressureBar.style.width = `${state.pressureLevel}%`;
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // --- External Interface ---
  window.render_game_to_text = function() {
    return JSON.stringify({
      mode: state.gameOver ? 'result' : 'playing',
      score: state.score,
      streak: state.streak,
      current_scenario: state.scenarios[state.currentIndex] ? state.scenarios[state.currentIndex].title : null,
      history: state.history
    }, null, 2);
  };
  
  window.advanceTime = function() {
    // For automated testing
    return true;
  };

  init();

})();
