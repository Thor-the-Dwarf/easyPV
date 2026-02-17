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

    function playSound(freq, type = 'sine', duration = 0.2) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    async function init() {
        try {
            const resp = await fetch('_data/_gg01_sql_sorter.json');
            state.config = await resp.json();

            initArchive();
            initWorkbench();

            el.btnRestart.onclick = () => location.reload();
        } catch (e) { console.error(e); }
    }

    function initArchive() {
        el.archiveWalls.innerHTML = '';
        state.config.categories.forEach(cat => {
            const shelf = document.createElement('div');
            shelf.className = `archive-shelf`;
            shelf.dataset.cat = cat.id;
            shelf.innerHTML = `
                <div class="shelf-header cat-${cat.id.toLowerCase()}">
                    <span class="shelf-title">${cat.name}</span>
                    <span class="shelf-id">${cat.id}</span>
                </div>
                <div class="shelf-slots" id="slots-${cat.id}"></div>
            `;
            setupDropTarget(shelf);
            el.archiveWalls.appendChild(shelf);
        });
    }

    function initWorkbench() {
        el.workbench.innerHTML = '';
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
                el.infoBar.textContent = `[ARCHIVE_LORE]: ${cmd.info}`;
                el.infoBar.style.color = 'var(--gold-accent)';
                stone.style.opacity = '0.5';
            });

            stone.addEventListener('dragend', () => {
                stone.style.opacity = '1';
                el.infoBar.textContent = 'SELECT_A_COMMAND_TO_CATEGORIZE...';
                el.infoBar.style.color = '';
            });

            // Touch support placeholder logic if needed
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

            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const targetCat = target.dataset.cat;

                if (data.category === targetCat) {
                    handleCorrect(target, data.name);
                } else {
                    handleError(target);
                }
            } catch (err) { console.error('Drop Data Error'); }
        });
    }

    function handleCorrect(target, name) {
        playSound(440, 'sine', 0.2); // Success thud
        const slotArea = target.querySelector('.shelf-slots');
        const stoneInWorkbench = Array.from(el.workbench.children).find(s => s.dataset.name === name);

        if (stoneInWorkbench) {
            stoneInWorkbench.classList.add('sorted');
            stoneInWorkbench.draggable = false;
            slotArea.appendChild(stoneInWorkbench);

            state.sortedCount++;
            el.progress.textContent = `${state.sortedCount} / ${state.config.commands.length}`;

            if (state.sortedCount === state.config.commands.length) {
                playSound(880, 'square', 0.5);
                setTimeout(() => el.successOverlay.classList.remove('hidden'), 500);
            }
        }
    }

    function handleError(target) {
        playSound(110, 'sawtooth', 0.4);
        target.classList.add('error-shake');
        setTimeout(() => target.classList.remove('error-shake'), 400);

        // As per rule 9: visual UI message instead of just console
        el.infoBar.textContent = '!!!_CATEGORIZATION_ERROR:_MISALIGNED_SCHEMA_KIND_!!!';
        el.infoBar.style.color = 'var(--neon-tcl)';
    }

    function computeProgressPercent() {
        const total = state.config && Array.isArray(state.config.commands) ? state.config.commands.length : 0;
        if (total <= 0) return 0;
        return Math.round(Math.max(0, Math.min(1, state.sortedCount / total)) * 100);
    }

    window.render_game_to_text = function renderGameToText() {
        const total = state.config && Array.isArray(state.config.commands) ? state.config.commands.length : 0;
        return JSON.stringify({
            mode: state.sortedCount >= total && total > 0 ? 'result' : 'sorting',
            measurable: true,
            coordinate_system: 'origin top-left, x right, y down',
            sorted_count: state.sortedCount,
            total_commands: total,
            progress_percent: computeProgressPercent(),
            overlay_open: el.successOverlay ? !el.successOverlay.classList.contains('hidden') : false
        });
    };

    window.advanceTime = function advanceTime() {
        return true;
    };

    init();
})();
