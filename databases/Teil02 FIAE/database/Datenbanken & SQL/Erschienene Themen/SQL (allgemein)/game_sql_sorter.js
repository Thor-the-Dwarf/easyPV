(function () {
    'use strict';

    const state = {
        config: null,
        commands: [],
        sortedCount: 0
    };

    const el = {
        progress: document.getElementById('progress-count'),
        archiveWalls: document.getElementById('archive-walls'),
        workbench: document.getElementById('workbench'),
        infoBar: document.getElementById('info-bar'),
        successOverlay: document.getElementById('success-overlay'),
        btnRestart: document.getElementById('btn-restart')
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'success') {
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        }
    }

    async function init() {
        try {
            const resp = await fetch('game_sql_sorter.json');
            state.config = await resp.json();

            initArchive();
            initWorkbench();

            el.btnRestart.addEventListener('click', () => location.reload());
        } catch (e) {
            console.error("Failed to load game config:", e);
        }
    }

    function initArchive() {
        el.archiveWalls.innerHTML = '';
        state.config.categories.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'shelf-category';
            div.dataset.cat = cat.id;
            div.innerHTML = `
        <div class="shelf-header">
          <span class="shelf-title">${cat.name}</span>
          <span class="shelf-id">${cat.id}</span>
        </div>
        <div class="shelf-slots" id="slots-${cat.id}"></div>
      `;

            setupDropTarget(div);
            el.archiveWalls.appendChild(div);
        });
    }

    function initWorkbench() {
        el.workbench.innerHTML = '';
        // Shuffle commands
        const shuffled = [...state.config.commands].sort(() => Math.random() - 0.5);

        shuffled.forEach(cmd => {
            const stone = document.createElement('div');
            stone.className = 'sql-stone';
            stone.textContent = cmd.name;
            stone.draggable = true;
            stone.dataset.name = cmd.name;
            stone.dataset.cat = cmd.category;
            stone.dataset.info = cmd.info;

            stone.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    name: cmd.name,
                    category: cmd.category
                }));
                el.infoBar.textContent = cmd.info;
            });

            stone.addEventListener('dragend', () => {
                el.infoBar.textContent = "Select a command to categorize.";
            });

            // Mobile Touch Support would need more logic, but for now focus on desktop drag

            el.workbench.appendChild(stone);
        });
    }

    function setupDropTarget(target) {
        target.addEventListener('dragover', (e) => {
            e.preventDefault();
            target.classList.add('highlight');
        });

        target.addEventListener('dragleave', () => {
            target.classList.remove('highlight');
        });

        target.addEventListener('drop', (e) => {
            e.preventDefault();
            target.classList.remove('highlight');

            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const targetCat = target.dataset.cat;

            if (data.category === targetCat) {
                handleCorrect(target, data.name);
            } else {
                handleError(target);
            }
        });
    }

    function handleCorrect(target, name) {
        playSound('success');
        const slotArea = target.querySelector('.shelf-slots');

        // Find matching stone in workbench
        const stone = Array.from(el.workbench.children).find(s => s.dataset.name === name);
        if (stone) {
            stone.classList.add('sorted', stone.dataset.cat.toLowerCase());
            stone.draggable = false;
            slotArea.appendChild(stone);

            state.sortedCount++;
            el.progress.textContent = `${state.sortedCount} / ${state.config.commands.length}`;

            if (state.sortedCount === state.config.commands.length) {
                setTimeout(() => el.successOverlay.classList.remove('hidden'), 500);
            }
        }
    }

    function handleError(target) {
        playSound('error');
        target.classList.add('error-shake'); // Would need CSS
        // Using alert as per plan for simple feedback
        alert("Incorrect Category. Re-examine the command function.");
    }

    init();
})();
