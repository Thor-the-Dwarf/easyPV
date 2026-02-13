(function () {
    'use strict';

    const state = {
        config: null,
        levelIdx: 0,
        filledSlots: 0,
        currentStatement: "",
        gameOver: false
    };

    const el = {
        levelTitle: document.getElementById('level-title'),
        loadingDock: document.getElementById('loading-dock'),
        packageYard: document.getElementById('package-yard'),
        syntaxPreview: document.getElementById('syntax-preview'),
        resultOverlay: document.getElementById('result-overlay'),
        btnNext: document.getElementById('btn-next')
    };

    // Audio Context for feedback sounds
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playTone(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'snap') {
            osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_value_match.json');
            state.config = await resp.json();

            el.btnNext.addEventListener('click', () => {
                el.resultOverlay.classList.add('hidden');
                if (state.levelIdx < state.config.levels.length - 1) {
                    startLevel(state.levelIdx + 1);
                } else {
                    window.location.reload();
                }
            });

            startLevel(0);
        } catch (e) {
            console.error("Failed to load game config:", e);
        }
    }

    function startLevel(idx) {
        state.levelIdx = idx;
        state.filledSlots = 0;
        state.gameOver = false;

        const level = state.config.levels[idx];
        el.levelTitle.textContent = `Unit ${idx + 1}: ${level.title}`;

        renderDock(level);
        renderYard(level);
        updateSyntax(level);
    }

    function renderDock(level) {
        el.loadingDock.innerHTML = '';
        level.columns.forEach((col, i) => {
            const div = document.createElement('div');
            div.className = 'column-container';
            div.innerHTML = `
        <div class="column-header">
          <span class="column-name">${col.name}</span>
          <span class="column-type">${col.type}</span>
        </div>
        <div class="drop-zone" data-type="${col.type}" data-idx="${i}">
           <div class="column-icon">${col.icon}</div>
        </div>
      `;
            setupDropZone(div.querySelector('.drop-zone'));
            el.loadingDock.appendChild(div);
        });
    }

    function renderYard(level) {
        el.packageYard.innerHTML = '';
        // Shuffle packages for better game feel
        const shuffled = [...level.packages].sort(() => Math.random() - 0.5);

        shuffled.forEach(pkg => {
            const div = document.createElement('div');
            div.className = 'data-package';
            div.draggable = true;
            div.textContent = pkg.label;
            div.dataset.type = pkg.type;
            div.dataset.value = pkg.value;

            const typeLabel = document.createElement('span');
            typeLabel.className = 'type-label';
            typeLabel.textContent = pkg.type;
            div.appendChild(typeLabel);

            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify(pkg));
                // Using a global trick to handle the element hiding during drag if needed
            });

            el.packageYard.appendChild(div);
        });
    }

    function setupDropZone(zone) {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('hover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('hover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('hover');

            const pkg = JSON.parse(e.dataTransfer.getData('text/plain'));
            const targetType = zone.dataset.type;

            if (validateType(pkg.type, targetType)) {
                acceptPackage(zone, pkg);
            } else {
                rejectPackage(zone);
            }
        });
    }

    function validateType(pkgType, targetType) {
        // Basic mapping check
        if (pkgType === targetType) return true;
        // Allow DECIMAL in INT for simplification? No, stay strict as per GamePlan.
        return false;
    }

    function acceptPackage(zone, pkg) {
        if (zone.classList.contains('filled')) return; // Already filled

        zone.classList.add('filled');
        zone.innerHTML = `<div class="data-package" style="cursor:default; margin:0; width:100%">${pkg.label}</div>`;
        playTone('snap');

        state.filledSlots++;

        // Update syntax preview
        updateSyntaxValue(zone.dataset.idx, pkg.label);

        checkWinCondition();
    }

    function rejectPackage(zone) {
        playTone('error');
        const parent = zone.closest('.column-container');
        parent.classList.add('shake');
        setTimeout(() => parent.classList.remove('shake'), 500);
    }

    function updateSyntax(level) {
        const colNames = level.columns.map(c => c.name).join(', ');
        el.syntaxPreview.innerHTML = `
      <span class="syntax-keyword">INSERT INTO</span> 
      <span class="syntax-text">${level.tableName}</span> 
      <span class="syntax-text">(${colNames})</span> 
      <span class="syntax-keyword">VALUES</span> 
      <span class="syntax-text">(</span>
      <span id="syntax-values">...</span>
      <span class="syntax-text">);</span>
    `;

        // Create placeholders for values
        const valSpan = document.getElementById('syntax-values');
        valSpan.innerHTML = level.columns.map((c, i) => `<span id="val-slot-${i}" class="syntax-value">?</span>`).join(', ');
    }

    function updateSyntaxValue(idx, label) {
        const slot = document.getElementById(`val-slot-${idx}`);
        if (slot) slot.textContent = label;
    }

    function checkWinCondition() {
        const level = state.config.levels[state.levelIdx];
        if (state.filledSlots === level.columns.length) {
            state.gameOver = true;
            playTone('success');
            setTimeout(() => {
                el.resultOverlay.classList.remove('hidden');
            }, 1000);
        }
    }

    init();
})();
